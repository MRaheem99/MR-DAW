function addClipToTrack(track, clip) {
    track.clips.push(clip);
    renderClip(track, clip);
}

function removeClipFromTrack(track, clip) {
    if (clip.dom) clip.dom.remove();
    track.clips = track.clips.filter(c => c !== clip);
}

addAudioBtn.addEventListener('click', () => {
    const defaultBuffer = createDefaultAudioBuffer(1);

    const track = addAudioTrackWithWaveform(
        defaultBuffer,
        'Audio Track'
    );

    track.type = 'audio';

    track.settings.source = 'sample';
    track.sampleBuffer = defaultBuffer;
    updateTrackStates();

    openInstrumentPopup(track);
});

function lassoOwnsContextMenu() {
    return (
        (window.lassoExists || window.lassoActive) &&
        Array.isArray(selectedItems) &&
        selectedItems.length > 0
    );
}

function createDefaultAudioBuffer(duration = 1) {
    const sr = audioContext.sampleRate;
    const length = sr * duration;
    const buffer = audioContext.createBuffer(1, length, sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
        data[i] = Math.sin(2 * Math.PI * 220 * (i / sr)) * 0.1;
    }

    return buffer;
}

async function loadAudioFileAndCreateTrack(file) {
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        addAudioTrackWithWaveform(audioBuffer, file.name);
    } catch (err) {
        console.error('Audio load failed:', err);
        alert('Failed to load audio file.');
    }
}

function syncInstrumentStepsToTimeline() {
    const bpm = getBPM();
    const secondsPerStep = getSecondsPerStep();
    const requiredSteps = Math.ceil(totalSeconds / getSecondsPerStep());

    audioTracks.forEach(track => {
        if (track.type === 'instrument') {
            const currentSteps = track.steps.length;
            
            if (requiredSteps > currentSteps) {
                
                const extraSteps = new Array(requiredSteps - currentSteps).fill(false);
                track.steps = track.steps.concat(extraSteps);
                
                rebuildInstrumentSteps(track);
            }
        }
    });
}

function createClip_L(buffer, startOffset) {
    
    return {
        id: "clip_" + crypto.randomUUID(),
        buffer: buffer,
        startOffset: startOffset,
        trimStart: 0,
        trimEnd: buffer.duration,
        loopEnabled: false,
        loopCount: 1,
        baseDuration: buffer.duration,

        effects: {
            volume: 1.0,
            pitch: 1.0,
            reverb: 0,
            echoPreset: 'off',
            fadeIn: 0,
            fadeOut: 0
        },
        dom: null,
        color: null,
        track: null
    };
}

function createClip(buffer, startOffset) {
    return {
        id: "clip_" + crypto.randomUUID(),
        buffer: buffer,
        startOffset: startOffset,
        trimStart: 0,
        trimEnd: buffer?.duration || 0,
        loopEnabled: false,
        loopCount: 1,
        baseDuration: buffer?.duration || 0,
        effects: {
            volume: 1.0,
            pitch: 1.0,
            pan: 0.0,
            reverb: 0,
            echoPreset: 'off',
            delayTime: 0,
            delayMix: 0,
            chorus: 0,
            fadeIn: 0,
            fadeOut: 0
        },
        dom: null,
        color: null,
        track: null
    };
}

function secondsFromMouse(e) {
    const rect = timelineScroll.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineScroll.scrollLeft;
    return Math.max(0, x / getPPS());
}

function drawClipWaveform(clip, canvas, pps) {
    if (!canvas || !clip.buffer) return;

    const ctx = canvas.getContext('2d');

    const visualDuration = clip.trimEnd - clip.trimStart;
    const bufferDuration = clip.buffer.duration;

    const visualWidth = visualDuration * pps;
    const visualHeight = 35;

    canvas.width = Math.floor(visualWidth);
    canvas.height = visualHeight;
    canvas.style.width = visualWidth + 'px';
    canvas.style.height = visualHeight + 'px';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const amp = visualHeight / 2;
    ctx.fillStyle = clip.color?.wave || '#4caf50';

    const channelData = clip.buffer.getChannelData(0);
    const sampleRate = clip.buffer.sampleRate;

    const baseTrimDuration = Math.min(
        bufferDuration - clip.trimStart,
        bufferDuration
    );

    const repeatCount = Math.ceil(visualDuration / baseTrimDuration);

    for (let r = 0; r < repeatCount; r++) {

        const loopStartTime = r * baseTrimDuration;
        const remainingTime = visualDuration - loopStartTime;

        if (remainingTime <= 0) break;

        const drawDuration = Math.min(baseTrimDuration, remainingTime);
        const startSample = Math.floor(clip.trimStart * sampleRate);
        const endSample = Math.floor((clip.trimStart + drawDuration) * sampleRate);
        const sliced = channelData.subarray(startSample,Math.min(endSample, channelData.length));
        const loopX = loopStartTime * pps;
        const loopWidth = drawDuration * pps;
        const samplesPerPixel = sliced.length / loopWidth;

        for (let x = 0; x < loopWidth; x++) {
            const sampleIndexStart = Math.floor(x * samplesPerPixel);
            const sampleIndexEnd = Math.floor((x + 1) * samplesPerPixel);

            if (sampleIndexStart >= sliced.length) break;

            let min = 1;
            let max = -1;

            for (let i = sampleIndexStart; i < sampleIndexEnd && i < sliced.length; i++) {
                const v = sliced[i];
                if (v < min) min = v;
                if (v > max) max = v;
            }

            const height = Math.max(1, (max - min) * amp);

            ctx.fillRect(
                loopX + x,
                amp + min * amp,
                1,
                height
            );
        }
    }
}

function drawClipWaveform_L(clip, canvas, pps) {
    if (!canvas || !clip.buffer) return;

    const ctx = canvas.getContext('2d');

    const visualDuration = clip.trimEnd - clip.trimStart;
    const bufferDuration = clip.buffer.duration;
    const visualWidth = visualDuration * pps;
    const MAX_CANVAS_WIDTH = 32767;
    const cappedWidth = Math.min(Math.floor(visualWidth), MAX_CANVAS_WIDTH);

    const visualHeight = 35;

    canvas.width = cappedWidth;
    canvas.height = visualHeight;
    canvas.style.width = Math.min(visualWidth, MAX_CANVAS_WIDTH) + 'px';
    canvas.style.height = visualHeight + 'px';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = visualHeight / 2;
    const amplitudeScale = centerY;

    ctx.fillStyle = clip.color?.wave || '#4caf50';

    const channelData = clip.buffer.getChannelData(0);
    const sampleRate = clip.buffer.sampleRate;
    const baseTrimDuration = Math.min(bufferDuration - clip.trimStart, bufferDuration);
    const repeatCount = Math.ceil(visualDuration / baseTrimDuration);
    const visibleStartPx = Math.max(0, -canvas.offsetLeft || 0);
    const visibleEndPx = Math.min(canvas.width, visibleStartPx + (canvas.clientWidth || canvas.width));

    for (let r = 0; r < repeatCount; r++) {
        const loopStartTime = r * baseTrimDuration;
        const loopStartPx = loopStartTime * pps;
        const loopEndPx = loopStartPx + (baseTrimDuration * pps);

        if (loopEndPx < visibleStartPx || loopStartPx > visibleEndPx) continue;

        const remainingTime = visualDuration - loopStartTime;
        if (remainingTime <= 0) break;

        const drawDuration = Math.min(baseTrimDuration, remainingTime);
        const startSample = Math.floor(clip.trimStart * sampleRate);
        const endSample = Math.floor((clip.trimStart + drawDuration) * sampleRate);

        const sliced = channelData.subarray(startSample,Math.min(endSample, channelData.length));

        const loopWidth = drawDuration * pps;
        const samplesPerPixel = sliced.length / loopWidth;
        const startX = Math.max(0, Math.ceil(visibleStartPx - loopStartPx));
        const endX = Math.min(loopWidth, Math.floor(visibleEndPx - loopStartPx));

        for (let x = startX; x < endX; x++) {
            const sampleIndexStart = Math.floor(x * samplesPerPixel);
            const sampleIndexEnd = Math.floor((x + 1) * samplesPerPixel);

            let min = 1;
            let max = -1;

            for (let i = sampleIndexStart; i < sampleIndexEnd && i < sliced.length; i++) {
                const v = sliced[i];
                if (v < min) min = v;
                if (v > max) max = v;
            }

            const peakHeight = (max - min) * amplitudeScale;
            const yStart = centerY - (max * amplitudeScale) - 1;

            ctx.fillRect(
                loopStartPx + x,
                yStart,
                1,
                peakHeight
            );
        }
    }
}

function drawClipWaveform_N(clip, canvas, pps) {
    if (!canvas || !clip?.buffer) return;

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    if (!container) return;

    const viewWidth  = container.clientWidth;
    const viewHeight = 60;

    canvas.width  = viewWidth;
    canvas.height = viewHeight;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, viewWidth, viewHeight);

    const centerY = viewHeight / 2;
    const ampScale = centerY * 0.95;

    ctx.fillStyle = clip.color?.wave || '#4caf50';

    const scrollLeft = container.scrollLeft;
    const visibleStartTime = scrollLeft / pps;
    const visibleDuration  = viewWidth / pps;

    const visibleEndTime = visibleStartTime + visibleDuration;

    const channel = clip.buffer.getChannelData(0);
    const sr      = clip.buffer.sampleRate;
    const loopLen = clip.trimEnd - clip.trimStart;

    let currentTime = visibleStartTime;
    let currentX    = 0;

    while (currentTime < visibleEndTime && currentX < viewWidth) {
        const timeInLoop = currentTime % loopLen;
        const absTime    = clip.trimStart + timeInLoop;

        const startSample = Math.floor(absTime * sr);
        const remaining   = visibleEndTime - currentTime;
        const drawSamples = Math.min(
            Math.floor((clip.trimEnd - absTime) * sr),
            Math.floor(remaining * sr)
        );

        const endSample = Math.min(startSample + drawSamples, channel.length);
        const segment   = channel.subarray(startSample, endSample);

        if (segment.length < 2) break;

        const samplesPerPx = segment.length / (viewWidth - currentX);
        const pixelsThis   = Math.ceil(segment.length / samplesPerPx);

        for (let px = 0; px < pixelsThis && currentX < viewWidth; px++) {
            const s0 = Math.floor(px * samplesPerPx);
            const s1 = Math.min(Math.floor((px + 1) * samplesPerPx), segment.length);

            let min = 1, max = -1;
            for (let i = s0; i < s1; i++) {
                const v = segment[i];
                min = Math.min(min, v);
                max = Math.max(max, v);
            }

            if (max <= min) continue;

            const height = (max - min) * ampScale;
            const yStart = centerY - max * ampScale;

            ctx.fillRect(
                Math.round(currentX + px),
                Math.round(yStart),
                1,
                Math.max(1, Math.round(height))
            );
        }

        currentX    += pixelsThis;
        currentTime += pixelsThis / pps;
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(viewWidth, centerY);
    ctx.stroke();
}

function drawFromCache(cache, ctx, width, height) {
  ctx.strokeStyle = '#0f0';
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const { min, max } = cache[x];
    const y1 = (1 - max) * height / 2;
    const y2 = (1 - min) * height / 2;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.stroke();
}

function createAudioGridCanvas(track) {
    const canvas = document.createElement('canvas');
    canvas.className = 'audio-grid-canvas';

    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';

    track.trackElement.appendChild(canvas);
    track.audioGridCanvas = canvas;

    resizeAudioGridCanvas(track);
    drawAudioGrid(track);
}

function resizeAudioGridCanvas(track) {
    const canvas = track.audioGridCanvas;
    if (!canvas) return;

    const width = totalSeconds * getPPS();
    const height = track.trackElement.clientHeight;
    const newWidth = Math.min(width, 50000);
    if (canvas.width !== newWidth) {
        canvas.width = newWidth;
    }
    canvas.height = height;
}

function drawAudioGrid(track) {
    const canvas = track.audioGridCanvas;
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
}

function waitForCanvasReady(trackData, retries = 10) {
    const canvas = trackData?.canvas;

    if (!canvas) return;

    function tryDraw() {
        
        if (!canvas || !canvas.parentElement) {
            if (retries > 0) {
                setTimeout(() => waitForCanvasReady(trackData, retries - 1), 50);
            }
            return;
        }

        const parent = canvas.parentElement;
        const height = parent.getBoundingClientRect().height;

        if (height > 0) {
            return;
        }

        if (retries > 0) {
            setTimeout(() => waitForCanvasReady(trackData, retries - 1), 50);
        } else {
            console.warn('Waveform draw skipped: parent not ready.');
        }
    }

    requestAnimationFrame(tryDraw);
}


function startWaveformDrag(e, track, clip) {
    if (!clip || !clip.dom) return; 
    if (e.shiftKey || window.isMagnetActive) {
    
        const clipEl = clip.dom; 
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
    
        const isTouch = e.type.startsWith('touch');
        const startX = isTouch ? e.touches[0].clientX : e.clientX;
        const origLeft = parseFloat(clipEl.style.left || 0);
    
        clipEl.style.opacity = '0.7';
        clipEl.style.zIndex = '1000';
    
        function onMove(ev) {
            if (window.isMagnetActive || ev.shiftKey) {
                const currentX = ev.type.startsWith('touch') ? ev.touches[0].clientX : ev.clientX;
                const deltaX = currentX - startX;
                let newLeft = origLeft + deltaX;
                if (newLeft < 0) newLeft = 0;
                clipEl.style.left = `${newLeft}px`;
                const pps = getPPS();
                clip.startOffset = newLeft / pps;
        
                if (ev.cancelable) ev.preventDefault();
            }
        }
        
        const startOffsetBefore = clip.startOffset;
    
        function onUp() {
            const endOffset = clip.startOffset;

            if (startOffsetBefore !== endOffset) {
                pushHistory({
                    redo() {
                        clip.startOffset = endOffset;
                        updateClipDOMSize(clip);
                    },
                    undo() {
                        clip.startOffset = startOffsetBefore;
                        updateClipDOMSize(clip);
                    }
                });
            }

            clipEl.style.opacity = '1';
            clipEl.style.zIndex = '5';
            
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        }
    
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }
}

function openClipContextMenu(x, y, track, clip, isMobile = false) {

    const existing = document.querySelector('.audio-clip-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.className = 'popup audio-clip-popup';
    popup.style.zIndex = '1001';
    
    popup.onclick = () => {
        const popups = document.querySelectorAll('.popup');
        popups.forEach(el => {
            el.style.zIndex = '100'; 
        });
        popup.style.zIndex = '1000';
    }

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    const panel = document.createElement('div');
    panel.className = 'popup-panel';

    if (!isMobile) {
        //panel.style.position = 'absolute';
        //panel.style.left = `${x}px`;
        //panel.style.top = `${y}px`;
    }

    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = `Audio Clip (${clip.id.slice(-4)})`;

    const close = document.createElement('span');
    close.className = 'popup-close';
    close.innerHTML = '&times;';
    header.appendChild(close);

    const body = document.createElement('div');
    body.className = 'popup-body';

    body.innerHTML = `
    <div class="flex-center">
        <button class="btn btn-default" id="clip-split" title="Split at Playhead"><img src="./img/icons/cut-64-w.png"/></button>
        <button class="btn btn-default" id="clip-copy" title="Copy"><img src="./img/icons/copy-64-w.png"/></button>
        <button class="btn btn-default" id="clip-paste" title="Paste"><img src="./img/icons/stamp-64-w.png"/></button>
        <button class="btn btn-default" id="clip-effects" title="Effects"><img src="./img/icons/slider-v-64-w.png"/></button>
        <button class="btn btn-default danger" id="clip-remove" title="Remove"><img src="./img/icons/remove-r-64.png"/></button>
        </div>
    `;

    panel.append(header, body);
    popup.append(overlay, panel);
    document.body.appendChild(popup);

    makeDraggable(panel, header, popup);

    body.querySelector('#clip-split').onclick = () => {
        splitClip(track);
        popup.remove();
    };

    body.querySelector('#clip-copy').onclick = () => {
        window.clipClipboard = cloneWholeClip(clip);
        popup.remove();
    };

    body.querySelector('#clip-paste').onclick = () => {
        if (window.clipClipboard) {
            pasteAudioClipAtClick(track);
        }
        popup.remove();
    };

    body.querySelector('#clip-effects').onclick = () => {
        openEffectsPopup(track, clip);
        popup.remove();
    };

    body.querySelector('#clip-remove').onclick = () => {
        removeClip(track, clip);
        popup.remove();
    };

    close.onclick = () => popup.remove();
    overlay.onclick = () => popup.remove();
}

function openEffectsPopup(track, clip) {
    if (!clip) return;

    clip.effects ??= {};
    clip.effects.volume ??= 1;
    clip.effects.pitch ??= 1;
    clip.effects.pan ??= 0;
    clip.effects.delayTime ??= 0;
    clip.effects.delayMix ??= 0;
    clip.effects.chorus ??= 0;
    clip.effects.fadeIn ??= 0;
    clip.effects.fadeOut ??= 0;
    clip.effects.echoPreset ??= 'off';

    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.style.zIndex = '1001';

    popup.onclick = () => {
        document.querySelectorAll('.popup').forEach(el => el.style.zIndex = '100');
        popup.style.zIndex = '1001';
    };

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.onclick = () => popup.remove();

    const panel = document.createElement('div');
    panel.className = 'popup-panel';

    const header = document.createElement('div');
    header.className = 'popup-header';
    header.innerHTML = `CLIP EFFECTS <span class="popup-close">×</span>`;
    header.querySelector('.popup-close').onclick = () => popup.remove();

    const body = document.createElement('div');
    body.className = 'popup-body';

    body.appendChild(createRNSlider({
        label: 'Volume',
        value: clip.effects.volume,
        min: 0,
        max: 2,
        width: 360,
        height: 50,
        step: 0.01,
        onChange: v => clip.effects.volume = v,
        onCommit: (b, a) => pushHistory({ undo() { clip.effects.volume = b; }, redo() { clip.effects.volume = a; } })
    }));

    body.appendChild(createRNSlider({
        label: 'Pitch',
        value: clip.effects.pitch,
        min: 0.25,
        max: 4,
        width: 360,
        height: 50,
        step: 0.01,
        onChange: v => clip.effects.pitch = v,
        onCommit: (b, a) => pushHistory({ undo() { clip.effects.pitch = b; }, redo() { clip.effects.pitch = a; } })
    }));

    body.appendChild(createRNSlider({
        label: 'Pan',
        value: clip.effects.pan,
        min: -1,
        max: 1,
        width: 360,
        height: 50,
        step: 0.01,
        onChange: v => {
            clip.effects.pan = v;
            if (clip._panNode) clip._panNode.pan.value = v;
        },
        onCommit: (b, a) => pushHistory({ undo() { clip.effects.pan = b; }, redo() { clip.effects.pan = a; } })
    }));

    body.appendChild(createRNSlider({
        label: 'Delay Time (s)',
        value: clip.effects.delayTime,
        min: 0,
        max: 2,
        width: 360,
        height: 50,
        step: 0.01,
        onChange: v => clip.effects.delayTime = v,
        onCommit: (b, a) => pushHistory({ undo() { clip.effects.delayTime = b; }, redo() { clip.effects.delayTime = a; } })
    }));

    body.appendChild(createRNSlider({
        label: 'Delay Mix',
        value: clip.effects.delayMix,
        min: 0,
        max: 1,
        width: 360,
        height: 50,
        step: 0.01,
        onChange: v => clip.effects.delayMix = v,
        onCommit: (b, a) => pushHistory({ undo() { clip.effects.delayMix = b; }, redo() { clip.effects.delayMix = a; } })
    }));

    body.appendChild(createRNSlider({
        label: 'Chorus',
        value: clip.effects.chorus,
        min: 0,
        max: 1,
        width: 360,
        height: 50,
        step: 0.01,
        onChange: v => clip.effects.chorus = v,
        onCommit: (b, a) => pushHistory({ undo() { clip.effects.chorus = b; }, redo() { clip.effects.chorus = a; } })
    }));

    const echoOptions = Object.keys(ECHO_PRESETS || { off: 'Off', short: 'Short', medium: 'Medium', long: 'Long' });
    body.appendChild(createSelect('Echo', echoOptions, clip.effects.echoPreset, v => clip.effects.echoPreset = v));

    body.appendChild(createRNSlider({
        label: 'Fade In (s)',
        value: clip.effects.fadeIn,
        min: 0,
        max: 5,
        width: 360,
        height: 50,
        step: 0.01,
        onChange: v => clip.effects.fadeIn = v,
        onCommit: (b, a) => pushHistory({ undo() { clip.effects.fadeIn = b; }, redo() { clip.effects.fadeIn = a; } })
    }));

    body.appendChild(createRNSlider({
        label: 'Fade Out (s)',
        value: clip.effects.fadeOut,
        min: 0,
        max: 5,
        width: 360,
        height: 50,
        step: 0.01,
        onChange: v => clip.effects.fadeOut = v,
        onCommit: (b, a) => pushHistory({ undo() { clip.effects.fadeOut = b; }, redo() { clip.effects.fadeOut = a; } })
    }));

    panel.append(header, body);
    popup.append(overlay, panel);
    document.body.appendChild(popup);
    makeDraggable(panel, header, popup);
}

function cloneBufferRightOfPlayhead(clip) {
  const relativePlayheadTime = pausedAt - clip.startOffset;
  const startAt = Math.max(0, relativePlayheadTime);
  
  if (startAt >= clip.buffer.duration) {
    console.warn("Playhead is past the end of this clip.");
    return null;
  }

  const sr = clip.buffer.sampleRate;
  const chs = clip.buffer.numberOfChannels;
  const copyDuration = clip.buffer.duration - startAt;
  const buf = audioContext.createBuffer(chs, Math.floor(copyDuration * sr), sr);
  
  for (let ch = 0; ch < chs; ch++) {
    const originalChannelData = clip.buffer.getChannelData(ch);
    buf.getChannelData(ch).set(originalChannelData.slice(Math.floor(startAt * sr)));
  }
  
  return buf;
}

function cloneWholeClip(clip) {
    if (!clip || !clip.buffer) return null;

    return {
        buffer: clip.buffer,
        trimStart: clip.trimStart ?? 0,
        trimEnd: clip.trimEnd ?? clip.buffer.duration,
        effects: JSON.parse(JSON.stringify(clip.effects || {}))
    };
}

function cloneWholeClip(clip) {
    if (!clip || !clip.buffer) return null;

    return {
        buffer: clip.buffer, 
        trimStart: clip.trimStart ?? 0,
        trimEnd: clip.trimEnd ?? clip.buffer.duration,
        effects: JSON.parse(JSON.stringify(clip.effects || {}))
    };
}

function pasteClip(track, buffer, atTime) {
    const newClip = createClip(buffer, atTime);
    track.clips.push(newClip);
    renderClip(track, newClip);
}

function pasteAudioClipAtPlayhead(track) {
    if (!window.clipClipboard) return;

    const buffer = window.clipClipboard;
    const startTime = pausedAt;

    const newClip = createClip(buffer, startTime);
    newClip.track = track;
    newClip.color = track.color;

    track.clips.push(newClip);
    renderClip(track, newClip);
    
    const clipEnd = newClip.startOffset + buffer.duration;

    if (clipEnd > totalSeconds) {
        totalSeconds = Math.ceil(clipEnd + 1);
        syncInstrumentStepsToTimeline();
        applyZoom();
    }

}

function newAudioClipAtClick(track) {
    if (!track || track.type !== 'audio') return;

    const startTime = Math.max(0, audioPasteTime);

    let buffer = null;

    if (track.settings?.source === 'sample') {
        if (!track.sampleBuffer) {
            console.warn('Audio track has no sample assigned');
            return;
        }
        buffer = track.sampleBuffer;
    } else if (track.settings?.source === 'oscillator') {
        buffer = track.renderedBuffer;
        if (!buffer) {
            console.warn('Oscillator buffer not rendered yet');
            return;
        }
    }

    else {
        console.warn('Unknown audio track source');
        return;
    }

    const clip = createClip(buffer, startTime);
    
    clip.loopEnabled = false;
    clip.loopCount = 1;
    clip.baseDuration = audioBuffer.duration;

    clip.track = track;
    clip.color = track.color;

    clip.trimStart = 0;
    clip.trimEnd = buffer.duration;

    pushHistory({
        redo() {
            addClipToTrack(track, clip);
        },
        undo() {
            removeClipFromTrack(track, clip);
        }
    });

    addClipToTrack(track, clip);

    const clipEnd = startTime + buffer.duration;
    if (clipEnd > totalSeconds) {
        totalSeconds = Math.ceil(clipEnd + 1);
        syncInstrumentStepsToTimeline();
        applyZoom();
    }
}

function pasteAudioClipAtClick(track) {
    if (!window.clipClipboard) return;

    const data = window.clipClipboard;
    const startTime = Math.max(0, audioPasteTime);

    const newClip = createClip(data.buffer, startTime);

    newClip.trimStart = data.trimStart;
    newClip.trimEnd = data.trimEnd;

    newClip.effects = JSON.parse(JSON.stringify(data.effects || {}));

    newClip.track = track;
    newClip.color = track.color;

    pushHistory({
        redo() {
            addClipToTrack(track, newClip);
        },
        undo() {
            removeClipFromTrack(track, newClip);
        }
    });

    addClipToTrack(track, newClip);

    const clipEnd = startTime + (newClip.trimEnd - newClip.trimStart);
    if (clipEnd > totalSeconds) {
        totalSeconds = Math.ceil(clipEnd + 1);
        syncInstrumentStepsToTimeline();
        applyZoom();
    }
}

function removeClip(track, clip) {
    const index = track.clips.indexOf(clip);
    if (index === -1) return;

    pushHistory({
        redo() {
            removeClipFromTrack(track, clip);
        },
        undo() {
            track.clips.splice(index, 0, clip);
            renderClip(track, clip);
        }
    });

    removeClipFromTrack(track, clip);
}

function renderClip(trackData, clip) {
    const pps = getPPS();
    const clipEl = document.createElement('div');
    clipEl.className = 'clip';
    clipEl.id = clip.id;
    clipEl.style.borderColor = trackData.color.label;
    clipEl.style.background = 'transparent';
    clip.dom = clipEl;
    updateClipDOMSize(clip);

    clipEl.addEventListener('mousedown', (e) => startWaveformDrag(e, trackData, clip));
    clipEl.addEventListener('touchstart', (e) => startWaveformDrag(e, trackData, clip), { passive: false });

    const leftHandle = document.createElement('div');
    leftHandle.className = 'clip-handle left';
    
    const rightHandle = document.createElement('div');
    rightHandle.className = 'clip-handle right';
    
    clipEl.append(leftHandle, rightHandle);

    let touchTimer;
    clipEl.addEventListener('touchstart', (e) => {
        touchTimer = setTimeout(() => {
            const rect = clipEl.getBoundingClientRect();
            const bottomOfClip = rect.bottom;
            if (!window.lassoExists){
                openClipContextMenu(0, bottomOfClip, trackData, clip, true);
            }
        }, 500);
    }, { passive: false });

    clipEl.addEventListener('touchend', () => clearTimeout(touchTimer));
    clipEl.addEventListener('touchmove', () => clearTimeout(touchTimer));

    clipEl.addEventListener('contextmenu', e => {
        if (lassoOwnsContextMenu()) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
    
        e.preventDefault();
        e.stopPropagation();
        if (!window.lassoExists){
            openClipContextMenu(e.pageX, e.pageY, trackData, clip);
        }
    });

    
    leftHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
    
        const startX = e.clientX;
        const pps = getPPS();
    
        const initialTrimStart = clip.trimStart;
        const initialStartOffset = clip.startOffset;
        
        const before = {
            trimStart: clip.trimStart,
            trimEnd: clip.trimEnd,
            startOffset: clip.startOffset
        };
    
        const onMove = (ev) => {
            const dx = (ev.clientX - startX) / pps;
    
            let newTrimStart = initialTrimStart + dx;
            newTrimStart = Math.max(0, Math.min(newTrimStart, clip.trimEnd - 0.05));
    
            clip.trimStart = newTrimStart;
            clip.startOffset = initialStartOffset + (newTrimStart - initialTrimStart);
    
            refreshClip(trackData, clip);
        };
    
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const after = {
                trimStart: clip.trimStart,
                trimEnd: clip.trimEnd,
                startOffset: clip.startOffset
            };
            
            pushHistory({
                redo() {
                    Object.assign(clip, after);
                    refreshClip(trackData, clip);
                },
                undo() {
                    Object.assign(clip, before);
                    refreshClip(trackData, clip);
                }
            });
        };
    
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    rightHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
    
        const startX = e.clientX;
        const pps = getPPS();
    
        const initialTrimEnd = clip.trimEnd;
    
        const before = {
            trimStart: clip.trimStart,
            trimEnd: clip.trimEnd,
            startOffset: clip.startOffset
        };
    
        const onMove = (ev) => {
    
            const dx = (ev.clientX - startX) / pps;
    
            let newTrimEnd = initialTrimEnd + dx;
    
            newTrimEnd = Math.max(
                clip.trimStart + 0.05,
                newTrimEnd
            );
    
            clip.trimEnd = newTrimEnd;
    
            refreshClip(trackData, clip);
        };
    
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
    
            const after = {
                trimStart: clip.trimStart,
                trimEnd: clip.trimEnd,
                startOffset: clip.startOffset
            };
    
            pushHistory({
                redo() {
                    Object.assign(clip, after);
                    refreshClip(trackData, clip);
                },
                undo() {
                    Object.assign(clip, before);
                    refreshClip(trackData, clip);
                }
            });
        };
    
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    const canvas = document.createElement('canvas');
    canvas.className = 'waveform-canvas';
    clipEl.appendChild(canvas);
    trackData.trackElement.appendChild(clipEl);
    clip.dom = clipEl;
    drawClipWaveform(clip, canvas, pps);
}

function updateAllAudioClipSizes() {
    audioTracks.forEach(track => {
        if (!track.clips) return;
        track.clips.forEach(clip => {
            updateClipDOMSize(clip);
        });
    });
}

function updateClipDOMSize(clip) {
    if (!clip || !clip.dom) return;

    const pps = getPPS();

    clip.dom.style.left = `${clip.startOffset * pps}px`;
    
    const duration = clip.loopEnabled
    ? clip.baseDuration * clip.loopCount
    : (clip.trimEnd - clip.trimStart);

    clip.dom.style.width = (duration * getPPS()) + "px";
}

function refreshClip(trackData, clip) {
    if (!clip || !clip.dom) return;
    clip.dom.remove();
    renderClip(trackData, clip);
}

function playSequencer(track) {
    const stepDuration = 60 / bpmInput.value / 4;
    track.steps.forEach((active, i) => {
        if (active) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.type = track.instrument || 'sine';
            osc.connect(gain).connect(track.effects.gainNode);
            
            const startTime = playStartTime + (i * stepDuration);
            if (startTime >= audioContext.currentTime) {
                osc.start(startTime);
                osc.stop(startTime + 0.1);
            }
        }
    });
}

function applyEnvelope(gainNode, track, startTime, stepDuration, velocity = 1) {
    const { attack, decay, release } = track.settings;

    const peak = velocity;
    const sustain = peak * 0.7;

    const endTime = startTime + stepDuration;

    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(0, startTime);

    gainNode.gain.linearRampToValueAtTime(
        peak,
        startTime + attack
    );

    gainNode.gain.linearRampToValueAtTime(
        sustain,
        startTime + attack + decay
    );

    gainNode.gain.setValueAtTime(
        sustain,
        Math.max(startTime + attack + decay, endTime - release)
    );

    gainNode.gain.linearRampToValueAtTime(
        0,
        endTime
    );
}

function createChorusNode(ctx, options = {}) {
    const {
        rate = 0.5,
        depth = 0.5,
        delayTime = 0.03,
        feedback = 0.3,
        mix = 0.5
    } = options;

    const input = ctx.createGain();
    const output = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const delay = ctx.createDelay(0.1);
    delay.delayTime.value = delayTime;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rate;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = depth * 0.005;

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = feedback;

    input.connect(dryGain);
    dryGain.connect(output);

    input.connect(delay);
    delay.connect(feedbackGain);
    feedbackGain.connect(delay);

    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);

    delay.connect(wetGain);
    wetGain.connect(output);

    dryGain.gain.value = 1 - mix;
    wetGain.gain.value = mix;

    lfo.start();

    const chorusNode = {
        input,
        output,
        connect(destination) {
            output.connect(destination);
            return chorusNode;
        },
        disconnect() {
            output.disconnect();
        },
        
        setRate(value) { lfo.frequency.value = value; },
        setDepth(value) { lfoGain.gain.value = value * 0.005; },
        setDelayTime(value) { delay.delayTime.value = value; },
        setFeedback(value) { feedbackGain.gain.value = value; },
        setMix(value) {
            dryGain.gain.value = 1 - value;
            wetGain.gain.value = value;
        }
    };

    return chorusNode;
}
