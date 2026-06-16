

function detectKicks(data, sr) {
    const windowSize = Math.floor(sr * 0.01); // 10ms
    const energies = [];

    for (let i = 0; i < data.length; i += windowSize) {
        let sum = 0;
        for (let j = 0; j < windowSize && i + j < data.length; j++) {
            const v = data[i + j];
            sum += v * v;
        }
        energies.push(sum);
    }

    return peakPick(energies, sr, windowSize, 1.5);
}

function detectSnares(data, sr) {
    const windowSize = Math.floor(sr * 0.01);
    const energies = [];

    for (let i = 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        energies.push(diff * diff);
    }

    return peakPick(energies, sr, windowSize, 1.2);
}

function peakPick(energies, sr, windowSize, thresholdMul) {
    const avg =
        energies.reduce((a, b) => a + b, 0) / energies.length;

    const peaks = [];

    energies.forEach((v, i) => {
        if (v > avg * thresholdMul) {
            const time = (i * windowSize) / sr;
            peaks.push(time);
        }
    });

    return peaks;
}

function analyzeBeatMarkers(clip) {
    clip.isAnalyzingBeats = true;
    showProgressUI('Analyzing beats…');

    requestIdleCallback(() => {
        const data = clip.buffer.getChannelData(0);
        const sr = clip.buffer.sampleRate;

        clip.beatMarkers = {
            kicks: detectKicks(data, sr),
            snares: detectSnares(data, sr)
        };

        clip.showBeatMarkers = true;
        clip.isAnalyzingBeats = false;

        hideProgressUI();
        drawBeatMarkers();
    });
}

function drawBeatMarkers() {
    audioTracks.forEach(track => {
        if (!track.beatMarkerLayer) return;

        track.beatMarkerLayer.innerHTML = '';

        track.clips.forEach(clip => {
            if (!clip.showBeatMarkers || !clip.beatMarkers) return;

            const pps = getPPS();

            clip.beatMarkers.kicks.forEach(t => {
                createMarker(track, clip.startOffset + t, pps, 'kick');
            });

            clip.beatMarkers.snares.forEach(t => {
                createMarker(track, clip.startOffset + t, pps, 'snare');
            });
        });
    });
}

function createMarker(track, time, pps, type) {
    const el = document.createElement('div');
    el.className = `beat-marker ${type}`;
    el.style.left = `${time * pps}px`;
    track.beatMarkerLayer.appendChild(el);
}

function updateBeatMarkerVisibility(track) {
    if (!track || !track.beatMarkers) return;

    const visible = track.showBeatMarkers;

    track.beatMarkers.forEach(m => {
        if (m.dom) {
            m.dom.style.display = visible ? 'block' : 'none';
        }
    });
}


