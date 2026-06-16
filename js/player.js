//player.js

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToPlaybackRate(midi, rootMidi = 60) {
    return Math.pow(2, (midi - rootMidi) / 12);
}

function resetSynthLoopState() {
    audioTracks.forEach(track => {
        if (track.type !== 'synth') return;

        track.notes.forEach(note => {
            note._playing = false;
        });
    });
}

function getNotePitches(note) {
    if (note.mode === 'chord' && Array.isArray(note.pitches)) {
        return note.pitches;
    }
    return [note.pitch ?? 60];
}

function applyADSR(gainNode, track, note, startTime, duration, velocity = 1) {
    
    const attack  = note?.attack  ?? track.settings.attack ?? 0.01;
    const decay   = note?.decay   ?? track.settings.decay ?? 0.0;
    const sustain = note?.sustain ?? track.settings.sustain ?? 1.0;
    const release = note?.release ?? track.settings.release ?? 1.0;

    const peak = velocity;
    const sustainLevel = peak * sustain;

    const aEnd = startTime + attack;
    const dEnd = aEnd + decay;
    const rStart = Math.max(startTime + duration - release, dEnd);

    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peak, aEnd);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, dEnd);
    gainNode.gain.setValueAtTime(sustainLevel, rStart);
    gainNode.gain.linearRampToValueAtTime(0, rStart + release);
}

function hasVelocityEnvelope(note) {
    return Array.isArray(note?.velEnv) && note.velEnv.length >= 2;
}

function applyVelocityEnvelope(
    gain,
    velEnv,
    startTime,
    duration,
    baseVelocity = 1
) {
    gain.gain.cancelScheduledValues(startTime);

    velEnv.forEach((p, i) => {
        const t = startTime + (p.t * duration);
        const v = Math.max(0, p.v * baseVelocity);

        if (i === 0) {
            gain.gain.setValueAtTime(v, t);
        } else {
            gain.gain.linearRampToValueAtTime(v, t);
        }
    });
}

function playAllTracks() {
    if (isPlaying) return;
    isPlaying = true;
    playStartTime = audioContext.currentTime;
    playheadStartTime = playStartTime;
    
    nextNoteTime = pausedAt;
    schedulerTimer = setInterval(scheduleSteps, SCHEDULER_INTERVAL);
    
    const bpm = getBPM();
    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = resolution / 4; 
    const secondsPerStep = secondsPerBeat / stepsPerBeat;
    
    if(metronomeActive){
        stopMetronome();
        startMetronome();
    }

    audioTracks.forEach(track => {
        syncTrackSettings(track); 
        track.activeSources = [];

        if (track.type === 'instrument' || track.type === 'synth') {
            
        } else {
            if (track.type === 'audio') {

                track.clips.forEach(clip => {
            
                    if (!clip.buffer) return;
                    if (!track._canPlay) return;
            
                    const playheadTime = pausedAt;
            
                    const clipStart = clip.startOffset;
                    const clipEnd = clip.startOffset + (clip.trimEnd - clip.trimStart);
            
                    if (playheadTime >= clipEnd) return;
            
                    if (playheadTime < clipStart) {
                        scheduleClipPlayback(track, clip, clipStart, 0);
                    } else {
                        const offsetIntoClip = playheadTime - clipStart;
                        scheduleClipPlayback(track, clip, playheadTime, offsetIntoClip);
                    }
            
                });
            }

        }
    });
    animatePlayhead();
}

function scheduleClipPlayback_L(track, clip, timelineStart, offsetIntoClip) {

    const source = audioContext.createBufferSource();
    source.buffer = clip.buffer;

    const pitch = clip.effects?.pitch ?? 1;
    source.playbackRate.value = pitch;

    const clipGain = audioContext.createGain();
    const clipPan = audioContext.createStereoPanner();

    clipPan.pan.value = clip.effects?.pan ?? 0;

    source.connect(clipGain);
    clipGain.connect(clipPan);
    clipPan.connect(track.effects?.inputNode || masterBus.input);

    const clipDuration = clip.trimEnd - clip.trimStart;
    const sourceDuration = clip.buffer.duration;

    const loopOffset = (clip.trimStart + offsetIntoClip) % sourceDuration;

    const remaining = clipDuration - offsetIntoClip;

    source.loop = true;
    source.loopStart = clip.trimStart % sourceDuration;
    source.loopEnd = sourceDuration;

    source.start(
        audioContext.currentTime + (timelineStart - pausedAt),
        loopOffset
    );

    source.stop(
        audioContext.currentTime +
        (timelineStart - pausedAt) +
        remaining
    );

    track.activeSources.push(source);
}

function scheduleClipPlayback(track, clip, timelineStart, offsetIntoClip) {
    if (!clip.buffer) return;

    const audioCtx = audioContext; // your global AudioContext

    const source = audioCtx.createBufferSource();
    source.buffer = clip.buffer;

    // Pitch
    const pitch = clip.effects?.pitch ?? 1;
    source.playbackRate.value = pitch;

    // Volume (Gain)
    const clipGain = audioCtx.createGain();
    clipGain.gain.value = clip.effects?.volume ?? 1;

    // Pan
    const clipPan = audioCtx.createStereoPanner();
    clipPan.pan.value = clip.effects?.pan ?? 0;

    // Fade In / Fade Out
    const fadeInTime = clip.effects?.fadeIn ?? 0;
    const fadeOutTime = clip.effects?.fadeOut ?? 0;
    const clipDuration = clip.trimEnd - clip.trimStart;

    const startTime = audioCtx.currentTime + (timelineStart - pausedAt || 0);
    const endTime = startTime + clipDuration;

    // Apply fades to clipGain
    if (fadeInTime > 0) {
        clipGain.gain.setValueAtTime(0, startTime);
        clipGain.gain.linearRampToValueAtTime(clip.effects.volume ?? 1, startTime + fadeInTime);
    } else {
        clipGain.gain.setValueAtTime(clip.effects.volume ?? 1, startTime);
    }

    if (fadeOutTime > 0) {
        clipGain.gain.setValueAtTime(clip.effects.volume ?? 1, endTime - fadeOutTime);
        clipGain.gain.linearRampToValueAtTime(0, endTime);
    }

    // Build the chain
    let lastNode = source;

    // Insert Chorus if enabled
    if (clip.effects?.chorus > 0) {
        const chorus = createChorusNode(audioCtx, {
            rate: 0.5 + clip.effects.chorus * 1.5,
            depth: clip.effects.chorus,
            delayTime: 0.40,
            feedback: 0.3 + clip.effects.chorus * 0.2,
            mix: clip.effects.chorus
        });
        lastNode.connect(chorus.input);
        lastNode = chorus.output;
    }

    // Insert Delay if enabled
    if (clip.effects?.delayTime > 0 || clip.effects?.delayMix > 0) {
        const delayNode = audioCtx.createDelay(2);
        delayNode.delayTime.value = clip.effects.delayTime ?? 0;

        const delayFeedback = audioCtx.createGain();
        delayFeedback.gain.value = clip.effects.delayFeedback ?? 0.3;

        const delayWet = audioCtx.createGain();
        delayWet.gain.value = clip.effects.delayMix ?? 0;

        const delayDry = audioCtx.createGain();
        delayDry.gain.value = 1 - (clip.effects.delayMix ?? 0);

        // Dry path
        lastNode.connect(delayDry);
        delayDry.connect(clipGain);

        // Wet path + feedback
        lastNode.connect(delayNode);
        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        delayNode.connect(delayWet);
        delayWet.connect(clipGain);
    } else {
        lastNode.connect(clipGain);
    }

    // Final routing
    clipGain.connect(clipPan);
    clipPan.connect(track.effects?.inputNode || masterBus.input);

    // Start and stop
    //source.start(startTime, clip.trimStart + offsetIntoClip);
    
    //const clipDuration = clip.trimEnd - clip.trimStart;
    const sourceDuration = clip.buffer.duration;

    const loopOffset = (clip.trimStart + offsetIntoClip) % sourceDuration;

    const remaining = clipDuration - offsetIntoClip;

    source.loop = true;
    source.loopStart = clip.trimStart % sourceDuration;
    source.loopEnd = sourceDuration;

    source.start(
        audioContext.currentTime + (timelineStart - pausedAt),
        loopOffset
    );

    source.stop(
        audioContext.currentTime +
        (timelineStart - pausedAt) +
        remaining
    );
    
    source.stop(endTime);

    track.activeSources = track.activeSources || [];
    track.activeSources.push(source);
}

function stopAllTracks() {
    isPlaying = false;
    
    audioTracks.forEach(track => {
        
        if (track.type === 'synth' && Array.isArray(track.notes)) {
            track.notes.forEach(note => note._playing = false);
        }
        track.clips?.forEach(c => {
            if (c.activeSource) {
                try { c.activeSource.stop(); } catch(e) {}
                c.activeSource = null;
            }
        });

        if (track.activeSources) {
            track.activeSources.forEach(node => {
                try {
                    node.stop();
                    node.disconnect();
                } catch(e) {
                    
                }
            });
            track.activeSources = [];
        }
    });

    pausedAt = 0;
    playhead.style.left = '0px';
    timelineScroll.scrollLeft = 0;
    cancelAnimationFrame(animationFrameId);
    clearInterval(schedulerTimer);
    schedulerTimer = null;
}

function animatePlayhead() {
    if (!isPlaying) return;

    const pps = getPPS();
    const elapsed = audioContext.currentTime - playStartTime;
    let currentTime = pausedAt + elapsed;

    if (loopStart !== null && loopEnd !== null) {

        if (currentTime >= loopEnd) {
    
            if (!loopJustRestarted) {
                loopJustRestarted = true;
    
                pausedAt = loopStart;
                playStartTime = audioContext.currentTime;
    
                stopActiveAudioNodes();
                resetSynthLoopState();
                nextNoteTime = loopStart;
    
                restartAudioClipsAt(loopStart);
    
                playhead.style.left = `${loopStart * pps}px`;
            }
    
            animationFrameId = requestAnimationFrame(animatePlayhead);
            return;
        } else {
            loopJustRestarted = false;
        }
    }

    const contentEnd = getProjectContentEnd();
    if (loopStart === null && currentTime >= contentEnd && contentEnd > 0) {
        stopAllTracks();
        playBtn.src = playIcon;
        return;
    }

    const x = currentTime * pps;
    playhead.style.left = `${x}px`;
    timelineScroll.scrollLeft = Math.max(0, x - timelineScroll.clientWidth / 2);

    animationFrameId = requestAnimationFrame(animatePlayhead);
}

function restartAudioClipsAt(time) {
    const now = audioContext.currentTime;

    audioTracks.forEach(track => {
        if (track.type !== 'audio') return;

        track.clips.forEach(clip => {
            if (!clip.buffer) return;

            const clipDuration =
                clip.trimEnd - clip.trimStart;

            const clipEnd =
                clip.startOffset + clipDuration;

            if (clipEnd <= time) return;

            const pitch = clip.effects?.pitch || 1;

            const offsetIntoClip =
                Math.max(0, time - clip.startOffset);

            const finalOffset =
                clip.trimStart + offsetIntoClip;

            if (finalOffset >= clip.trimEnd) return;

            let startTime = playStartTime + (clip.startOffset - time);

            startTime = Math.max(startTime, now + 0.001);

            const src = audioContext.createBufferSource();
            src.buffer = clip.buffer;
            src.playbackRate.value = pitch;

            const gain = audioContext.createGain();
            gain.gain.value =
                volumeToGain(clip.effects?.volume ?? 1);

            const pan = audioContext.createStereoPanner();
            pan.pan.value = clip.effects?.pan ?? 0;

            src
                .connect(gain)
                .connect(pan)
                .connect(track.effects?.inputNode || masterBus.input);

            const duration =
                (clip.trimEnd - finalOffset) / pitch;

            src.start(startTime, finalOffset, duration);

            track.activeSources.push(src);
        });
    });
}

function pauseAllTracks() {
    if (!isPlaying) return;
    isPlaying = false;

    const elapsed = audioContext.currentTime - playStartTime;
    pausedAt += elapsed; 

    audioTracks.forEach(track => {
        if (track.type === 'synth' && Array.isArray(track.notes)) {
            track.notes.forEach(note => note._playing = false);
        }
        track.clips?.forEach(c => {
            if (c.activeSource) {
                try { c.activeSource.stop(); } catch(e) {}
                c.activeSource = null;
            }
        });

        if (track.activeSources) {
            track.activeSources.forEach(node => {
                try { node.stop(); node.disconnect(); } catch(e) {}
            });
            track.activeSources = [];
        }
    });

    cancelAnimationFrame(animationFrameId);
    playBtn.src = playIcon;
    clearInterval(schedulerTimer);
    schedulerTimer = null;
}

function scheduleSteps() {
    if (!isPlaying) return;

    const now = audioContext.currentTime;
    const bpm = getBPM();

    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = resolution / 4;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;

    while (nextNoteTime < pausedAt + (now - playStartTime) + SCHEDULE_AHEAD_TIME) {
        const stepIndex = Math.round(nextNoteTime / secondsPerStep);
        
        if (metronomeEnabled) {
            const stepsPerBeat = resolution / 4;
            const isBeat = stepIndex % stepsPerBeat === 0;
            const isBar = stepIndex % (stepsPerBeat * 4) === 0;
        
            if (isBeat) {
                const clickTime =
                    playStartTime +
                    (stepIndex * secondsPerStep) -
                    pausedAt;
        
                if (clickTime >= audioContext.currentTime) {
                    playMetronomeClick(clickTime, isBar);
                }
            }
        }

        audioTracks.forEach(track => {
            syncTrackSettings(track);
            //if (track.muted) return;
            if (!track._canPlay) return;
            if (track.type === 'synth') {
                track.notes.forEach(note => {

                    const noteStart =
                        playStartTime +
                        (note.startStep * secondsPerStep) -
                        pausedAt;

                    const noteDuration =
                        note.length * secondsPerStep;

                    const noteEnd =
                        noteStart + noteDuration;

                    if (noteEnd < now || noteStart > now + SCHEDULE_AHEAD_TIME) return;

                    if (note._playing) return;
                    note._playing = true;

                    const velocity = note.velocity ?? 1;
                    const panVal = note.pan ?? track.settings.pan ?? 0;

                    const pitches = getNotePitches(note);

                    let activeVoices = 0;

                    pitches.forEach(midi => {
                        const freq = midiToFreq(midi);

                        if (track.sampleBuffer) {
                            const src = audioContext.createBufferSource();
                            const gain = audioContext.createGain();
                            const pan = audioContext.createStereoPanner();

                            src.buffer = track.sampleBuffer;
                            src.playbackRate.value =
                                midiToPlaybackRate(midi, 60);

                            pan.pan.value = panVal;

                            src
                                .connect(gain)
                                .connect(pan)
                                .connect(track.effects.inputNode);

                            if (hasVelocityEnvelope(note)) {
                                applyVelocityEnvelope(
                                    gain,
                                    note.velEnv,
                                    noteStart,
                                    noteDuration,
                                    velocity
                                );
                            } else {
                                applyADSR(
                                    gain,
                                    track,
                                    note,
                                    noteStart,
                                    noteDuration,
                                    velocity
                                );
                            }

                            if (Array.isArray(note.pitchEnv)) {
                                const baseRate = midiToPlaybackRate(midi, 60);
                                applyPitchEnvelope(
                                    src.playbackRate,
                                    baseRate,
                                    note.pitchEnv,
                                    noteStart,
                                    noteDuration
                                );
                            }

                            src.start(noteStart);
                            src.stop(
                                noteEnd +
                                (note.release ?? track.settings.release ?? 0.2)
                            );

                            track.activeSources.push(src);
                            activeVoices++;

                            src.onended = () => {
                                activeVoices--;
                                if (activeVoices === 0) {
                                    note._playing = false;
                                }
                            };

                            return;
                        }

                        const voices = createSynthVoices(
                            track,
                            note,
                            noteStart,
                            freq,
                            noteDuration,
                            velocity
                        );

                        voices.forEach(v => {
                            activeVoices++;
                            track.activeSources.push(v);

                            v.onended = () => {
                                activeVoices--;
                                if (activeVoices === 0) {
                                    note._playing = false;
                                }
                            };
                        });
                    });
                });

                return;
            }

            if (track.type === 'instrument') {

                const stepIndex =
                    Math.floor(nextNoteTime / secondsPerStep);
            
                const step = normalizeStep(track.steps[stepIndex]);
                if (!step?.active) return;
            
                const baseTime =
                    playStartTime +
                    (stepIndex * secondsPerStep) -
                    pausedAt;
            
                const fire = (time, dur) => {
                    if (track.sampleBuffer) {
                        const src = audioContext.createBufferSource();
                        const g = audioContext.createGain();
                        const pan = audioContext.createStereoPanner();
            
                        src.buffer = track.sampleBuffer;
                        src.playbackRate.value =
                            step.pitch ?? track.settings.pitch ?? 1;
            
                        pan.pan.value =
                            step.pan ?? track.settings.pan ?? 0;
            
                        applyADSR(
                            g,
                            track,
                            step,
                            time,
                            dur,
                            step.velocity ?? 1
                        );
            
                        src
                            .connect(g)
                            .connect(pan)
                            .connect(track.effects?.inputNode || masterBus.input);
            
                        src.start(time);
            
                        track.activeSources.push(src);
                        return;
                    }
            
                    const note = {
                        pitch: 60, // base C
                        velocity: step.velocity ?? 1,
                        pan: step.pan ?? track.settings.pan ?? 0,
                        attack: step.attack ?? track.settings.attack,
                        decay: step.decay ?? track.settings.decay,
                        sustain: step.sustain ?? track.settings.sustain,
                        release: step.release ?? track.settings.release,
                        pitchEnv: step.pitchEnv ?? null,
                        _track: track
                    };
            
                    const pitch =
                        step.pitch ?? track.settings.pitch ?? 1;
            
                    const freq = 440 * pitch;
            
                    const voices = createSynthVoices(
                        track,
                        note,
                        time,
                        freq,
                        dur,
                        note.velocity
                    );
            
                    voices.forEach(v => {
                        track.activeSources.push(v);
                    });
                };
            
                if (step.sub > 1) {
                    const d = secondsPerStep / step.sub;
                    for (let i = 0; i < step.sub; i++) {
                        fire(baseTime + i * d, d);
                    }
                } else {
                    fire(baseTime, secondsPerStep);
                }
            
                return;
            }

        });

        nextNoteTime += secondsPerStep;
    }
}

function playSynthNote(track, step, time, duration) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const pan = audioContext.createStereoPanner();

    osc.type = track.instrument || 'sawtooth';
    osc.frequency.setValueAtTime(
        440 * (step.pitch ?? track.settings.pitch ?? 1),
        time
    );

    pan.pan.value = step.pan ?? track.settings.pan ?? 0;

    osc.connect(gain);
    gain.connect(pan);
    pan.connect(track.effects.inputNode);

    applyADSR(gain, track, time, duration, step.velocity ?? 1);

    osc.start(time);
    osc.stop(time + duration + track.settings.release);

    track.activeSources.push(osc);
}


function playInstrumentHit(track, time) {
    const node = track.sampleBuffer
        ? audioContext.createBufferSource()
        : audioContext.createOscillator();

    if (track.sampleBuffer) {
        node.buffer = track.sampleBuffer;
        node.playbackRate.value = track.settings.pitch ?? 1;
    } else {
        node.type = track.instrument || 'sine';
        node.frequency.setValueAtTime(
            440 * (track.settings.pitch ?? 1),
            time
        );
    }

    if (track.effects?.inputNode) {
        node.connect(track.effects.inputNode);
    } else {
        node.connect(masterBus.input);
    }

    node.start(time);
    if (!track.sampleBuffer) node.stop(time + 0.1);

    track.activeSources.push(node);
}

function previewTrackStep(track, step = {}) {
    if (!track || track.muted) return;

    const now = audioContext.currentTime;

    const velocity = step.velocity ?? 1;
    const pan = step.pan ?? track.settings.pan ?? 0;
    const pitch = step.pitch ?? track.settings.pitch ?? 1;

    // -----------------------------------
    // SAMPLE MODE
    // -----------------------------------
    if (
        track.settings.source === 'sample' &&
        track.sampleBuffer
    ) {
        const source = audioContext.createBufferSource();
        source.buffer = track.sampleBuffer;
        source.playbackRate.value = pitch;

        const gain = audioContext.createGain();
        gain.gain.value =
            (track.settings.volume ?? 1) * velocity;

        const panner = audioContext.createStereoPanner();
        panner.pan.value = pan;

        source.connect(gain);
        gain.connect(panner);

        if (track.effects?.inputNode) {
            panner.connect(track.effects.inputNode);
        } else {
            panner.connect(audioContext.destination);
        }

        applyEnvelope(
            gain,
            track,
            now,
            0.25,
            velocity
        );

        source.start(now);
        source.stop(now + 1);

        return;
    }

    // -----------------------------------
    // OSCILLATOR / SYNTH MODE
    // -----------------------------------
    if (
        track.settings.source === 'oscillator'
    ) {
        const freq = 261.63 * pitch; // middle C preview

        createSynthVoices(
            track,
            now,
            freq,
            0.3,
            velocity
        );

        return;
    }
}

playBtn.addEventListener('click', () => {
  if (!isPlaying) {
        playBtn.src = pauseIcon;
        playAllTracks();
  } else {
        playBtn.src = playIcon;
        pauseAllTracks();
  }
});
 
stopBtn.addEventListener('click', () => {
  playBtn.src = playIcon;
  stopAllTracks();
});

function stopActiveAudioNodes() {
    audioTracks.forEach(track => {
        if (track.activeSources) {
            track.activeSources.forEach(node => {
                try {
                    node.stop();
                    node.disconnect();
                } catch(e) {}
            });
            track.activeSources = [];
        }
    });
}

function previewSynthTrack(track) {
    if (!audioContext || !track) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    stopPreviewSynthTrack();

    const now = audioContext.currentTime;
    const duration = 1.2;
    const freq = midiToFreq(60);

    if (track.settings.source === 'sample' && track.sampleBuffer) {
        return;
    }

    const voices = createSynthVoices(
        track,
        {
            pitch: 60,
            pan: 0,
            attack: track.settings.attack,
            decay: track.settings.decay,
            sustain: track.settings.sustain,
            release: track.settings.release
        },
        now,
        freq,
        duration,
        1
    );

    previewNode = { voices };
}

function stopPreviewSynthTrack() {
    if (!previewNode) return;

    try {
        previewNode.voices?.forEach(v => v.stop());
        previewNode.source?.stop();
    } catch {}

    previewNode = null;
}

function seekToTime(time) {
    time = Math.max(0, time);

    stopActiveAudioNodes();
    resetSynthPlayingFlags();

    pausedAt = time;
    playStartTime = audioContext.currentTime;
    nextNoteTime = time;

    playhead.style.left = (time * getPPS()) + 'px';
}

