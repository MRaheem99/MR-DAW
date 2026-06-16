let lassoState = null;
let lassoBox = null;
let startX = 0;
let startY = 0;
let isSelectionDragging = false;
let selectionDrag = null;
let didDragSelection = false;
let dragOrigin = null;
let longPressTimer = null;
let touchStarted = false;
let suppressLassoDestroy = false;
let selectionMoved = false;
let dragSnapshot = null;
let originalTrackStates = null;

window.lassoActive = false;
window.lassoExists = false;

function destroyLasso() {
    const box = document.getElementById('selection-marquee');
    if (box) box.remove();

    lassoBox = null;
    selectedItems.length = 0;
    window.lassoActive = false;
    window.lassoExists = false;
    window.audioLassoSelection = [];

    if (window.lassoBtn) {
        lassoBtn.style.background = '#222';
    }
}

function createLasso(x, y) {
    if (window.lassoExists || lassoBox) return;

    startX = x;
    startY = y;

    lassoBox = document.createElement('div');
    lassoBox.className = 'lasso-box';
    lassoBox.style.left = `${x}px`;
    lassoBox.style.top = `${y}px`;
    lassoBox.style.width = '0px';
    lassoBox.style.height = '0px';

    timelineContent.appendChild(lassoBox);
    window.lassoActive = true;
}

function updateLasso(x, y) {
    if (!lassoBox) return;

    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);

    lassoBox.style.left = `${left}px`;
    lassoBox.style.top = `${top}px`;
    lassoBox.style.width = `${width}px`;
    lassoBox.style.height = `${height}px`;
}

function finishLasso() {
    if (!lassoBox) return;

    window.lassoExists = true;
    window.lassoActive = true;

    lassoBox.id = 'selection-marquee';
    lassoBox.classList.remove('lasso-box');
    lassoBox.classList.add('selection-marquee');

    selectItemsInsideSelectionBox(lassoBox);
    drawSelectionBox();

    lassoBox = null;
    timelineScroll.classList.remove('cur-default');
}

function drawSelectionBox() {
    if (!lassoState || !selectedItems.length) return;

    let box = document.getElementById('selection-marquee');
    if (!box) {
        box = document.createElement('div');
        box.id = 'selection-marquee';
        box.className = 'selection-marquee';
        timelineContent.appendChild(box);
    }

    const stepWidth = getStepWidth();

    const left   = lassoState.startStep * stepWidth;
    const right  = (lassoState.endStep + 1) * stepWidth;
    const top    = lassoState.startTrack * TRACK_HEIGHT + 30;
    const bottom = (lassoState.endTrack + 1) * TRACK_HEIGHT + 30;

    box.style.left   = `${left}px`;
    box.style.top    = `${top}px`;
    box.style.width  = `${right - left}px`;
    box.style.height = `${bottom - top}px`;
}

function selectItemsInsideSelectionBox(box) {
    selectedItems.length = 0;

    const left   = parseFloat(box.style.left);
    const top    = parseFloat(box.style.top);
    const right  = left + parseFloat(box.style.width);
    const bottom = top  + parseFloat(box.style.height);

    const stepWidth = getStepWidth();

    audioTracks.forEach((track, trackIdx) => {
        const rect = track.trackElement.getBoundingClientRect();
        const contentRect = timelineContent.getBoundingClientRect();
        const trackTop = rect.top - contentRect.top + timelineScroll.scrollTop;
        const trackBottom = trackTop + rect.height;

        if (bottom < trackTop || top > trackBottom) return;

        if (track.type === 'instrument') {
            const s0 = Math.floor(left / stepWidth);
            const s1 = Math.floor(right / stepWidth);

            for (let s = s0; s <= s1; s++) {
                if (track.steps[s]) {
                    selectedItems.push({ type: 'instrument', trackIdx, stepIdx: s });
                }
            }
        }

        if (track.type === 'synth') {
            track.notes.forEach(note => {
                const x1 = note.startStep * stepWidth;
                const x2 = x1 + note.length * stepWidth;

                if (x2 >= left && x1 <= right) {
                    selectedItems.push({ type: 'synth', trackIdx, note });
                }
            });
        }
        
        if (track.type === 'audio' && Array.isArray(track.clips)) {
            track.clips.forEach(clip => {
                const clipLeft  = clip.startOffset * getPPS();
                const clipRight = clipLeft + clip.dom.offsetWidth;
        
                if (clipRight >= left && clipLeft <= right) {
                    selectedItems.push({
                        type: 'audio',
                        trackIdx,
                        clip
                    });
                }
            });
        
            window.audioLassoSelection = selectedItems.filter(
                i => i.type === 'audio'
            );
        }


    });
}

document.addEventListener('mousedown', e => {
    const box = document.getElementById('selection-marquee');
    if (!box || !box.contains(e.target)) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    isSelectionDragging = true;

    const rect = timelineContent.getBoundingClientRect();
    const p = getTimelineCoords(e.clientX, e.clientY);
    const x = p.x;
    const stepWidth = getStepWidth();
    
    originalTrackStates = {};

    selectedItems.forEach(item => {
        if (item.type === 'instrument') {
            const track = audioTracks[item.trackIdx];
            if (!originalTrackStates[item.trackIdx]) {
                originalTrackStates[item.trackIdx] = track.steps.slice();
            }
        }
    });

    dragOrigin = selectedItems.map(item => {
        if (item.type === 'instrument') {
            return {
                type: 'instrument',
                trackIdx: item.trackIdx,
                stepIdx: item.stepIdx
            };
        }
    
        if (item.type === 'synth') {
            return {
                type: 'synth',
                trackIdx: item.trackIdx,
                note: item.note,
                startStep: item.note.startStep
            };
        }
    
        if (item.type === 'audio') {
            return {
                type: 'audio',
                trackIdx: item.trackIdx,
                clip: item.clip,
                startOffset: item.clip.startOffset
            };
        }
    });

    selectionDrag = {
        startStep: Math.floor(x / stepWidth),
        startLeft: parseFloat(box.style.left),
        startClientX: e.clientX
    };
});

document.addEventListener('mousemove', e => {
    if (!isSelectionDragging || !selectionDrag || !dragOrigin) return;
    
    const dxPx = e.clientX - selectionDrag.startClientX;

    const rect = timelineContent.getBoundingClientRect();
    const p = getTimelineCoords(e.clientX, e.clientY);
    const x = p.x;
    const stepWidth = getStepWidth();

    const step = Math.floor(x / stepWidth);
    const delta = step - selectionDrag.startStep;
    if (delta === 0) return;

    Object.keys(originalTrackStates).forEach(trackIdx => {
        const track = audioTracks[trackIdx];
        track.steps = originalTrackStates[trackIdx].slice();
    });
    
    dragOrigin.forEach(item => {
        if (item.type !== 'instrument') return;
        const track = audioTracks[item.trackIdx];
        track.steps[item.stepIdx] = false;
    });
    
    selectedItems.forEach((item, i) => {
        if (item.type === 'instrument'){
    
            const origin = dragOrigin[i];
            const track = audioTracks[item.trackIdx];
            const newStep = origin.stepIdx + delta;
        
            if (newStep >= 0 && newStep < track.steps.length) {
                track.steps[newStep] = true;
                item.stepIdx = newStep;
            } 
        } 
        else if (item.type === 'audio') {
            const origin = dragOrigin[i];
            const clip = item.clip;
            const pps = getPPS();
        
            const newLeft = (origin.startOffset * pps) + dxPx;
            const clamped = Math.max(0, newLeft);
        
            clip.startOffset = clamped / pps;
            clip.dom.style.left = `${clamped}px`;
        }
        else {
            const origin = dragOrigin[i];
            const track = audioTracks[origin.trackIdx];
            const newStart = origin.startStep + delta;
            if (newStart >= 0) {
                item.note.startStep = newStart;
            }
        }
    });

    const box = document.getElementById('selection-marquee');
    if (box) {
        box.style.left = `${selectionDrag.startLeft + dxPx}px`;
        box.style.backgroundColor = 'rgb(255, 128, 128, 0.4)';
        box.style.mixBlendMode = 'screen';
    }

    audioTracks.forEach(drawTrackSteps);
});

document.addEventListener('mouseup', () => {
    if (!isSelectionDragging) return;

    isSelectionDragging = false;
    selectionDrag = null;
    dragOrigin = null;
    
    const box = document.getElementById('selection-marquee');
    if (box) {
        box.style.backgroundColor = 'rgb(0, 229, 255, 0.1)';
    }
});

timelineContent.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!e.altKey && !window.lassoActive) return;
    if (window.lassoExists) return;

    e.preventDefault();

    const p = getTimelineCoords(e.clientX, e.clientY);
    createLasso(p.x, p.y);
});

document.addEventListener('mousemove', e => {
    if (!lassoBox) return;
    const p = getTimelineCoords(e.clientX, e.clientY);
    updateLasso(p.x, p.y);
});

document.addEventListener('mouseup', () => {
    if (lassoBox) finishLasso();
});

document.addEventListener('mousedown', e => {
    if (!window.lassoExists) return;
    if (e.button && e.ctrlKey) return;
    if (e.button !== 0) return;
    if (e.ctrlKey) return;
    if (e.target.closest('.context-menu')) return;

    const box = document.getElementById('selection-marquee');
    if (box && box.contains(e.target)) return;

    if (suppressLassoDestroy) return;

    destroyLasso();
});

window.lassoBtn.onclick = () => {
    if (window.lassoActive || window.lassoExists) {
        destroyLasso();
        lassoBtn.style.background = '#222';
    } else {
        window.lassoActive = true;
        lassoBtn.style.background = '#ffeecc';
    }
};

function clearSelection() {
    selectedItems = [];

    drawSelectionBox();
}
 
function getTrackIndexFromY(y) {
    for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        if (!track.trackElement) continue;

        const rect = track.trackElement.getBoundingClientRect();
        const contentRect = timelineContent.getBoundingClientRect();

        const top = rect.top - contentRect.top;
        const bottom = top + rect.height;

        if (y >= top && y <= bottom) {
            return i;
        }
    }
    return null;
}


function destroyLasso() {
    const box = document.getElementById('selection-marquee');
    if (box) box.remove();

    lassoBox = null;
    selectedItems.length = 0;
    window.lassoActive = false;
    window.lassoExists = false;
    window.audioLassoSelection = [];

    if (window.lassoBtn) {
        lassoBtn.style.background = '#222';
    }
}

function createLasso(x, y) {
    if (window.lassoExists || lassoBox) return;

    startX = x;
    startY = y;

    lassoBox = document.createElement('div');
    lassoBox.className = 'lasso-box';
    lassoBox.style.left = `${x}px`;
    lassoBox.style.top = `${y}px`;
    lassoBox.style.width = '0px';
    lassoBox.style.height = '0px';

    timelineContent.appendChild(lassoBox);
    window.lassoActive = true;
}

function updateLasso(x, y) {
    if (!lassoBox) return;

    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);

    lassoBox.style.left = `${left}px`;
    lassoBox.style.top = `${top}px`;
    lassoBox.style.width = `${width}px`;
    lassoBox.style.height = `${height}px`;
}

function finishLasso() {
    if (!lassoBox) return;

    window.lassoExists = true;
    window.lassoActive = true;

    lassoBox.id = 'selection-marquee';
    lassoBox.classList.remove('lasso-box');
    lassoBox.classList.add('selection-marquee');

    selectItemsInsideSelectionBox(lassoBox);
    drawSelectionBox();

    lassoBox = null;
}

function drawSelectionBox() {
    if (!lassoState || !selectedItems.length) return;

    let box = document.getElementById('selection-marquee');
    if (!box) {
        box = document.createElement('div');
        box.id = 'selection-marquee';
        box.className = 'selection-marquee';
        timelineContent.appendChild(box);
    }

    const stepWidth = getStepWidth();

    const left   = lassoState.startStep * stepWidth;
    const right  = (lassoState.endStep + 1) * stepWidth;
    const top    = lassoState.startTrack * TRACK_HEIGHT + 30;
    const bottom = (lassoState.endTrack + 1) * TRACK_HEIGHT + 30;

    box.style.left   = `${left}px`;
    box.style.top    = `${top}px`;
    box.style.width  = `${right - left}px`;
    box.style.height = `${bottom - top}px`;
}

function selectItemsInsideSelectionBox(box) {
    selectedItems.length = 0;

    const left   = parseFloat(box.style.left);
    const top    = parseFloat(box.style.top);
    const right  = left + parseFloat(box.style.width);
    const bottom = top  + parseFloat(box.style.height);

    const stepWidth = getStepWidth();

    audioTracks.forEach((track, trackIdx) => {
        const rect = track.trackElement.getBoundingClientRect();
        const contentRect = timelineContent.getBoundingClientRect();

        const trackTop = rect.top - contentRect.top;
        const trackBottom = trackTop + rect.height;

        if (bottom < trackTop || top > trackBottom) return;

        if (track.type === 'instrument') {
            const s0 = Math.floor(left / stepWidth);
            const s1 = Math.floor(right / stepWidth);

            for (let s = s0; s <= s1; s++) {
                if (track.steps[s]) {
                    selectedItems.push({ type: 'instrument', trackIdx, stepIdx: s });
                }
            }
        }

        if (track.type === 'synth') {
            track.notes.forEach(note => {
                const x1 = note.startStep * stepWidth;
                const x2 = x1 + note.length * stepWidth;

                if (x2 >= left && x1 <= right) {
                    selectedItems.push({ type: 'synth', trackIdx, note });
                }
            });
        }
        
        if (track.type === 'audio' && Array.isArray(track.clips)) {
            track.clips.forEach(clip => {
                const clipLeft  = clip.startOffset * getPPS();
                const clipRight = clipLeft + clip.dom.offsetWidth;
        
                if (clipRight >= left && clipLeft <= right) {
                    selectedItems.push({
                        type: 'audio',
                        trackIdx,
                        clip
                    });
                }
            });
        
            window.audioLassoSelection = selectedItems.filter(
                i => i.type === 'audio'
            );
        }


    });
}

document.addEventListener('mousedown', e => {
    const box = document.getElementById('selection-marquee');
    if (!box || !box.contains(e.target)) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    isSelectionDragging = true;

    const rect = timelineContent.getBoundingClientRect();
    const p = getTimelineCoords(e.clientX, e.clientY);
    const x = p.x;
    const stepWidth = getStepWidth();
    
    originalTrackStates = {};

    selectedItems.forEach(item => {
        if (item.type === 'instrument') {
            const track = audioTracks[item.trackIdx];
            if (!originalTrackStates[item.trackIdx]) {
                originalTrackStates[item.trackIdx] = track.steps.slice();
            }
        }
    });

    dragOrigin = selectedItems.map(item => {
        if (item.type === 'instrument') {
            return {
                type: 'instrument',
                trackIdx: item.trackIdx,
                stepIdx: item.stepIdx
            };
        }
    
        if (item.type === 'synth') {
            return {
                type: 'synth',
                trackIdx: item.trackIdx,
                note: item.note,
                startStep: item.note.startStep
            };
        }
    
        if (item.type === 'audio') {
            return {
                type: 'audio',
                trackIdx: item.trackIdx,
                clip: item.clip,
                startOffset: item.clip.startOffset
            };
        }
    });

    selectionDrag = {
        startStep: Math.floor(x / stepWidth),
        startLeft: parseFloat(box.style.left),
        startClientX: e.clientX
    };
});

document.addEventListener('mousemove', e => {
    if (!isSelectionDragging || !selectionDrag || !dragOrigin) return;
    
    const dxPx = e.clientX - selectionDrag.startClientX;

    const rect = timelineContent.getBoundingClientRect();
    const p = getTimelineCoords(e.clientX, e.clientY);
    const x = p.x;
    const stepWidth = getStepWidth();

    const step = Math.floor(x / stepWidth);
    const delta = step - selectionDrag.startStep;
    if (delta === 0) return;

    Object.keys(originalTrackStates).forEach(trackIdx => {
        const track = audioTracks[trackIdx];
        track.steps = originalTrackStates[trackIdx].slice();
    });
    
    dragOrigin.forEach(item => {
        if (item.type !== 'instrument') return;
        const track = audioTracks[item.trackIdx];
        track.steps[item.stepIdx] = false;
    });
    
    selectedItems.forEach((item, i) => {
        if (item.type === 'instrument'){
    
            const origin = dragOrigin[i];
            const track = audioTracks[item.trackIdx];
            const newStep = origin.stepIdx + delta;
        
            if (newStep >= 0 && newStep < track.steps.length) {
                track.steps[newStep] = true;
                item.stepIdx = newStep;
            } 
        } 
        else if (item.type === 'audio') {
            const origin = dragOrigin[i];
            const clip = item.clip;
            const pps = getPPS();
        
            const newLeft = (origin.startOffset * pps) + dxPx;
            const clamped = Math.max(0, newLeft);
        
            clip.startOffset = clamped / pps;
            clip.dom.style.left = `${clamped}px`;
        }
        else {
            const origin = dragOrigin[i];
            const track = audioTracks[origin.trackIdx];
            const newStart = origin.startStep + delta;
            if (newStart >= 0) {
                item.note.startStep = newStart;
            }
        }
    });

    const box = document.getElementById('selection-marquee');
    if (box) {
        box.style.left = `${selectionDrag.startLeft + dxPx}px`;
        box.style.backgroundColor = 'rgb(255, 128, 128, 0.4)';
        box.style.mixBlendMode = 'screen';
    }

    audioTracks.forEach(drawTrackSteps);
});

document.addEventListener('mouseup', () => {
    if (!isSelectionDragging) return;

    isSelectionDragging = false;
    selectionDrag = null;
    dragOrigin = null;
    
    const box = document.getElementById('selection-marquee');
    if (box) {
        box.style.backgroundColor = 'rgb(0, 229, 255, 0.1)';
    }
});


timelineContent.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!e.altKey && !window.lassoActive) return;
    if (window.lassoExists) return;

    e.preventDefault();
    const p = getTimelineCoords(e.clientX, e.clientY);
    createLasso(p.x, p.y);
});

document.addEventListener('mousemove', e => {
    if (!lassoBox) return;
    const p = getTimelineCoords(e.clientX, e.clientY);
    updateLasso(p.x, p.y);
});

document.addEventListener('mouseup', () => {
    if (lassoBox) finishLasso();
});


timelineContent.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    if (window.lassoExists) return;

    touchStarted = true;

    const t = e.touches[0];
    const p = getTimelineCoords(t.clientX, t.clientY);

    longPressTimer = setTimeout(() => {
        if(!window.lassoActive) return;
        createLasso(p.x, p.y);
    }, 450);
}, { passive: false });

timelineContent.addEventListener('touchmove', e => {
    if (!lassoBox) {
        clearTimeout(longPressTimer);
        return;
    }

    const t = e.touches[0];
    const p = getTimelineCoords(t.clientX, t.clientY);
    updateLasso(p.x, p.y);
}, { passive: false });

timelineContent.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
    if (lassoBox) finishLasso();
});

document.addEventListener('mousedown', e => {
    if (!window.lassoExists) return;
    if (e.button && e.ctrlKey) return;
    if (e.button !== 0) return;
    if (e.ctrlKey) return;
    if (e.target.closest('.context-menu')) return;

    const box = document.getElementById('selection-marquee');
    if (box && box.contains(e.target)) return;

    if (suppressLassoDestroy) return;

    destroyLasso();
});

window.lassoBtn.onclick = () => {
    if (window.lassoActive || window.lassoExists) {
        destroyLasso();
        lassoBtn.style.background = '#222';
    } else {
        window.lassoActive = true;
        lassoBtn.style.background = '#ffeecc';
    }
};

function clearSelection() {
    selectedItems = [];

    drawSelectionBox();
}
 
function getTrackIndexFromY(y) {
    for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        if (!track.trackElement) continue;

        const rect = track.trackElement.getBoundingClientRect();
        const contentRect = timelineContent.getBoundingClientRect();

        const top = rect.top - contentRect.top;
        const bottom = top + rect.height;

        if (y >= top && y <= bottom) {
            return i;
        }
    }
    return null;
}
