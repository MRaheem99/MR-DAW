let projectName = 'MR DWA Project';
const timelineRuler = document.getElementById('timeline-ruler');
const rulerCanvas = document.getElementById('ruler-canvas');
const timelineGrid = document.getElementById('timeline-grid');
const tracksContainer = document.getElementById('tracks');
const trackLabels = document.getElementById('track-labels');
const resolutionSelect = document.getElementById('resolution-select');
const timelineScroll = document.getElementById('timeline-scroll');
const timelineContent = document.getElementById('timeline-content');
const addAudioBtn = document.getElementById('add-audio');
const addInstrumentBtn = document.getElementById('add-instrument');
const addSynthBtn = document.getElementById('add-synth');
const magnetBtn = document.getElementById('magnetBtn');
const lassoBtn = document.getElementById('lassoBtn');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const bpmInput = document.getElementById('bpm-input');
const bpmUpBtn = document.getElementById('bpm-up');
const bpmDownBtn = document.getElementById('bpm-down');
const playhead = document.getElementById('playhead');
const projectBtn = document.getElementById('project-mgmt-btn');
const projectNameInput = document.getElementById('project-name-input');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const tempoBtn = document.getElementById('tempo-btn');
const hoverLine = document.getElementById('hover-line');
const audioInput = document.getElementById('bpm-file-input');
const analyzeBtn = document.getElementById('BPManalyzeBtn');
const statusEl = document.getElementById('BPMstatus');
const resultEl = document.getElementById('BPMresult');
const fileInput = document.getElementById('file-input');

const LONG_PRESS_DELAY = 450;
const USER_SYNTH_PRESETS_KEY = 'userSynthPresets';
const SYNTH_HANDLE_WIDTH = 6;
const TRACK_HEIGHT = 40;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCHEDULE_AHEAD_TIME = 0.15;
const SCHEDULER_INTERVAL = 40;
const MAX_PPS = 400;
const MIN_PPS = 20;
const MAX_CANVAS_WIDTH = 40000;

const playIcon = './img/icons/play-button-64.png';
const pauseIcon = './img/icons/pause-button-64.png';
const stopIcon = './img/icons/stop-button-64.png';
const settingsIcon = './img/icons/settings-64-w.png';
const soloIcon = './img/icons/solo-64-w.png';
const muteIcon = './img/icons/mute-64-w.png';
const gridIcon = './img/icons/grid-64-i.png';

let isSyncingScroll = false;
let zoomLevel = 5;
let totalSeconds = 60;
let resolution = resolutionSelect.value;
let trackCount = 0;
let isDragging = false;
let dragStartX = 0;
let scrollStartX = 0;
let lastTouchDist = null;
let isCtrlDragging = false;
let ctrlDragStartX = 0;
let ctrlScrollStartX = 0;
let isSelecting = false;
let loopStart = null;
let loopJustRestarted = false;
let loopEnd = null;
let selectionDiv = null;
let audioTracks = [];
let isPlaying = false;
let pausedAt = 0;
let touchStartX = 0;
let selectedItems = [];
let clipboardData = {type: null, items: []};
let movePattern = [];
let schedulerTimer = null;
let nextNoteTime = 0;
let lassoScrollStart = 0;
let suppressNextClick = false;
let stepHoldTimer = null;
let previewSource = null;
let libraryPreviewSource = null;
let animationFrameId = null;
let clipClipboard = null;
let clipboardBuffer = null;
let previewNode = null;
let isEditing = null;
let audioPasteTime = 0;
let metronomeEnabled = false;
let metronomeGain = null;
let metronomeNextTime = 0;
let bpmUpdateTimer = null;
let zoomRAF = null;
let lastMetronomeStep = -1;
let metronomeClickBuffer = null;
let metronomeBarBuffer = null;
let metronomeActive = false;
let metronomeScheduler = null;
let nextClickTime = 0;
let metronomeBeat = 0;
let progressLock = false;
let playheadStartTime = 0;
isLongPressActive = false;
let noteClipboard = null;
let copiedSynthNote = null;
let MASTER_DELAY_ACTIVE = false;
let REVERB_IR = null;

const WHITE_KEYS = [
  { note: 0, name: 'C' },
  { note: 2, name: 'D' },
  { note: 4, name: 'E' },
  { note: 5, name: 'F' },
  { note: 7, name: 'G' },
  { note: 9, name: 'A' },
  { note: 11, name: 'B' }
];

const BLACK_KEYS = [
  { note: 1, pos: 0.7 },
  { note: 3, pos: 1.7 },
  { note: 6, pos: 3.7 },
  { note: 8, pos: 4.7 },
  { note: 10, pos: 5.7 }
];

let pianoPreview = {
    source: null,
    gain: null
};
let activeChordIndex = 0;

window.timelineOffsetX = 0;
window.isLassoActive = false;
window.currentProjectName = "Untitled";
window.audioTracks = audioTracks;
window.timelineContent;
window.timelineScroll;
window.pasteTarget = null;
window.isMagnetActive = false;
window.audioLassoSelection = [];
window.audioPasteTarget = null;
window.audioInsertTarget = {time: null, trackIdx: null};
window.loadedLibrarysmaples = window.loadedLibrarysmaples || {};

let cpuMeter = {
    schedulerTime: 0,
    rafDrift: 0,
    activeNodes: 0,
    value: 0
};

let lastRAFTime = performance.now();
let masterBusCreated = false;

const masterUI = {
    volume: null,
    eq: [],
    comp: {},
    presetButtons: {}
};

const masterBus = {
    settings: {
        volume: 1,
        eq: [0, 0, 0, 0, 0],
        delayTime: 0,
        delayMix: 0,
        reverb: 0
    }
};

const MASTER_PRESETS = {
    clean: {
        name: 'Clean',
        volume: 1.0,
        eq: [0, 0, 0, 0, 0],
        compressor: {
            threshold: -18,
            ratio: 1.5,
            attack: 0.02,
            release: 0.25
        },
        delay: { time: 0, mix: 0 },
        reverb: 0,
        limiter: -1
    },

    pop: {
        name: 'Pop',
        volume: 1.1,
        eq: [2, 1, 0, 2, 3],
        compressor: {
            threshold: -16,
            ratio: 3,
            attack: 0.01,
            release: 0.18
        },
        delay: { time: 0.25, mix: 0.08 },
        reverb: 0.12,
        limiter: -1
    },

    edm: {
        name: 'EDM',
        volume: 1.2,
        eq: [4, 2, -1, 3, 4],
        compressor: {
            threshold: -20,
            ratio: 5,
            attack: 0.005,
            release: 0.12
        },
        delay: { time: 0.35, mix: 0.15 },
        reverb: 0.18,
        limiter: -0.5
    },

    loud: {
        name: 'Loud',
        volume: 1.3,
        eq: [3, 1, -2, 2, 3],
        compressor: {
            threshold: -28,
            ratio: 8,
            attack: 0.003,
            release: 0.08
        },
        delay: { time: 0, mix: 0 },
        reverb: 0,
        limiter: -0.1
    }
};

const ECHO_PRESETS = {
    off: {
        time: 0,
        feedback: 0,
        mix: 0
    },
    slapback: {
        time: 0.12,
        feedback: 0.25,
        mix: 0.3
    },
    pingpong: {
        time: 0.28,
        feedback: 0.45,
        mix: 0.4,
        pingPong: true
    },
    hall: {
        time: 0.45,
        feedback: 0.65,
        mix: 0.45
    },
    dub: {
        time: 0.6,
        feedback: 0.75,
        mix: 0.55
    }
};

const DEFAULT_DRUM_SAMPLES = {
    kick: "./smaples/Kicks/21/Kick-002.wav",
    snare: "./smaples/Snares/19/Snare-015.wav",
    hihat: "./smaples/Hihats/8/Hihat-001.wav",
    clap: "./smaples/Claps/Clap-002.wav",
    tom: "./smaples/Toms/Tom-004.wav",
    perc: "./smaples/Percs/Perc-001.wav",
    ride: "./smaples/Percs/Perc-040.wav",
    crash: "./smaples/Cymbals/Cymbal-003.wav"
};

let DRUM_PRESETS = {};

let DRUM_PATTERNS = {};
window.currentDrumPattern = null;

window.WAV_PATTERNS = JSON.parse(
    localStorage.getItem("RN_WAV_PATTERNS") || "{}"
);

const DB_NAME = "RN_STUDIO_DB";
const DB_VERSION = 1;
const STORE_NAME = "wav_patterns";

let rnDB = null;

function normalizePaths(obj){
    if(Array.isArray(obj)){
        obj.forEach(normalizePaths);
        return;
    }
    if(typeof obj === "object" && obj){
        Object.values(obj).forEach(normalizePaths);
        if(obj.path){
            obj.path = obj.path.replace(/\\\//g,"/").replace(/^\.?\//,"./");
        }
    }
}

async function loadDrumPresets() {
    try {
        const res = await fetch('./drumkits.json?v='+Date.now());
        DRUM_PRESETS = await res.json();
    } catch (err) {
        console.error("Failed to load drum presets", err);
    }
}

async function loadSampleBuffer(url) {
    const response = await fetch(url);
    console.log("Loaded sample: " + url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

function isMobile() {
  return window.innerWidth < 768;
}

function initRNDatabase() {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = (e) => {
            rnDB = e.target.result;
            resolve();
        };

        request.onerror = (e) => reject(e);
    });
}

loadDrumPresets();
initRNDatabase();

let audioContext = new (window.AudioContext || window.webkitAudioContext)();

function getProjectContentEnd() {
    let lastTime = 0;
    const bpm = getBPM();
    const secondsPerStep = (60 / bpm) / (resolution / 4);

    audioTracks.forEach(track => {

        if (track.type === 'audio' && track.clips) {
            track.clips.forEach(clip => {
                if (!clip.buffer) return;

                const rate = clip.effects?.pitch || 1;
                const trimmedDuration = (clip.trimEnd - clip.trimStart) / rate;
                const end = clip.startOffset + trimmedDuration;
                lastTime = Math.max(lastTime, end);
            });
        }

        else if (track.type === 'instrument' && Array.isArray(track.steps)) {
            const lastActiveStep = track.steps
                .map(s => normalizeStep(s)?.active)
                .lastIndexOf(true);

            if (lastActiveStep !== -1) {
                lastTime = Math.max(
                    lastTime,
                    (lastActiveStep + 1) * secondsPerStep
                );
            }
        }

        else if (track.type === 'synth' && Array.isArray(track.notes)) {
            track.notes.forEach(note => {
                const endStep = note.startStep + note.length;
                const endTime = endStep * secondsPerStep;
                lastTime = Math.max(lastTime, endTime);
            });
        }
    }); 

    return lastTime + 2;
}
