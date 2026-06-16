//instruments.js

function midiToNoteName(midi) {
    if (typeof midi !== 'number') return '';
    const name = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12);
    return `${name}${octave}`;
}

function getOctaveFromMidi(midi) {
    return Math.floor(midi / 12) - 1;
}

function createPianoRoll(note) {

    const track = note._track;

    const container = document.createElement('div');
    container.className = 'piano-container';

    const octaveLabel = document.createElement('div');
    octaveLabel.className = 'piano-octave-label';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'piano-wrapper';

    const piano = document.createElement('div');
    piano.className = 'piano';

    function getCurrentMidi() {
        return note.mode === 'chord'
            ? note.pitches[note.activeKeyIndex]
            : note.pitch;
    }

    function setCurrentMidi(midi) {
        if (note.mode === 'chord') {
            note.pitches[note.activeKeyIndex] = midi;
        } else {
            note.pitch = midi;
            note.pitches = [midi];
        }
    }

    function currentOctave() {
        return Math.floor(getCurrentMidi() / 12);
    }

    function render() {
        piano.innerHTML = '';

        const octave = currentOctave();
        const baseMidi = octave * 12;
        const activeMidi = getCurrentMidi();

        octaveLabel.innerHTML = `
            <button class="octave-btn" id="downOct">◀</button>
            <span>Octave ${octave}</span>
            <button class="octave-btn" id="upOct">▶</button>
        `;

        octaveLabel.querySelector('#downOct').onclick = () => {
            setCurrentMidi(Math.max(0, activeMidi - 12));
            render();
            drawSynthSteps(track);
        };

        octaveLabel.querySelector('#upOct').onclick = () => {
            setCurrentMidi(Math.min(127, activeMidi + 12));
            render();
            drawSynthSteps(track);
        };

        WHITE_KEYS.forEach(k => {
            const key = document.createElement('div');
            key.className = 'white-key';

            const midi = baseMidi + k.note;
            if (midi === activeMidi) key.classList.add('active');

            bindKey(key, midi);
            piano.appendChild(key);
        });

        BLACK_KEYS.forEach(k => {
            const key = document.createElement('div');
            key.className = 'black-key';
            key.style.left = `${k.pos * 40}px`;

            const midi = baseMidi + k.note;
            if (midi === activeMidi) key.classList.add('active');

            bindKey(key, midi);
            piano.appendChild(key);
        });
    }

    function bindKey(key, midi) {
        key.onpointerdown = e => {
            e.preventDefault();
            stopPianoPreview();

            setCurrentMidi(midi);
            startPianoPreview(track, midi, note);

            render();
            drawSynthSteps(track);
        };

        key.onpointerup = stopPianoPreview;
        key.onpointerleave = stopPianoPreview;
    }

    render();
    wrapper.appendChild(piano);
    container.append(octaveLabel, wrapper);
    return container;
}

function updatePiano() {
        const container = document.querySelector('.piano-container');
    container.innerHTML = '';

    const midi =
        note.mode === 'single'
            ? note.pitch
            : note.pitches[activeChordIndex];

    container.appendChild(
        createPianoRoll({
            pitch: midi,
            _track: track,
            onChange(newMidi) {
                if (note.mode === 'single') {
                    note.pitch = newMidi;
                } else {
                    note.pitches[activeChordIndex] = newMidi;
                }
            }
        })
    );
}

function startPianoPreview(track, midi, note = null) {
    if (!audioContext || !track) return;

    if (audioContext.state !== 'running') {
        audioContext.resume();
    }

    stopPianoPreview();

    const now = audioContext.currentTime;

    const gain = audioContext.createGain();
    const pan  = audioContext.createStereoPanner();

    const velocity = note?.velocity ?? 1;
    const panVal   = note?.pan ?? track.settings.pan ?? 0;

    pan.pan.value = panVal;

    let source;

    if (track.sampleBuffer) {
        source = audioContext.createBufferSource();
        source.buffer = track.sampleBuffer;
        source.playbackRate.value = midiToPlaybackRate(midi, 60);
        source.loop = true;
    } else {
        source = audioContext.createOscillator();
        source.type = track.instrument || 'sawtooth';
        source.frequency.setValueAtTime(midiToFreq(midi), now);
    }

    source
        .connect(gain)
        .connect(pan)
        .connect(track.effects?.inputNode || audioContext.destination);

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);

    if (Array.isArray(note?.velEnv) && note.velEnv.length >= 2) {
        const dur = 0.8;

        note.velEnv.forEach((p, i) => {
            const t = now + p.t * dur;
            const v = Math.max(0, p.v * velocity);

            if (i === 0) {
                gain.gain.setValueAtTime(v, t);
            } else {
                gain.gain.linearRampToValueAtTime(v, t);
            }
        });
    } else {
        const attack  = note?.attack  ?? track.settings.attack  ?? 0.01;
        const decay   = note?.decay   ?? track.settings.decay   ?? 0.05;
        const sustain = note?.sustain ?? track.settings.sustain ?? 1;

        const aEnd = now + Math.max(attack, 0.001);
        const dEnd = aEnd + Math.max(decay, 0.001);

        gain.gain.linearRampToValueAtTime(velocity, aEnd);
        gain.gain.linearRampToValueAtTime(
            velocity * sustain,
            dEnd
        );
    }

    source.start(now);

    pianoPreview = {
        source,
        gain,
        track,
        note,
        startedAt: now
    };
}

function stopPianoPreview() {
    if (!pianoPreview) return;

    const now = audioContext.currentTime;
    const release =
        pianoPreview.note?.release ??
        pianoPreview.track?.settings?.release ??
        0.15;

    try {
        pianoPreview.gain.gain.cancelScheduledValues(now);
        pianoPreview.gain.gain.setTargetAtTime(0.0001, now, release / 3);
        pianoPreview.source.stop(now + release + 0.02);
    } catch {}

    pianoPreview = null;
}

function refreshPianoPreview() {
    if (!pianoPreview) return;

    startPianoPreview(
        pianoPreview.track,
        pianoPreview.midi,
        pianoPreview.note
    );
}

function serializeSynthNote(note) {
    return {
        startStep: note.startStep,
        length: note.length,
        pitch: note.pitch,
        velocity: note.velocity,
        pan: note.pan,

        attack: note.attack,
        decay: note.decay,
        sustain: note.sustain,
        release: note.release,

        velEnv: note.velEnv
            ? structuredClone(note.velEnv)
            : null,

        pitchEnv: note.pitchEnv
            ? structuredClone(note.pitchEnv)
            : null,

        echoPreset: note.echoPreset ?? null
    };
}

function markSynthAsCustom(track) {
    if (track.settings?.synth) {
        track.settings.synth.presetName = 'Custom';
    }
}

function createSynthVoices(track, note, startTime, freq, duration, velocity = 1) {
    const ctx = audioContext;
    if (!track.settings) track.settings = {};
    if (!track.settings.synth) track.settings.synth = {};
    
    const synth = track.settings.synth;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();

    if (!synth.filter) {
        synth.filter = {
            type: 'lowpass',
            cutoff: 12000,
            resonance: 0
        }; 
    }
    
    filter.type = synth.filter.type;
    filter.frequency.value = synth.filter.cutoff;
    filter.Q.value = synth.filter.resonance;

    pan.pan.value = track.settings.pan ?? 0;

    gain.connect(filter);
    filter.connect(pan);
    pan.connect(track.effects.inputNode);

    applyADSR(gain, track, note, startTime, duration, velocity);

    const nodesToStop = [];

    if (synth.effects?.tremolo?.depth > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        lfo.type = 'sine';
        lfo.frequency.value = synth.effects.tremolo.rate;
        lfoGain.gain.value = synth.effects.tremolo.depth;

        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        lfo.start(startTime);
        lfo.stop(startTime + duration + 0.1);

        nodesToStop.push(lfo);
    }

    if (synth.effects?.wah?.depth > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        lfo.type = 'sine';
        lfo.frequency.value = synth.effects.wah.rate;
        lfoGain.gain.value = synth.effects.wah.depth * 2000;

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        lfo.start(startTime);
        lfo.stop(startTime + duration + 0.1);

        nodesToStop.push(lfo);
    }

    const unison = Math.max(1, synth.unison);
    const spread = synth.spread ?? 0;
    const detune = synth.detune ?? 0;

    for (let i = 0; i < unison; i++) {
        const osc = ctx.createOscillator();
        osc.type = synth.oscType;

        const det =
            detune +
            (i - (unison - 1) / 2) * spread;

        osc.detune.value = det;
        
        const baseFreq = midiToFreq(note.pitch ?? 60);

        //osc.frequency.setValueAtTime(baseFreq, startTime);
        applyPitchEnvelope(
            osc.frequency,
            freq,
            note.pitchEnv,
            startTime,
            duration
        );
        
        if (note.pitchEnv?.length) {
            note.pitchEnv.forEach(p => {
                const t = startTime + p.t * duration;
                const semitoneRatio = Math.pow(2, p.v / 12);
                osc.frequency.linearRampToValueAtTime(
                    baseFreq * semitoneRatio,
                    t
                );
            });
        }

        osc.connect(gain);
        osc.start(startTime);
        osc.stop(startTime + duration + track.settings.release);

        nodesToStop.push(osc);
    }

    return nodesToStop;
}


function normalizeSynthSettings(synth) {
    if (!synth.effects) {
        synth.effects = {};
    }

    if (!synth.effects.tremolo) {
        synth.effects.tremolo = { rate: 5, depth: 0 };
    }

    if (!synth.effects.wah) {
        synth.effects.wah = { rate: 3, depth: 0 };
    }

    if (!synth.filter) {
        synth.filter = { type: 'lowpass', cutoff: 8000, resonance: 0.7 };
    }

    if (!synth.lfo) {
        synth.lfo = { target: 'pitch', rate: 5, depth: 0 };
    }
}

function loadUserSynthPresets() {
    try {
        return JSON.parse(localStorage.getItem(USER_SYNTH_PRESETS_KEY)) || {};
    } catch {
        return {};
    }
}

function saveUserSynthPresets(presets) {
    localStorage.setItem(
        USER_SYNTH_PRESETS_KEY,
        JSON.stringify(presets)
    );
}

async function createDrumTrack(type, index = 0, total = 1) {

    const drumOrder = ["kick", "snare", "hihat", "clap", "tom", "perc", "ride", "crash"];
    const drumKey = drumOrder[index] || "kick";

    const drumNames = [
        "Kick",
        "Snare",
        "HiHat",
        "Clap",
        "Tom",
        "Perc",
        "Ride",
        "Crash"
    ];

    const name = total > 1
        ? drumNames[index] || `Drum ${index + 1}`
        : "Drum";

    const track = addInstrumentTrack("instrument");

    track.label.dataset.name = name;
    if(type === 'p'){
        track.label.dataset.pattern = "pattern";
        track._isPatternTrack = true;
    }
    track.label.querySelector('.track-subdiv').textContent = name;

    if (DEFAULT_DRUM_SAMPLES[drumKey]) {
        try {
            const buffer = await loadSampleBuffer(DEFAULT_DRUM_SAMPLES[drumKey]);
            track.sampleBuffer = buffer;
        } catch (err) {
            console.warn("Failed loading drum sample:", err);
        }
    }

    track.settings.attack = 0.002;
    track.settings.decay = 1.0;
    track.settings.sustain = 1.0;
    track.settings.release = 1.0;

    const hue = (index * 50) % 360;
    track.label.style.backgroundColor = `hsl(${hue}, 45%, 35%)`;

    drawTrackSteps(track);

    return track;
}

async function createDrumKitFromPreset(presetName) {

    const preset = DRUM_PRESETS[presetName];
    if (!preset) return;

    const entries = Object.entries(preset);

    for (let i = 0; i < entries.length; i++) {

        const [name, url] = entries[i];

        const track = addInstrumentTrack("instrument");

        track.label.dataset.pattern = "pattern";
        track._isPatternTrack = true;
        track.label.title = name.toUpperCase();
        track.label.dataset.name = name.toUpperCase();
        track.label.querySelector('.track-subdiv').textContent = name.toUpperCase().slice(0, 7);

        try {
            const buffer = await loadSampleBuffer(url);
            track.sampleBuffer = buffer;
        } catch (err) {
            console.warn("Sample load failed:", url);
        }

        track.settings.attack = 0.01;
        track.settings.decay = 1.0;
        track.settings.sustain = 1.0;
        track.settings.release = 1.0;

        drawTrackSteps(track);
    }
}

function generateRandomDrumPattern_L(tracks, bars = 1) {

    if (!Array.isArray(tracks) || !tracks.length) {
        console.warn("No tracks found for random pattern");
        return null;
    }

    const safeResolution =
        Number.isFinite(resolution) && resolution > 0
            ? resolution
            : 16;

    const safeBars =
        Number.isFinite(bars) && bars > 0
            ? bars
            : 1;

    const totalSteps = safeResolution * safeBars;

    const pattern = {
        resolution: safeResolution,
        lengthBars: safeBars,
        data: {}
    };

    tracks.forEach(track => {

        if (track.type !== "instrument") return;

        const steps = new Array(totalSteps).fill(0);

        for (let i = 0; i < totalSteps; i++) {

            const beatPos = i % safeResolution;
            const name = track.label?.dataset?.name?.toLowerCase() || "";

            if (name.includes("kick")) {
                if (beatPos === 0 || beatPos === safeResolution / 2)
                    steps[i] = 1;
            }

            else if (name.includes("snare")) {
                if (beatPos === safeResolution / 4 ||
                    beatPos === (safeResolution / 4) * 3)
                    steps[i] = 1;
            }

            else if (name.includes("hat")) {
                if (Math.random() > 0.3)
                    steps[i] = 1;
            }

            else {
                if (Math.random() > 0.8)
                    steps[i] = 1;
            }
        }

        pattern.data[track.trackId] = steps;
    });

    return pattern;
}

// Advanced random drum pattern generator with genre support
function generateRandomDrumPattern(tracks, bars = 1, genre = "techno") {
    if (!Array.isArray(tracks) || tracks.length < 4 || tracks.length > 8) {
        console.warn("Need 4–8 instrument tracks for drum pattern");
        return null;
    }

    const safeResolution = Number.isFinite(resolution) && resolution > 0 ? resolution : 16;
    const safeBars = Number.isFinite(bars) && bars > 0 ? bars : 2;
    const totalSteps = safeResolution * safeBars;

    // ─── Genre Profiles ────────────────────────────────────────────────
    const genreSettings = {
        techno: {
            kick: { density: 0.98, onBeat: [0, 8], ghostChance: 0.03 },
            snare: { density: 0.45, onBeat: [4, 12], ghostChance: 0.08 },
            hihat: { density: 0.88, closedOpenRatio: 0.85, tripletChance: 0.05 },
            clap: { density: 0.4, onBeat: [4, 12], layeredWithSnare: true },
            tom: { density: 0.06, placement: "random" },
            perc: { density: 0.22 },
            ride: { density: 0.08 },
            crash: { density: 0.02, onlyFirstBeat: true }
        },
        house: {
            kick: { density: 0.98, onBeat: [0, 8] },
            snare: { density: 0.4, onBeat: [4, 12] },
            hihat: { density: 0.75, tripletChance: 0.08, openChance: 0.15 },
            clap: { density: 0.6, onBeat: [4, 12], layeredWithSnare: true },
            tom: { density: 0.04 },
            perc: { density: 0.35 },
            ride: { density: 0.12 },
            crash: { density: 0.03 }
        },
        deep_house: {
            kick: { density: 0.95, onBeat: [0, 8], softGhosts: true },
            snare: { density: 0.35, onBeat: [4, 12] },
            hihat: { density: 0.65, swung: 0.55, openChance: 0.25 },
            clap: { density: 0.45, onBeat: [4, 12] },
            tom: { density: 0.08 },
            perc: { density: 0.45, swung: true },
            ride: { density: 0.2 },
            crash: { density: 0.02 }
        },
        trap: {
            kick: { density: 0.55, tripletKick: true, ghostChance: 0.3 },
            snare: { density: 0.4, onBeat: [4, 12], rollChance: 0.25 },
            hihat: { density: 0.92, tripletHihat: true, velocityVariation: 0.9 },
            clap: { density: 0.5, onBeat: [4, 12] },
            tom: { density: 0.25, tripletTom: true },
            perc: { density: 0.45 },
            ride: { density: 0.18 },
            crash: { density: 0.1 }
        },
        dnb: {
            kick: { density: 0.75, onBeat: [0, 6, 12], ghostChance: 0.2 },
            snare: { density: 0.7, onBeat: [4, 12], reverbTail: true },
            hihat: { density: 0.98, fast16th: true, tripletChance: 0.15 },
            clap: { density: 0.3 },
            tom: { density: 0.12 },
            perc: { density: 0.6 },
            ride: { density: 0.3 },
            crash: { density: 0.12 }
        },
        hiphop: {
            kick: { density: 0.6, swing: 0.65 },
            snare: { density: 0.4, onBeat: [4, 12], swing: 0.65 },
            hihat: { density: 0.75, tripletChance: 0.3, velocityVariation: 0.7 },
            clap: { density: 0.45, onBeat: [4, 12] },
            tom: { density: 0.15 },
            perc: { density: 0.35, swing: true },
            ride: { density: 0.22 },
            crash: { density: 0.06 }
        },
        dubstep: {
            kick: { density: 0.45, halfTime: true, ghostChance: 0.25 },
            snare: { density: 0.4, halfTime: true, onBeat: [4, 12] },
            hihat: { density: 0.85, tripletHihat: true },
            clap: { density: 0.35 },
            tom: { density: 0.3 },
            perc: { density: 0.5 },
            ride: { density: 0.15 },
            crash: { density: 0.15, wobbleChance: 0.3 }
        },
        drumstep: {
            kick: { density: 0.5, halfTime: true },
            snare: { density: 0.45, halfTime: true },
            hihat: { density: 0.95, fast16th: true },
            clap: { density: 0.3 },
            tom: { density: 0.2 },
            perc: { density: 0.55 },
            ride: { density: 0.25 },
            crash: { density: 0.1 }
        },
        breaks: {
            kick: { density: 0.65, breakbeatStyle: true },
            snare: { density: 0.7, breakbeatStyle: true },
            hihat: { density: 0.8, breakbeatStyle: true },
            clap: { density: 0.25 },
            tom: { density: 0.3 },
            perc: { density: 0.65 },
            ride: { density: 0.2 },
            crash: { density: 0.08 }
        },
        lofi: {
            kick: { density: 0.5, swing: 0.7, lowVelocity: true },
            snare: { density: 0.35, swing: 0.7, lowVelocity: true },
            hihat: { density: 0.65, tripletChance: 0.4, lowVelocity: true },
            clap: { density: 0.3, swing: true },
            tom: { density: 0.12 },
            perc: { density: 0.45, swing: true },
            ride: { density: 0.25 },
            crash: { density: 0.05 }
        }
    };

    const profile = genreSettings[genre] || genreSettings["techno"];

    // ─── Pattern Generation ─────────────────────────────────────────────
    const pattern = {
        resolution: safeResolution,
        lengthBars: safeBars,
        genre: genre,
        data: {}
    };

    tracks.forEach(track => {
        if (track.type !== "instrument") return;

        const name = (track.label?.dataset?.name || "").toLowerCase();
        const p = getProfileForName(name, profile);

        const steps = new Array(totalSteps).fill(0);

        for (let i = 0; i < totalSteps; i++) {
            const beatPos = i % safeResolution;
            let probability = p.density || 0.3;

            // Specific beat placements
            if (p.onBeat && p.onBeat.includes(beatPos)) {
                probability = 1;
            }

            // Half-time feel (dubstep, drumstep)
            if (p.halfTime && beatPos % 8 !== 0 && beatPos % 8 !== 4) {
                probability *= 0.2;
            }

            // Triplet feel
            if (p.tripletHihat && name.includes("hat") && beatPos % 4 === 2) {
                probability *= 0.7;
            }

            // Ghost notes
            if (Math.random() < (p.ghostChance || 0)) {
                probability *= 0.35;
            }

            // Swing (probability shift)
            if (p.swing && beatPos % 2 === 1) {
                probability *= (1 - p.swing * 0.6);
            }

            // Final hit decision + velocity
            if (Math.random() < probability) {
                let velocity = 100;

                // Accent
                if (p.accentEvery && i % p.accentEvery === 0) {
                    velocity = 127;
                }

                // Low velocity for lofi
                if (p.lowVelocity) {
                    velocity = Math.floor(60 + Math.random() * 40);
                }

                steps[i] = velocity;
            }
        }

        pattern.data[track.trackId] = steps;
    });

    return pattern;
}

// Helper to match track name to profile
function getProfileForName(name, profile) {
    if (name.includes("kick")) return profile.kick || {};
    if (name.includes("snare") || name.includes("clap")) return profile.snare || profile.clap || {};
    if (name.includes("hat") || name.includes("hihat")) return profile.hihat || {};
    if (name.includes("clap")) return profile.clap || {};
    if (name.includes("tom")) return profile.tom || {};
    if (name.includes("perc")) return profile.perc || {};
    if (name.includes("ride")) return profile.ride || {};
    if (name.includes("crash")) return profile.crash || {};
    return { density: 0.25 };
}

// Helper to match track name to genre profile
function getProfileForName(name, genreProfile) {
    if (name.includes("kick")) return genreProfile.kick || {};
    if (name.includes("snare") || name.includes("clap")) return genreProfile.snare || {};
    if (name.includes("hat") || name.includes("hihat")) return genreProfile.hihat || {};
    if (name.includes("clap")) return genreProfile.clap || {};
    if (name.includes("tom")) return genreProfile.tom || {};
    if (name.includes("perc")) return genreProfile.perc || {};
    if (name.includes("ride")) return genreProfile.ride || {};
    if (name.includes("crash")) return genreProfile.crash || {};
    return { density: 0.25 };
}

function savePatternsToStorage() {
    localStorage.setItem(
        "RN_DRUM_PATTERNS",
        JSON.stringify(DRUM_PATTERNS)
    );
    refreshPatternListUI();
}

function saveCurrentPattern(name, pattern, patternList) {

    if (!name) return;

    DRUM_PATTERNS[name] = pattern;

    savePatternsToStorage();

    refreshPatternListUI(patternList);
}

function refreshPatternListUI(cont) {
        const containerPatterns = document.querySelector('.pattern-list');
    
        const container = cont || containerPatterns;

        container.innerHTML = "";
    
        Object.keys(DRUM_PATTERNS).forEach(name => {
    
            const row = document.createElement("div");
            row.className = "pattern-row";
            row.style.borderRadius = "5px";
            row.style.background = '#333'
            row.style.padding = "5px";
            row.style.marginBottom = "10px";
    
            const label = document.createElement("span");
            label.textContent = name;
            
            const patternListItems = document.createElement("div");
            patternListItems.style.display = "flex";
            patternListItems.style.alignItems = "center";
            patternListItems.style.justifyContent = "center";
            patternListItems.style.padding = "5px";
    
            const previewBtn = document.createElement("button");
            previewBtn.textContent = "Preview";
            previewBtn.className = 'btn btn-default';
            previewBtn.onclick = () => openDrumPatternEditor(DRUM_PATTERNS[name]);
    
            const addBtn = document.createElement("button");
            addBtn.textContent = "Add";
            addBtn.className = 'btn btn-default';
            addBtn.onclick = () => insertDrumPatternAtPlayhead(DRUM_PATTERNS[name]);
    
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.className = 'btn btn-red';
            deleteBtn.onclick = () => {
                delete DRUM_PATTERNS[name];
                savePatternsToStorage();
                loadPatternsFromStorage();
                refreshPatternListUI(container);
            };
            patternListItems.append(previewBtn, addBtn, deleteBtn);
            row.append(label, patternListItems);
            container.appendChild(row);
        });
    }

function insertDrumPatternAtPlayhead(pattern) {

    if (!pattern) return;

    const startStep = Math.floor(
        pausedAt / getSecondsPerStep()
    );

    const patternTracks = audioTracks
        .filter(t => t.label?.dataset?.pattern === "pattern");

    if (!patternTracks.length) {
        console.warn("No pattern tracks found.");
        return;
    }

    const patternTrackIds = Object.keys(pattern.data);

    patternTrackIds.forEach((patternTrackId, rowIndex) => {

        const targetTrack = patternTracks[rowIndex];
        if (!targetTrack) return;

        const patternSteps = pattern.data[patternTrackId];
        if (!patternSteps) return;

        patternSteps.forEach((v, i) => {

            const targetStep = startStep + i;

            if (targetStep < targetTrack.steps.length) {

                targetTrack.steps[targetStep] = v
                    ? { active: true, velocity: 1 }
                    : false;
            }
        });

        drawTrackSteps(targetTrack);
    });
}


function previewDrumPattern(pattern) {

    const bpm = getBPM();
    const secondsPerStep = getSecondsPerStep();

    audioTracks.forEach(track => {

        const data = pattern.data[track.trackId];
        if (!data) return;

        data.forEach((v, i) => {

            if (!v) return;

            const time =
                audioContext.currentTime +
                (i * secondsPerStep);

            playInstrumentHit(track, time);
        });
    });
}

async function renderCurrentDrumKitToWav(bars = 1) {

    const bpm = getBPM();
    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = resolution / 4;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;

    const sampleRate = 48000;

    const drumTracks = audioTracks.filter(t =>
        t._isPatternTrack &&
        t.type === "instrument" &&
        t.sampleBuffer &&
        t.label?.dataset?.pattern === "pattern"
    );

    if (!drumTracks.length) {
        console.warn("No pattern tracks found");
        return null;
    }

    let lastStepIndex = -1;

    drumTracks.forEach(track => {
        track.steps.forEach((stepData, i) => {
            const step = normalizeStep(stepData);
            if (step?.active) {
                lastStepIndex = Math.max(lastStepIndex, i);
            }
        });
    });

    if (lastStepIndex < 0) {
        console.warn("Pattern is empty");
        return null;
    }

    const patternSteps = lastStepIndex + 1;

    const safetyTail = 0; //0.05;

    //const duration = (patternSteps * secondsPerStep) + safetyTail;
    const duration = resolution * bars * secondsPerStep;

    const offlineCtx = new OfflineAudioContext(
        2,
        Math.ceil(duration * sampleRate),
        sampleRate
    );

    const masterBusOffline = createMasterBusOffline(offlineCtx);


    drumTracks.forEach(track => {

        const chain = createFullOfflineTrackChain(
            offlineCtx,
            masterBusOffline,
            track
        );

        track.steps.forEach((stepData, i) => {

            const step = normalizeStep(stepData);
            if (!step?.active) return;

            const start = i * secondsPerStep;
            const dur = secondsPerStep;

            const gain = offlineCtx.createGain();
            gain.connect(chain.inputNode);

            const src = offlineCtx.createBufferSource();
            src.buffer = track.sampleBuffer;

            src.playbackRate.value =
                step.pitch ?? track.settings.pitch ?? 1;

            src.connect(gain);

            applyADSR_Offline(
                offlineCtx,
                gain,
                track,
                step,
                start,
                dur,
                step.velocity ?? 1
            );

            const release =
                step.release ??
                track.settings.release ??
                0.05;

            src.start(start);
            src.stop(start + dur + release);
        });
    });

    const rendered = await offlineCtx.startRendering();

    const trimmed = trimSilence(rendered);

    return trimmed;
}

function trimSilence(buffer, threshold = 0.0005) {

    const channels = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let endSample = buffer.length - 1;

    outer:
    for (let i = buffer.length - 1; i >= 0; i--) {
        for (let ch = 0; ch < channels.length; ch++) {
            if (Math.abs(channels[ch][i]) > threshold) {
                endSample = i;
                break outer;
            }
        }
    }

    const newLength = endSample + 1;

    const trimmed = new AudioBuffer({
        length: newLength,
        numberOfChannels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate
    });

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        trimmed.copyToChannel(
            channels[ch].slice(0, newLength),
            ch
        );
    }

    return trimmed;
}

function saveWavPatternToDB(name, audioBuffer) {

    return new Promise((resolve, reject) => {

        const wavArrayBuffer = audioBufferToWav(audioBuffer);

        const transaction =
            rnDB.transaction("wav_patterns", "readwrite");

        const store =
            transaction.objectStore("wav_patterns");

        const record = {
            id: "wav_" + Date.now(),
            name,
            duration: audioBuffer.duration,
            wavData: wavArrayBuffer
        };

        const request = store.put(record);

        request.onsuccess = () => resolve(record);
        request.onerror = reject;
    });
}

function deleteWavPattern(id, refresh) {

    const transaction =
        rnDB.transaction("wav_patterns", "readwrite");

    const store =
        transaction.objectStore("wav_patterns");

    store.delete(id);

    transaction.oncomplete = () => refresh();
}

function audioBufferToWav(buffer) {

    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);

    const channels = [];
    let offset = 0;
    let pos = 0;

    function writeString(s) {
        for (let i = 0; i < s.length; i++) {
            view.setUint8(pos++, s.charCodeAt(i));
        }
    }

    function writeUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function writeUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    writeString("RIFF");
    writeUint32(length - 8);
    writeString("WAVE");

    writeString("fmt ");
    writeUint32(16);
    writeUint16(1);
    writeUint16(numOfChan);
    writeUint32(buffer.sampleRate);
    writeUint32(buffer.sampleRate * 2 * numOfChan);
    writeUint16(numOfChan * 2);
    writeUint16(16);

    writeString("data");
    writeUint32(length - pos - 4);

    for (let i = 0; i < numOfChan; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0
                ? sample * 0x8000
                : sample * 0x7FFF;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return bufferArray;
}


function loadPatternsFromStorage() {

    const stored = localStorage.getItem("RN_DRUM_PATTERNS");

    if (!stored) {
        DRUM_PATTERNS = {};
        return;
    }

    try {
        DRUM_PATTERNS = JSON.parse(stored) || {};
    } catch (e) {
        console.warn("Pattern load failed:", e);
        DRUM_PATTERNS = {};
    }
}

function removePatternTracks() {

    const toRemove = audioTracks.filter(
            t => t._isPatternTrack &&
            t.type === "instrument" &&
            t.sampleBuffer &&
            t.label?.dataset?.pattern === "pattern"
        );

    toRemove.forEach(track => {

        track.trackElement.remove();
        track.label.remove();

        const index = audioTracks.indexOf(track);
        if (index !== -1) {
            audioTracks.splice(index, 1);
        }
    });
}

async function renderDrumPatternToWav(instruments, bars = 1) {

    const bpm = getBPM();
    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = resolution / 4;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;

    const totalSteps = resolution * bars;
    const duration = totalSteps * secondsPerStep;

    const sampleRate = 48000;

    const offlineCtx = new OfflineAudioContext(
        2,
        duration * sampleRate,
        sampleRate
    );

    instruments.forEach(inst => {

        inst.steps.forEach((v, stepIdx) => {

            if (!v) return;

            const src = offlineCtx.createBufferSource();
            src.buffer = inst.buffer;

            const gain = offlineCtx.createGain();
            gain.gain.value = 1;

            src.connect(gain);
            gain.connect(offlineCtx.destination);

            const time = stepIdx * secondsPerStep;

            src.start(time);
        });
    });

    const rendered = await offlineCtx.startRendering();

    return rendered;
}

