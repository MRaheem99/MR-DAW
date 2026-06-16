function getCanvasStepFromEvent(e) {
    const rect = timelineContent.getBoundingClientRect();

    const x = e.clientX - rect.left + timelineScroll.scrollLeft;
    const y = e.clientY - rect.top;

    const stepWidth = getStepWidth();
    const trackHeight = 40;

    const stepIdx = Math.floor(x / stepWidth);
    const trackIdx = Math.floor(y / trackHeight);

    if (
        trackIdx < 0 ||
        trackIdx >= audioTracks.length ||
        !audioTracks[trackIdx] ||
        audioTracks[trackIdx].type !== 'instrument'
    ) return null;

    if (stepIdx < 0 || stepIdx >= audioTracks[trackIdx].steps.length) return null;

    return { trackIdx, stepIdx };
}

function createStepCanvas(trackData) {
    if (isSelectionDragging || window.lassoActive || window.lassoExists) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'step-canvas';
    trackData.trackElement.appendChild(canvas);
    trackData.stepCanvas = canvas;

    canvas.addEventListener('mousedown', (e) => {
        if (e.altKey) return;
        if (window.lassoActive || window.lassoExists) return;
        if (e.ctrlKey || isCtrlDragging) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const stepIdx = Math.floor(x / getStepWidth());
        if (stepIdx < 0) return;

        if (trackData.type === 'synth' && e.button === 0) {
            const hit = findSynthNoteAt(trackData, stepIdx, x);

            if (hit) {
                const { note, isResize } = hit;
                const startLen = note.length;
                const dragOffset = stepIdx - note.startStep;
                
                const before = {
                    startStep: note.startStep,
                    length: note.length
                };

                const onMove = ev => {
                    const mx = ev.clientX - rect.left;
                    const newStep = Math.floor(mx / getStepWidth());

                    if (isResize) {
                        const newLen = Math.max(1, newStep - note.startStep + 1);
                        if (isSynthRangeFree(trackData, note.startStep, newLen, note)) {
                            note.length = newLen;
                        }
                    } else {
                        const newStart = Math.max(0, newStep - dragOffset);
                        if (isSynthRangeFree(trackData, newStart, startLen, note)) {
                            note.startStep = newStart;
                        }
                    }
                    drawTrackSteps(trackData);
                };

                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    
                    const after = {
                        startStep: note.startStep,
                        length: note.length
                    };
                    
                    if (
                        before.startStep !== after.startStep ||
                        before.length !== after.length
                    ) {
                        pushHistory({
                            undo() {
                                note.startStep = before.startStep;
                                note.length = before.length;
                                drawTrackSteps(trackData);
                            },
                            redo() {
                                note.startStep = after.startStep;
                                note.length = after.length;
                                drawTrackSteps(trackData);
                            }
                        });
                    }

                };

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
                return;
            }
            
            const note = {
                startStep: stepIdx,
                length: 1,
            
                pitches: [60],
                chordSize: 1, 
            
                velocity: 1,
                pan: null,
            
                attack: null,
                decay: null,
                sustain: null,
                release: null,
            
                velEnv: null,
                pitchEnv: null,
            
                echoPreset: 'off',
                _track: trackData
            };

            if (!isSynthRangeFree(trackData, stepIdx, 1)) return;
            
            pushHistory({
                undo() {
                    trackData.notes = trackData.notes.filter(n => n !== note);
                    drawTrackSteps(trackData);
                },
                redo() {
                    trackData.notes.push(note);
                    drawTrackSteps(trackData);
                }
            });
            
            trackData.notes.push(note);

            const onMove = ev => {
                const mx = ev.clientX - rect.left;
                const end = Math.floor(mx / getStepWidth());
                const len = Math.max(1, end - stepIdx + 1);

                if (isSynthRangeFree(trackData, stepIdx, len, note)) {
                    note.length = len;
                    drawTrackSteps(trackData);
                }
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            return;
        }

        if (!trackData.steps || stepIdx >= trackData.steps.length) return;

        if (e.button === 0) {
            if (isSelectionDragging || window.lassoActive || window.lassoExists) return;
        
            const before = trackData.steps[stepIdx];
            const after = !before;
            
            previewTrackStep(trackData, trackData.steps[stepIdx]);
        
            pushHistory({
                undo() {
                    trackData.steps[stepIdx] = before;
                    drawTrackSteps(trackData);
                },
                redo() {
                    trackData.steps[stepIdx] = after;
                    drawTrackSteps(trackData);
                }
            });
        
            trackData.steps[stepIdx] = after;
            drawTrackSteps(trackData);
        }

        if (e.button === 2) {
            stepHoldTimer = setTimeout(() => {
                openStepPopup(trackData, stepIdx);
            }, 300);
        }
    });

    canvas.addEventListener('mouseup', () => {
        clearTimeout(stepHoldTimer);
        stepHoldTimer = null;
    });

    canvas.addEventListener('contextmenu', (e) => {
        if (window.lassoActive || window.lassoExists || isCtrlDragging) return;
        e.preventDefault();
        const cx = e.clientX; 
        const cy = e.clientY;
    
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const stepIdx = Math.floor(x / getStepWidth());
    
        if (trackData.type === 'synth') {
        
            const hit = findSynthNoteAt(trackData, stepIdx, x);
        
            if (hit) {
                openSynthNotePopup(trackData, hit.note, stepIdx);
                return;
            }
        
            if (!clipboardData?.length) return;
            
            const coords = getTimelineCoords(cx, cy);
            const trackIdx = getTrackIndexFromY(coords.y);
            if (trackIdx == null) return;
    
            window.pasteTarget = { trackIdx, stepIdx };
        
            pasteStepsAt();
            return;
        }

        if (trackData.steps && stepIdx >= 0 && stepIdx < trackData.steps.length) {
            openStepPopup(trackData, stepIdx);
        }
    });


    if (!isMobile) return;
    let holdTimer = null;
    let dragNote = null;
    let dragMode = null;
    let dragOffset = 0;
    let startStep = 0;
    let moved = false;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length == 2) return;
        if (e.touches.length !== 1) return;
        if (window.lassoActive || window.lassoExists) return;

        const rect = canvas.getBoundingClientRect();
        const t = e.touches[0];
        const x = t.clientX - rect.left;
        startStep = Math.floor(x / getStepWidth());
        moved = false;

        holdTimer = setTimeout(() => {
            if (trackData.type === 'synth') {
                const hit = findSynthNoteAt(trackData, startStep, x);
                if (hit) openSynthNotePopup(trackData, hit.note, stepIdx);
            } else if (trackData.steps && startStep >= 0 && startStep < trackData.steps.length) {
                openStepPopup(trackData, startStep);
            }
            holdTimer = null;
        }, 450);

        if (window.isMagnetActive && trackData.type === 'synth') {
            const hit = findSynthNoteAt(trackData, startStep, x);
            if (hit) {
                dragNote = hit.note;
                dragMode = hit.isResize ? 'resize' : 'move';
                dragOffset = startStep - dragNote.startStep;
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }

        if (!dragNote || !window.isMagnetActive) return;

        moved = true;
        const rect = canvas.getBoundingClientRect();
        const t = e.touches[0];
        const x = t.clientX - rect.left;
        const step = Math.floor(x / getStepWidth());

        if (dragMode === 'move') {
            const newStart = Math.max(0, step - dragOffset);
            if (isSynthRangeFree(trackData, newStart, dragNote.length, dragNote)) {
                dragNote.startStep = newStart;
            }
        }

        if (dragMode === 'resize') {
            const newLen = Math.max(1, step - dragNote.startStep + 1);
            if (isSynthRangeFree(trackData, dragNote.startStep, newLen, dragNote)) {
                dragNote.length = newLen;
            }
        }

        drawTrackSteps(trackData);
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;

        if (
            !moved &&
            trackData.type === 'synth' &&
            !window.isMagnetActive
        ) {
            if (!isSynthRangeFree(trackData, startStep, 1)) return;

            trackData.notes.push({
                startStep,
                length: 1,
                velocity: 1,
                pitch: null,
                pan: null,
                echoPreset: 'off',
                _track: trackData
            });
            drawTrackSteps(trackData);
        }

        dragNote = null;
        dragMode = null;
    });
}

function findSynthNoteAt(track, stepIdx, mouseX) {
    const stepWidth = getStepWidth();

    for (const note of track.notes) {
        const start = note.startStep;
        const end   = start + note.length;

        if (stepIdx >= start && stepIdx < end) {
            const noteRightPx =
                (note.startStep + note.length) * stepWidth;

            const isResize =
                mouseX >= noteRightPx - SYNTH_HANDLE_WIDTH;

            return { note, isResize };
        }
    }
    return null;
}

function isSynthRangeFree(track, start, length, exceptNote = null) {
    const end = start + length;

    return !track.notes.some(n => {
        if (n === exceptNote) return false;
        const nStart = n.startStep;
        const nEnd = nStart + n.length;
        return start < nEnd && end > nStart;
    });
}

function preventSynthOverlaps(track, note) {
    track.notes.forEach(n => {
        if (n === note) return;

        const a1 = note.startStep;
        const a2 = a1 + note.length;
        const b1 = n.startStep;
        const b2 = b1 + n.length;

        if (a1 < b2 && a2 > b1) {
            note.startStep = b2;
        }
    });
}


function normalizeStep(step) {
    if (!step) return null;

    if (step === true) {
        return {
            active: true,
            velocity: 1.0,
            pitch: null,
            pan: null,
            sub: 1,
            echoPreset: 'off',
            sustain: false
        };
    }

    if (typeof step === 'object' && step.active) {
        if (step.velocity == null) step.velocity = 1.0;
        if (step.pitch == null) step.pitch = null;
        if (step.pan == null) step.pan = null;
        if (step.sub == null) step.sub = 1;
        if (step.echoPreset == null) step.echoPreset = 'off';
        if (step.sustain == null) step.sustain = false;

        return step;
    }

    return null;
}

function resizeStepCanvas(trackData) {
    const canvas = trackData.stepCanvas;
    if (!canvas) return;

    const width = totalSeconds * getPPS();
    const height = trackData.trackElement.clientHeight;
    const newWidth = Math.min(width, 50000);
    if (canvas.width !== newWidth) {
        canvas.width = newWidth;
    }
    canvas.height = height;
}

function drawTrackSteps(track) {
    if (!track.stepCanvas) return;

    if (track.type === 'synth') {
        drawSynthSteps(track);
    } else {
        drawInstrumentSteps(track);
    }
}

function drawInstrumentSteps(track) {
    const canvas = track.stepCanvas;
    const ctx = canvas.getContext('2d');
    const stepWidth = getStepWidth();
    const h = canvas.height;
    const totalSteps = Math.ceil(canvas.width / stepWidth);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < totalSteps; i++) {
        const x = i * stepWidth;
        if (x > canvas.width) break;

        const step = track.steps[i];

        if (step) {
            ctx.fillStyle = '#4caf50';
        } else {
            ctx.fillStyle = (i % 4 === 0) ? '#454954' : '#2a2a2a';
        }

        ctx.fillRect(x, 0, stepWidth - 1, h);

        if (typeof step === 'object' && step.active && step.sub > 1) {
            const subCount = step.sub;
            const subHeight = h / subCount;
            ctx.fillStyle = '#1aff64';

            for (let r = 0; r < subCount; r++) {
                const y = h - ((r + 1) * subHeight);
                ctx.fillRect(x + 2, y + 1, stepWidth - 5, subHeight - 2);
            }
        }

        ctx.strokeStyle = '#222';
        ctx.strokeRect(x, 0, stepWidth, h);
    }
}

function drawSynthSteps(track) {
    const canvas = track.stepCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const stepWidth = getStepWidth();
    const h = canvas.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bpm = getBPM();
    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = resolution / 4;
    const stepsPerBar = stepsPerBeat * 4;
    const totalSteps = Math.ceil(canvas.width / stepWidth);
    const steps = Math.ceil(totalSeconds / getSecondsPerStep());

    for (let i = 0; i < totalSteps; i++) {
        const x = i * stepWidth;

        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(x, 0, stepWidth - 1, h);

        if (i % stepsPerBar === 0) {
            ctx.strokeStyle = '#4d4d4d';
        } else if (i % stepsPerBeat === 0) {
            ctx.strokeStyle = '#333333';
        } else {
            ctx.strokeStyle = '#262626';
        }

        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
    }

    track.notes.forEach(note => {
        const x = note.startStep * stepWidth;
        const w = note.length * stepWidth;

        ctx.fillStyle = '#4caf50';
        ctx.fillRect(x, 0, w - 1, h);
        ctx.strokeStyle = '#ffcc99';
        ctx.strokeRect(x, 0, w, h);
        ctx.fillStyle = '#ffaa80';
        ctx.fillRect(
            x + w - SYNTH_HANDLE_WIDTH,
            2,
            SYNTH_HANDLE_WIDTH,
            h - 4
        );

        ctx.strokeStyle = '#777';
        for (let i = 1; i <= 2; i++) {
            const gx = x + w - i * 2;
            ctx.beginPath();
            ctx.moveTo(gx, 6);
            ctx.lineTo(gx, h - 6);
            ctx.stroke();
        }

        if (typeof note.pitch === 'number') {
            ctx.fillStyle = '#111';
            ctx.font = '11px monospace';
            ctx.textBaseline = 'middle';

            const label = midiToNoteName(note.pitch);
            ctx.fillText(label, x + 6, h / 2);
        }
    });
}

function renderRuler() {
    const pps = getPPS();
    const bpm = getBPM();

    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = resolution / 4;
    const secondsPerStep = getSecondsPerStep();
    const height = 30;
    const viewWidth = timelineScroll.clientWidth;
    const scrollX = timelineScroll.scrollLeft;
    const SUBS_PER_SECOND = 8;

    rulerCanvas.width = viewWidth;
    rulerCanvas.height = height;
    rulerCanvas.style.width = viewWidth + 'px';
    rulerCanvas.style.height = height + 'px';

    const ctx = rulerCanvas.getContext('2d');
    ctx.clearRect(0, 0, viewWidth, height);
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aaa';

    const startSec = Math.floor(scrollX / pps);
    const endSec = Math.ceil((scrollX + viewWidth) / pps);

    for (let t = startSec; t <= endSec; t++) {
        if (t < 0 || t > totalSeconds) continue;

        const x = Math.floor((t * pps) - scrollX);

        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, height);
        ctx.lineTo(x + 0.5, 0);
        ctx.stroke();

        ctx.fillText(t.toString(), x + 6, 11);

        if (t === totalSeconds) continue;

        const stepsPerSecond = stepsPerBeat / secondsPerBeat;
        
        for (let s = 1; s < SUBS_PER_SECOND; s++) {
            const subX = Math.floor(
                ((t + s / SUBS_PER_SECOND) * pps) - scrollX
            );
        
            if (subX < -20 || subX > viewWidth + 20) continue;
            const isBeat = s % stepsPerBeat === 0;
        
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
        
            ctx.beginPath();
            ctx.moveTo(subX + 0.5, height);
            ctx.lineTo(
                subX + 0.5,
                isBeat ? height - 15 : height - 10
            );
            ctx.stroke();
        }

    }
}

function renderGrid() {
    if (!timelineGrid) return;
    const pps = getPPS();
    const bpm = getBPM();
    const secondsPerBeat = 60 / bpm;
    const beatWidth = secondsPerBeat * pps;

    timelineGrid.innerHTML = ''; 
    timelineGrid.style.width = (totalSeconds * pps) + 'px';

    const totalBeats = Math.ceil(totalSeconds / secondsPerBeat);

    for (let i = 0; i < totalBeats; i++) {
        const line = document.createElement('div');
        line.className = (i % 4 === 0) ? 'grid-line bar' : 'grid-line beat';
        line.style.left = `${i * beatWidth}px`;
        timelineGrid.appendChild(line);
    }
}

function updateGridCSS() {
    const pps = getPPS();
    const bpm = getBPM();
    const secondsPerBeat = 60 / bpm;
    const stepWidth = (secondsPerBeat * pps) / 4; 
}

function attachStepListeners(step, trackIdx, stepIdx, trackData) {
    if (isSelectionDragging || window.lassoActive || window.lassoExists) return;
    step.addEventListener('click', (e) => {
        if (window.lassoActive || window.lassoExists) return;
        if (e.button !== 1) return;

        trackData.steps[stepIdx] = !trackData.steps[stepIdx];
        step.classList.toggle('active', trackData.steps[stepIdx]);
    });
}

function rebuildInstrumentSteps(trackData) {
    if (!trackData || !trackData.stepCanvas) return;

    resizeStepCanvas(trackData);
    drawTrackSteps(trackData);
}

function toggleSelect(trackIdx, stepIdx) {
    const already = selectedItems.find(s => s.trackIdx === trackIdx && s.stepIdx === stepIdx);
    if (!already) {
        selectedItems.push({ trackIdx, stepIdx });
    }
    drawSelectionBox();
}

timelineContent.addEventListener('contextmenu', (e) => {
    const cx = e.clientX;
    const cy = e.clientY;

    e.preventDefault();
    e.stopPropagation();

    const lassoEl = document.getElementById('selection-marquee');
    if (lassoEl) lassoEl.style.pointerEvents = 'none';
    const realTarget = document.elementFromPoint(cx, cy);
    if (lassoEl) lassoEl.style.pointerEvents = '';

    if (!realTarget) return;

    const audioItems =
    window.lassoActive &&
    Array.isArray(window.audioLassoSelection)
        ? window.audioLassoSelection
        : [];

    if (audioItems.length > 0) {
        const coords = getTimelineCoords(cx, cy);
        const rect = timelineScroll.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineScroll.scrollLeft;
        audioPasteTime = Math.max(0, x / getPPS());
        const targetTrackIdx = getTrackIndexFromY(coords.y);

        openAudioLassoContextMenu(
            e.pageX,
            e.pageY,
            audioItems,
            targetTrackIdx
        );
        return;
    }

    const trackEl =
        realTarget.closest('.instrument-track') ||
        realTarget.closest('.synth-track');

    if (trackEl) {
        const coords = getTimelineCoords(cx, cy);
        const trackIdx = getTrackIndexFromY(coords.y);
        if (trackIdx == null) return;

        const stepIdx = Math.floor(coords.x / getStepWidth());
        window.pasteTarget = { trackIdx, stepIdx };
        
        showContextMenu(cx, cy, trackIdx, stepIdx);
        return;
    }

});

function showContextMenu(x, y, trackIdx, stepIdx) {
    if(!window.lassoActive) return;
    let menu = document.getElementById('ctx-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'ctx-menu';
        menu.className = 'context-menu';
        document.body.appendChild(menu);
    }

    menu.style.display = 'block';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    menu.innerHTML = `
        <div onclick="copySelectedSteps()">Copy</div>
        <div onclick="pasteStepsAt()">Paste</div>
        <div onclick="removeSelectedSteps()">Remove</div>
    `;
}

function openAudioLassoContextMenu(x, y, items, targetTrackIdx = null) {
    
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.innerHTML = `
        <div class="menu-header">Audio Selection (${items.length})</div>
        <div class="flex-center">
        <button id="a-copy" class="btn btn-default"><img src="./img/icons/copy-64-w.png"/> Copy</button>
        <button id="a-paste" class="btn btn-default"><img src="./img/icons/stamp-64-w.png"/> Paste</button>
        <button id="a-remove" class="btn btn-red"><img src="./img/icons/remove-r-64.png"/>️ Remove</button>
        </div>
    `;

    document.body.appendChild(menu);

    menu.querySelector('#a-copy').onclick = () => {
        window.audioLassoClipboard = items
            .map(i => ({
                buffer: i.clip.buffer,
                trimStart: i.clip.trimStart,
                trimEnd: i.clip.trimEnd,
                offset: i.clip.startOffset,
                trackIdx: i.trackIdx
            }))
            .sort((a, b) => a.offset - b.offset);

        menu.remove();
    };

    menu.querySelector('#a-paste').onclick = () => {
        pastFromLasso(targetTrackIdx);

        menu.remove();
    };

    menu.querySelector('#a-remove').onclick = () => {
        items.forEach(i => {
            if (!audioTracks[i.trackIdx]) return;
            removeClip(audioTracks[i.trackIdx], i.clip);
        });
        destroyLasso();
        menu.remove();
    };

    setTimeout(() => {
        const close = () => {
            menu.remove();
            document.removeEventListener('click', close);
        };
        document.addEventListener('click', close);
    }, 10);
}

function pastFromLasso(targetTrackIdx){
    if (!window.audioLassoClipboard?.length) return;

        const baseTime = audioPasteTime ?? pausedAt;
        const baseOffset = window.audioLassoClipboard[0].offset;

        window.audioLassoClipboard.forEach(data => {
            const rel = data.offset - baseOffset;
            const start = Math.max(0, baseTime + rel);

            const destTrackIdx =
                targetTrackIdx != null
                    ? targetTrackIdx
                    : data.trackIdx;

            const track = audioTracks[destTrackIdx];
            if (!track) return;

            const clip = createClip(data.buffer, start);
            clip.trimStart = data.trimStart;
            clip.trimEnd = data.trimEnd;
            clip.track = track;
            clip.color = track.color;

            track.clips.push(clip);
            renderClip(track, clip);
        });
}

function refreshUI() {
    if (window.isLassoActive) return;

    audioTracks.forEach(track => {
        if ((track.type === 'instrument' || track.type === 'synth') && track.stepCanvas) {
            drawTrackSteps(track);
        }
    });
}

function copySelectedSteps() {
    if (!selectedItems.length) return;
    const minTrack = Math.min(...selectedItems.map(i => i.trackIdx));

    const minStep = Math.min(...selectedItems.map(i => {
        if (i.type === 'instrument') return i.stepIdx;
        if (i.type === 'synth') return i.note.startStep;
        return Infinity;
    }));

    clipboardData = selectedItems.map(item => {

        if (item.type === 'instrument') {
            return {
                type: 'instrument',
                relT: item.trackIdx - minTrack,
                relS: item.stepIdx - minStep,
                data: structuredClone(
                    audioTracks[item.trackIdx].steps[item.stepIdx]
                )
            };
        }

        if (item.type === 'synth') {
            return {
                type: 'synth',
                relT: item.trackIdx - minTrack,
                relS: item.note.startStep - minStep,
                data: {
                    length: item.note.length,

                    mode: item.note.mode ?? 'single',
                    pitch: item.note.pitch ?? null,
                    pitches: Array.isArray(item.note.pitches)
                        ? structuredClone(item.note.pitches)
                        : null,
                    activeChordIndex: item.note.activeChordIndex ?? 0,

                    velocity: item.note.velocity,
                    pan: item.note.pan,
                    echoPreset: item.note.echoPreset,

                    attack: item.note.attack,
                    decay: item.note.decay,
                    sustain: item.note.sustain,
                    release: item.note.release,

                    velEnv: Array.isArray(item.note.velEnv)
                        ? structuredClone(item.note.velEnv)
                        : null,

                    pitchEnv: Array.isArray(item.note.pitchEnv)
                        ? structuredClone(item.note.pitchEnv)
                        : null
                }
            };
        }

    }).filter(Boolean);
}

function pasteStepsAt() {
    if (!window.pasteTarget || !clipboardData?.length) return;

    const { trackIdx, stepIdx } = window.pasteTarget;
    const createdNotes = [];

    clipboardData.forEach(p => {
        const t = trackIdx + p.relT;
        if (!audioTracks[t]) return;

        const track = audioTracks[t];

        if (p.type === 'instrument' && track.type === 'instrument') {
            const s = stepIdx + p.relS;
            if (s < 0 || s >= track.steps.length) return;

            const before = track.steps[s];
            const after = structuredClone(p.data);

            track.steps[s] = after;

            pushHistory({
                undo() {
                    track.steps[s] = before;
                    drawTrackSteps(track);
                },
                redo() {
                    track.steps[s] = structuredClone(after);
                    drawTrackSteps(track);
                }
            });
        }

        if (p.type === 'synth' && track.type === 'synth') {
            const start = stepIdx + p.relS;
        
            const note = normalizeSynthNote({
                startStep: start,
                length: p.data.length,
        
                mode: p.data.mode,
                pitch: p.data.pitch,
                pitches: Array.isArray(p.data.pitches)
                    ? structuredClone(p.data.pitches)
                    : null,
                activeChordIndex: p.data.activeChordIndex ?? 0,
        
                velocity: p.data.velocity,
                pan: p.data.pan,
                echoPreset: p.data.echoPreset,
        
                attack: p.data.attack,
                decay: p.data.decay,
                sustain: p.data.sustain,
                release: p.data.release,
        
                velEnv: Array.isArray(p.data.velEnv)
                    ? structuredClone(p.data.velEnv)
                    : null,
        
                pitchEnv: Array.isArray(p.data.pitchEnv)
                    ? structuredClone(p.data.pitchEnv)
                    : null,
        
                _track: track
            });
        
            pushHistory({
                undo() {
                    track.notes = track.notes.filter(n => n !== note);
                    drawTrackSteps(track);
                },
                redo() {
                    track.notes.push(note);
                    drawTrackSteps(track);
                }
            });
        
            track.notes.push(note);
        }

    });

    audioTracks.forEach(drawTrackSteps);

    selectedItems.length = 0;
    createdNotes.forEach(n => {
        selectedItems.push({
            type: 'synth',
            note: n,
            trackIdx: audioTracks.indexOf(n._track)
        });
    });
}


function sampleEnvelope(env, tNorm) {
    if (!env || env.length === 0) return 0;

    for (let i = 0; i < env.length - 1; i++) {
        const a = env[i];
        const b = env[i + 1];
        if (tNorm >= a.t && tNorm <= b.t) {
            const k = (tNorm - a.t) / (b.t - a.t);
            return a.v + (b.v - a.v) * k;
        }
    }
    return env.at(-1).v;
}

function copySynthNote(note) {
    noteClipboard = structuredClone(note);
}

function pasteSynthNote(track, atStep) {
    if (!noteClipboard) return;

    const n = structuredClone(noteClipboard);
    n.startStep = atStep;
    n._track = track;

    track.notes.push(n);
}

function removeSelectedSteps() {
    const removed = [];
    selectedItems.forEach(item => {
        const track = audioTracks[item.trackIdx];

        if (item.type === 'instrument') {
            const track = audioTracks[item.trackIdx];
            const before = track.steps[item.stepIdx];
        
            removed.push(() => {
                track.steps[item.stepIdx] = before;
            });
        
            track.steps[item.stepIdx] = false;
        }

        if (item.type === 'synth') {
            const track = audioTracks[item.trackIdx];
            const note = item.note;
        
            pushHistory({
                undo() {
                    track.notes.push(note);
                    drawTrackSteps(track);
                },
                redo() {
                    track.notes = track.notes.filter(n => n !== note);
                    drawTrackSteps(track);
                }
            });
        
            track.notes = track.notes.filter(n => n !== note);
        }

    });
    
    pushHistory({
        undo() {
            removed.forEach(fn => fn());
            audioTracks.forEach(drawTrackSteps);
        },
        redo() {
            removeSelectedSteps();
        }
    });

    selectedItems = [];
    drawSelectionBox();
    audioTracks.forEach(drawTrackSteps);
}

function initDefaultSynth(track) {

    if (!track.settings) track.settings = {};
    if (!track.settings.synth) {

        const preset = SYNTH_PRESETS[DEFAULT_SYNTH_PRESET];

        track.settings.synth = structuredClone(preset);
        track.instrument = preset.oscType;
        track.settings.source = 'oscillator';
        track.settings.synth.presetName = DEFAULT_SYNTH_PRESET;
    }
}

function applyZoom() {
    if (isCtrlDragging || window.isLassoActive) return;
    const pps = getPPS();
    const bpm = getBPM();
    const secondsPerBeat = 60 / bpm;
    const totalWidth = totalSeconds * pps;

    if (timelineContent) timelineContent.style.width = totalWidth + 'px';

        audioTracks.forEach(track => {
            if (track.trackElement) {
                track.trackElement.style.width = totalWidth + 'px';
                
                if (track.clips) {
                    track.clips.forEach(clip => {
                        if(clip.dom){
                            clip.dom.style.left = (clip.startOffset * pps) + 'px';
                            clip.dom.style.width = ((clip.trimEnd - clip.trimStart) * pps) + 'px';
                            const canvas = clip.dom.querySelector('canvas');
                            if (canvas) drawClipWaveform(clip, canvas, pps);
                        }
                    });
                }
    
                if (track.type === 'instrument' || track.type === 'synth') {
                    rebuildInstrumentSteps(track);
                }
                
                else if (track.type === 'audio') {
                    resizeAudioGridCanvas(track);
                    drawAudioGrid(track);
                }
            }
        });
    
        const elapsed = isPlaying ? (audioContext.currentTime - playStartTime) : 0;
        const currentTime = pausedAt + elapsed;
        if (playhead) {
            playhead.style.left = (currentTime * pps) + 'px';
        }
        
        renderRuler();
        updateAllAudioClipSizes();
        if (window.lassoExists && lassoState) {
            drawSelectionBox();
        }
    
}

function handleTouchStart(e, clip, track) {
    const now = Date.now();
    const TIMESPAN = 300;

    if (now - lastTap < TIMESPAN) {
        console.log("Double tapped clip:", clip);
        openClipSettings(clip, track);
        e.preventDefault();
    }
    lastTap = now;
}

function attachClipDragListeners(clipElement, clip, track) {
    let startX = 0;
    let initialLeft = 0;
    let isDragging = false;

    const onStart = (e) => {
        if (!isMagnetActive) return;
        
        isDragging = true;
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        
        startX = clientX;
        initialLeft = parseFloat(clipElement.style.left) || 0;
        
        clipElement.classList.add('dragging');
        
        if (e.type.includes('touch')) e.preventDefault(); 
    };

    const onMove = (e) => {
        if (!isDragging || !isMagnetActive) return;

        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const deltaX = clientX - startX;
        
        const pixelsPerSecond = getPPS();
        const stepsPerBeat = resolution / 4;
        const stepSize = (60 / getBPM() * pixelsPerSecond) / stepsPerBeat;

        let newLeft = initialLeft + deltaX;
        newLeft = Math.round(newLeft / stepSize) * stepSize;
        newLeft = Math.max(0, newLeft);

        clipElement.style.left = `${newLeft}px`;
        clip.startOffset = newLeft / pixelsPerSecond;
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        clipElement.classList.remove('dragging');
    };

    clipElement.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    clipElement.addEventListener('touchstart', onStart, { passive: false });
    clipElement.addEventListener('touchmove', onMove, { passive: false });
    clipElement.addEventListener('touchend', onEnd);
}

document.addEventListener('mousedown', (e) => {
    if (e.altKey) e.preventDefault();
});

renderRuler();
