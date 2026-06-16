function openEqualizerpanel(track){
    const popupId = `equalizerTrack_${track.trackId}`;
    
    const eqControls = [60, 250, 1000, 4000, 8000].map((freq, i) =>
          createRNSlider({
            label: freq + ' Hz',
            value: track.settings.eq[i] ?? 0,
            min: -12,
            max: 12,
            width: 50,
            height: 200,
            step: 0.01,
            orientation: 'vertical',
            onChange: v => {
              track.settings.eq[i] = v;
              applyTrackEffects(track, track.settings);
            },
            onCommit: (before, after) => {
              pushHistory({
                undo() { track.settings.eq[i] = before; },
                redo() { track.settings.eq[i] = after; }
              });
            }
          })
    );
    const eqRow = document.createElement('div');
    eqRow.className = 'eq-slider-row';
    eqControls.forEach(slider => eqRow.appendChild(slider));
    
    openPopup({
        id: popupId,
        title: `Equalizer - Track ${track.trackId}`,
        content: eqRow,
        width: '360px',
        height: '350px',
        onClose: () => {
        //   document.querySelector('#custBtn_' + track.trackId)?.classList.remove('active');
        // stopPreview(); // if needed
        }
    });
}

function openTrackDelayPopup(track) {
    const popupId = `delayPopupTrack_${track.trackId}`;
    
    const delay = track.settings.delay;
    const fx = track.effects.delay;
    const ctx = audioContext;

    const body = document.createElement('div');
    body.className = 'popup-main-content';

    const toggleRow = document.createElement('div');
    toggleRow.className = 'fx-toggle-row';

    const toggle = document.createElement('div');
    toggle.className = 'fx-toggle';
    toggle.classList.toggle('active', delay.enabled);

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = delay.enabled ? 'ON' : 'OFF';

    toggle.onclick = () => {
        track.settings.delay.enabled = !track.settings.delay.enabled;
        toggle.classList.toggle('active', track.settings.delay.enabled);
        applyTrackDelay(track);
    };

    toggleRow.append(
        document.createTextNode('Delay'),
        toggle,
        toggleLabel
    );

    body.appendChild(toggleRow);

    body.appendChild(createRNSlider({
        label: 'Time (s)',
        value: delay.time,
        min: 0.01,
        max: 2,
        step: 0.01,
        width: 360,
        height: 50,
        onChange: v => {
            delay.time = v;
            if (delay.enabled) {
                applyTrackDelay(track);
            }
        }
    }));

    body.appendChild(createRNSlider({
        label: 'Feedback',
        value: delay.feedback,
        min: 0,
        max: 0.95,
        step: 0.01,
        width: 360,
        height: 50,
        onChange: v => {
            delay.feedback = v;
            if (delay.enabled) {
                applyTrackDelay(track);
            }
        }
    }));

    body.appendChild(createRNSlider({
        label: 'Mix',
        value: delay.mix,
        min: 0,
        max: 1,
        step: 0.01,
        width: 360,
        height: 50,
        onChange: v => {
            delay.mix = v;
            if (delay.enabled) {
                applyTrackDelay(track);
            }
        }
    }));

    body.appendChild(createRNSlider({
        label: 'Low Cut (Hz)',
        value: delay.lowCut,
        min: 20,
        max: 1000,
        step: 1,
        width: 360,
        height: 50,
        onChange: v => {
            delay.lowCut = v;
            if (delay.enabled) {
                applyTrackDelay(track);
            }
        }
    }));

    body.appendChild(createRNSlider({
        label: 'High Cut (Hz)',
        value: delay.highCut,
        min: 1000,
        max: 12000,
        step: 10,
        width: 360,
        height: 50,
        onChange: v => {
            delay.highCut = v;
            if (delay.enabled) {
                applyTrackDelay(track);
            }
        }
    }));
    
    body.appendChild(createRNSlider({
        label: 'Wet',
        min: 0,
        max: 1,
        step: 0.01,
        value: delay.wetGain ?? 0,
        width:360,
        height: 50,
        unit: '',
        onChange: v => {
            delay.wetGain = v;
            if (delay.enabled) {
                applyTrackDelay(track);
            }
        }
    }));
    
    body.appendChild(createRNSlider({
        label: 'Dry',
        min: 0,
        max: 1,
        step: 0.01,
        value: delay.dryGain ?? 0,
        width:360,
        height: 50,
        unit: '',
        onChange: v => {
            delay.dryGain = v;
            if (delay.enabled) {
                applyTrackDelay(track);
            }
        }
    }));
    
    body.appendChild(createRNSlider({
        label: 'Wide',
        value: delay.width ?? 1,
        min: -2,
        max: 2,
        width:360,
        height: 50,
        step: 0.01,
        onChange: v => {
            delay.width = v;
            if (delay.enabled) {
                applyTrackDelay(track);
            }
        }
    }));

    openPopup({
        id: popupId,
        title: `Delay / Echo`,
        content: body,
        width: '360px',
        height: '400px',
        onClose: () => {
          
        }
    });
}

function openTrackReverbPopup(track) {
    const popupId = `reverbTrack_${track.trackId}`;

    const r = track.settings.reverb;

    const body = document.createElement('div');
    body.className = 'popup-main-content';

    const toggleRow = document.createElement('div');
    toggleRow.className = 'popup-row';
    toggleRow.style.display = 'flex';
    toggleRow.style.alignItems = 'center';
    toggleRow.style.gap = '12px';

    const toggle = document.createElement('div');
    toggle.className = 'fx-toggle';
    toggle.classList.toggle('active', r.enabled);

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Enable Reverb';

    toggle.onclick = () => {
        r.enabled = !r.enabled;
        toggle.classList.toggle('active', r.enabled);
        applyTrackReverbSettings(track);
    };

    toggleRow.append(toggleLabel, toggle);
    body.appendChild(toggleRow);

    const typeRow = document.createElement('div');
    typeRow.className = 'popup-row';

    const typeLabel = document.createElement('div');
typeLabel.textContent = 'Type';

const typeSelect = document.createElement('select');
typeSelect.id = `reverbType_${track.trackId}`;

// Default placeholder option
const option1 = document.createElement('option');
option1.value = '';
option1.selected = true;
option1.hidden = true;
option1.textContent = 'Select Reverb Type';
typeSelect.appendChild(option1);

let cachedIRFiles = null;
// Fetch dynamic IR list from PHP
async function loadIRFilesIntoSelect() {
    
    if (cachedIRFiles) {
        populateSelect(cachedIRFiles);
        return;
    }
    try {
        const response = await fetch('./list_ir.php');
        if (!response.ok) throw new Error('Failed to fetch IR list');

        const data = await response.json();

        if (data.status !== 'success') {
            console.error('Error from PHP:', data);
            return;
        }

        // Populate select with fetched files
        //data.files.forEach(file => {
        //    const option = document.createElement('option');
        //    option.value = './ir/'+file.url;
        //    option.textContent = file.name;
        //    typeSelect.appendChild(option);
        //});
        
        cachedIRFiles = data.files;
        populateSelect(cachedIRFiles);

        // Optional: set default value if needed
        // typeSelect.value = './ir/hall.wav';

    } catch (err) {
        console.error('Failed to load IR files:', err);

        // Fallback to hardcoded list if PHP fails
        const fallbackFiles = [
            'corner.wav', 'hall.wav', 'nice_drum_room.wav', /* ... your old list ... */
        ];
        fallbackFiles.forEach(file => {
            const cleanName = file
                .replace(/\.wav$/i, '')
                .replace(/[_-]/g, ' ')
                .replace(/(\d+)/g, ' $1')
                .trim()
                .replace(/\b\w/g, c => c.toUpperCase());

            const option = document.createElement('option');
            option.value = `./ir/${file}`;
            option.textContent = cleanName;
            typeSelect.appendChild(option);
        });
    }
    
    function populateSelect(files) {
        files.forEach(file => {
            const option = document.createElement('option');
            option.value = './ir/'+file.url;
            option.textContent = file.name;
            typeSelect.appendChild(option);
        });
    }
}

// Load files immediately
loadIRFilesIntoSelect();

// Optional: sort alphabetically
// typeSelect.innerHTML = Array.from(typeSelect.options)
//   .sort((a, b) => a.textContent.localeCompare(b.textContent))
//   .map(opt => opt.outerHTML)
//   .join('');

    typeSelect.value = r.type;

    typeSelect.onchange = () => {
        r.type = typeSelect.value;
        loadTrackReverbIR(track, r.type);
    };

    typeRow.append(typeLabel, typeSelect);
    body.appendChild(typeRow);

    body.appendChild(createRNSlider({
        label: 'Pre Delay (s)',
        min: 0,
        max: 0.5,
        step: 0.001,
        width: 360,
        value: r.preDelay,
        onChange: v => {
            r.preDelay = v;
            applyTrackReverbSettings(track);
        }
    }));
    
    body.appendChild(createRNSlider({
        label: 'Wet',
        min: 0,
        max: 1,
        step: 0.001,
        width: 360,
        value: r.wetGain,
        onChange: v => {
            r.wetGain = v;
            applyTrackReverbSettings(track);
        }
    }));
    
    body.appendChild(createRNSlider({
        label: 'Dry',
        min: 0,
        max: 1,
        step: 0.001,
        width: 360,
        value: r.dryGain,
        onChange: v => {
            r.dryGain = v;
            applyTrackReverbSettings(track);
        }
    }));

    body.appendChild(createRNSlider({
        label: 'Low Cut (Hz)',
        min: 20,
        max: 2000,
        step: 1,
        width: 360,
        value: r.lowCut,
        onChange: v => {
            r.lowCut = v;
            applyTrackReverbSettings(track);
        }
    }));

    body.appendChild(createRNSlider({
        label: 'High Cut (Hz)',
        min: 1000,
        max: 20000,
        step: 10,
        width: 360,
        value: r.highCut,
        onChange: v => {
            r.highCut = v;
            applyTrackReverbSettings(track);
        }
    }));

    body.appendChild(createRNSlider({
        label: 'Stereo Width',
        min: -1,
        max: 1,
        step: 0.01,
        width: 360,
        value: r.width,
        onChange: v => {
            r.width = v;
            applyTrackReverbSettings(track);
        }
    }));

    openPopup({
        id: popupId,
        title: `Reverb`,
        content: body,
        width: '360px',
        height: '400px',
        onClose: () => {
          
        }
    });
}

// ──────────────────────────────────────────────
// Advanced Euclidean Sequencer Panel
// ──────────────────────────────────────────────
function openEuclideanSequencer(track) {
    const popupId = track.id+'_euseq';
    const title = 'Euclidean Sequencer';
    const euclidContainer = document.createElement('div');
    euclidContainer.style.margin = '15px 0';
    euclidContainer.style.padding = '15px';
    euclidContainer.style.background = 'rgba(33, 150, 243, 0.12)';
    euclidContainer.style.border = '1px solid #444';
    euclidContainer.style.borderRadius = '10px';
    euclidContainer.style.maxWidth = '420px';

    // Title
    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = '<strong>'+title+'</strong>';
    titleDiv.style.textAlign = 'center';
    titleDiv.style.marginBottom = '12px';
    titleDiv.style.fontSize = '1.1em';
    euclidContainer.appendChild(titleDiv);

    // Controls grid
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '10px';

    // Inputs
    const stepsInput = createSmallInput('Steps', 16, 4, 64);
    const hitsInput = createSmallInput('Hits', 4, 1, 16);
    const rotationInput = createSmallInput('Rotation', 0, 0, 63);
    const accentInput = createSmallInput('Accent every', 4, 1, 16);

    grid.append(
        stepsInput.div,
        hitsInput.div,
        rotationInput.div,
        accentInput.div
    );

    // Preset selector
    const presetDiv = document.createElement('div');
    presetDiv.style.gridColumn = '1 / -1';
    const presetSelect = document.createElement('select');
    presetSelect.innerHTML = `
        <option value="">Custom</option>
        <option value="3:8">3:8 Clave</option>
        <option value="4:16">4 hits in 16</option>
        <option value="5:16">5 hits in 16 (Bossa)</option>
        <option value="7:16">7 hits in 16</option>
        <option value="11:16">11 hits in 16</option>
        <option value="2:7">2:7 (simple)</option>
    `;
    presetDiv.appendChild(presetSelect);

    // Preview grid
    const preview = document.createElement('div');
    preview.style.gridColumn = '1 / -1';
    preview.style.height = '60px';
    preview.style.background = '#1a1a2e';
    preview.style.border = '1px solid #444';
    preview.style.borderRadius = '6px';
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.justifyContent = 'center';
    preview.style.overflow = 'hidden';
    preview.innerHTML = '<div style="color:#666">Preview will appear here</div>';

    // Buttons row
    const btnRow = document.createElement('div');
    btnRow.style.gridColumn = '1 / -1';
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.marginTop = '10px';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply to Track';
    applyBtn.className = 'btn btn-primary';
    applyBtn.style.flex = '1';

    const randomizeBtn = document.createElement('button');
    randomizeBtn.textContent = 'Randomize';
    randomizeBtn.className = 'btn btn-secondary';

    const savePresetBtn = document.createElement('button');
    savePresetBtn.textContent = 'Save Preset';
    savePresetBtn.className = 'btn btn-small';

    btnRow.append(applyBtn, randomizeBtn, savePresetBtn);

    euclidContainer.append(
        grid,
        presetDiv,
        preview,
        btnRow
    );

    // ─── Logic ──────────────────────────────────────
    function generateEuclidean(steps, hits, rotation = 0) {
        if (hits === 0) return new Array(steps).fill(false);
        if (hits >= steps) return new Array(steps).fill(true);

        const pattern = new Array(steps).fill(false);
        let step = 0;
        for (let i = 0; i < hits; i++) {
            pattern[(step + rotation) % steps] = true;
            step += Math.floor(steps / hits);
        }
        return pattern;
    }

    function updatePreview() {
        const steps = parseInt(stepsInput.input.value) || 16;
        const hits = parseInt(hitsInput.input.value) || 4;
        const rot = parseInt(rotationInput.input.value) || 0;

        const pattern = generateEuclidean(steps, hits, rot);

        preview.innerHTML = '';
        const gridPrev = document.createElement('div');
        gridPrev.style.display = 'grid';
        gridPrev.style.gridTemplateColumns = `repeat(${steps}, 1fr)`;
        gridPrev.style.gap = '2px';
        gridPrev.style.padding = '6px';
        gridPrev.style.width = '100%';
        gridPrev.style.height = '100%';

        pattern.forEach((on, i) => {
            const dot = document.createElement('div');
            dot.style.background = on ? '#4caf50' : '#333';
            dot.style.borderRadius = '50%';
            dot.style.height = '100%';
            dot.style.aspectRatio = '1';
            dot.title = i;
            gridPrev.appendChild(dot);
        });

        preview.appendChild(gridPrev);
    }

    // Events
    [stepsInput.input, hitsInput.input, rotationInput.input].forEach(inp => {
        inp.addEventListener('input', updatePreview);
    });

    presetSelect.addEventListener('change', () => {
        const val = presetSelect.value;
        if (!val) return;

        let steps = 16, hits = 4, rot = 0;
        if (val === '3:8') { steps = 8; hits = 3; rot = 0; }
        else if (val === '4:16') { steps = 16; hits = 4; rot = 0; }
        else if (val === '5:16') { steps = 16; hits = 5; rot = 0; }
        else if (val === '7:16') { steps = 16; hits = 7; rot = 0; }
        else if (val === '11:16') { steps = 16; hits = 11; rot = 0; }
        else if (val === '2:7') { steps = 7; hits = 2; rot = 0; }

        stepsInput.input.value = steps;
        hitsInput.input.value = hits;
        rotationInput.input.value = rot;
        updatePreview();
    });

    applyBtn.onclick = () => {
        const steps = parseInt(stepsInput.input.value) || 16;
        const hits = parseInt(hitsInput.input.value) || 4;
        const rot = parseInt(rotationInput.input.value) || 0;

        const pattern = generateEuclidean(steps, hits, rot);

        // Apply to track steps (adjust range if needed)
        for (let i = 0; i < Math.min(steps, track.steps.length); i++) {
            track.steps[i] = pattern[i];
        }

        updateTrackUI(track);
        drawTrackSteps(track);
    };

    randomizeBtn.onclick = () => {
        const steps = parseInt(stepsInput.input.value) || 16;
        const hits = Math.floor(Math.random() * (steps / 2)) + 2;
        const rot = Math.floor(Math.random() * steps);

        hitsInput.input.value = hits;
        rotationInput.input.value = rot;
        updatePreview();
    };

    // Optional: Save preset to localStorage
    savePresetBtn.onclick = () => {
        const preset = {
            steps: stepsInput.input.value,
            hits: hitsInput.input.value,
            rotation: rotationInput.input.value
        };
        localStorage.setItem('lastEuclidPreset', JSON.stringify(preset));
        alert("Preset saved!");
    };

    // Load last preset if exists
    const saved = localStorage.getItem('lastEuclidPreset');
    if (saved) {
        try {
            const p = JSON.parse(saved);
            stepsInput.input.value = p.steps;
            hitsInput.input.value = p.hits;
            rotationInput.input.value = p.rotation;
            updatePreview();
        } catch {}
    }

    updatePreview();
    
    openPopup({
        id: popupId,
        title: title,
        content: euclidContainer,
        width: '360px',
        height: '400px',
        onClose: () => {
          
        }
    });

}