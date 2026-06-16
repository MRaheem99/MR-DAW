//operator.js

function setLiveParam(param, value, smoothing = 0.03) {
    if (!param || !param.setTargetAtTime) return;

    const now = audioContext.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, smoothing);
}

window.addEventListener('click', () => {
    const menu = document.getElementById('ctx-menu');
    if (menu) menu.remove();
});

addInstrumentBtn.addEventListener('click', () => openAddDrumPopup());
addSynthBtn.addEventListener('click', () => addInstrumentTrack("synth"));

timelineGrid.addEventListener('mousedown', (e) => {
    if (e.target === timelineGrid) clearSelection();
});

document.addEventListener('click', () => {
    if (suppressNextClick) {
        suppressNextClick = false;
        return;
    }
});

function clearRulerSelection() {
    if (selectionDiv) {
        selectionDiv.remove();
        selectionDiv = null;
    }
    loopStart = null;
    loopEnd = null;
}

/*
timelineScroll.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();

    if (zoomRAF) return;

    zoomRAF = requestAnimationFrame(() => {
        const delta = e.deltaY < 0 ? 2 : -2;
        zoomLevel = Math.max(2, Math.min(50, zoomLevel + delta));
        applyZoom();
        zoomRAF = null;
    });
}, { passive: false });
*/

timelineScroll.addEventListener('wheel', (e) => {

    if (!e.ctrlKey) return;

    e.preventDefault();

    if (zoomRAF) return;

    zoomRAF = requestAnimationFrame(() => {

        const MAX_TIMELINE_WIDTH = 63700;

        const ppsBefore = getPPS();
        const mouseX = e.clientX - timelineScroll.getBoundingClientRect().left;
        const scrollLeftBefore = timelineScroll.scrollLeft;

        const timeAtCursor = (scrollLeftBefore + mouseX) / ppsBefore;

        const delta = e.deltaY < 0 ? 2 : -2;
        const newZoom = Math.max(2, Math.min(20, zoomLevel + delta));

        const oldZoom = zoomLevel;
        zoomLevel = newZoom;

        const ppsAfter = getPPS();
        const newTimelineWidth = totalSeconds * ppsAfter;

        // prevent exceeding max width
        if (newTimelineWidth > MAX_TIMELINE_WIDTH) {
            zoomLevel = oldZoom;
            zoomRAF = null;
            return;
        }

        applyZoom();

        // keep zoom centered at mouse
        const newScrollLeft = (timeAtCursor * ppsAfter) - mouseX;
        timelineScroll.scrollLeft = newScrollLeft;

        zoomRAF = null;

    });

}, { passive: false });

timelineRuler.addEventListener('click', (e) => {
    const rect = timelineRuler.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineScroll.scrollLeft;
    pausedAt = x / getPPS();
    playhead.style.left = x + 'px';
});

timelineScroll.addEventListener('touchstart', (e) => {
    if(window.isLassoActive) return;
    if(!window.isMagnetActive){
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].pageX;
            scrollStartX = timelineScroll.scrollLeft;
        } else if (e.touches.length === 2) {
            lastTouchDist = Math.hypot(
                e.touches[1].pageX - e.touches[0].pageX,
                e.touches[1].pageY - e.touches[0].pageY
            );
        }
    }
}, { passive: false });

timelineScroll.addEventListener('touchmove', (e) => {

    if (window.isMagnetActive) return;

    const MAX_TIMELINE_WIDTH = 63700;

    if (e.touches.length === 1) {

        const touchCurrentX = e.touches[0].pageX;
        const dx = touchCurrentX - touchStartX;

        timelineScroll.scrollLeft = scrollStartX - dx;

    }

    else if (e.touches.length === 2) {

        const currentDist = Math.hypot(
            e.touches[1].pageX - e.touches[0].pageX,
            e.touches[1].pageY - e.touches[0].pageY
        );

        if (lastTouchDist > 0) {

            const delta = currentDist - lastTouchDist;

            if (Math.abs(delta) > 5) {

                const zoomFactor = delta > 0 ? 1.1 : 0.9;

                const oldZoom = zoomLevel;
                const newZoom = Math.max(2, Math.min(100, zoomLevel * zoomFactor));

                zoomLevel = newZoom;

                const pps = getPPS();
                const newTimelineWidth = totalSeconds * pps;

                // prevent exceeding max width
                if (newTimelineWidth > MAX_TIMELINE_WIDTH) {
                    zoomLevel = oldZoom;
                    lastTouchDist = currentDist;
                    return;
                }

                applyZoom();

                lastTouchDist = currentDist;
            }
        }
    }

    e.preventDefault();

}, { passive: false });

/*
timelineScroll.addEventListener('touchmove', (e) => {

    if(!window.isMagnetActive){
        if (e.touches.length === 1) {
            const touchCurrentX = e.touches[0].pageX;
            const dx = touchCurrentX - touchStartX;
            timelineScroll.scrollLeft = scrollStartX - dx;
    
        } else if (e.touches.length === 2) {
            const currentDist = Math.hypot(
                e.touches[1].pageX - e.touches[0].pageX,
                e.touches[1].pageY - e.touches[0].pageY
            );
    
            if (lastTouchDist > 0) {
                const delta = currentDist - lastTouchDist;
                
                if (Math.abs(delta) > 5) {
                    const zoomFactor = delta > 0 ? 1.1 : 0.9;
                    const newZoom = zoomLevel * zoomFactor;
                    
                    zoomLevel = Math.max(2, Math.min(100, newZoom));
                    
                    applyZoom();
                    lastTouchDist = currentDist;
                }
            }
        }
        e.preventDefault();
    }
}, { passive: false });

*/

timelineScroll.addEventListener('touchend', () => {
    lastTouchDist = 0;
});

timelineScroll.addEventListener('mousedown', (e) => {
    
    if (e.altKey){
        window.lassoActive = true;
        timelineScroll.className = 'cur-default';

        if (
            e.target === timelineGrid ||
            e.target === timelineScroll ||
            e.target.classList.contains('track')
        ) {
            clearSelection();
        }
    } else {
    
        if (e.ctrlKey && e.button === 0) {
            isCtrlDragging = true;
            suppressNextClick = true;
            clearTimeout(stepHoldTimer);
            stepHoldTimer = null;
            timelineScroll.className = 'cur-grab';
            ctrlDragStartX = e.clientX;
            ctrlScrollStartX = timelineScroll.scrollLeft;
            e.preventDefault();
        }
        if (e.target === timelineGrid || e.target === timelineScroll || e.target.classList.contains('track')) {
            clearSelection();
        }
    }
});

timelineScroll.addEventListener('mousemove', (e) => {
    if (isCtrlDragging) {
        timelineScroll.className = 'cur-grab';
        const dx = e.clientX - ctrlDragStartX;
        timelineScroll.scrollLeft = ctrlScrollStartX - dx;
    }
});
timelineScroll.addEventListener('mouseup', () => {
    isCtrlDragging = false;
    timelineScroll.classList.remove('cur-grab');
});

timelineRuler.addEventListener('click', (e) => {
    const pixelsPerSecond = getPPS();
    const rect = timelineRuler.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedTime = clickX / pixelsPerSecond;
    playhead.style.left = `${clickX}px`;
    pausedAt = clickedTime;
});

timelineRuler.addEventListener('mousedown', (e) => {
    if (!e.shiftKey) return;

    e.preventDefault();

    const rect = timelineRuler.getBoundingClientRect();
    const pps = getPPS();

    const startX = e.clientX - rect.left;
    const startTime = startX / pps;

    clearRulerSelection();

    isSelecting = true;
    loopStart = startTime;
    loopEnd = startTime;

    selectionDiv = document.createElement('div');
    selectionDiv.className = 'ruler-selection';
    selectionDiv.style.left = `${startX}px`;
    selectionDiv.style.width = '0px';

    timelineRuler.appendChild(selectionDiv);
});

document.addEventListener('mousemove', (e) => {
    if (!isSelecting || !selectionDiv) return;

    const rect = timelineRuler.getBoundingClientRect();
    const pps = getPPS();

    const currentX = e.clientX - rect.left;
    const currentTime = currentX / pps;

    const startTime = loopStart;

    const leftTime = Math.min(startTime, currentTime);
    const rightTime = Math.max(startTime, currentTime);

    loopStart = leftTime;
    loopEnd = rightTime;

    selectionDiv.style.left = `${leftTime * pps}px`;
    selectionDiv.style.width = `${(rightTime - leftTime) * pps}px`;
});

document.addEventListener('mouseup', () => {
    if (!isSelecting) return;

    isSelecting = false;

    if (loopEnd - loopStart < 0.05) {
        clearRulerSelection();
        return;
    }

    if (pausedAt < loopStart || pausedAt > loopEnd) {
        pausedAt = loopStart;
        playhead.style.left = `${pausedAt * getPPS()}px`;
    }
});

timelineRuler.addEventListener('dblclick', clearRulerSelection);

timelineScroll.addEventListener('scroll', () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;

    trackLabels.scrollTop = timelineScroll.scrollTop;
    requestAnimationFrame(renderRuler);
    
    audioTracks.forEach(track => {
        if (track.type === 'audio' && track.audioGridCanvas) {
            drawAudioGrid(track);
        }
    });
    isSyncingScroll = false;
});

trackLabels.addEventListener('scroll', () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;

    timelineScroll.scrollTop = trackLabels.scrollTop;

    isSyncingScroll = false;
});
 
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

function getTimelineCoords(clientX, clientY) {
    const rect = timelineScroll.getBoundingClientRect();
    return {
        x: clientX - rect.left + timelineScroll.scrollLeft,
        y: clientY - rect.top + timelineScroll.scrollTop
    };
}

function generateWaveColor() {
    const hue = Math.floor(Math.random() * 360);
    return {
        wave: `hsl(${hue}, 70%, 55%)`,
        label: `hsl(${hue}, 40%, 30%)`
    };
}

document.addEventListener('keydown', e => {
    if (e.key === 'Alt') {
        document.body.classList.add('alt-lasso');
        document.body.classList.add('lasso-active');
    }
});

document.addEventListener('keyup', e => {
    if (e.key === 'Alt') {
        document.body.classList.remove('alt-lasso');
        document.body.classList.remove('lasso-active');
    }
});

projectNameInput.oninput = (e) => {
    window.currentProjectName = e.target.value;
};

document.getElementById('menu-save-btn').onclick = () => {
    saveProjectData();
};

document.getElementById('menu-load-btn').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        loadProjectData(e.target.files[0]);
        document.getElementById('main-menu-popup').style.display = 'none';
    };
    input.click();
};

document.getElementById('menu-export-wav-btn').onclick = () => {
    exportToWav();
};

document.getElementById('main-menu-btn').onclick = () => {
    const popups = document.querySelectorAll('.popup');
    popups.forEach(el => {
        if(el.id != 'main-menu-btn'){
            el.style.zIndex = '100'; 
        } 
    });
        
    document.getElementById('bpm-input').value = getBPM();
    document.getElementById('resolution-select').value = resolution || 16;
    projectNameInput.value = window.currentProjectName;
    const popup = document.getElementById('main-menu-popup');
    const panel = document.getElementById('main-menu-popup-panel');
    const popupHeader = document.getElementById('mainMunuPopupHeader');
    popup.className = 'popup';
    popup.style.display = 'flex';
    popup.style.zIndex = '1000';
    popupHeader.onclick = () => {
        const popups = document.querySelectorAll('.popup');
        popups.forEach(el => {
            if(el.id != 'main-menu-btn'){
                el.style.zIndex = '100'; 
            } 
        });
        popup.style.zIndex = '1000';
    }
    makeDraggable(panel, popupHeader, popup);
};

const closeMainMenu = () => {
    document.getElementById('main-menu-popup').style.display = 'none';
};

document.getElementById('menu-close-x').onclick = closeMainMenu;
document.querySelector('#main-menu-popup .popup-overlay').onclick = closeMainMenu;

bpmUpBtn.addEventListener('click', (e) => {
    const step = e.shiftKey ? 1 : 0.01; 
    updateBPM(parseFloat(bpmInput.value) + step);
});

bpmDownBtn.addEventListener('click', (e) => {
    const step = e.shiftKey ? 1 : 0.01;
    updateBPM(parseFloat(bpmInput.value) - step);
});

bpmInput.addEventListener('blur', () => {
    clearTimeout(bpmUpdateTimer);

    bpmUpdateTimer = setTimeout(() => {
        updateBPM(bpmInput.value);
    }, 150);
});

document.getElementById('masterEffects-btn').onclick = openMasterEffectsPopup;

function updateBPM(newVal) {
    const wasPlaying = isPlaying;
    
    let bpm = parseFloat(newVal);
    if (isNaN(bpm)) bpm = 120;
    
    if (bpm < 40 || bpm > 300) return;

    bpmInput.value = bpm % 1 === 0 ? bpm : bpm.toFixed(2);

    if (isPlaying) {
        const elapsed = audioContext.currentTime - playStartTime;
        pausedAt += elapsed;

        pauseAllTracks();
        clearInterval(schedulerTimer);
        isPlaying = false;
    }

    requestAnimationFrame(() => {
        audioTracks.forEach(track => {
            if (track.type === 'instrument' || track.type === 'synth') {
                rebuildInstrumentSteps(track);
            }
        });

        requestAnimationFrame(() => {
            renderGrid();
            applyZoom();
        });
    });

    const sps = getSecondsPerStep();
    nextNoteTime = Math.floor(pausedAt / sps) * sps;

    if (wasPlaying) {
        pausedAt = Math.max(0, pausedAt);
        playAllTracks();
    }
}

resolutionSelect.addEventListener('change', () => {
    resolution = parseInt(resolutionSelect.value);
    audioTracks.forEach(track => {
        if (track.type === 'instrument' || track.type === 'synth') rebuildInstrumentSteps(track);
    });
    if (isPlaying) {
        currentStep = 0; 
        nextStepTime = audioContext.currentTime;
    }
    renderGrid();
    applyZoom();
    pauseAllTracks();
});

function updateProjectTitleUI() {
    const el = document.getElementById('progressDiv');
    if (el) {
        el.textContent = projectName;
    }
}

document.getElementById('progressDiv')?.addEventListener('click', () => {
    const name = prompt('Project name:', projectName);
    if (name) {
        projectName = name.trim();
        updateProjectTitleUI();
    }
});

function getBPM() {
    return parseFloat(bpmInput.value) || 120;
}

function getPPS() {
    return zoomLevel * 20;
}

function getStepIndexFromCanvasPos(x) {
    return Math.floor(x / getStepWidth());
}

function getTrackIndexFromCanvasPos(y) {
    const trackHeight = 40;
    return Math.floor(y / trackHeight);
}

function pixelToTime(x) {
 return x / getPPS();
}

function timeToPixel(t) {
 return t * getPPS();
}

function getStepDuration() {
    const bpm = getBPM();
    return (60 / bpm) / (resolution / 4);
}

function getSecondsPerStep() {
    return (60 / getBPM()) / (resolution / 4);
}

function stepIndexToTime(stepIndex) {
    return stepIndex * getSecondsPerStep();
}

function getStepWidth() {
    const bpm = getBPM();
    const secondsPerStep = getSecondsPerStep();
    return secondsPerStep * getPPS();
}

function ensureAudioContextRunning() {
    if (audioContext.state !== 'running') {
        audioContext.resume();
    }
}

function volumeToGain(v) {
    return v <= 0
        ? 0
        : Math.pow(v, 2.2);
}

function setControlValue(control, value) {
    if (!control) return;

    if (typeof control.setValue === 'function') {
        control.setValue(value);
        return;
    }

    if ('value' in control) {
        control.value = value;
        return;
    }

    if (typeof control.update === 'function') {
        control.update(value);
    }
}

function createMasterBus() {
    const ctx = audioContext;

    if (!masterBus.settings) {
        masterBus.settings = {
            volume: 1,
            eq: [0, 0, 0, 0, 0],
            delayTime: 0.3,
            delayMix: 0,
            reverb: 0,
    
            compressor: {
                threshold: -24,
                ratio: 4,
                attack: 0.01,
                release: 0.15
            },
            limiter: -1,
            preset: null
        };
    }

    masterBus.input = ctx.createGain();

    const freqs = [60, 250, 1000, 4000, 8000];
    masterBus.eq = freqs.map((f, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type =
            i === 0 ? 'lowshelf' :
            i === freqs.length - 1 ? 'highshelf' :
            'peaking';
        filter.frequency.value = f;
        filter.Q.value = 1;
        filter.gain.value = Number.isFinite(masterBus.settings.eq?.[i])
            ? masterBus.settings.eq[i]
            : 0;
        return filter;
    });

    masterBus.compressor = ctx.createDynamicsCompressor();
    masterBus.compressor.threshold.value = -24;
    masterBus.compressor.knee.value = 30;
    masterBus.compressor.ratio.value = 4;
    masterBus.compressor.attack.value = 0.01;
    masterBus.compressor.release.value = 0.15;

    masterBus.delay = ctx.createDelay(5);
    masterBus.delay.delayTime.setValueAtTime(
        masterBus.settings.delayTime ?? 0,
        ctx.currentTime
    );
    
    masterBus.delayGain = ctx.createGain();
    masterBus.delayGain.gain.setValueAtTime(
        masterBus.settings.delayMix ?? 0,
        ctx.currentTime
    );
    
    masterBus.delayFeedback = ctx.createGain();
    masterBus.delayFeedback.gain.setValueAtTime(0.35, ctx.currentTime);
    
    masterBus.delay.connect(masterBus.delayFeedback);
    masterBus.delayFeedback.connect(masterBus.delay);

    masterBus.reverb = ctx.createConvolver();
    masterBus.reverbGain = ctx.createGain();
    masterBus.reverbGain.gain.value =
        Number.isFinite(masterBus.settings.reverb)
            ? masterBus.settings.reverb
            : 0;

    masterBus.limiter = ctx.createDynamicsCompressor();
    masterBus.limiter.threshold.value = -1;
    masterBus.limiter.ratio.value = 20;
    masterBus.limiter.attack.value = 0.003;
    masterBus.limiter.release.value = 0.05;

    masterBus.volume = ctx.createGain();
    masterBus.volume.gain.value =
        Number.isFinite(masterBus.settings.volume)
            ? masterBus.settings.volume
            : 1;

    let node = masterBus.input;

    masterBus.eq.forEach(eq => {
        node.connect(eq);
        node = eq;
    });
    
    node.connect(masterBus.compressor);
    
    masterBus.compressor.connect(masterBus.limiter);
    
    masterBus.compressor.connect(masterBus.delay);
    masterBus.delay.connect(masterBus.delayGain);
    masterBus.delayGain.connect(masterBus.limiter);
    
    masterBus.compressor.connect(masterBus.reverb);
    masterBus.reverb.connect(masterBus.reverbGain);
    masterBus.reverbGain.connect(masterBus.limiter);
    
    masterBus.limiter.connect(masterBus.volume);
    masterBus.volume.connect(ctx.destination);

}

createMasterBus();

function stopGlobalPreview() {
    if (libraryPreviewSource) {
        try { libraryPreviewSource.stop(); } catch (e) {}
        libraryPreviewSource = null;
    }
}

function updateMasterDelayRouting() {
    const mix = masterBus.settings.delayMix;

    if (masterBus._delayConnected) {
        try {
            masterBus.compressor.disconnect(masterBus.delay);
        } catch {}
        masterBus._delayConnected = false;
    }

    if (mix > 0) {
        masterBus.compressor.connect(masterBus.delay);
        masterBus.delay.connect(masterBus.delayGain);
        masterBus.delayGain.connect(masterBus.limiter);
        masterBus._delayConnected = true;
    }
}

function applyMasterPreset(key) {
    const p = MASTER_PRESETS[key];
    if (!p) return;

    masterBus.settings.preset = key;

    masterBus.settings.volume = p.volume;
    masterBus.settings.eq = [...p.eq];
    masterBus.settings.delayTime = p.delay.time;
    masterBus.settings.delayMix = p.delay.mix;
    masterBus.settings.reverb = p.reverb;

    masterBus.volume.gain.setValueAtTime(p.volume, audioContext.currentTime);
    p.eq.forEach((v, i) =>
        masterBus.eq[i].gain.setValueAtTime(v, audioContext.currentTime)
    );

    masterBus.compressor.threshold.setValueAtTime(
        p.compressor.threshold, audioContext.currentTime
    );
    masterBus.compressor.ratio.setValueAtTime(
        p.compressor.ratio, audioContext.currentTime
    );
    masterBus.compressor.attack.setValueAtTime(
        p.compressor.attack, audioContext.currentTime
    );
    masterBus.compressor.release.setValueAtTime(
        p.compressor.release, audioContext.currentTime
    );

    masterBus.delay.delayTime.setValueAtTime(p.delay.time, audioContext.currentTime);
    masterBus.delayGain.gain.setValueAtTime(p.delay.mix, audioContext.currentTime);
    masterBus.reverbGain.gain.setValueAtTime(p.reverb, audioContext.currentTime);
    masterBus.limiter.threshold.setValueAtTime(p.limiter, audioContext.currentTime);

    updateMasterUI();
    updateMasterPresetUI();
    updateMasterDelayRouting();
}

function updateMasterUI() {
    setControlValue(masterUI.volume, masterBus.settings.volume);

    masterBus.settings.eq.forEach((v, i) => {
        setControlValue(masterUI.eq[i], v);
    });

    setControlValue(masterUI.threshold, masterBus.compressor.threshold.value);
    setControlValue(masterUI.ratio, masterBus.compressor.ratio.value);
    setControlValue(masterUI.attack, masterBus.compressor.attack.value);
    setControlValue(masterUI.release, masterBus.compressor.release.value);

    setControlValue(masterUI.delayTime, masterBus.settings.delayTime);
    setControlValue(masterUI.delayMix, masterBus.settings.delayMix);
    setControlValue(masterUI.reverb, masterBus.settings.reverb);
}

function updateMasterPresetUI() {
    Object.entries(masterUI.presetButtons).forEach(([key, btn]) => {
        btn.classList.toggle(
            'active',
            masterBus.settings.preset === key
        ); 
    });
}

tempoBtn.addEventListener('click', () => {
    if(metronomeEnabled){
        metronomeEnabled = false;
        tempoBtn.src = './img/icons/metronome-64-r.png';
    } else {
        metronomeEnabled = true;
        tempoBtn.src = './img/icons/metronome-64-w.png';
    }
});

function normalizeNotePitches(note) {
    if (!Array.isArray(note.pitches)) {
        note.pitches = [
            Number.isFinite(note.pitch) ? note.pitch : 60
        ];
        delete note.pitch;
    }

    if (!note.pitches.length) {
        note.pitches = [60];
    }

    note.chordSize = note.pitches.length;
}

function applyPitchEnvelopeToPlaybackRate(param, env, start, duration) {
    param.cancelScheduledValues(start);

    env.forEach((p, i) => {
        const t = start + p.t * duration;
        const ratio = Math.pow(2, p.v / 12);

        if (i === 0) {
            param.setValueAtTime(param.value * ratio, t);
        } else {
            param.linearRampToValueAtTime(param.value * ratio, t);
        }
    });
}

function serializeSynthNote(note) {
    return {
        startStep: note.startStep,
        length: note.length,

        mode: note.mode ?? 'single',

        pitch: note.pitch ?? null,

        pitches: Array.isArray(note.pitches)
            ? structuredClone(note.pitches)
            : null,

        activeChordIndex: note.activeChordIndex ?? 0,

        velocity: note.velocity ?? 1,
        pan: note.pan ?? 0,

        attack: note.attack ?? 0.01,
        decay: note.decay ?? 0,
        sustain: note.sustain ?? 0,
        release: note.release ?? 0.2,

        velEnv: Array.isArray(note.velEnv)
            ? structuredClone(note.velEnv)
            : null,

        pitchEnv: Array.isArray(note.pitchEnv)
            ? structuredClone(note.pitchEnv)
            : null,

        echoPreset: note.echoPreset ?? 'off'
    };
}

function applySynthNoteFromData(note, data) {
    Object.assign(note, structuredClone(data));
}

function normalizeSynthNote(note) {
    if (!note) return note;

    if (note.mode == null) note.mode = 'single';

    if (note.mode === 'single') {
        if (typeof note.pitch !== 'number') {
            note.pitch = note.pitches?.[0] ?? 60;
        }
        note.pitches = null;
        note.activeChordIndex = 0;
    } else {
        if (!Array.isArray(note.pitches) || !note.pitches.length) {
            note.pitches = [note.pitch ?? 60];
        }
        note.pitch = null;

        if (note.activeChordIndex == null) {
            note.activeChordIndex = 0;
        }
    }

    return note;
}
function computeCPUValue() {
    const sched = Math.min(cpuMeter.schedulerTime / 6, 1);
    const raf   = Math.min(cpuMeter.rafDrift / 20, 1);
    const nodes = Math.min(cpuMeter.activeNodes / 120, 1);

    cpuMeter.value =
        (sched * 0.5 +
         raf   * 0.3 +
         nodes * 0.2) * 100;

    cpuMeter.value = Math.min(100, Math.round(cpuMeter.value));
}

function updateCPUMeterUI() {
    const el = document.getElementById('progressDiv');
    if (!el) return;

    computeCPUValue();

    const v = cpuMeter.value;

    el.innerHTML = `<span style="font-size:12px;">CPU ${v}%</span>`;

    if (v < 50) {
        el.style.color = '#4caf50';
    } else if (v < 75) {
        el.style.color = '#ffc107';
    } else {
        el.style.color = '#ff5252';
    }
}

function checkCPUPanic() {
    if (cpuMeter.value >= 95) {
        console.warn('CPU overload – emergency stop');
        stopAllTracks();
    }
}

document.getElementById('magnetBtn').addEventListener('click', function() {
    window.isMagnetActive = !window.isMagnetActive;
    if (window.isMagnetActive) {
        this.classList.add('active');
        this.style.backgroundColor = "#2196F3";
        timelineScroll.style.touchAction = 'none'; 
    } else {
        this.classList.remove('active');
        this.style.backgroundColor = "";
        timelineScroll.style.touchAction = 'pan-x'; 
    }
});

function playMetronomeClick(time, isBar = false) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'square';
    osc.frequency.value = isBar ? 2000 : 1200;

    gain.gain.setValueAtTime(isBar ? 0.9 : 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain).connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + 0.05);
}

function setupLongPress(el, callback, delay = 450) {
    let timer;
    el.addEventListener('touchstart', e => {
        timer = setTimeout(() => callback(e), delay);
    }, { passive: true });

    el.addEventListener('touchend', () => clearTimeout(timer));
    el.addEventListener('touchmove', () => clearTimeout(timer));
}

if (isEditing || window.isLassoActive) {
    timelineScroll.style.touchAction = 'none';
} else {
    timelineScroll.style.touchAction = 'pan-x pan-y';
}

function setupLongPress(target, onLongPress) {
    let timer = null;
    let startX = 0;
    let startY = 0;

    target.addEventListener('touchstart', e => {
        if (!isMobile) return;
        if (e.touches.length !== 1) return;

        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;

        timer = setTimeout(() => {
            suppressNextTap = true;
            onLongPress(e);
        }, LONG_PRESS_DELAY);
    }, { passive: true });

    target.addEventListener('touchmove', e => {
        if (!timer) return;

        const t = e.touches[0];
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);

        if (dx > 6 || dy > 6) {
            clearTimeout(timer);
            timer = null;
        }
    }, { passive: true });

    target.addEventListener('touchend', () => {
        clearTimeout(timer);
        timer = null;
    });

    target.addEventListener('touchcancel', () => {
        clearTimeout(timer);
        timer = null;
    });
}

window.addEventListener('error', e => {
    console.error('Runtime error:', e.error);
    emergencyStop();
});

window.addEventListener('unhandledrejection', e => {
    console.error('Unhandled promise:', e.reason);
    emergencyStop();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying) {
        pauseAllTracks();
    }
});

function emergencyStop() {
    try {
        isPlaying = false;
        clearInterval(schedulerTimer);
        schedulerTimer = null;
        cancelAnimationFrame(animationFrameId);
        stopActiveAudioNodes();
    } catch {}
}

function showProgressUI(text = 'Working…') {
    const el = document.getElementById('progressDiv');
    if (!el) return;

    progressLock = true;
    el.textContent = text;
    el.style.color = '#03a9f4';
    el.style.fontWeight = 'bold';
}

function hideProgressUI() {
    const el = document.getElementById('progressDiv');
    if (!el) return;

    progressLock = false;
    el.textContent = '—';
    el.style.color = '';
    el.style.fontWeight = '';
}

function showHoverLine(clientX) {
    const rect = timelineScroll.getBoundingClientRect();
    const x =
        clientX - rect.left + timelineScroll.scrollLeft;

    hoverLine.style.left = `${x}px`;
    hoverLine.style.display = 'block';
}

function hideHoverLine() {
    hoverLine.style.display = 'none';
}

timelineRuler.addEventListener('mousemove', e => {
    showHoverLine(e.clientX);
});
timelineScroll.addEventListener('mousemove', e => {
    showHoverLine(e.clientX);
});

timelineRuler.addEventListener('mouseleave', hideHoverLine);

document.getElementById('BPMPopup-btn').onclick = () => {
    const popups = document.querySelectorAll('.popup');
    popups.forEach(el => {
        if(el.id != 'BPMPopup-btn'){
            el.style.zIndex = '100'; 
        } 
    });
    const popup = document.getElementById('bpm-popup');
    const panel = document.getElementById('bpm-popup-panel');
    const popupHeader = document.getElementById('bpmPopupHeader');
    popup.style.display = 'flex';
    popup.className = 'popup';
    popup.style.zIndex = '1000';
    popupHeader.onclick = () => {
        const popups = document.querySelectorAll('.popup');
        popups.forEach(el => {
            if(el.id != 'bpm-popup'){
                el.style.zIndex = '100'; 
            }
        });
        popup.style.zIndex = '1000';
    }
    makeDraggable(panel, popupHeader, popup);
};

const closeBPMPopup = () => {
    document.getElementById('bpm-popup').style.display = 'none';
};

document.getElementById('bpmPopup-close').onclick = closeBPMPopup;

audioInput.addEventListener('change', () => {
    analyzeBtn.disabled = audioInput.files.length === 0;
        if (!analyzeBtn.disabled) {
            resultEl.textContent = '';
            statusEl.textContent = 'Ready to analyze.';
        }
});

analyzeBtn.addEventListener('click', async () => {
    const file = audioInput.files[0];
    if (!file) return;

    statusEl.textContent = 'Decoding audio...';
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        
        statusEl.textContent = 'Detecting tempo...';
        const bpm = estimateTempo(buffer);
        resultEl.textContent = `${bpm.toFixed(1)} BPM`;
        statusEl.textContent = '✅ Done!';
    } catch (err) {
        console.error(err);
        statusEl.textContent = '❌ Error: ' + (err.message || 'Failed to analyze');
    }
});

function estimateTempo(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    const targetRate = 22050;
    const downsampled = downsample(channelData, sampleRate, targetRate);
    const sr = targetRate;
    const hopSize = Math.floor(sr / 100);
    const frameSize = hopSize * 2;
    const onsetEnv = computeOnsetEnvelope(downsampled, sr, frameSize, hopSize);
    const autocorr = autocorrelate(onsetEnv);
    const minBPM = 60;
    const maxBPM = 240;
    const minLag = Math.floor((60 / maxBPM) * (sr / hopSize));
    const maxLag = Math.floor((60 / minBPM) * (sr / hopSize));

    let bestLag = 0;
    let maxCorr = -Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
        if (autocorr[lag] > maxCorr) {
          maxCorr = autocorr[lag];
          bestLag = lag;
        }
    }

    if (bestLag === 0) throw new Error('No tempo found');

    if (bestLag > 0 && bestLag < autocorr.length - 1) {
        const y1 = autocorr[bestLag - 1];
        const y2 = autocorr[bestLag];
        const y3 = autocorr[bestLag + 1];
        const delta = 0.5 * (y1 - y3) / (y1 - 2 * y2 + y3);
        bestLag += delta;
    }

    const intervalInSeconds = (bestLag * hopSize) / sr;
    const bpm = 60 / intervalInSeconds;

    return Math.min(maxBPM, Math.max(minBPM, bpm));
}

function downsample(data, originalRate, targetRate) {
    if (originalRate === targetRate) return data;
    const ratio = originalRate / targetRate;
    const length = Math.floor(data.length / ratio);
    const result = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const srcIndex = Math.floor(i * ratio);
        result[i] = data[srcIndex] || 0;
    }
    return result;
}

function computeOnsetEnvelope(signal, sampleRate, frameSize, hopSize) {
    const env = [];
    const numFrames = Math.floor((signal.length - frameSize) / hopSize) + 1;

    let prevSpectrum = null;

    for (let i = 0; i < numFrames; i++) {
        const start = i * hopSize;
        const frame = signal.slice(start, start + frameSize);
        
        for (let j = 0; j < frame.length; j++) {
          frame[j] *= 0.5 * (1 - Math.cos((2 * Math.PI * j) / (frame.length - 1)));
        }

        const spectrum = rfft(frame);
        const magnitude = spectrum.map(c => Math.sqrt(c.re * c.re + c.im * c.im));

        if (prevSpectrum === null) {
          prevSpectrum = magnitude;
          env.push(0);
          continue;
        }

        let flux = 0;
        for (let j = 0; j < magnitude.length; j++) {
          const diff = magnitude[j] - prevSpectrum[j];
          if (diff > 0) flux += diff;
        }

        env.push(flux);
        prevSpectrum = magnitude;
    }

    const maxVal = Math.max(...env);
    if (maxVal > 0) {
        for (let i = 0; i < env.length; i++) env[i] /= maxVal;
    }

    return env;
}

function rfft(x) {
    const N = x.length;
    if (N === 1) return [{ re: x[0], im: 0 }];

    const log2N = Math.ceil(Math.log2(N));
    const size = 1 << log2N;
    if (x.length < size) {
        const padded = new Float32Array(size);
        padded.set(x);
        x = padded;
    }

    const X = Array.from({ length: size }, (_, i) => ({ re: x[i], im: 0 }));
    for (let i = 0; i < size; i++) {
        const j = reverseBits(i, log2N);
        if (i < j) [X[i], X[j]] = [X[j], X[i]];
    }

    for (let s = 1; s <= log2N; s++) {
        const m = 1 << s;
        const w_m = { re: Math.cos(2 * Math.PI / m), im: -Math.sin(2 * Math.PI / m) };
        for (let k = 0; k < size; k += m) {
            let w = { re: 1, im: 0 };
            for (let j = 0; j < m / 2; j++) {
                const t = cmul(w, X[k + j + m / 2]);
                const u = X[k + j];
                X[k + j] = cadd(u, t);
                X[k + j + m / 2] = csub(u, t);
                w = cmul(w, w_m);
            }
        }
    }

    return X.slice(0, size / 2 + 1);
}

const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a, b) => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
});

function reverseBits(n, bits) {
    let rev = 0;
    for (let i = 0; i < bits; i++) {
        rev = (rev << 1) | (n & 1);
        n >>= 1;
    }
      return rev;
}

function autocorrelate(signal) {
    const n = signal.length;
    const ac = new Array(n).fill(0);
    for (let lag = 0; lag < n; lag++) {
        let sum = 0;
        for (let i = 0; i < n - lag; i++) {
          sum += signal[i] * signal[i + lag];
        }
        ac[lag] = sum;
    }
    return ac;
}

function syncTrackSettings(track) {
    applyTrackEffects(track);
    applyTrackDelay(track);
    applyTrackReverbSettings(track);
}

