// project.js
const tail = 0; 
const duration = getProjectContentEnd() + tail;

async function prepareOfflineIR(ctx) {
    for (const track of audioTracks) {
        if (!track.settings.reverb?.enabled) continue;
        const response = await fetch(track.settings.reverb.irUrl);
        const arrayBuffer = await response.arrayBuffer();

        const decoded = await ctx.decodeAudioData(arrayBuffer);

        track._offlineIR = decoded;
    }
}

function createAudioChainForContext(ctx, masterBus, settings) {
    const inputNode = ctx.createGain();
    const outputGain = ctx.createGain();
    const panNode = ctx.createStereoPanner();

    const eqBands = [60, 250, 1000, 4000, 8000].map((freq, i) => {
        const f = ctx.createBiquadFilter();
        f.type = 'peaking';
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = settings.eq?.[i] ?? 0;
        return f;
    });

    const delayNode = ctx.createDelay(4);
    const delayFeedback = ctx.createGain();
    const delayWet = ctx.createGain();
    const delayDry = ctx.createGain();

    delayNode.delayTime.value = settings.delay?.time ?? 0;
    delayFeedback.gain.value = settings.delay?.feedback ?? 0;
    delayWet.gain.value = settings.delay?.enabled ? settings.delay?.mix ?? 0 : 0;
    delayDry.gain.value = 1;

    const convolver = ctx.createConvolver();
    const reverbWet = ctx.createGain();
    const reverbDry = ctx.createGain();

    reverbWet.gain.value = settings.reverb?.enabled ? settings.reverb?.send ?? 0 : 0;
    reverbDry.gain.value = 1;

    inputNode.connect(eqBands[0]);
    eqBands.reduce((a, b) => (a.connect(b), b));

    const postEQ = eqBands[eqBands.length - 1];

    postEQ.connect(delayDry);
    delayDry.connect(outputGain);

    postEQ.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(outputGain);

    postEQ.connect(reverbDry);
    reverbDry.connect(outputGain);

    postEQ.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(outputGain);

    outputGain.connect(panNode);
    panNode.pan.value = settings.pan ?? 0;
    panNode.connect(masterBus.input);

    return {
        inputNode,
        outputGain,
        delayNode,
        convolver
    };
}

function applyADSR_Offline(ctx, gainNode, track, note, start, duration, velocity = 1) {
    const attack  = note?.attack  ?? track.settings.attack ?? 0.01;
    const decay   = note?.decay   ?? track.settings.decay ?? 0.08;
    const sustain = note?.sustain ?? track.settings.sustain ?? 0.6;
    const release = note?.release ?? track.settings.release ?? 0.12;
    const peak = velocity;
    const sustainLevel = peak * sustain;
    const aEnd = start + attack;
    const dEnd = aEnd + decay;
    const rStart = Math.max(start + duration - release, dEnd);

    const g = gainNode.gain;

    g.cancelScheduledValues(start);
    g.setValueAtTime(0, start);
    g.linearRampToValueAtTime(peak, aEnd);
    g.linearRampToValueAtTime(sustainLevel, dEnd);
    g.setValueAtTime(sustainLevel, rStart);
    g.linearRampToValueAtTime(0, rStart + release);
}

function applyVolumeEnvelopeOffline(gainNode, env, start, duration) {
    if (!Array.isArray(env) || env.length < 2) return;

    const g = gainNode.gain;
    g.cancelScheduledValues(start);

    env.forEach((pt, i) => {
        if (!Number.isFinite(pt.t) || !Number.isFinite(pt.v)) return;

        const t = start + pt.t * duration;
        const v = pt.v;

        if (i === 0) g.setValueAtTime(v, t);
        else g.linearRampToValueAtTime(v, t);
    });
}

function applyPitchEnvelope_Offline(param, baseValue, pitchEnv, startTime, duration) {
    if (!Array.isArray(pitchEnv) || pitchEnv.length < 2) {
        param.setValueAtTime(baseValue, startTime);
        return;
    }

    param.cancelScheduledValues(startTime);

    pitchEnv.forEach((pt, i) => {
        if (!Number.isFinite(pt.t) || !Number.isFinite(pt.v)) return;

        const t = startTime + pt.t * duration;
        const multiplier = Math.pow(2, pt.v / 12);
        const value = baseValue * multiplier;

        if (!Number.isFinite(value)) return;

        if (i === 0) param.setValueAtTime(value, t);
        else param.linearRampToValueAtTime(value, t);
    });
}

function createSynthVoicesOffline(
    ctx,
    track,
    note,
    startTime,
    freq,
    duration,
    velocity,
    destination
) {
    if (!track.settings) track.settings = {};
    if (!track.settings.synth) track.settings.synth = {};

    const synth = track.settings.synth;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();

    if (!synth.filter) {
        synth.filter = {
            type: "lowpass",
            cutoff: 12000,
            resonance: 0
        };
    }

    filter.type = synth.filter.type;
    filter.frequency.setValueAtTime(
        synth.filter.cutoff,
        startTime
    );
    filter.Q.setValueAtTime(
        synth.filter.resonance,
        startTime
    );

    pan.pan.setValueAtTime(
        note.pan ?? track.settings.pan ?? 0,
        startTime
    );

    gain.connect(filter);
    filter.connect(pan);
    pan.connect(destination);

    applyADSR_Offline(
        ctx,
        gain,
        track,
        note,
        startTime,
        duration,
        velocity
    );

    if (synth.effects?.tremolo?.depth > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        lfo.type = "sine";
        lfo.frequency.setValueAtTime(
            synth.effects.tremolo.rate,
            startTime
        );
        lfoGain.gain.setValueAtTime(
            synth.effects.tremolo.depth,
            startTime
        );

        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        lfo.start(startTime);
        lfo.stop(startTime + duration + 0.1);
    }

    if (synth.effects?.wah?.depth > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        lfo.type = "sine";
        lfo.frequency.setValueAtTime(
            synth.effects.wah.rate,
            startTime
        );
        lfoGain.gain.setValueAtTime(
            synth.effects.wah.depth * 2000,
            startTime
        );

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        lfo.start(startTime);
        lfo.stop(startTime + duration + 0.1);
    }

    const unison = Math.max(1, synth.unison ?? 1);
    const spread = synth.spread ?? 0;
    const detune = synth.detune ?? 0;

    for (let i = 0; i < unison; i++) {
        const osc = ctx.createOscillator();
        osc.type = track.instrument ?? "sawtooth";

        const det =
            detune +
            (i - (unison - 1) / 2) * spread;

        osc.detune.setValueAtTime(det, startTime);

        applyPitchEnvelope_Offline(
            osc.frequency,
            freq,
            note.pitchEnv,
            startTime,
            duration
        );

        osc.connect(gain);

        osc.start(startTime);
        osc.stop(
            startTime +
            duration +
            (note.release ?? track.settings.release ?? 0.2)
        );
    }
}

function createFullOfflineTrackChain(ctx, masterBus, track) {
    const settings = track.settings;
    const inputNode = ctx.createGain();
    const outputGain = ctx.createGain();
    const panNode = ctx.createStereoPanner();
    const volumeNode = ctx.createGain();
    volumeNode.gain.value = settings.volume ?? 1;

    const eqBands = [60, 250, 1000, 4000, 8000].map((freq, i) => {
        const f = ctx.createBiquadFilter();
        f.type = "peaking";
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = settings.eq?.[i] ?? 0;
        return f;
    });

    inputNode.connect(eqBands[0]);
    eqBands.reduce((a,b)=>(a.connect(b),b));
    const postEQ = eqBands[eqBands.length - 1];

    const delayNode = ctx.createDelay(4);
    const delayFeedback = ctx.createGain();
    const delayWet = ctx.createGain();
    const delayDry = ctx.createGain();

    delayNode.delayTime.value = settings.delay?.time ?? 0;
    delayFeedback.gain.value = settings.delay?.feedback ?? 0;

    const delayMix = settings.delay?.enabled ? (settings.delay?.mix ?? 0) : 0;

    delayWet.gain.value = delayMix;
    delayDry.gain.value = 1 - delayMix;

    postEQ.connect(delayDry);
    delayDry.connect(volumeNode);

    postEQ.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(volumeNode);
    const convolver = ctx.createConvolver();
    const reverbWet = ctx.createGain();
    const reverbDry = ctx.createGain();

    const reverbMix = settings.reverb?.enabled ? (settings.reverb?.wetGain ?? 0) : 0;

    reverbWet.gain.value = reverbMix;
    reverbDry.gain.value = 1 - reverbMix;

    if (settings.reverb?.enabled) {
        convolver.buffer = track.effects.reverb.convolver.buffer;
    } else {
        convolver.buffer = generateImpulseOffline(ctx, 2.5);
    }

    postEQ.connect(reverbDry);
    reverbDry.connect(volumeNode);
    postEQ.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(volumeNode);
    volumeNode.connect(panNode);
    panNode.pan.value = settings.pan ?? 0;

    panNode.connect(masterBus.input);

    return { inputNode };
}

function generateImpulseOffline(ctx, seconds = 2.5) {
  const length = ctx.sampleRate * seconds;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const decay = Math.exp(-i / (ctx.sampleRate * 0.6));
    left[i] = (Math.random() * 2 - 1) * decay;
    right[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
}

function createMasterBusOffline(ctx) {
    const input = ctx.createGain();
    const eqBands = [60, 250, 1000, 4000, 8000].map((freq, i) => {
        const f = ctx.createBiquadFilter();
        f.type = "peaking";
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = masterBus.settings.eq?.[i] ?? 0;
        return f;
    });

    let node = input;
    eqBands.forEach(eq => {
        node.connect(eq);
        node = eq;
    });

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = masterBus.settings.compressor?.threshold ?? -24;
    compressor.ratio.value = masterBus.settings.compressor?.ratio ?? 4;
    compressor.attack.value = masterBus.settings.compressor?.attack ?? 0.01;
    compressor.release.value = masterBus.settings.compressor?.release ?? 0.15;

    node.connect(compressor);

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.05;

    compressor.connect(limiter);

    const masterVolume = ctx.createGain();
    masterVolume.gain.value = masterBus.settings.volume ?? 1;

    limiter.connect(masterVolume);
    masterVolume.connect(ctx.destination);

    return { input };
}

function scheduleProjectOffline(ctx, masterBus) {
    const bpm = getBPM();
    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = resolution / 4;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;

    audioTracks.forEach(track => {
        if (track.muted) return;

        const chain = createFullOfflineTrackChain(ctx, masterBus, track);

        if (track.type === "instrument") {
            track.steps.forEach((stepData, i) => {
                const step = normalizeStep(stepData);
                if (!step?.active) return;

                const start = i * secondsPerStep;
                const dur = secondsPerStep;
                const gain = ctx.createGain();
                const pan = ctx.createStereoPanner();

                pan.pan.value = step.pan ?? track.settings.pan ?? 0;

                gain.connect(pan);
                pan.connect(chain.inputNode);

                if (track.sampleBuffer) {

                    const src = ctx.createBufferSource();
                    src.buffer = track.sampleBuffer;
                    src.playbackRate.value = step.pitch ?? 1;

                    src.connect(gain);

                    applyADSR_Offline(ctx, gain, track, step, start, dur, step.velocity ?? 1);

                    if (step.velEnv)
                        applyVolumeEnvelopeOffline(gain, step.velEnv, start, dur);

                    src.start(start);
                    src.stop(start + dur + (step.release ?? track.settings.release ?? 0.2));

                } else {

                    const osc = ctx.createOscillator();
                    osc.type = track.settings.oscType ?? "sine";
                    osc.frequency.setValueAtTime(440 * (step.pitch ?? 1), start);

                    osc.connect(gain);

                    applyADSR_Offline(ctx, gain, track, step, start, dur, step.velocity ?? 1);

                    osc.start(start);
                    osc.stop(start + dur + (step.release ?? track.settings.release ?? 0.2));
                }
            });
        }

        if (track.type === "synth") {
            track.notes.forEach(note => {
                const start = note.startStep * secondsPerStep;
                const duration = note.length * secondsPerStep;
                const velocity = note.velocity ?? 1;
                const pitches = getNotePitches(note);
        
                pitches.forEach(midi => {
                    const freq = midiToFreq(midi);
        
                    if (track.sampleBuffer) {
                        const src = ctx.createBufferSource();
                        const gain = ctx.createGain();
                        const pan = ctx.createStereoPanner();
        
                        pan.pan.setValueAtTime(
                            note.pan ?? track.settings.pan ?? 0,
                            start
                        );
        
                        src.buffer = track.sampleBuffer;
        
                        const rate = midiToPlaybackRate(midi, 60);
                        src.playbackRate.setValueAtTime(rate, start);
        
                        src.connect(gain);
                        gain.connect(pan);
                        pan.connect(chain.inputNode);
        
                        applyADSR_Offline(
                            ctx,
                            gain,
                            track,
                            note,
                            start,
                            duration,
                            velocity
                        );
        
                        if (note.velEnv)
                            applyVolumeEnvelopeOffline(
                                gain,
                                note.velEnv,
                                start,
                                duration
                            );
        
                        src.start(start);
                        src.stop(
                            start +
                            duration +
                            (note.release ?? track.settings.release ?? 0.2)
                        );
        
                        return;
                    }
        
                    createSynthVoicesOffline(
                        ctx,
                        track,
                        note,
                        start,
                        freq,
                        duration,
                        velocity,
                        chain.inputNode
                    );
                });
            });
        }

        if (track.type === "audio") {
            track.clips.forEach(clip => {
                if (!clip.buffer) return;
        
                const pitch = clip.effects?.pitch ?? 1;
                const volume = clip.effects?.volume ?? 1;
                const panVal = clip.effects?.pan ?? track.settings.pan ?? 0;
        
                const clipDuration = clip.trimEnd - clip.trimStart;
                const bufferDuration = clip.buffer.duration - clip.trimStart;
        
                if (bufferDuration <= 0) return;
        
                const repeatCount = Math.ceil(clipDuration / bufferDuration);
        
                for (let r = 0; r < repeatCount; r++) {
                    const src = ctx.createBufferSource();
                    src.buffer = clip.buffer;
                    src.playbackRate.value = pitch;
        
                    const clipGain = ctx.createGain();
                    clipGain.gain.value = volume;
                    const clipPan = ctx.createStereoPanner();
                    clipPan.pan.value = panVal;
                    const fadeInTime = clip.effects?.fadeIn ?? 0;
                    const fadeOutTime = clip.effects?.fadeOut ?? 0;
                    const start = (clip.startOffset ?? 0) + (r * bufferDuration);
                    const duration = Math.min(bufferDuration, clipDuration - (r * bufferDuration));
        
                    if (duration <= 0) continue;
        
                    const startTime = start;
                    const endTime = start + duration;
        
                    if (fadeInTime > 0) {
                        clipGain.gain.setValueAtTime(0, startTime);
                        clipGain.gain.linearRampToValueAtTime(volume, startTime + fadeInTime);
                    } else {
                        clipGain.gain.setValueAtTime(volume, startTime);
                    }
        
                    if (fadeOutTime > 0) {
                        clipGain.gain.setValueAtTime(volume, endTime - fadeOutTime);
                        clipGain.gain.linearRampToValueAtTime(0, endTime);
                    }
        
                    src.connect(clipGain);
                    clipGain.connect(clipPan);
                    
                    let lastNode = clipGain;

                    if (clip.effects?.chorus > 0) {
                        const chorus = createChorusNode(ctx, {
                            rate: 0.5 + clip.effects.chorus * 1.5,
                            depth: clip.effects.chorus,
                            delayTime: 0.03,
                            feedback: 0.3 + clip.effects.chorus * 0.2,
                            mix: clip.effects.chorus
                        });
                        lastNode.connect(chorus.input);
                        lastNode = chorus.output;
                    }
                    
                    if (clip.effects?.delayTime > 0 || clip.effects?.delayMix > 0) {
                        const delayNode = ctx.createDelay(2);
                        delayNode.delayTime.value = clip.effects.delayTime ?? 0;
                    
                        const delayFeedback = ctx.createGain();
                        delayFeedback.gain.value = clip.effects.delayFeedback ?? 0.3;
                    
                        const delayWet = ctx.createGain();
                        delayWet.gain.value = clip.effects.delayMix ?? 0;
                    
                        const delayDry = ctx.createGain();
                        delayDry.gain.value = 1 - (clip.effects.delayMix ?? 0);
                    
                        lastNode.connect(delayDry);
                        delayDry.connect(clipPan);
                    
                        lastNode.connect(delayNode);
                        delayNode.connect(delayFeedback);
                        delayFeedback.connect(delayNode);
                        delayNode.connect(delayWet);
                        delayWet.connect(clipPan);
                    } else {
                        lastNode.connect(clipPan);
                    }

                    clipPan.connect(chain.inputNode);
        
                    src.start(startTime, clip.trimStart, duration);
                }
            });
        }
    });
}


async function loadAudioBufferFromProject(trackData) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';

        input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) {
                reject("No audio selected");
                return;
            }

            const arrayBuffer = await file.arrayBuffer();
            const buffer = await audioContext.decodeAudioData(arrayBuffer);
            resolve(buffer);
        };

        input.click();
    });
}

function updateExportProgress(percent) {
    const container = document.getElementById('export-progress-container');
    const fill = document.getElementById('export-progress-fill');
    if (container && fill) {
        container.style.display = 'block';
        fill.style.width = percent + '%';
    }
}

async function exportToWav() {
    if (!audioTracks.length) {
        alert("Nothing to export.");
        return;
    }

    const reverbTail = 0;
    const duration = getProjectContentEnd() + reverbTail;

    const sampleRate = 48000;
    const length = Math.ceil(duration * sampleRate);

    const offlineCtx = new OfflineAudioContext(
        2,
        length,
        sampleRate
    );

    const masterBus = createMasterBusOffline(offlineCtx);
    scheduleProjectOffline(offlineCtx, masterBus);

    updateExportProgress?.(20);
    const renderedBuffer = await offlineCtx.startRendering();

    updateExportProgress?.(85);
    const wavBlob = bufferToWave(renderedBuffer);
    downloadBlob(wavBlob, `${projectName || "MR_Studio_Project"}.wav`);
    updateExportProgress?.(100);
    setTimeout(() => updateExportProgress?.(0), 1500);
}


function bufferToWave(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);

    let offset = 0;
    let pos = 0;

    function writeString(s) {
        for (let i = 0; i < s.length; i++)
            view.setUint8(pos++, s.charCodeAt(i));
    }

    writeString("RIFF");
    view.setUint32(pos, length - 8, true); pos += 4;
    writeString("WAVE");
    writeString("fmt ");
    view.setUint32(pos, 16, true); pos += 4;
    view.setUint16(pos, 1, true); pos += 2;
    view.setUint16(pos, numOfChan, true); pos += 2;
    view.setUint32(pos, buffer.sampleRate, true); pos += 4;
    view.setUint32(pos, buffer.sampleRate * 2 * numOfChan, true); pos += 4;
    view.setUint16(pos, numOfChan * 2, true); pos += 2;
    view.setUint16(pos, 16, true); pos += 2;
    writeString("data");
    view.setUint32(pos, buffer.length * numOfChan * 2, true); pos += 4;

    const channels = [];
    for (let i = 0; i < numOfChan; i++)
        channels.push(buffer.getChannelData(i));

    while (offset < buffer.length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = channels[i][offset];
            sample = Math.max(-1, Math.min(1, sample));
            view.setInt16(pos, sample * 0x7FFF, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
}

function saveProjectData() {
    if (!audioTracks.length) {
        alert("Nothing to save.");
        return;
    }

    const safeName = (projectName || "MR Studio Project")
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    const data = {
        version: "SoundEngine-v1",
        name: projectName || "Untitled",
        safeName: safeName,
        bpm: getBPM(),
        resolution: resolution,
        totalSeconds: getProjectContentEnd(),
        masterSettings: masterBus?.settings ? structuredClone(masterBus.settings) : {}, // optional
        tracks: audioTracks.map(t => ({
            type: t.type,
            name: t.label?.dataset.name || "Track",
            muted: t.muted,
            solo: t.solo,
            instrument: t.instrument, // name
            libraryPath: t.libraryPath || null, // ← NEW: save full path (e.g. "./samples/kick_1.wav")
            settings: structuredClone(t.settings || {}),
            steps: t.type === 'instrument' ? structuredClone(t.steps || []) : null,
            notes: t.type === 'synth' ? (t.notes || []).map(n => ({
                startStep: n.startStep,
                length: n.length,
                mode: n.mode ?? "single",
                pitch: n.pitch ?? null,
                pitches: Array.isArray(n.pitches) ? structuredClone(n.pitches) : null,
                velocity: n.velocity,
                pan: n.pan,
                attack: n.attack,
                decay: n.decay,
                sustain: n.sustain,
                release: n.release,
                velEnv: n.velEnv ? structuredClone(n.velEnv) : null,
                pitchEnv: n.pitchEnv ? structuredClone(n.pitchEnv) : null
            })) : null,
            clips: t.type === 'audio' ? (t.clips || []).map(c => ({
                startOffset: c.startOffset,
                trimStart: c.trimStart,
                trimEnd: c.trimEnd,
                effects: structuredClone(c.effects || {}),
                libraryPath: c.libraryPath || null // ← NEW for audio clips
            })) : null
        }))
    };

    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(jsonBlob, `${safeName}.json`);

}

function downloadBlob(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

async function loadProjectData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const project = JSON.parse(e.target.result);
            if (!project.version || !project.tracks) {
                throw new Error("Invalid project file");
            }

            stopAllTracks();
            tracksContainer.innerHTML = '';
            document.querySelectorAll('.track-label').forEach(el => el.remove());
            audioTracks.length = 0;

            updateBPM(project.bpm || 120);
            resolution = project.resolution || 16;
            totalSeconds = project.totalSeconds || 60;
            projectName = project.name || "Loaded Project";

            for (const t of project.tracks) {
                let track;

                if (t.type === 'instrument') {
                    track = addInstrumentTrack("instrument", t.instrument || "Sine");
                    track.steps = structuredClone(t.steps || []);
                    track.instrument = t.instrument;

                    // Auto-load sample if libraryPath exists
                    if (t.libraryPath) {
                        try {
                            const response = await fetch(t.libraryPath);
                            if (!response.ok) throw new Error("File not found");
                            const arrayBuffer = await response.arrayBuffer();
                            const buffer = await audioContext.decodeAudioData(arrayBuffer);

                            track.sampleBuffer = buffer;
                            track.settings.source = 'sample';
                            track.instrument = t.instrument; // name from JSON
                            // Update label to show loaded sample name
                            const displayName = t.instrument || "Sample";
                            if (track.label && track.label.childNodes[0]) {
                                track.label.childNodes[0].textContent = 
                                    displayName.length > 7 ? `${displayName.slice(0, 7)}..` : displayName;
                            }
                            track.label.title = displayName;
                            track.label.dataset.name = displayName;
                        } catch (err) {
                            console.warn(`Failed to load sample from ${t.libraryPath}:`, err);
                            // Fallback to oscillator (default behavior)
                        }
                    }
                } else if (t.type === 'synth') {
                    track = addInstrumentTrack("synth", t.instrument || "Sawtooth");
                    track.notes = (t.notes || []).map(n => ({
                        ...n,
                        velEnv: n.velEnv ? structuredClone(n.velEnv) : null,
                        pitchEnv: n.pitchEnv ? structuredClone(n.pitchEnv) : null,
                        _track: track
                    }));
                    track.instrument = t.instrument;

                    // Same auto-load logic for synth if it uses sample
                    if (t.libraryPath) {
                        try {
                            const response = await fetch(t.libraryPath);
                            if (!response.ok) throw new Error("File not found");
                            const arrayBuffer = await response.arrayBuffer();
                            const buffer = await audioContext.decodeAudioData(arrayBuffer);

                            track.sampleBuffer = buffer;
                            track.settings.source = 'sample';
                            track.instrument = t.instrument;
                            // Update label
                            const displayName = t.instrument || "Sample";
                            if (track.label && track.label.childNodes[0]) {
                                track.label.childNodes[0].textContent = 
                                    displayName.length > 7 ? `${displayName.slice(0, 7)}..` : displayName;
                            }
                            track.label.title = displayName;
                            track.label.dataset.name = displayName;
                        } catch (err) {
                            console.warn(`Failed to load sample from ${t.libraryPath}:`, err);
                        }
                    }
                } else if (t.type === 'audio') {
                    track = addAudioTrackWithWaveform(null, t.name || "Audio Track");

                    track.clips = [];

                    t.clips.forEach(c => {
                        const clip = {
                            id: "clip_" + crypto.randomUUID(),
                            startOffset: c.startOffset,
                            trimStart: c.trimStart,
                            trimEnd: c.trimEnd,
                            effects: structuredClone(c.effects || {}),
                            buffer: null,
                            color: track.color,
                            track: track,
                            libraryPath: c.libraryPath  // save for later reload
                        };
                        track.clips.push(clip);
                        renderClipPlaceholder(track, clip);
                    });

                    // Auto-reload clip buffers if libraryPath exists
                    for (const clip of track.clips) {
                        if (clip.libraryPath) {
                            try {
                                const response = await fetch(clip.libraryPath);
                                if (!response.ok) throw new Error("File not found");
                                const arrayBuffer = await response.arrayBuffer();
                                clip.buffer = await audioContext.decodeAudioData(arrayBuffer);
                                renderClip(track, clip); // re-render with buffer
                            } catch (err) {
                                console.warn(`Failed to load clip from ${clip.libraryPath}:`, err);
                            }
                        }
                    }
                }

                if (track) {
                    track.muted = !!t.muted;
                    track.solo = !!t.solo;
                    track.instrument = t.instrument;
                    track.settings = structuredClone(t.settings || {});
                    track.libraryPath = t.libraryPath || null; // store for future
                    drawTrackSteps?.(track);
                }
            }

            applyZoom();
            renderGrid();
            renderRuler();

            alert("Project Loaded Successfully: " + projectName);
        } catch (err) {
            console.error("LOAD ERROR:", err);
            alert("Project load failed: " + err.message);
        }
    };
    reader.readAsText(file);
}

function renderClipPlaceholder(track, clip) {
    const container = track.trackElement.querySelector('.waveform');
    if (!container) return;

    const placeholder = document.createElement('div');
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.background = 'rgba(100,100,100,0.3)';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.color = '#888';
    placeholder.textContent = 'Audio missing – re-upload to restore';
    container.appendChild(placeholder);
}

async function reloadAudioBuffers() {
    for (const track of audioTracks) {
        if (track.type !== 'audio' || track.clips.length === 0) continue;

        const trackName = track.label?.dataset.name || 'Untitled Audio Track';
        if (!confirm(`Re-select audio file for track "${trackName}"?`)) continue;

        try {
            const buffer = await loadAudioBufferFromProject(track);
            track.sampleBuffer = buffer;

            track.clips.forEach(clip => {
                clip.buffer = buffer;
                renderClip(track, clip); // now waveform appears
            });

            // Update track width
            const sampleWidth = buffer.duration * getPPS();
            const rulerWidth = totalSeconds * getPPS();
            track.trackElement.style.width = `${Math.max(rulerWidth, sampleWidth)}px`;
        } catch (err) {
            console.error(err);
        }
    }
    applyZoom();
    renderGrid();
    renderRuler();
}
