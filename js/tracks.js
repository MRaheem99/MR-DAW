function addAudioTrackWithWaveform_L(audioBuffer, labelText) {
    const hue = Math.floor(Math.random() * 360);
    const trackColor = {
        wave: `hsl(${hue}, 70%, 55%)`,
        label: `hsl(${hue}, 40%, 30%)`
    };
    
    const label = document.createElement('div');
    label.className = 'track-label';
    const subdiv1 = document.createElement('div');
    subdiv1.className = 'track-subdiv';
    const subdiv2 = document.createElement('div');
    subdiv2.className = 'track-subdiv';
  
    label.id = `trackL_${(audioTracks.length)+1}`;
    label.dataset.id = `${(audioTracks.length)+1}`;
    subdiv1.textContent = labelText.length > 7 ? `${labelText.slice(0, 7)}..` : `${labelText}`;
    label.title = labelText;
    label.dataset.name = labelText;
    label.style.backgroundColor = trackColor.label;
  
    const custBtn = document.createElement('img'); 
    custBtn.src = settingsIcon;
    custBtn.className = 'labels-btn';
    custBtn.title = 'Manage';
    custBtn.style.fontSize = '8px';
    custBtn.id = `custBtn_${(audioTracks.length)+1}`;
  
    const muteBtn = document.createElement('img'); 
    muteBtn.src = muteIcon; 
    muteBtn.className = 'labels-btn';
    muteBtn.title = 'Mute';
  
    const soloBtn = document.createElement('img'); 
    soloBtn.src = soloIcon; 
    soloBtn.className = 'labels-btn'; 
    soloBtn.title = 'Solo';
  
    subdiv2.appendChild(custBtn);
    subdiv2.appendChild(muteBtn);
    subdiv2.appendChild(soloBtn);
    label.appendChild(subdiv1);
    label.appendChild(subdiv2);
    trackLabels.appendChild(label);

    const track = document.createElement('div');
    track.className = 'track audio-track';
    track.id = `trackR_${(audioTracks.length)+1}`;
    track.dataset.id = `${(audioTracks.length)+1}`;

    const pps = getPPS();
    const rulerWidth = totalSeconds * pps;
    const sampleWidth = audioBuffer.duration * pps;
    
    const trackWidth = Math.max(rulerWidth, sampleWidth);
    
    track.style.width = `${trackWidth}px`;

    const waveformContainer = document.createElement('div');
    waveformContainer.className = 'waveform';
    track.appendChild(waveformContainer);
    tracksContainer.appendChild(track);

    const trackData = {
        trackId: audioTracks.length + 1,
        type: 'audio',
    
        clips: [],
        sampleBuffer: null,
    
        instrument: 'sine',
        settings: {
            source: 'oscillator',
            volume: 1,
            pitch: 1,
            pan: 0,
            attack: 0.01,
            decay: 0.9,
            sustain: 1.0,
            release: 1.0,
            eq: [0,0,0,0,0],
            delayTime: 0,
            delayGain: 0,
            delay: {
                enabled: false,
                time: 0.3,
                feedback: 0.35,
                mix: 0.25,
                lowCut: 40,
                highCut: 12000,
                width: 1.0
            },
            reverb: {
                enabled: false,
                type: 'hall',
                wetGain: 0.3,
                dryGain: 1,
                returnGain: 0.35,
                preDelay: 0.25,
                lowCut: 200,
                highCut: 8000,
                widthGainL: 0,
                widthGainR: 0,
                width: 0,
                irBuffer: null
            }
        },
    
        effects: createAudioChain(),
        trackElement: track,
        label,
        muted: false,
        solo: false,
        color: trackColor
    };
    
    syncTrackSettings(trackData);

    const initialClip = createClip(audioBuffer, 0);
    initialClip.color = trackColor;
    initialClip.track = trackData;
    trackData.clips.push(initialClip);
    renderClip(trackData, initialClip);
  
    trackData.startOffset = 0;
    
    let longPressTimer;
    track.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            startWaveformDrag(e.touches[0], trackData);
        }, 500);
    });
    track.addEventListener('touchend', () => clearTimeout(longPressTimer));
    
    track.addEventListener('contextmenu', (e) => {
        
        const clientX = e.clientX;
        const clientY = e.clientY;
        const timelineRect = timelineContent.getBoundingClientRect();

        const cx = clientX - timelineRect.left + timelineScroll.scrollLeft;
        const cy = clientY - timelineRect.top + timelineScroll.scrollTop;
        
    
        e.preventDefault();
        e.stopPropagation();
        
        if (!window.lassoExists){
    
            const rect = timelineScroll.getBoundingClientRect();
            const x = clientX - rect.left + timelineScroll.scrollLeft;
            audioPasteTime = Math.max(0, x / getPPS());
            const coords = getTimelineCoords(cx, cy);
    
            const targetTrackIdx = getTrackIndexFromY(coords.y);
            
            const audioItems =
                Array.isArray(selectedItems)
                    ? selectedItems.filter(i => i.type === 'audio')
                    : [];
        
            openAudioTrackPopup(trackData, targetTrackIdx);
        } else {
            const coords = getTimelineCoords(cx, cy);
            const targetTrackIdx = getTrackIndexFromY(coords.y);
            
            const audioItems =
                window.isLassoActive &&
                Array.isArray(selectedItems)
                    ? selectedItems.filter(i => i.type === 'audio')
                    : [];
            const rect = timelineScroll.getBoundingClientRect();
            const x = clientX - rect.left + timelineScroll.scrollLeft;
            audioPasteTime = Math.max(0, x / getPPS());
    
                openAudioLassoContextMenu(
                    e.pageX,
                    e.pageY,
                    audioItems
                );
        }
    });

    label.trackRef = trackData;
  
    custBtn.addEventListener('click', () => {
        custBtn.classList.toggle('active');
        openInstrumentPopup(trackData);
    });
  
    muteBtn.addEventListener('click', () => {
        trackData.muted = !trackData.muted;
        muteBtn.classList.toggle('active', trackData.muted);
        updateTrackStates();
    });
    
    soloBtn.addEventListener('click', () => {

        const willSolo = !trackData.solo;
    
        // Clear all solos first
        audioTracks.forEach(t => {
            t.solo = false;
    
            // Remove active class from all solo buttons
            const btn = t.label.querySelector('[title="Solo"]');
            if (btn) btn.classList.remove('active');
        });
    
        // If turning ON solo
        if (willSolo) {
            trackData.solo = true;
            soloBtn.classList.add('active');
        }
    
        updateTrackStates();
    });


    audioTracks.push(trackData);

    const duration = audioBuffer.duration;
    if (duration > totalSeconds) {
        totalSeconds = Math.ceil(duration);
        syncInstrumentStepsToTimeline();
        applyZoom();
    }
  
    const contentEnd = getProjectContentEnd();
    if (contentEnd > totalSeconds) {
        totalSeconds = Math.ceil(contentEnd + 2); 
        syncInstrumentStepsToTimeline();
        applyZoom();
    }

    waitForCanvasReady(trackData);
    createAudioGridCanvas(trackData);
    return trackData;
}

function addAudioTrackWithWaveform(audioBuffer, labelText) {
    const hue = Math.floor(Math.random() * 360);
    const trackColor = {
        wave: `hsl(${hue}, 70%, 55%)`,
        label: `hsl(${hue}, 40%, 30%)`
    };

    // Create label
    const label = document.createElement('div');
    label.className = 'track-label';
    const subdiv1 = document.createElement('div');
    subdiv1.className = 'track-subdiv';
    const subdiv2 = document.createElement('div');
    subdiv2.className = 'track-subdiv';

    label.id = `trackL_${audioTracks.length + 1}`;
    label.dataset.id = `${audioTracks.length + 1}`;
    subdiv1.textContent = labelText.length > 7 ? `${labelText.slice(0, 7)}..` : labelText;
    label.title = labelText;
    label.dataset.name = labelText;
    label.style.backgroundColor = trackColor.label;

    const custBtn = document.createElement('img');
    custBtn.src = settingsIcon;
    custBtn.className = 'labels-btn';
    custBtn.title = 'Manage';
    custBtn.id = `custBtn_${audioTracks.length + 1}`;

    const muteBtn = document.createElement('img');
    muteBtn.src = muteIcon;
    muteBtn.className = 'labels-btn';
    muteBtn.title = 'Mute';

    const soloBtn = document.createElement('img');
    soloBtn.src = soloIcon;
    soloBtn.className = 'labels-btn';
    soloBtn.title = 'Solo';

    subdiv2.appendChild(custBtn);
    subdiv2.appendChild(muteBtn);
    subdiv2.appendChild(soloBtn);
    label.appendChild(subdiv1);
    label.appendChild(subdiv2);
    trackLabels.appendChild(label);

    // Create track element
    const track = document.createElement('div');
    track.className = 'track audio-track';
    track.id = `trackR_${audioTracks.length + 1}`;
    track.dataset.id = `${audioTracks.length + 1}`;

    const pps = getPPS();
    const rulerWidth = totalSeconds * pps;

    // Safe width calculation – use 0 if no buffer
    let sampleWidth = 0;
    if (audioBuffer && typeof audioBuffer.duration === 'number' && !isNaN(audioBuffer.duration)) {
        sampleWidth = audioBuffer.duration * pps;
    }

    const trackWidth = Math.max(rulerWidth, sampleWidth);
    track.style.width = `${trackWidth}px`;

    const waveformContainer = document.createElement('div');
    waveformContainer.className = 'waveform';
    track.appendChild(waveformContainer);
    tracksContainer.appendChild(track);

    // Track data
    const trackData = {
        trackId: audioTracks.length + 1,
        type: 'audio',
        clips: [],
        sampleBuffer: audioBuffer || null,  // null is now safe
        instrument: 'sine',
        settings: {
            source: 'oscillator',
            volume: 1,
            pitch: 1,
            pan: 0,
            attack: 0.01,
            decay: 0.9,
            sustain: 1.0,
            release: 1.0,
            eq: [0,0,0,0,0],
            delayTime: 0,
            delayGain: 0,
            delay: {
                enabled: false,
                time: 0.3,
                feedback: 0.35,
                mix: 0.25,
                lowCut: 40,
                highCut: 12000,
                width: 1.0
            },
            reverb: {
                enabled: false,
                type: 'hall',
                wetGain: 0.3,
                dryGain: 1,
                returnGain: 0.35,
                preDelay: 0.25,
                lowCut: 200,
                highCut: 8000,
                widthGainL: 0,
                widthGainR: 0,
                width: 0,
                irBuffer: null
            }
        },
        effects: createAudioChain(),
        trackElement: track,
        label,
        muted: false,
        solo: false,
        color: trackColor
    };

    syncTrackSettings(trackData);

    // Only create initial clip if we have a valid buffer
    if (audioBuffer && typeof audioBuffer.duration === 'number' && !isNaN(audioBuffer.duration)) {
        const initialClip = createClip(audioBuffer, 0);
        initialClip.color = trackColor;
        initialClip.track = trackData;
        trackData.clips.push(initialClip);
        renderClip(trackData, initialClip);

        trackData.startOffset = 0;

        // Update totalSeconds safely
        const duration = audioBuffer.duration;
        if (duration > totalSeconds) {
            totalSeconds = Math.ceil(duration);
            syncInstrumentStepsToTimeline();
            applyZoom();
        }

        const contentEnd = getProjectContentEnd();
        if (contentEnd > totalSeconds) {
            totalSeconds = Math.ceil(contentEnd + 2);
            syncInstrumentStepsToTimeline();
            applyZoom();
        }
    } else {
        // Placeholder for loaded project (no buffer yet)
        trackData.clips = []; // will be filled later in loadProjectData
    }

    // Event listeners (unchanged)
    let longPressTimer;
    track.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            startWaveformDrag(e.touches[0], trackData);
        }, 500);
    });
    track.addEventListener('touchend', () => clearTimeout(longPressTimer));

    track.addEventListener('contextmenu', (e) => {
        const clientX = e.clientX;
        const clientY = e.clientY;
        const timelineRect = timelineContent.getBoundingClientRect();

        const cx = clientX - timelineRect.left + timelineScroll.scrollLeft;
        const cy = clientY - timelineRect.top + timelineScroll.scrollTop;
        
    
        e.preventDefault();
        e.stopPropagation();
        
        if (!window.lassoExists){
    
            const rect = timelineScroll.getBoundingClientRect();
            const x = clientX - rect.left + timelineScroll.scrollLeft;
            audioPasteTime = Math.max(0, x / getPPS());
            const coords = getTimelineCoords(cx, cy);
    
            const targetTrackIdx = getTrackIndexFromY(coords.y);
            
            const audioItems =
                Array.isArray(selectedItems)
                    ? selectedItems.filter(i => i.type === 'audio')
                    : [];
        
            openAudioTrackPopup(trackData, targetTrackIdx);
        } else {
            const coords = getTimelineCoords(cx, cy);
            const targetTrackIdx = getTrackIndexFromY(coords.y);
            
            const audioItems =
                window.isLassoActive &&
                Array.isArray(selectedItems)
                    ? selectedItems.filter(i => i.type === 'audio')
                    : [];
            const rect = timelineScroll.getBoundingClientRect();
            const x = clientX - rect.left + timelineScroll.scrollLeft;
            audioPasteTime = Math.max(0, x / getPPS());
    
                openAudioLassoContextMenu(
                    e.pageX,
                    e.pageY,
                    audioItems
                );
        }
    });

    label.trackRef = trackData;

    custBtn.addEventListener('click', () => {
        custBtn.classList.toggle('active');
        openInstrumentPopup(trackData);
    });

    muteBtn.addEventListener('click', () => {
        trackData.muted = !trackData.muted;
        muteBtn.classList.toggle('active', trackData.muted);
        updateTrackStates();
    });

    soloBtn.addEventListener('click', () => {
        const willSolo = !trackData.solo;
        audioTracks.forEach(t => {
            t.solo = false;
            const btn = t.label.querySelector('[title="Solo"]');
            if (btn) btn.classList.remove('active');
        });
        if (willSolo) {
            trackData.solo = true;
            soloBtn.classList.add('active');
        }
        updateTrackStates();
    });

    audioTracks.push(trackData);

    waitForCanvasReady(trackData);
    createAudioGridCanvas(trackData);

    return trackData;
}

function addInstrumentTrack_L(type) {
    const isSynth = type === 'synth';
    let trackClass = '';
    if(type === 'synth'){
        trackClass = 'synth-track';
    }else{
        trackClass = 'instrument-track';
    }
    const labelText = type;
    const label = document.createElement('div');
    label.className = 'track-label';
    const subdiv1 = document.createElement('div');
    subdiv1.className = 'track-subdiv';
    const subdiv2 = document.createElement('div');
    subdiv2.className = 'track-subdiv';
    label.id = `trackL_${(audioTracks.length)+1}`;
    label.dataset.id = `${(audioTracks.length)+1}`;
    subdiv1.textContent = labelText.length > 7 ? `${labelText.slice(0, 7)}..` : `${labelText}`;
    label.title = labelText;
    label.dataset.name = labelText;

    const custBtn = document.createElement('img');
    custBtn.src = settingsIcon;
    custBtn.className = 'labels-btn track-settings-btn';
    custBtn.title = 'Manage';
    custBtn.id = `custBtn_${(audioTracks.length)+1}`;
    custBtn.style.fontSize = '8px';

    const muteBtn = document.createElement('img');
    muteBtn.src = muteIcon;
    muteBtn.className = 'labels-btn';
    muteBtn.title = 'Mute';

    const soloBtn = document.createElement('img');
    soloBtn.src = soloIcon;
    soloBtn.className = 'labels-btn';
    soloBtn.title = 'Solo';

    subdiv2.appendChild(custBtn);
    subdiv2.appendChild(muteBtn);
    subdiv2.appendChild(soloBtn);
    label.appendChild(subdiv1);
    label.appendChild(subdiv2);
    trackLabels.appendChild(label);

    const track = document.createElement('div');
    track.className = 'track '+trackClass;
    track.id = `trackR_${(audioTracks.length)+1}`;
    track.dataset.id = `${(audioTracks.length)+1}`;
    tracksContainer.appendChild(track);

    const bpm = getBPM();
    const pps = getPPS();
    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = resolution / 4;
    const secondsPerStep = getSecondsPerStep(); //secondsPerBeat / stepsPerBeat;
    const totalSteps = Math.ceil(totalSeconds / secondsPerStep);
    const stepWidth = secondsPerStep * pps;

    const stepsArray = new Array(totalSteps).fill(false);
  
    const trackData = {
            trackId: audioTracks.length + 1,
            type,
            steps: new Array(totalSteps).fill(false),
            notes: type === 'synth' ? [] : null,
            instrument: 'sawtooth',
            sampleBuffer: null,
            settings: {
                source: 'oscillator',
                volume: 1,
                pitch: 1,
                pan: 0,
                echoPreset: 'off',
                attack: 0.01,
                decay: 1.0,
                sustain: 1.0,
                release: 1.0,
                eq: [0,0,0,0,0],
                oscType: 'sawtooth',
                detune: 0,
                unison: 1,
                spread: 0.02,
                filterType: 'lowpass',
                filterCutoff: 12000,
                filterResonance: 0,
                echoPreset: 'off',
                delayTime: 0,
                delayGain: 0,
                delay: {
                    enabled: false,
                    time: 0.3,
                    feedback: 0.35,
                    mix: 0.25,
                    lowCut: 40,
                    highCut: 12000,
                    wetGain: 0,
                    dryGain: 1,
                    width: 1.0
                },
                reverb: {
                    enabled: false,
                    type: 'hall',
                    wetGain: 0.3,
                    dryGain: 1,
                    returnGain: 0.35,
                    preDelay: 0.25,
                    lowCut: 200,
                    highCut: 8000,
                    widthGainL: 0,
                    widthGainR: 0,
                    width: 0.5,
                    irBuffer: null
                }
            },
        effects: createAudioChain(),
        activeSources: [],
        activeNotes: new Map(),
        muted: false,
        solo: false,
        label,
        trackElement: track
    };
    syncTrackSettings(trackData);

    initDefaultSynth(trackData);

    createStepCanvas(trackData);
    resizeStepCanvas(trackData);
    drawTrackSteps(trackData);

    label.trackRef = trackData;
    custBtn.addEventListener('click', () => {
        custBtn.classList.toggle('active');
        openInstrumentPopup(trackData);
    });

    muteBtn.addEventListener('click', () => {
        trackData.muted = !trackData.muted;
        muteBtn.classList.toggle('active', trackData.muted);
        updateTrackStates();
    });

    soloBtn.addEventListener('click', () => {

        const willSolo = !trackData.solo;
    
        audioTracks.forEach(t => {
            t.solo = false;
    
            const btn = t.label.querySelector('[title="Solo"]');
            if (btn) btn.classList.remove('active');
        });
    
        if (willSolo) {
            trackData.solo = true;
            soloBtn.classList.add('active');
        }
    
        updateTrackStates();
    });

    audioTracks.push(trackData);
    updateTrackStates();

    if (totalSeconds > 0) { 
        applyZoom();
    }
    return trackData;
}

function addInstrumentTrack(type, instrumentName = null, sampleBuffer = null) {
    const isSynth = type === 'synth';
    let trackClass = isSynth ? 'synth-track' : 'instrument-track';

    // Use saved name if provided (from JSON), else default
    const displayName = instrumentName || (isSynth ? 'Sawtooth' : 'Sine');

    const label = document.createElement('div');
    label.className = 'track-label';
    const subdiv1 = document.createElement('div');
    subdiv1.className = 'track-subdiv';
    const subdiv2 = document.createElement('div');
    subdiv2.className = 'track-subdiv';

    label.id = `trackL_${audioTracks.length + 1}`;
    label.dataset.id = `${audioTracks.length + 1}`;

    // Show actual instrument/sample name
    subdiv1.textContent = displayName.length > 7 ? `${displayName.slice(0, 7)}..` : displayName;
    label.title = displayName;
    label.dataset.name = displayName;

    const custBtn = document.createElement('img');
    custBtn.src = settingsIcon;
    custBtn.className = 'labels-btn track-settings-btn';
    custBtn.title = 'Manage';
    custBtn.id = `custBtn_${audioTracks.length + 1}`;
    custBtn.style.fontSize = '8px';

    const muteBtn = document.createElement('img');
    muteBtn.src = muteIcon;
    muteBtn.className = 'labels-btn';
    muteBtn.title = 'Mute';

    const soloBtn = document.createElement('img');
    soloBtn.src = soloIcon;
    soloBtn.className = 'labels-btn';
    soloBtn.title = 'Solo';

    subdiv2.appendChild(custBtn);
    subdiv2.appendChild(muteBtn);
    subdiv2.appendChild(soloBtn);
    label.appendChild(subdiv1);
    label.appendChild(subdiv2);
    trackLabels.appendChild(label);

    const track = document.createElement('div');
    track.className = `track ${trackClass}`;
    track.id = `trackR_${audioTracks.length + 1}`;
    track.dataset.id = `${audioTracks.length + 1}`;
    tracksContainer.appendChild(track);

    const pps = getPPS();
    const secondsPerBeat = 60 / getBPM();
    const stepsPerBeat = resolution / 4;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;
    const totalSteps = Math.ceil(totalSeconds / secondsPerStep);
    const stepWidth = secondsPerStep * pps;
    const stepsArray = new Array(totalSteps).fill(false);

    const trackData = {
        trackId: audioTracks.length + 1,
        type,
        steps: type === 'instrument' ? new Array(totalSteps).fill(false) : null,
        notes: isSynth ? [] : null,
        instrument: instrumentName || (isSynth ? 'sawtooth' : 'sine'),
        sampleBuffer: sampleBuffer || null,  // will be set if sample from library
        settings: {
            source: sampleBuffer ? 'sample' : 'oscillator',
            volume: 1,
            pitch: 1,
            pan: 0,
            echoPreset: 'off',
            attack: 0.01,
            decay: 1.0,
            sustain: 1.0,
            release: 1.0,
            eq: [0,0,0,0,0],
            oscType: isSynth ? (instrumentName || 'sawtooth') : 'sine',
            detune: 0,
            unison: 1,
            spread: 0.02,
            filterType: 'lowpass',
            filterCutoff: 12000,
            filterResonance: 0,
            delay: {
                enabled: false,
                time: 0.3,
                feedback: 0.35,
                mix: 0.25,
                lowCut: 40,
                highCut: 12000,
                width: 1.0
            },
            reverb: {
                enabled: false,
                type: 'hall',
                wetGain: 0.3,
                dryGain: 1,
                returnGain: 0.35,
                preDelay: 0.25,
                lowCut: 200,
                highCut: 8000,
                widthGainL: 0,
                widthGainR: 0,
                width: 0,
                irBuffer: null
            }
        },
        effects: createAudioChain(),
        activeSources: [],
        activeNotes: new Map(),
        muted: false,
        solo: false,
        label,
        trackElement: track
    };

    syncTrackSettings(trackData);
    initDefaultSynth(trackData);

    // If sample from library is provided, use it
    if (sampleBuffer) {
        trackData.sampleBuffer = sampleBuffer;
        trackData.settings.source = 'sample';
        trackData.settings.oscType = null; // no osc if sample
    }

    createStepCanvas(trackData);
    resizeStepCanvas(trackData);
    drawTrackSteps(trackData);

    label.trackRef = trackData;

    custBtn.addEventListener('click', () => {
        custBtn.classList.toggle('active');
        openInstrumentPopup(trackData);
    });

    muteBtn.addEventListener('click', () => {
        trackData.muted = !trackData.muted;
        muteBtn.classList.toggle('active', trackData.muted);
        updateTrackStates();
    });

    soloBtn.addEventListener('click', () => {
        const willSolo = !trackData.solo;
        audioTracks.forEach(t => {
            t.solo = false;
            const btn = t.label.querySelector('[title="Solo"]');
            if (btn) btn.classList.remove('active');
        });
        if (willSolo) {
            trackData.solo = true;
            soloBtn.classList.add('active');
        }
        updateTrackStates();
    });

    audioTracks.push(trackData);
    updateTrackStates();

    if (totalSeconds > 0) {
        applyZoom();
    }

    return trackData;
}

function updateTrackStates() {

    const soloTrack = audioTracks.find(t => t.solo);

    audioTracks.forEach(track => {

        if (soloTrack) {
            track._canPlay = (track === soloTrack);
        } else {
            track._canPlay = !track.muted;
        }

        track.trackElement.style.opacity = track._canPlay ? 1 : 0.5;
        track.label.style.opacity = track._canPlay ? 1 : 0.5;

        if (track.effects?.muteGain) {
            track.effects.muteGain.gain.setValueAtTime(
                track._canPlay ? 1 : 0,
                audioContext.currentTime
            );
        }
    });
}

function removeTrack(track) {
    if (track.source) {
        try { track.source.stop(); } catch {}
        track.source.disconnect();
        track.source = null;
    }

    track.buffer = null;
    if (track.effects) {
        Object.values(track.effects).forEach(effect => {
            try { effect.disconnect(); } catch {}
        });
        track.effects = null;
    }

    const index = audioTracks.indexOf(track);
    if (index !== -1) {
        audioTracks.splice(index, 1);
    }

    if (track.domElement) {
        track.domElement.remove();
    }
    document.querySelector('#trackL_'+track.trackId).remove();
    document.querySelector('#trackR_'+track.trackId).remove();

    console.log(`Track "${track.label}" removed completely.`);
}

function confirmRemoveTrack(track, popup) {
    const confirmPopup = document.createElement('div');
    confirmPopup.className = 'confirm-popup';
    
    const flexDiv = document.createElement('div');
    flexDiv.style.display = 'flex';
    flexDiv.style.alignItems = 'center';
    flexDiv.style.justifyContent = 'space-between';
    confirmPopup.innerHTML = `
        <div style="margin-bottom:10px;"><p>Are you sure you want to remove "${track.label.dataset.name}"?</p></div>`;
    flexDiv.innerHTML = `
        <button id="confirmYes" class="btn btn-default">Yes</button>
        <button id="confirmNo" class="btn btn-default">No</button>
    `;
    confirmPopup.appendChild(flexDiv);
    document.body.appendChild(confirmPopup);

    confirmPopup.querySelector('#confirmYes').addEventListener('click', () => {
        removeTrack(track);
        confirmPopup.remove();
        popup.remove();
    });

    confirmPopup.querySelector('#confirmNo').addEventListener('click', () => {
        confirmPopup.remove();
    });
}

function copyTrack(track) {
  const playheadTime = pausedAt;
  const offset = track.startOffset || 0;
  const relativeTime = playheadTime - offset;

  if (relativeTime < 0 || relativeTime >= track.buffer.duration) return;

  const copyDuration = track.buffer.duration - relativeTime;
  clipboardBuffer = audioContext.createBuffer(
    track.buffer.numberOfChannels,
    copyDuration * track.buffer.sampleRate,
    track.buffer.sampleRate
  );

  for (let ch = 0; ch < track.buffer.numberOfChannels; ch++) {
    const channelData = track.buffer.getChannelData(ch);
    clipboardBuffer.getChannelData(ch).set(channelData.slice(relativeTime * track.buffer.sampleRate));
  }
}

function pasteTrack(track) {
  if (!clipboardBuffer) return;
  addAudioTrackWithWaveform(clipboardBuffer, track.label.dataset.name + " (copy)");
  audioTracks[audioTracks.length - 1].startOffset = pausedAt;
}

function clearTrackSteps(track) {
    track.steps = track.steps.map(() => false);
    updateTrackUI(track);
}

function updateTrackUI(track) {
    if (track.stepCanvas) {
        resizeStepCanvas(track);
        drawTrackSteps(track);
    }
}

function splitClip(track) {
    const playheadTime = pausedAt;

    const parentIndex = track.clips.findIndex(c =>
        playheadTime > c.startOffset &&
        playheadTime < (c.startOffset + c.buffer.duration)
    );

    if (parentIndex === -1) return;

    const parentClip = track.clips[parentIndex];
    const originalClip = parentClip;

    const relSplitTime = playheadTime - parentClip.startOffset;
    const sr = parentClip.buffer.sampleRate;

    const leftBufferLength = Math.floor(relSplitTime * sr);
    const rightBufferLength = parentClip.buffer.length - leftBufferLength;

    const leftBuf = audioContext.createBuffer(
        parentClip.buffer.numberOfChannels,
        leftBufferLength,
        sr
    );

    const rightBuf = audioContext.createBuffer(
        parentClip.buffer.numberOfChannels,
        rightBufferLength,
        sr
    );

    for (let i = 0; i < parentClip.buffer.numberOfChannels; i++) {
        const data = parentClip.buffer.getChannelData(i);
        leftBuf.getChannelData(i).set(data.subarray(0, leftBufferLength));
        rightBuf.getChannelData(i).set(data.subarray(leftBufferLength));
    }

    if (parentClip.dom) parentClip.dom.remove();
    track.clips.splice(parentIndex, 1);

    const leftClip = createClip(leftBuf, parentClip.startOffset);
    const rightClip = createClip(rightBuf, playheadTime);

    leftClip.color = parentClip.color;
    rightClip.color = parentClip.color;

    leftClip.track = track;
    rightClip.track = track;

    leftClip.effects = { ...parentClip.effects };
    rightClip.effects = { ...parentClip.effects };

    track.clips.push(leftClip, rightClip);

    renderClip(track, leftClip);
    renderClip(track, rightClip);
    
    pushHistory({
        redo() {
            removeClipFromTrack(track, originalClip);
            addClipToTrack(track, leftClip);
            addClipToTrack(track, rightClip);
        },
        undo() {
            removeClipFromTrack(track, leftClip);
            removeClipFromTrack(track, rightClip);
            addClipToTrack(track, originalClip);
        }
    });

}
