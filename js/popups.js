function openInstrumentPopup(track) {
    track.settings ??= {};
    track.settings.source ??= 'oscillator';
    track.settings.volume ??= 1;
    track.settings.pan ??= 0;
    track.settings.pitch ??= 1;
    track.settings.attack ??= 0.01;
    track.settings.decay ??= 0.08;
    track.settings.sustain ??= 0.6;
    track.settings.release ??= 0.12;
    track.settings.eq ??= [0,0,0,0,0];
    track.settings.delayTime ??= 0;
    track.settings.delayGain ??= 0;
    document.querySelectorAll('.labels-btn').forEach(el => el.classList.remove('active'));

    const popup = document.createElement('div');
    popup.className = 'popup-main-content';
    popup.id = 'track_'+track.trackId;
    popupId = 'track_'+track.trackId;
    const labelText = document.querySelector('#trackL_'+track.trackId).dataset.name
    let title  = '';
    if(track.type === 'synth'){
        title = labelText ? labelText + ' Settings - '+ track.trackId : 'Synth Track Settings - '+ track.trackId;
    } else if(track.type === 'audio') {
        title = labelText ? labelText + ' Settings - '+ track.trackId : 'Audio Track Settings - '+ track.trackId;
    } else {
        title = labelText ? labelText + ' Settings - '+ track.trackId : 'Instrument Track Settings - '+ track.trackId;
    }
    
    const popupBody = document.createElement('div');
    popupBody.className = 'popup-sub-content';

    const nameInput = createTextField('Name', track.label.dataset.name, newName => {
        track.label.dataset.name = newName.slice(0, 7);
        track.label.childNodes[0].textContent = newName.slice(0, 7); 
    });

    const instrumentRow = document.createElement('div');
    instrumentRow.style.display = 'flex';
    instrumentRow.style.alignItems = 'center';
    instrumentRow.style.gap = '12px';
    instrumentRow.style.margin = '15px 0';
    instrumentRow.style.padding = '10px';
    instrumentRow.style.background = 'rgba(0,0,0,0.2)';
    instrumentRow.style.borderRadius = '6px';
    instrumentRow.style.border = '1px solid #444';

    const infoCol = document.createElement('div');
    infoCol.style.flex = '1';
    infoCol.style.overflow = 'hidden';

    const rowLabel = document.createElement('div');
    rowLabel.textContent = 'Selected Sample';
    rowLabel.style.fontSize = '10px';
    rowLabel.style.color = '#888';
    rowLabel.style.marginBottom = '4px';
    
    const modeLabel = document.createElement('div');
    modeLabel.textContent =
        track.settings.source === 'sample'
            ? 'Mode: Sample'
            : 'Mode: Oscillator';
    
    modeLabel.style.fontSize = '11px';
    modeLabel.style.color = '#aaa';

    const currentFileName = document.createElement('div');
    currentFileName.innerHTML =
    track.settings.source === 'sample'
        ? `&#128190; ${track.instrument || 'No sample selected'}`
        : `&#127932; ${track.instrument || track.settings.synth || 'Oscillator'}`;

    currentFileName.style.fontSize = '13px';
    currentFileName.style.color = '#4caf50';
    currentFileName.style.whiteSpace = 'nowrap';
    currentFileName.style.overflow = 'hidden';
    currentFileName.style.textOverflow = 'ellipsis';
    currentFileName.style.fontWeight = 'bold';

    infoCol.appendChild(modeLabel);
    infoCol.append(rowLabel, currentFileName);

    let previewSource = null;
    const previewBtn = document.createElement('img');
    previewBtn.src = playIcon;
    previewBtn.className = 'top-btn';

    const stopPreview = () => {
        if (previewSource) {
            try { previewSource.stop(); previewSource.disconnect(); } catch (e) {}
            previewSource = null;
            previewBtn.src = playIcon;
        }
    };

    previewBtn.onclick = () => {
        if (previewSource) {
            stopPreview();
        } else {
            if (track.settings.source === 'sample' && track.sampleBuffer) {
                previewSource = audioContext.createBufferSource();
                previewSource.buffer = track.sampleBuffer;
                previewSource.loop = true;
            } else {
                previewSource = audioContext.createOscillator();
                previewSource.type = track.instrument || track.settings.synth;
                previewSource.frequency.setValueAtTime(261.63, audioContext.currentTime);
            }

            if (track.effects && track.effects.inputNode) {
                previewSource.connect(track.effects.inputNode);
            } else {
                previewSource.connect(masterBus.input);
            }

            previewSource.start();
            previewBtn.src = stopIcon;
        }
    };

    instrumentRow.append(infoCol, previewBtn);

    const fileInputContainer = document.createElement('div');
    fileInputContainer.className = 'popup-field-vertical';
    fileInputContainer.style.marginBottom = '20px';

    const fileLabel = document.createElement('label');
    fileLabel.textContent = 'Load New Sample';
    fileLabel.style.display = 'block';
    fileLabel.style.fontSize = '12px';
    fileLabel.style.marginBottom = '8px';

    const instrumentInput = document.createElement('input');
    instrumentInput.type = 'file';
    instrumentInput.accept = 'audio/*';
    instrumentInput.style.width = '100%';

    instrumentInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        currentFileName.innerHTML = "&#8987; Loading...";
    
        try {
            const arrayBuffer = await file.arrayBuffer();
            const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
            track.sampleBuffer = decodedBuffer;
            track.instrument = file.name;
            track.settings.source = 'sample';
    
            const displayName =
                file.name.length > 7 ? file.name.slice(0, 7) + ".." : file.name;
    
            if (track.label && track.label.childNodes[0]) {
                track.label.childNodes[0].textContent = displayName;
            }
    
            track.label.title = file.name;
            track.label.dataset.name = file.name;
            currentFileName.innerHTML = `&#128190; ${file.name}`;
    
            if (track.type === 'audio') {
                track.clips.forEach(clip => {
                    clip.buffer = decodedBuffer;
                    clip.trimStart = 0;
                    clip.trimEnd = decodedBuffer.duration;
    
                    if (clip.dom) clip.dom.remove();
                    renderClip(track, clip);
                });
    
                const pps = getPPS();
                const sampleWidth = decodedBuffer.duration * pps;
                const rulerWidth = totalSeconds * pps;
                track.trackElement.style.width =
                    Math.max(sampleWidth, rulerWidth) + 'px';
    
                const endTime = decodedBuffer.duration;
                if (endTime > totalSeconds) {
                    totalSeconds = Math.ceil(endTime + 1);
                    drawAudioGrid(track);
                    syncInstrumentStepsToTimeline();
                    applyZoom();
                }
            }
    
        } catch (err) {
            currentFileName.innerHTML = "&#10060; Error Loading";
            console.error("Audio Decode Error:", err);
        }
    };
    
    const flex_3 = document.createElement('div');
    flex_3.className = 'flex-center';

    fileInputContainer.append(fileLabel, instrumentInput);
    
    const libBtn = document.createElement('button');
    libBtn.innerHTML = '&#128194; Open Library';
    libBtn.className = 'library-btn btn btn-default';
    libBtn.style.marginBottom = '10px';
    libBtn.style.width = '100%';
    libBtn.style.background = '#2196F3';
    
    libBtn.onclick = () => {
        openLibraryPopup((decodedBuffer, fileName, fullPath) => {
            track.sampleBuffer = decodedBuffer;
            track.instrument = fileName;
            track.libraryPath = fullPath;
            
            currentFileName.innerHTML = `&#128190; ${fileName}`;
            
            const displayName = fileName.length > 7 ? fileName.slice(0, 7) + ".." : fileName;
            if (track.label && track.label.childNodes[0]) {
                track.label.childNodes[0].textContent = displayName;
            }
            track.label.title = fileName;
            track.label.dataset.name = fileName;
            track.settings.source = 'sample';
            
            if (track.type === 'audio') {
                track.clips.forEach(clip => {
                    clip.buffer = decodedBuffer;
                    clip.trimStart = 0;
                    clip.trimEnd = decodedBuffer.duration;
                    clip.libraryPath = fullPath;
        
                    if (clip.dom) clip.dom.remove();
                    renderClip(track, clip);
                });
            }
        });
    };
    
    const oscBtn = document.createElement('button');
    oscBtn.className = 'btn btn-default';
    oscBtn.style.width = '100%';
    oscBtn.style.marginBottom = '10px';
    oscBtn.textContent = 'Sound Engine';
    oscBtn.onclick = () => openOscillatorPopup(track);
    
    if (track.type === 'audio') {
        track.settings.source = 'oscillator';
        track.sampleBuffer = null;
    }
    
    flex_3.append(oscBtn, libBtn);
    fileInputContainer.prepend(flex_3);
    
    const patternSection = document.createElement("div");
    patternSection.style.padding = '5px';
    patternSection.style.borderRadius = '4px';
    patternSection.style.border = '1px solid #333';
    patternSection.style.margin = "10px 0";
    
    const patternTitle = document.createElement("div");
    patternTitle.textContent = "WAV Patterns";
    patternTitle.style.fontWeight = "bold";
    patternTitle.style.marginBottom = "10px";
    
    patternSection.appendChild(patternTitle);
    
    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";
    
    patternSection.appendChild(list);

    const { volume, eq, delayTime, delayGain } = track.settings;

    const volumeControl = 
        createRNSlider({
            label: 'Velocity',
            value: track.settings.volume ?? 1,
            min: 0,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                track.settings.volume = v;
                applyTrackEffects(track, track.settings);
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { track.settings.volume = before; },
                    redo() { track.settings.volume = after; }
                });
            }
        });
    
    const attackControl = 
        createRNSlider({
            label: 'Attack (s)',
            value: track.settings.attack ?? 0.01,
            min: 0.01,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                track.settings.attack = v;
                applyTrackEffects(track, track.settings);
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { track.settings.attack = before; },
                    redo() { track.settings.attack = after; }
                });
            }
        });
    
    const decayControl = 
        createRNSlider({
            label: 'Decay (s)',
            value: track.settings.decay ?? 1.0,
            min: 0.01,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                track.settings.decay = v;
                applyTrackEffects(track, track.settings);
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { track.settings.decay = before; },
                    redo() { track.settings.decay = after; }
                });
            }
        });
    
    const sustainControl = 
        createRNSlider({
            label: 'Sustain',
            value: track.settings.sustain ?? 1.0,
            min: 0.01,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                track.settings.sustain = v;
                applyTrackEffects(track, track.settings);
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { track.settings.sustain = before; },
                    redo() { track.settings.sustain = after; }
                });
            }
        });
    
    const releaseControl = 
        createRNSlider({
            label: 'Release',
            value: track.settings.release ?? 1.00,
            min: 0.01,
            max: 5,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                track.settings.release = v;
                applyTrackEffects(track, track.settings);
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { track.settings.release = before; },
                    redo() { track.settings.release = after; }
                });
            }
        });

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
    
    const flexCDiv_1 = document.createElement('div');
    flexCDiv_1.className = 'flex-center';
    flexCDiv_1.style.marginBottom = '15px';
    
    const eqRowHeading = document.createElement('button');
    eqRowHeading.className = 'btn btn-default';
    const eqRowHeadingDiv = document.createElement('div');
    eqRowHeading.textContent = 'Equalizer';
    eqRowHeadingDiv.appendChild(eqRowHeading);
    eqRowHeading.onclick = () => openEqualizerpanel(track);
    
    const delayBtn = document.createElement('button');
    delayBtn.className = 'btn btn-default';
    delayBtn.textContent = 'Delay / Echo';
    delayBtn.onclick = () => openTrackDelayPopup(track);
    
    const reverbBtn = document.createElement('button');
    reverbBtn.className = 'btn btn-default';
    reverbBtn.textContent = 'Reverb';
    reverbBtn.onclick = () => openTrackReverbPopup(track);
    
    flexCDiv_1.append(eqRowHeadingDiv, delayBtn, reverbBtn)
    
    const pitchControl = 
        createRNSlider({
            label: 'Pitch',
            value: track.settings.pitch ?? 0,
            min: 1,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                track.settings.pitch = v;
                applyTrackEffects(track, track.settings);
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { track.settings.pitch = before; },
                    redo() { track.settings.pitch = after; }
                });
            }
        });
    
    const panControl = 
        createRNSlider({
            label: 'Pan',
            value: track.settings.pan ?? 0,
            min: -1,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                track.settings.pan = v;
                applyTrackEffects(track, track.settings);
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { track.settings.pan = before; },
                    redo() { track.settings.pan = after; }
                });
            }
        });

    const flexCDiv = document.createElement('div');
    flexCDiv.className = 'flex-center';
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove Track';
    removeBtn.className = 'remove-track-btn btn btn-red';
    removeBtn.style.marginTop = '20px';
    removeBtn.addEventListener('click', () => {
        stopPreview();
        confirmRemoveTrack(track, popup);
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save & Close';
    saveBtn.className = 'save-track-btn btn btn-default';
    saveBtn.style.marginTop = '20px';
    saveBtn.addEventListener('click', () => {
        stopPreview();
        popup.remove();
    });
    
    const euclidContainer = document.createElement('div');
    euclidContainer.style.margin = '15px 0';
    euclidContainer.style.padding = '12px';
    euclidContainer.style.background = 'rgba(33, 150, 243, 0.1)';
    euclidContainer.style.border = '1px solid #333';
    euclidContainer.style.borderRadius = '8px';
    
    const tleDiv = document.createElement('div');
    tleDiv.style.textAlign = 'center';
    tleDiv.style.marginBottom = '10px';
    tleDiv.innerHTML = '<strong>Euclidean Sequencer</strong>';
    euclidContainer.appendChild(tleDiv);
    
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '8px';
    
    const contDiv = document.createElement('div');
    const typeLabel = document.createElement('label');
    typeLabel.innerHTML = `<span style="display:block;font-size:10px;color:#888;margin-bottom:5px;">Range Unit:</span> `;
    const typeSelect = document.createElement('select');
    typeSelect.innerHTML = `<option value="seconds">Seconds</option><option value="steps">Step Index (0, 1, 2...)</option>`;
    typeSelect.style.width = '100%';
    typeSelect.style.marginBottom = '10px';
    contDiv.append(typeLabel, typeSelect);
    
    const ovrWrDiv = document.createElement('div');
    ovrWrDiv.innerHTML = `<label style="display:block;font-size:10px;color:#888;margin-bottom:5px;">Overwrite:</label>`;
    const ovrWrSelect = document.createElement('select');
    ovrWrSelect.innerHTML = `<option value="no">No</option><option value="yes">Yes</option>`;
    ovrWrSelect.style.width = '100%';
    ovrWrDiv.appendChild(ovrWrSelect);
    
    const startField = createSmallInput('Start', 0);
    const endField = createSmallInput('End', 15);
    const nthField = createSmallInput('Nth Value', 4);
    
    const modeDiv = document.createElement('div');
    modeDiv.innerHTML = `<label style="display:block;font-size:10px;color:#888;">Nth is in:</label>`;
    const modeSelect = document.createElement('select');
    modeSelect.innerHTML = `<option value="step">Steps</option><option value="beat">Beats</option>`;
    modeSelect.style.width = '100%';
    modeDiv.appendChild(modeSelect);
    
    grid.append(contDiv, ovrWrDiv, startField.div, endField.div, nthField.div, modeDiv);
    
    const applyEuclidBtn = document.createElement('button');
    applyEuclidBtn.innerHTML = '<img src="'+gridIcon+'" style="width:20px;height:20px;"/> Generate Sequence';
    applyEuclidBtn.className = 'btn btn-default';
    applyEuclidBtn.style.background = '#2196F3';
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex-center';
    btnGroup.style.marginTop = "15px";
    
    applyEuclidBtn.onclick = () => {
        applyEuclideanPattern(track, {
            start: parseFloat(startField.input.value),
            end: parseFloat(endField.input.value),
            nth: parseFloat(nthField.input.value),
            mode: modeSelect.value,
            rangeType: typeSelect.value,
            resolution: resolution ,
            ovrWrSelect: ovrWrSelect.value
        });
    };
    
    const clearBtn = document.createElement('button');
    clearBtn.innerHTML = '<span style="font-size:14px;">&#128465;️ Clear Track</span>';
    clearBtn.className = 'btn btn-red';
    clearBtn.onclick = () => {
        if (confirm("Clear all steps on this track?")) {
            clearTrackSteps(track);
        }
    };
    
    btnGroup.append(applyEuclidBtn, clearBtn);
    
    euclidContainer.append(grid, btnGroup);
            
            popupBody.append(nameInput);
            if (track.type !== 'audio' && track.type !== 'synth') {
                popupBody.append(euclidContainer);
            }
            flexCDiv.append(
                removeBtn,
                saveBtn
            );
            popupBody.append(
                instrumentRow,
                fileInputContainer,
                patternSection,
                flexCDiv_1,
                volumeControl,
                pitchControl,
                panControl,
                attackControl,
                decayControl,
                sustainControl,
                releaseControl,
                flexCDiv
            );
  
    openPopup({
        id: popupId,
        title: title,
        content: popupBody,
        width: '360px',
        height: '400px',
        onClose: () => {
          
        }
    });
    
    async function loadWavPatternsIntoUI() {

        const transaction =
            rnDB.transaction("wav_patterns", "readonly");
    
        const store =
            transaction.objectStore("wav_patterns");
    
        const request = store.getAll();
    
        request.onsuccess = () => {
    
            list.innerHTML = "";
    
            request.result.forEach(record => {
    
                const row = document.createElement("div");
                row.style.display = "flex";
                row.style.justifyContent = "space-between";
                row.style.alignItems = "center";
    
                const btn = document.createElement("button");
                btn.className = "btn btn-default";
                btn.textContent = record.name;
    
                btn.onclick = async () => {

                    const arrayBuffer = record.wavData;
                
                    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
                
                    
                    if (track.type === 'audio') {
                        track.clips.forEach(clip => {
                            if (clip.dom) clip.dom.remove();
                        });
                        
                        track.sampleBuffer = decoded;
                        
                        track.clips = [];
                        const clip = createClip(decoded, 0);
                        track.clips.push(clip);
                        renderClip(track, clip);
                        
                        track.label.dataset.name = record.name || "WAV Pattern";
                        track.label.querySelector('.track-subdiv').textContent = record.name || "WAV Pattern";
                        
                        syncTrackSettings(track);
                        updateTrackStates();
                    }
                
                };

                const del = document.createElement("button");
                del.textContent = "X";
                del.className = "btn btn-red";
                del.onclick = () => deleteWavPattern(record.id, loadWavPatternsIntoUI);
    
                row.append(btn, del);
                list.appendChild(row);
            });
        };
    }
    loadWavPatternsIntoUI();
}

function openAudioTrackPopup(track, targetTrackIdx) {

    const popupId = `audioTrack_${track.trackId}`;
    const popupBody = document.createElement('div');
    popupBody.className = 'popup-main-content';
    const title = `AUDIO TRACK ${track.trackId}`;

    popupBody.innerHTML = `
    <div class="flex-center">
        <button class="btn btn-default" id="new-audio-clip" title="Add New Clip">
            <img src="./img/icons/plus-64-w.png"/>
        </button>
        <button class="btn btn-default" id="audio-paste" title="Paste Clip">
            <img src="./img/icons/stamp-64-w.png"/>
        </button>
        <button class="btn btn-default" id="paste-lasso" title="Paste Lasso">
            <img src="./img/icons/paste-64-w.png"/>
        </button>
        <button class="btn btn-default danger" id="audio-clear" title=" Clear Track">
            <img src="./img/icons/clear-64-w.png"/>
        </button>
    </div>`;
    
    const cpopup = document.querySelector('#'+popupId);

    popupBody.querySelector('#new-audio-clip').onclick = () => {
        newAudioClipAtClick(track);
    };
    
    popupBody.querySelector('#audio-paste').onclick = () => {
        pasteAudioClipAtClick(track);
    };
    
    popupBody.querySelector('#paste-lasso').onclick = () => {
        pastFromLasso(targetTrackIdx);
    };

    popupBody.querySelector('#audio-clear').onclick = () => {
        track.clips.forEach(c => c.dom?.remove());
        track.clips = [];
    };
    openPopup({
        id: popupId,
        title: title,
        content: popupBody,
        width: '360px',
        height: '100px',
        onClose: () => {
          
        }
    });
}

async function openLibraryPopup(onSelect) {
    const addClass = 'library-popup';
    const popupId = `libPopup`;
    const libPopup = document.createElement('div');
    libPopup.className = 'library-popup';

    const panel = document.createElement('div');
    panel.className = 'library-panel';
    panel.style.width = '350px';
    panel.style.maxWidth = '600px';
    panel.style.height = '450px';

    const title = `Sample Library`;

    const body = document.createElement('div');
    body.className = 'library-body';
    body.style.display = 'flex';
    body.style.height = 'calc(100% - 60px)';

    const categoryList = document.createElement('div');
    categoryList.className = 'library-categories';
    categoryList.style.overflowY = 'auto';

    const sampleList = document.createElement('div');
    sampleList.className = 'library-samples';
    sampleList.style.overflowY = 'auto';
    sampleList.style.paddingLeft = '10px';

    try {
        loadLibraryUI(libPopup, categoryList, sampleList, onSelect);

    } catch (err) {
        sampleList.textContent = "Failed to load library data.";
    }

    libPopup.append(categoryList, sampleList, body);
    
    openPopup({
        id: popupId,                     
        title: title,
        content: libPopup,
        width: '360px',
        height: '400px',
        addClass: addClass,
        remex: addClass,
        onClose: () => {
          stopGlobalPreview();
        }
      });
}

let cachedSampleFiles = null;
async function loadLibraryUI(libPopup, container, sampleList, onSelect) {
    let response = null;
    let libraryData = null;
    
    if (cachedSampleFiles) {
        libraryData = cachedSampleFiles;
    } else {
        const res = await fetch('./samples.json');
        libraryData = await res.json();
        cachedSampleFiles =  libraryData;
    }

    let currentPathStack = [];
    let currentNode = libraryData;

    container.innerHTML = '';
    sampleList.innerHTML = '';

    const topBar = document.createElement('div');
    topBar.style.position = 'sticky';
    topBar.style.top = '0';
    topBar.style.background = '#222';
    topBar.style.display = "flex";
    topBar.style.alignItems = "center";
    topBar.style.gap = "8px";
    topBar.style.paddingBottom = "8px";

    const backBtn = document.createElement('button');
    backBtn.textContent = "←";
    backBtn.className = "btn btn-default";
    backBtn.style.display = "none";

    const breadcrumb = document.createElement('div');
    breadcrumb.style.flexGrow = "1";
    breadcrumb.style.fontSize = "12px";
    breadcrumb.style.opacity = "0.8";

    const searchInput = document.createElement('input');
    searchInput.type = "text";
    searchInput.placeholder = "Search samples...";
    searchInput.style.padding = "5px"; 
    searchInput.style.width = "180px";

    topBar.append(backBtn, breadcrumb, searchInput);
    libPopup.prepend(topBar, sampleList);

    function renderNode(node) {
        container.innerHTML = '';
        sampleList.innerHTML = '';

        Object.keys(node).forEach(key => {

            const item = node[key];

            if (item.type === "folder") {

                const catBtn = document.createElement('div');
                catBtn.className = 'library-item category-item';
                catBtn.textContent = key;

                catBtn.onclick = () => {
                    currentPathStack.push({
                        node: currentNode,
                        name: key
                    });

                    currentNode = item.children;
                    renderNode(currentNode);
                };

                container.appendChild(catBtn);
            }

            if (item.type === "file") {

                const row = document.createElement('div');
                row.className = 'library-item sample-row';
                row.textContent = item.name;
                
                const fullPath = './' + item.path;

                const spinner = document.createElement("div");
                spinner.style.position = "absolute";
                spinner.style.right = "3px";
                spinner.style.width = "14px";
                spinner.style.height = "14px";
                spinner.style.border = "2px solid #555";
                spinner.style.borderTop = "2px solid #4caf50";
                spinner.style.borderRadius = "50%";
                spinner.style.display = "none";
                spinner.style.animation = "rnSpin 0.8s linear infinite";
                row.prepend(spinner);
                
                if (window.loadedLibrarySamples[fullPath]) {
                    row.style.color = "#4caf50";
                } else {
                    row.style.color = "#ddd";
                }
                
                row.onclick = async (e) => {
                    if (window.loadedLibrarySamples[fullPath]) {
                        await previewLibraryFile(fullPath);
                        return;
                    }
                
                    spinner.style.display = "block";
                    row.style.color = "#aaa";
                
                    try {
                
                        await previewLibraryFile(fullPath);
                        window.loadedLibrarySamples[fullPath] = true;
                
                        row.style.color = "#4caf50";
                
                    } catch (err) {
                
                        console.error("Load failed:", err);
                        row.style.color = "#ddd";
                
                        setTimeout(() => {
                            nameSpan.style.color = "";
                        }, 1200);
                
                    } finally {
                        spinner.style.display = "none";
                    }
                };
            
                const useBtn = document.createElement('button');
                useBtn.textContent = "Use";
                useBtn.className = "btn btn-default";
                useBtn.style.marginLeft = "8px";

                useBtn.onclick = async (e) => {
                    e.stopPropagation();
                    stopGlobalPreview();
                    const popup = document.querySelector('#libPopup');
                    await loadLibrarySample(
                        item.path,
                        item.name,
                        onSelect
                    );
                    popup.remove();
                };

                row.appendChild(useBtn);
                sampleList.appendChild(row);
            }
        });

        updateBreadcrumb();
    }

    function updateBreadcrumb() {

        if (!currentPathStack.length) {
            breadcrumb.textContent = "Root";
            backBtn.style.display = "none";
            return;
        }

        backBtn.style.display = "inline-block";

        const names = currentPathStack.map(p => p.name);
        breadcrumb.textContent = "Root / " + names.join(" / ");
    }

    backBtn.onclick = () => {

        if (!currentPathStack.length) return;

        const last = currentPathStack.pop();
        currentNode = last.node;

        renderNode(currentNode);
    };

    searchInput.oninput = () => {

        const query = searchInput.value.toLowerCase();

        if (!query) {
            renderNode(currentNode);
            return;
        }
        container.innerHTML = '';
        sampleList.innerHTML = '';

        function searchRecursive(node) {

            Object.keys(node).forEach(key => {

                const item = node[key];

                if (item.type === "file") {

                    if (item.name.toLowerCase().includes(query)) {

                        const row = document.createElement('div');
                        row.className = 'library-item sample-row';
                        row.textContent = item.name;
                        
                        const fullPath = './' + item.path;

                        const spinner = document.createElement("div");
                        spinner.style.position = "absolute";
                        spinner.style.right = "3px";
                        spinner.style.width = "14px";
                        spinner.style.height = "14px";
                        spinner.style.border = "2px solid #555";
                        spinner.style.borderTop = "2px solid #4caf50";
                        spinner.style.borderRadius = "50%";
                        spinner.style.display = "none";
                        spinner.style.animation = "rnSpin 0.8s linear infinite";
                        
                        row.prepend(spinner);
                        
                        if (window.loadedLibrarySamples[fullPath]) {
                            row.style.color = "#4caf50";
                        } else {
                            row.style.color = "#ddd";
                        }
                        
                        row.onclick = async (e) => {

                            if (window.loadedLibrarySamples[fullPath]) {
                                await previewLibraryFile(fullPath);
                                return;
                            }
                        
                            spinner.style.display = "block";
                            row.style.color = "#aaa";
                        
                            try {
                        
                                await previewLibraryFile(fullPath);
                                window.loadedLibrarySamples[fullPath] = true;
                                row.style.color = "#4caf50";
                        
                            } catch (err) {
                        
                                console.error("Load failed:", err);
                                row.style.color = "#ddd";
                        
                                setTimeout(() => {
                                    row.style.color = "";
                                }, 1200);
                        
                            } finally {
                                spinner.style.display = "none";
                            }
                        };
                        
                        const useBtn = document.createElement('button');
                        useBtn.textContent = "Use";
                        useBtn.className = "btn btn-default";
                        useBtn.style.marginLeft = "8px";
        
                        useBtn.onclick = async (e) => {
                            e.stopPropagation();
                            stopGlobalPreview();
                            const popup = document.querySelector('#libPopup');
                            await loadLibrarySample(
                                item.path,
                                item.name,
                                onSelect
                            );
                            popup.remove();
                        };
                        row.append(useBtn);
                        sampleList.appendChild(row);
                    }
                }

                if (item.type === "folder") {
                    searchRecursive(item.children);
                }
            });
        }

        searchRecursive(libraryData);
    };

    renderNode(currentNode);
}

async function loadLibrarySample(url, fileName, onSelect) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        onSelect(decodedBuffer, fileName, url);
    } catch (err) {
        console.error("Library Load Error:", err);
        alert("Could not load sample: " + fileName);
    }
}

async function previewLibraryFile(url) {
    stopGlobalPreview();
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        libraryPreviewSource = audioContext.createBufferSource();
        libraryPreviewSource.buffer = decodedBuffer;
        libraryPreviewSource.connect(masterBus.input);
        libraryPreviewSource.start(0);
        console.log("Loaded sample: " + url);
    } catch (err) {
        console.error("Preview Error:", err);
    }
}

function applyEuclideanPattern(track, params) {
    const { start, end, nth, mode, rangeType, resolution, ovrWrSelect } = params;
    const stepsPerBeat = resolution / 4;

    let stepInterval = mode === 'beat' ? nth * stepsPerBeat : nth;
    stepInterval = Math.max(1, stepInterval); 

    let startIdx, endIdx;
    if (rangeType === 'steps') {
        startIdx = Math.max(0, parseInt(start));
        endIdx = Math.min(track.steps.length - 1, parseInt(end));
    } else {
        const bpm = getBPM();
        const secondsPerStep = (60 / bpm) / stepsPerBeat;
        startIdx = Math.max(0, Math.round(start / secondsPerStep));
        endIdx = Math.min(track.steps.length - 1, Math.round(end / secondsPerStep));
    }

    if(ovrWrSelect === 'yes'){
        for (let i = startIdx; i <= endIdx; i++) track.steps[i] = false;
    }

    for (let i = startIdx; i <= endIdx; i += stepInterval) {
        const targetIdx = Math.round(i);
        if (targetIdx <= endIdx) {
            track.steps[targetIdx] = true;
        }
    }

    updateTrackUI(track);
}

function openStepPopup(track, stepIdx) {
    if (isCtrlDragging) return;
    if (stepIdx < 0 || stepIdx >= track.steps.length) return;

    let step = normalizeStep(track.steps[stepIdx]);
    if (!step?.active) return;

    track.steps[stepIdx] = step;
    
    const popupId = `trackStep_${track.trackId}_${stepIdx + 1}`;
    const addClass = 'step_popup';
    
    if (stepIdx < 0 || stepIdx >= track.steps.length) return;
    
    let ratchetControl, pitchControl, panControl, sustainControl;
    
    const title = `STEP ${stepIdx + 1}`;
    const body = document.createElement('div');
    body.className = 'popup-main-content';

    if (!step || step === true) {
        step = normalizeStep(step)  || {active: true, velocity: 1.0, sub: 1};
        track.steps[stepIdx] = step;
    }
    
    const velocityControl = 
        createRNSlider({
            label: 'Velocity',
            value: step.velocity ?? 1.0,
            min: 0,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                step.velocity = v;
                track.steps[stepIdx] = step;
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { step.velocity = before; },
                    redo() { step.velocity = after; }
                });
            }
        });

    if (track.type === 'synth') {
        ratchetControl = '';
        
        pitchControl = 
        createRNSlider({
            label: 'Pitch',
            value: step.pitch ?? 1,
            min: 0.2,
            max: 4,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                step.pitch = v;
                track.steps[stepIdx] = step;
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { step.pitch = before; },
                    redo() { step.pitch = after; }
                });
            }
        });
        
        panControl = 
        createRNSlider({
            label: 'Pan',
            value: step.pan ?? 0,
            min: -1,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                step.pan = v;
                track.steps[stepIdx] = step;
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { step.pan = before; },
                    redo() { step.pan = after; }
                });
            }
        });
        
        sustainControl = 
        createRNSlider({
            label: 'Sustain',
            value: step.sustain ?? 1,
            min: 0,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                step.sustain = v;
                track.steps[stepIdx] = step;
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { step.sustain = before; },
                    redo() { step.sustain = after; }
                });
            }
        });
        
    } else {
    
        ratchetControl = createStepper('Sub-Steps', step.sub, 1, 16, 1, (v) => {
            step.sub = Math.max(1, Math.floor(v));
            track.steps[stepIdx] = step;
            drawTrackSteps(track);
        });
    
        pitchControl = 
        createRNSlider({
            label: 'Pitch',
            value: step.pitch ?? 1,
            min: 0.2,
            max: 4,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                step.pitch = v;
                track.steps[stepIdx] = step;
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { step.pitch = before; },
                    redo() { step.pitch = after; }
                });
            }
        });
        
        panControl = 
        createRNSlider({
            label: 'Pan',
            value: step.pan ?? 0,
            min: -1,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                step.pan = v;
                track.steps[stepIdx] = step;
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { step.pan = before; },
                    redo() { step.pan = after; }
                });
            }
        });
        
        sustainControl = '';
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-default';
    removeBtn.style.background = '#f44336';
    removeBtn.textContent = 'Clear Step';
    removeBtn.onclick = () => {
        track.steps[stepIdx] = false;
        drawTrackSteps(track);
        document.querySelector('#'+popupId).remove();
    };

    body.append(
        velocityControl,
        pitchControl,
        panControl,
        ratchetControl,
        removeBtn
    );
    
    openPopup({
        id: popupId,
        title: title,
        content: body,
        width: '340px',
        height: '300px',
        addClass: addClass,
        remex: addClass,
        onClose: () => {
          
        }
    });

}

function openSynthNotePopup(track, note, stepIdx) {
    
    if (!note.mode) note.mode = 'single';
    if (note.activeKeyIndex == null) note.activeKeyIndex = 0;

    if (note.mode === 'single') {
        if (typeof note.pitch !== 'number') note.pitch = 60;
        note.pitches = [note.pitch];
    } else {
        if (!Array.isArray(note.pitches) || !note.pitches.length) {
            note.pitches = [note.pitch ?? 60];
        }
        note.pitch = null;
        note.activeKeyIndex = Math.min(
            note.activeKeyIndex,
            note.pitches.length - 1
        );
    }
    
    const popupId = `trackStep_${track.trackId}_${note.startStep}`;
    const addClass = 'note_popup';

    const popupTitle = `SYNTH NOTE ${track.trackId} - ${note.startStep}`;

    const body = document.createElement('div');
    body.className = 'popup-main-content';

    
    const modeRow = document.createElement('div');
    modeRow.style.display = 'flex';
    modeRow.style.alignItems = 'center';
    modeRow.style.gap = '8px';
    modeRow.style.marginTop = '10px';
    modeRow.style.marginBottom = '15px';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-default';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = () => {
        const trackIdx = audioTracks.indexOf(track);

        selectedItems.length = 0;
        selectedItems.push({
            type: 'synth',
            trackIdx,
            note
        });
    
        copySelectedSteps();
    };
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-default';
    removeBtn.style.background = '#f44336';
    removeBtn.textContent = 'Remove';
    
    removeBtn.onclick = () => {
        const idx = track.notes.indexOf(note);
        if (idx !== -1) {
            track.notes.splice(idx, 1);
            drawTrackSteps(track);
        }
        document.querySelector('#'+popupId).remove();
    };
    
    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'btn btn-default';
    pasteBtn.textContent = 'Paste';
    pasteBtn.disabled = !copiedSynthNote;
    
    pasteBtn.onclick = () => {
        if (!copiedSynthNote) return;
    
        const before = serializeSynthNote(note);
    
        Object.assign(
            note,
            normalizeSynthNote(
                structuredClone({
                    ...copiedSynthNote,
                    startStep: note.startStep,
                    _track: note._track
                })
            )
        );
    
        pushHistory({
            undo() {
                Object.assign(note, normalizeSynthNote(structuredClone(before)));
                drawSynthSteps(note._track);
            },
            redo() {
                Object.assign(
                    note,
                    normalizeSynthNote(structuredClone(copiedSynthNote))
                );
                drawSynthSteps(note._track);
            }
        });
    
        document.querySelector('#'+popupId).remove();
        openSynthNotePopup(note._track, note, stepIdx);
    };

    const modeSelect = document.createElement('select');
    ['single', 'chord'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m === 'single' ? 'Single Key' : 'Chord';
        modeSelect.appendChild(opt);
    });
    modeSelect.value = note.mode;

    modeSelect.onchange = () => {
        if (modeSelect.value === 'single') {
            note.mode = 'single';
            note.pitch = note.pitches[0];
            note.pitches = [note.pitch];
        } else {
            note.mode = 'chord';
            note.pitches = [note.pitch ?? 60, (note.pitch ?? 60) + 4, (note.pitch ?? 60) + 7];
            note.pitch = null;
            note.activeKeyIndex = 0;
        }
        document.querySelector('#'+popupId).remove();
        openSynthNotePopup(track, note, stepIdx);
    };

    modeRow.append(copyBtn, removeBtn, 'Mode:', modeSelect);
    body.appendChild(modeRow);


    if (note.mode === 'chord') {

        const chordRow = document.createElement('div');
        chordRow.style.display = 'flex';
        chordRow.style.alignItems = 'center';
        chordRow.style.gap = '8px';
        chordRow.style.marginBottom = '10px';

        // Key count
        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = 2;
        countInput.max = 8;
        countInput.value = note.pitches.length;
        countInput.style.width = '60px';

        countInput.onchange = () => {
            const count = Math.max(2, Math.min(8, Number(countInput.value)));
            while (note.pitches.length < count) {
                note.pitches.push(note.pitches[note.pitches.length - 1] + 4);
            }
            note.pitches.length = count;
            note.activeKeyIndex = Math.min(note.activeKeyIndex, count - 1);
            document.querySelector('#'+popupId).remove();
            openSynthNotePopup(track, note, stepIdx);
        };

        const keySelect = document.createElement('select');
        note.pitches.forEach((_, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Key ${i + 1}`;
            keySelect.appendChild(opt);
        });
        keySelect.value = note.activeKeyIndex;

        keySelect.onchange = () => {
            note.activeKeyIndex = Number(keySelect.value);
            document.querySelector('#'+popupId).remove();
            openSynthNotePopup(track, note, stepIdx);
        };

        chordRow.append('Keys:', countInput, 'Edit:', keySelect);
        body.appendChild(chordRow);
    }

    body.appendChild(createPianoRoll(note));

    body.appendChild(
        createRNSlider({
            label: 'Velocity',
            value: note.velocity ?? 1,
            min: 0,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                note.velocity = v;
                refreshPianoPreview();
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { note.velocity = before; },
                    redo() { note.velocity = after; }
                });
            }
        })
    );
    
    const title = document.createElement('div');
        title.className = 'env-title';
        title.textContent = 'Velocity Envelope';
    const velWrapperdiv = document.createElement('div');
    velWrapperdiv.className = "rn-slider-wrapper";
    velWrapperdiv.style.borderWidth = '1px';
    velWrapperdiv.style.borderColor = '#ddd';
    velWrapperdiv.appendChild(createVelocityEnvelopeEditor(note));
    
    body.appendChild(title);
    body.appendChild(velWrapperdiv);
    
    const pitchEnvEditor = createEnvelopeEditor({
        label: 'Pitch Envelope (semitones)',
        env: note.pitchEnv || [
            { t: 0, v: 0 },
            { t: 1, v: 0 }
        ],
        min: -24,
        max: 24,
        onChange: env => {
            note.pitchEnv = env;
        },
        onCommit: (before, after) => {
            pushHistory({
                undo() { note.pitchEnv = structuredClone(before); },
                redo() { note.pitchEnv = structuredClone(after); }
            });
        }
    });
    
    const pitchWrapperdiv = document.createElement('div');
    pitchWrapperdiv.className = "rn-slider-wrapper";
    
    pitchWrapperdiv.appendChild(pitchEnvEditor);
    
    body.appendChild(pitchWrapperdiv);

    body.appendChild(
        createRNSlider({
            label: 'Pan',
            value: note.pan ?? 0,
            min: -1,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                note.pan = v;
                refreshPianoPreview();
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { note.pan = before; },
                    redo() { note.pan = after; }
                });
            }
        })
    );
    
    body.appendChild(
        createRNSlider({
            label: 'Attack',
            value: note.attack ?? 0.01,
            min: 0.01,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                note.attack = v;
                refreshPianoPreview();
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { note.attack = before; },
                    redo() { note.attack = after; }
                });
            }
        })
    );
    body.appendChild(
        createRNSlider({
            label: 'Decay',
            value: note.decay ?? 0,
            min: 0,
            max: 2,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                note.decay = v;
                refreshPianoPreview();
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { note.decay = before; },
                    redo() { note.decay = after; }
                });
            }
        })
    );
    body.appendChild(
        createRNSlider({
            label: 'Sustain',
            value: note.sustain ?? 0,
            min: 0,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                note.sustain = v;
                refreshPianoPreview();
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { note.sustain = before; },
                    redo() { note.sustain = after; }
                });
            }
        })
    );
    body.appendChild(
        createRNSlider({
            label: 'Release',
            value: note.release ?? 0,
            min: 0,
            max: 3,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                note.release = v;
                refreshPianoPreview();
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { note.release = before; },
                    redo() { note.release = after; }
                });
            }
        })
    );

    openPopup({
        id: popupId,
        title: popupTitle,
        content: body,
        width: '340px',
        height: '400px',
        addClass: addClass,
        remex: addClass,
        onClose: () => {
          
        }
    });
    
    function createVelocityEnvelopeEditor(note) {
        const canvas = document.createElement('canvas');
        canvas.style.marginTop = '15px';
        canvas.style.marginBottom = '15px';
        canvas.style.border = '1px';
        canvas.style.borderColor = '#ddd';
        canvas.width = 320;
        canvas.height = 100;
        canvas.className = 'vel-env-canvas';
    
        if (!note.velEnv) {
            note.velEnv = [
                { t: 0, v: 0.5 },
                { t: 1, v: 0.5 }
            ];
        }
    
        const ctx = canvas.getContext('2d');
        let draggingPoint = null;
    
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
    
            ctx.strokeStyle = '#333';
            for (let i = 0; i <= 4; i++) {
                const y = (i / 4) * canvas.height;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
    
            ctx.strokeStyle = '#4caf50';
            ctx.beginPath();
    
            note.velEnv.forEach((p, i) => {
                const x = p.t * canvas.width;
                const y = canvas.height - (p.v * canvas.height);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
    
            note.velEnv.forEach(p => {
                const x = p.t * canvas.width;
                const y = canvas.height - (p.v * canvas.height);
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    
        function getPointAt(x, y) {
            return note.velEnv.find(p => {
                const px = p.t * canvas.width;
                const py = canvas.height - (p.v * canvas.height);
                return Math.hypot(px - x, py - y) < 6;
            });
        }
    
        canvas.onpointerdown = e => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
    
            const hit = getPointAt(x, y);
            if (hit) {
                draggingPoint = hit;
            } else {
                const p = {
                    t: x / canvas.width,
                    v: 1 - (y / canvas.height)
                };
                note.velEnv.push(p);
                note.velEnv.sort((a, b) => a.t - b.t);
                draw();
            }
        };
    
        canvas.onpointermove = e => {
            if (!draggingPoint) return;
            const rect = canvas.getBoundingClientRect();
            draggingPoint.t = Math.min(1, Math.max(0,
                (e.clientX - rect.left) / canvas.width
            ));
            draggingPoint.v = Math.min(1, Math.max(0,
                1 - (e.clientY - rect.top) / canvas.height
            ));
            note.velEnv.sort((a, b) => a.t - b.t);
            draw();
        };
    
        canvas.onpointerup = () => draggingPoint = null;
        canvas.onpointerleave = () => draggingPoint = null;
    
        canvas.ondblclick = e => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const p = getPointAt(x, y);
            if (p && note.velEnv.length > 2) {
                note.velEnv = note.velEnv.filter(pt => pt !== p);
                draw();
            }
        };
        
        canvas.addEventListener('contextmenu', e => {
            e.preventDefault();
    
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const p = getPointAt(x, y);
            if (p && note.velEnv.length > 2) {
                note.velEnv = note.velEnv.filter(pt => pt !== p);
                draw();
            }
        });
    
        draw();
        return canvas;
    }
    
    function createEnvelopeEditor({
        label = 'Envelope',
        env,
        min = 0,
        max = 1,
        onChange,
        onCommit
    }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'env-editor';
    
        const title = document.createElement('div');
        title.className = 'env-title';
        title.textContent = label;
    
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 120;
        canvas.className = 'env-canvas';
    
        wrapper.append(title, canvas);
    
        const ctx = canvas.getContext('2d');
    
        let points = structuredClone(env);
        let dragging = null;
        let before = structuredClone(points);
    
        const padding = 0;
    
        const toX = t =>
            padding + t * (canvas.width - padding * 2);
    
        const toY = v =>
            padding + (1 - (v - min) / (max - min)) *
            (canvas.height - padding * 2);
    
        const fromX = x =>
            Math.max(0, Math.min(1,
                (x - padding) / (canvas.width - padding * 2)
            ));
    
        const fromY = y =>
            min + (1 - Math.max(0, Math.min(1,
                (y - padding) / (canvas.height - padding * 2)
            ))) * (max - min);
    
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
    
            ctx.strokeStyle = '#222';
            for (let i = 0; i <= 4; i++) {
                const y = padding + i * (canvas.height - padding * 2) / 4;
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(canvas.width - padding, y);
                ctx.stroke();
            }
    
            ctx.strokeStyle = '#4cafef';
            ctx.lineWidth = 1;
            ctx.beginPath();
            points.forEach((p, i) => {
                const x = toX(p.t);
                const y = toY(p.v);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
    
            points.forEach(p => {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(toX(p.t), toY(p.v), 5, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    
        function commit() {
            if (!onCommit) return;
            onCommit(before, structuredClone(points));
            before = structuredClone(points);
        }
    
        canvas.addEventListener('mousedown', e => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
    
            dragging = points.find(p =>
                Math.hypot(toX(p.t) - x, toY(p.v) - y) < 8
            );
    
            if (!dragging) {
                const t = fromX(x);
                const v = fromY(y);
                points.push({ t, v });
                points.sort((a, b) => a.t - b.t);
                onChange(points);
                draw();
            }
        });
    
        canvas.addEventListener('mousemove', e => {
            if (!dragging) return;
    
            const rect = canvas.getBoundingClientRect();
            dragging.t = fromX(e.clientX - rect.left);
            dragging.v = fromY(e.clientY - rect.top);
    
            points.sort((a, b) => a.t - b.t);
            onChange(points);
            draw();
        });
    
        window.addEventListener('mouseup', () => {
            if (dragging) commit();
            dragging = null;
        });
        
        canvas.ondblclick = e => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
    
            const idx = points.findIndex(p =>
                Math.hypot(toX(p.t) - x, toY(p.v) - y) < 8
            );
    
            if (idx > 0 && idx < points.length - 1) {
                points.splice(idx, 1);
                onChange(points);
                draw();
                commit();
            }
        };
    
        canvas.addEventListener('contextmenu', e => {
            e.preventDefault();
    
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
    
            const idx = points.findIndex(p =>
                Math.hypot(toX(p.t) - x, toY(p.v) - y) < 8
            );
    
            if (idx > 0 && idx < points.length - 1) {
                points.splice(idx, 1);
                onChange(points);
                draw();
                commit();
            }
        });
    
        draw();
        return wrapper;
    }

}

function openOscillatorPopup(track) {
    const popupId = `oscillatorDesigner_${track.trackId}`;
    
    if (!track.settings.synth) {
        track.settings.synth = {
            enabled: true,
            presetName: 'Custom',
            oscType: 'sawtooth',
            detune: 0,
            unison: 1,
            spread: 10,
            filter: { type: 'lowpass', cutoff: 8000, resonance: 0.7 },
            lfo: { target: 'pitch', rate: 5, depth: 0 },
            effects: {
                tremolo: { rate: 5, depth: 0 },
                wah: { rate: 3, depth: 0 }
            },
            drive: 0
        };
    }

    const synth = track.settings.synth;
    normalizeSynthSettings(synth);

    const header =  `Oscillator Designer (Track - ${track.trackId})`;

    const body = document.createElement('div');
    body.className = 'popup-main-content';
    
    const row1 = document.createElement('div');
    row1.className = 'popup-row';

    const row2 = document.createElement('div');
    row2.className = 'popup-row';
    
    const presetNames = Object.keys(SYNTH_PRESETS);
    
    const currentPreset =
    track.settings.synth.presetName &&
    SYNTH_PRESETS[track.settings.synth.presetName]
        ? track.settings.synth.presetName
        : 'Custom';
        
    const userPresets = loadUserSynthPresets();

    const presetOptions = [
        'Custom',
        ...Object.keys(SYNTH_PRESETS),
        ...Object.keys(userPresets)
    ];
    
    body.appendChild(
        createSelect(
            'Preset',
            presetOptions,
            synth.presetName || 'Custom',
            name => {
                if (name === 'Custom') {
                    synth.presetName = 'Custom';
                    return;
                }
    
                const preset =
                    SYNTH_PRESETS[name] ||
                    userPresets[name];
    
                if (!preset) return;
    
                track.settings.synth = JSON.parse(JSON.stringify(preset));
                track.settings.synth.presetName = name;
    
                track.instrument = preset.oscType;
                track.settings.source = 'oscillator';
                track.sampleBuffer = null;
    
                document.querySelector('#'+popupId).remove();
                openOscillatorPopup(track);
            }
        )
    );
    
    const savePresetBtn = document.createElement('button');
    savePresetBtn.className = 'btn btn-default';
    savePresetBtn.textContent = '💾 Save Preset';
    
    savePresetBtn.onclick = () => {
        const name = prompt('Preset name?');
        if (!name) return;
    
        const presets = loadUserSynthPresets();
    
        presets[name] = JSON.parse(
            JSON.stringify(track.settings.synth)
        );
    
        presets[name].presetName = name;
    
        saveUserSynthPresets(presets);
    
        track.settings.synth.presetName = name;
    
        document.querySelector('#'+popupId).remove();
        openOscillatorPopup(track);
    };
    
    const deletePresetBtn = document.createElement('button');
    deletePresetBtn.className = 'btn btn-default';
    deletePresetBtn.style.background = '#f44336';
    deletePresetBtn.textContent = '🗑 Delete Preset';
    
    deletePresetBtn.onclick = () => {
        const name = synth.presetName;
        if (!name || !loadUserSynthPresets()[name]) return;
    
        if (!confirm(`Delete preset "${name}"?`)) return;
    
        const presets = loadUserSynthPresets();
        delete presets[name];
        saveUserSynthPresets(presets);
    
        synth.presetName = 'Custom';
    
        document.querySelector('#'+popupId).remove();
        openOscillatorPopup(track);
    };
    
    body.appendChild(row1);
    
    const previewBtn = document.createElement('img');
    previewBtn.className = 'top-btn';
    previewBtn.src = playIcon;
    previewBtn.onmousedown = () => previewSynthTrack(track);
    previewBtn.onmouseup = stopPreviewSynthTrack();
    previewBtn.onmouseleave = stopPreviewSynthTrack();
    
    row2.append(previewBtn, savePresetBtn, deletePresetBtn);
    body.appendChild(row2);

    const waveformValue =
        track.settings.source === 'oscillator'
        ? track.instrument
        : '—';

    body.appendChild(
        createSelect('Waveform',
            ['sine','triangle','sawtooth','square'],
            waveformValue,
            v => {
                track.settings.synth.oscType = v;
                track.settings.source = 'oscillator';
                track.sampleBuffer = null;
                track.sampleName = null;
                markSynthAsCustom(track);
            }
        )
    );

    body.appendChild(
        createRNSlider({
            label: 'Unison',
            value: synth.unison ?? 1,
            min: 1,
            max: 8,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                synth.unison = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.unison = before; },
                    redo() { synth.unison = after; }
                });
            }
        })
    );

    body.appendChild(
        createRNSlider({
            label: 'Detune',
            value: synth.detune ?? 0,
            min: -50,
            max: 50,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                synth.detune = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.detune = before; },
                    redo() { synth.detune = after; }
                });
            }
        })
    );
    
    body.appendChild(
        createRNSlider({
            label: 'Spread',
            value: synth.spread ?? 0,
            min: 0,
            max: 50,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                synth.spread = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.spread = before; },
                    redo() { synth.spread = after; }
                });
            }
        })
    );

    body.appendChild(
        createSelect('Filter', 
            ['lowpass','highpass','bandpass'], 
            synth.filter.type,
            v => { synth.filter.type = v; synth.presetName = 'Custom'; }
        )
    );
    
    body.appendChild(
        createRNSlider({
            label: 'Cutoff',
            value: synth.filter.cutoff ?? 0,
            min: 50,
            max: 20000,
            width:360,
            height: 50,
            step: 10,
            onChange: v => {
                synth.filter.cutoff = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.filter.cutoff = before; },
                    redo() { synth.filter.cutoff = after; }
                });
            }
        })
    );
    
    body.appendChild(
        createRNSlider({
            label: 'Resonance',
            value: synth.filter.resonance ?? 0,
            min: 0,
            max: 2,
            width:360,
            height: 50,
            step: 0.05,
            onChange: v => {
                synth.filter.resonance = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.filter.resonance = before; },
                    redo() { synth.filter.resonance = after; }
                });
            }
        })
    );

    body.appendChild(
        createSelect('LFO Target', 
            ['pitch','filter','amp'], 
            synth.lfo.target,
            v => { synth.lfo.target = v; synth.presetName = 'Custom'; })
    );
    
    body.appendChild(
        createRNSlider({
            label: 'LFO Rate',
            value: synth.lfo.rate ?? 0.1,
            min: 0.1,
            max: 20,
            width:360,
            height: 50,
            step: 0.05,
            onChange: v => {
                synth.lfo.rate = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.lfo.rate = before; },
                    redo() { synth.lfo.rate = after; }
                });
            }
        })
    );
    
    body.appendChild(
        createRNSlider({
            label: 'LFO Depth',
            value: synth.lfo.depth ?? 0,
            min: 0,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                synth.lfo.depth = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.lfo.depth = before; },
                    redo() { synth.lfo.depth = after; }
                });
            }
        })
    );

    body.appendChild(
        createRNSlider({
            label: 'Drive',
            value: synth.drive ?? 0,
            min: 0,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                synth.drive = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.drive = before; },
                    redo() { synth.drive = after; }
                });
            }
        })
    );
    
    body.appendChild(
        createRNSlider({
            label: 'Tremolo Rate',
            value: synth.effects.tremolo.rate ?? 0.1,
            min: 0.1,
            max: 20,
            width:360,
            height: 50,
            step: 0.1,
            onChange: v => {
                synth.effects.tremolo.rate = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.effects.tremolo.rate = before; },
                    redo() { synth.effects.tremolo.rate = after; }
                });
            }
        })
    );
    
    body.appendChild(
        createRNSlider({
            label: 'Tremolo Depth',
            value: synth.effects.tremolo.depth ?? 0,
            min: 0.1,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                synth.effects.tremolo.depth = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.effects.tremolo.depth = before; },
                    redo() { synth.effects.tremolo.depth = after; }
                });
            }
        })
    );
    
    body.appendChild(
        createRNSlider({
            label: 'Wah Depth',
            value: synth.effects.wah.depth ?? 0,
            min: 0,
            max: 1,
            width:360,
            height: 50,
            step: 0.01,
            onChange: v => {
                synth.effects.wah.depth = v;
                synth.presetName = 'Custom';
            },
            onCommit: (before, after) => {
                pushHistory({
                    undo() { synth.effects.wah.depth = before; },
                    redo() { synth.effects.wah.depth = after; }
                });
            }
        })
    );

    openPopup({
        id: popupId,
        title: header,
        content: body,
        width: '360px',
        height: '400px',
        onClose: () => {
          
        }
    });
}

function openMasterEffectsPopup() {
    const popupId = 'masterBus';
    const header =  `MASTER BUS`;

    const body = document.createElement('div');
    body.className = 'popup-main-content';

    const presetRow = document.createElement('div');
    presetRow.style.display = 'flex';
    presetRow.style.gap = '8px';
    presetRow.style.marginBottom = '12px';

    window.masterUI = {
        presetButtons: {},
        eq: {}
    };

    Object.keys(MASTER_PRESETS).forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-default';
        btn.textContent = MASTER_PRESETS[key].name;
        btn.onclick = () => applyMasterPreset(key);
        masterUI.presetButtons[key] = btn;
        presetRow.appendChild(btn);
    });

    body.appendChild(presetRow);

    masterUI.volume = createRNSlider({
        label: 'Master Volume',
        value: masterBus.settings.volume,
        min: 0,
        max: 1.5,
        step: 0.01,
        width: 360,
        height: 50,
        onChange: v => {
            masterBus.settings.volume = v;
            masterBus.volume.gain.setValueAtTime(v, audioContext.currentTime);
        }
    });
    body.appendChild(masterUI.volume);

    const eqHeader = document.createElement('h3');
    eqHeader.textContent = 'Equalizer';
    eqHeader.style.marginTop = '16px';

    const eqRow = document.createElement('div');
    eqRow.style.display = 'flex';
    eqRow.style.gap = '8px';
    eqRow.style.justifyContent = 'space-between';

    [60, 250, 1000, 4000, 8000].forEach((freq, i) => {
        const slider = createRNSlider({
            label: freq + 'Hz',
            value: masterBus.settings.eq[i],
            min: -12,
            max: 12,
            step: 0.1,
            width: 50,
            height: 200,
            orientation: 'vertical',
            onChange: v => {
                masterBus.settings.eq[i] = v;
                masterBus.eq[i].gain.setValueAtTime(v, audioContext.currentTime);
            }
        });

        masterUI.eq[i] = slider;
        eqRow.appendChild(slider);
    });

    body.append(eqHeader, eqRow);

    body.append(
        headerBlock('Compressor'),
        masterUI.threshold = createRNSlider({
            label: 'Threshold',
            value: masterBus.compressor.threshold.value,
            min: -60,
            max: 0,
            step: 1,
            width: 360,
            height: 50,
            onChange: v =>
                masterBus.compressor.threshold.setValueAtTime(v, audioContext.currentTime)
        }),
        masterUI.ratio = createRNSlider({
            label: 'Ratio',
            value: masterBus.compressor.ratio.value,
            min: 1,
            max: 20,
            step: 0.1,
            width: 360,
            height: 50,
            onChange: v =>
                masterBus.compressor.ratio.setValueAtTime(v, audioContext.currentTime)
        }),
        masterUI.attack = createRNSlider({
            label: 'Attack (s)',
            value: masterBus.compressor.attack.value,
            min: 0.001,
            max: 0.2,
            step: 0.001,
            width: 360,
            height: 50,
            onChange: v =>
                masterBus.compressor.attack.setValueAtTime(v, audioContext.currentTime)
        }),
        masterUI.release = createRNSlider({
            label: 'Release (s)',
            value: masterBus.compressor.release.value,
            min: 0.05,
            max: 1,
            step: 0.01,
            width: 360,
            height: 50,
            onChange: v =>
                masterBus.compressor.release.setValueAtTime(v, audioContext.currentTime)
        })
    );

    body.append(
        headerBlock('Delay'),
        masterUI.delayTime = createRNSlider({
            label: 'Delay Time (s)',
            value: masterBus.settings.delayTime,
            min: 0,
            max: 1.5,
            step: 0.01,
            width: 360,
            height: 50,
            onChange: v => {
                const now = audioContext.currentTime;
                masterBus.settings.delayTime = v;
        
                masterBus.delay.delayTime.cancelScheduledValues(now);
                masterBus.delay.delayTime.setValueAtTime(v, now);
            }
        }),
        masterUI.delayMix = createRNSlider({
            label: 'Delay Mix',
            value: masterBus.settings.delayMix,
            min: 0,
            max: 1,
            step: 0.01,
            width: 360,
            height: 50,
            onChange: v => {
                const now = audioContext.currentTime;
                masterBus.settings.delayMix = v;
        
                masterBus.delayGain.gain.cancelScheduledValues(now);
                masterBus.delayGain.gain.setValueAtTime(v, now);
            }
        })

    );

    body.append(
        headerBlock('Reverb'),
        masterUI.reverb = createRNSlider({
            label: 'Reverb Mix',
            value: masterBus.settings.reverb,
            min: 0,
            max: 1,
            step: 0.01,
            width: 360,
            height: 50,
            onChange: v => {
                masterBus.settings.reverb = v;
                masterBus.reverbGain.gain.setValueAtTime(v, audioContext.currentTime);
            }
        })
    );

    openPopup({
        id: popupId,
        title: header,
        content: body,
        width: '360px',
        height: '400px',
        onClose: () => {
          
        }
    });

    updateMasterUI();
    updateMasterPresetUI();
    makeDraggable(panel, header, popup);
}

function headerBlock(text) {
    const h = document.createElement('h3');
    h.textContent = text;
    h.style.marginTop = '16px';
    return h;
}

function openAddDrumPopup() {

    const popupId = "add_drum_popup";

    const body = document.createElement('div');
    body.className = 'popup-main-content';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '12px';

    const inputWrapper = document.createElement('div');
    inputWrapper.style.display = 'flex';
    inputWrapper.style.alignItems = 'center';
    inputWrapper.style.justifyContent = 'space-between';
    inputWrapper.style.gap = '8px';
    
    const inputWrapper1 = document.createElement('div');
    inputWrapper1.style.display = 'flex';
    inputWrapper1.style.alignItems = 'center';
    inputWrapper1.style.justifyContent = 'space-between';
    inputWrapper1.style.gap = '8px';

    const label = document.createElement('span');
    label.textContent = "Number of Instruments:";

    const numberInput = document.createElement('input');
    numberInput.type = "number";
    numberInput.min = 1;
    numberInput.max = 32;
    numberInput.value = 4;
    numberInput.style.width = "80px";

    inputWrapper.append(label, numberInput);

    const addSingleBtn = document.createElement('button');
    addSingleBtn.className = "btn btn-default";
    addSingleBtn.textContent = "Add Single Drum Track";

    addSingleBtn.onclick = () => {
        createDrumTrack('s', 1, 1);
        document.getElementById(popupId)?.remove();
    };
    
    const prestWrapper = document.createElement('div');
    prestWrapper.style.display = 'flex';
    prestWrapper.style.alignItems = 'space-between';
    prestWrapper.style.gap = '8px';
    
    const presetLabel = document.createElement('div');
    presetLabel.textContent = "Select Kit";
    
    const presetSelect = document.createElement('select');
    
    const optselect = document.createElement('option');
        optselect.value = '';
        optselect.setAttribute('hidden', 'hidden');
        optselect.textContent = 'Select Kit';
        presetSelect.appendChild(optselect);

    Object.keys(DRUM_PRESETS).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        const cleanName = name
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
        opt.textContent = cleanName;
        presetSelect.appendChild(opt);
    });
    
    presetSelect.onchange = async () => {

        const presetName = presetSelect.value;
    
        await createDrumKitFromPreset(presetName);
    
        document.getElementById(popupId)?.remove();
    };
    
    prestWrapper.append(presetLabel, presetSelect);

    const addKitBtn = document.createElement('button');
    addKitBtn.className = "btn btn-default";
    addKitBtn.style.background = "#4caf50";
    addKitBtn.textContent = "Add Drum Kit";

    addKitBtn.onclick = async () => {
        const count = Math.max(1, parseInt(numberInput.value) || 1);
    
        for (let i = 0; i < count; i++) {
            await createDrumTrack('p', i, count);
        }
    
        document.getElementById(popupId)?.remove();
    };
    inputWrapper.appendChild(addKitBtn);
    
    const patternWrapper = document.createElement('div');
    patternWrapper.style.display = 'flex';
    patternWrapper.style.alignItems = 'space-between';
    patternWrapper.style.gap = '8px';
    
    const numberInput1 = document.createElement('input');
    numberInput1.type = "number";
    numberInput1.min = 1;
    numberInput1.max = 32;
    numberInput1.value = 1;
    numberInput1.style.width = "80px";
    const randomBtn = document.createElement("button");
    randomBtn.textContent = "Pattern Editor";
    randomBtn.className = "btn btn-default";
    
    inputWrapper1.append(randomBtn);
    
    const patternList = document.createElement("div");
    patternList.className = "pattern-list";
    const patternListTitle = document.createElement("div");
    patternListTitle.style.display = "flex";
    patternListTitle.style.alignItems = "center";
    patternListTitle.style.justifyContent = "center";
    patternListTitle.style.padding = "5px";
    patternListTitle.style.marginBottom = "10px";
    patternListTitle.textContent = "Saved Patterns";
    
    
    randomBtn.onclick = () => {
        window.currentDrumPattern = generateRandomDrumPattern(audioTracks, 1, 'techno');
        openDrumPatternEditor(window.currentDrumPattern, audioTracks, 1, 'techno');
    };
    
    
    const inputWrapper3 = document.createElement('div');
    inputWrapper3.style.display = 'flex';
    inputWrapper3.style.alignItems = 'center';
    inputWrapper3.style.justifyContent = 'space-between';
    inputWrapper3.style.gap = '8px';
    
    const remPatternTracksBtn = document.createElement("button");
    remPatternTracksBtn.textContent = "Remove pattern Tracks";
    remPatternTracksBtn.className = "btn btn-red";
    
    const convertBtn = document.createElement("button");
    convertBtn.textContent = "Save As Sample";
    convertBtn.className = "btn btn-default";
    
    convertBtn.onclick = async () => {

        const name = prompt("Enter WAV Pattern Name:");
        if (!name) return;
    
        const buffer = await renderCurrentDrumKitToWav();
    
        await saveWavPatternToDB(name, buffer);
    
        alert("WAV Pattern Saved");
    };
    
    remPatternTracksBtn.onclick = () => {
        removePatternTracks();
    };
    
    inputWrapper3.append(convertBtn, remPatternTracksBtn)
    
    refreshPatternListUI(patternList);

    body.append(inputWrapper, addSingleBtn, inputWrapper1, inputWrapper3, patternListTitle, patternList);

    openPopup({
        id: popupId,
        title: "Add Drum",
        content: body,
        width: "360px",
        height: "220px",
        addClass: "drum_popup",
        remex: "drum_popup"
    });
}

function openDrumPatternEditor(pattern, audioTrackss, barss, genre) {
    
    if(!pattern) return;
    let previewTimer = null;
    stopPreview();
    
    const popupId = "drum_pattern_editor";

    const stepsPerBar = pattern.resolution || 16;
    const bars = barss || pattern.lengthBars || 1;
    const totalSteps = stepsPerBar * bars;

    const drumTracks = audioTrackss.filter(
        t => t.type === "instrument"
    );

    if (!drumTracks.length) {
        alert("No drum tracks found.");
        return;
    }

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "12px";
    body.style.height = "100%";

    const gridWrapper = document.createElement("div");
    gridWrapper.style.flex = "1";
    gridWrapper.style.overflowX = "auto";
    gridWrapper.style.overflowY = "auto";
    gridWrapper.style.border = "1px solid #333";
    gridWrapper.style.padding = "8px 8px 20px 8px";

    const grid = document.createElement("div");
    grid.style.display = "flex";
    grid.style.flexDirection = "column";
    grid.style.gap = "6px";

    gridWrapper.appendChild(grid);

    drumTracks.forEach(track => {
        const row = document.createElement("div");
        row.style.position = "relative";
        row.style.display = "block";
        row.style.alignItems = "center";
        row.style.gap = "6px";

        const label = document.createElement("div");
        label.textContent = track.label?.dataset?.name || "Drum";
        label.style.position = "sticky";
        label.style.left = "0";
        label.style.float = "left";
        label.style.width = "80px";
        label.style.fontSize = "12px";

        row.appendChild(label);

        const stepRow = document.createElement("div");
        stepRow.style.display = "flex";
        stepRow.style.gap = "4px";
        label.style.float = "left";

        if (!pattern.data[track.trackId]) {
            pattern.data[track.trackId] =
                new Array(totalSteps).fill(0);
        }

        pattern.data[track.trackId].forEach((val, stepIdx) => {

            const cell = document.createElement("div");
            cell.style.width = "20px";
            cell.style.height = "20px";
            cell.style.cursor = "pointer";
            cell.style.borderRadius = "3px";
            cell.style.background =
                val ? "#4caf50" : "#222";
            cell.style.border = "1px solid #444";

            cell.onclick = () => {

                const current =
                    pattern.data[track.trackId][stepIdx];

                pattern.data[track.trackId][stepIdx] =
                    current ? 0 : 1;

                cell.style.background =
                    current ? "#222" : "#4caf50";
            };

            stepRow.appendChild(cell);
        });

        row.appendChild(stepRow);
        grid.appendChild(row);
    });

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "10px";
    controls.style.alignItems = "center";
    controls.style.justifyContent = "center";
    
    const numberInput1 = document.createElement('input');
    numberInput1.type = "number";
    numberInput1.min = 1;
    numberInput1.max = 32;
    numberInput1.value = 1;
    numberInput1.style.width = "80px";
    
    const labelBar = document.createElement('span');
    labelBar.textContent = "Bars:";
    
    const randomBtn = document.createElement("button");
    randomBtn.innerHTML = "&#128260;";
    randomBtn.className = "btn btn-default";
    
    const labelGenre = document.createElement('span');
    labelGenre.textContent = "Genre:";
    const typeGenre = document.createElement('select');
    typeGenre.innerHTML = `
    <option value="${genre}" selected hidden>${genre[0].toUpperCase()}${genre.slice(1)}</option>
    <option value="techno">Techno</option>
    <option value="house">House</option>
    <option value="deep_house">Deep house</option>
    <option value="trap">Trap</option>
    <option value="dnb">DNB</option>
    <option value="hiphop">Hiphop</option>
    <option value="dubstep">dubstep</option>
    <option value="drumstep">drumstep</option>
    <option value="breaks">breaks</option>
    <option value="lofi">lofi</option>
    `;

    const playBtn = document.createElement("button");
    playBtn.innerHTML = "&#9654;";
    playBtn.className = "btn btn-default";

    const stopBtn = document.createElement("button");
    stopBtn.innerHTML = "&#10074; &#10074;"; 
    stopBtn.className = "btn btn-default";

    const saveBtn = document.createElement("button");
    
    saveBtn.textContent = !pattern._name ? "Save" : "Update";
    saveBtn.className = "btn btn-default";
    saveBtn.style.background = "#4caf50";

    controls.append(labelBar, numberInput1, labelGenre, typeGenre, randomBtn, playBtn, stopBtn, saveBtn);
    
    typeGenre.onchange = () => {
        stopPreview();
        const lasteditor = document.querySelector('#drum_pattern_editor');
        if(lasteditor) {
            lasteditor.remove();
        }
        const bars = Math.max(1, parseInt(numberInput1.value) || 1);
        window.currentDrumPattern = generateRandomDrumPattern(audioTracks, bars, typeGenre.value);
        openDrumPatternEditor(window.currentDrumPattern, audioTracks, bars, typeGenre.value);
        openDrumPatternEditor(window.currentDrumPattern, audioTracks, bars, typeGenre.value);
    };
    
    randomBtn.onclick = () => {
        stopPreview();
        const lasteditor = document.querySelector('#drum_pattern_editor');
        if(lasteditor) {
            lasteditor.remove();
        }
        const bars = Math.max(1, parseInt(numberInput1.value) || 1);
        window.currentDrumPattern = generateRandomDrumPattern(audioTracks, bars, typeGenre.value);
        openDrumPatternEditor(window.currentDrumPattern, audioTracks, bars, typeGenre.value);
    };

    playBtn.onclick = () => {
        const secondsPerStep = getSecondsPerStep();
        const startTime = audioContext.currentTime;

        stopPreview();

        drumTracks.forEach(track => {
            const steps = pattern.data[track.trackId];
            if (!steps) return;

            steps.forEach((v, i) => {
                if (!v) return;

                const time =
                    startTime +
                    (i * secondsPerStep);

                playInstrumentHit(track, time);
            });
        });

        previewTimer = setInterval(() => {
            const now = audioContext.currentTime;

            drumTracks.forEach(track => {
                const steps = pattern.data[track.trackId];
                if (!steps) return;

                steps.forEach((v, i) => {
                    if (!v) return;

                    const time =
                        now +
                        (i * secondsPerStep);

                    playInstrumentHit(track, time);
                });
            });

        }, totalSteps * getSecondsPerStep() * 1000);
    };

    function stopPreview() {
        if (previewTimer) {
            clearInterval(previewTimer);
            previewTimer = null;
        }
    }

    stopBtn.onclick = stopPreview;
    
    saveBtn.onclick = () => {

        if (!pattern._name) {
            const name = prompt("Pattern Name?");
            if (!name) return;
            pattern._name = name;
        }

        DRUM_PATTERNS[pattern._name] = pattern;
        savePatternsToStorage();

        alert("Pattern Saved");
    };

    body.append(gridWrapper, controls);

    openPopup({
        id: popupId,
        title: !pattern._name ? "Drum Pattern Editor" : "Editing Pattern " + pattern._name,
        content: body,
        width: "900px",
        height: "500px",
        addClass: "drum_pattern_editor",
        remex: "drum_pattern_editor",
        onClose: stopPreview
    });
}

