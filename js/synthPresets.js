const DEFAULT_SYNTH_PRESET = 'Organ-Clean';

const SYNTH_PRESETS = {

  'Organ-Clean': {
    oscType: 'sine',
    unison: 3,
    detune: 3,
    spread: 8,
    filter: { type: 'lowpass', cutoff: 8000, resonance: 0.6 },
    lfo: { target: 'amp', rate: 5, depth: 0.3 },
    drive: 0.1
  },

  'Organ-Rock': {
    oscType: 'square',
    unison: 4,
    detune: 6,
    spread: 12,
    filter: { type: 'lowpass', cutoff: 5000, resonance: 1 },
    lfo: { target: 'amp', rate: 6, depth: 0.4 },
    drive: 0.35
  },

  'Piano-Soft': {
    oscType: 'triangle',
    unison: 2,
    detune: 2,
    spread: 4,
    filter: { type: 'lowpass', cutoff: 9000, resonance: 0.4 },
    lfo: { target: 'none', rate: 0, depth: 0 },
    drive: 0
  },

  'Piano-Bright': {
    oscType: 'sawtooth',
    unison: 2,
    detune: 1,
    spread: 3,
    filter: { type: 'lowpass', cutoff: 12000, resonance: 0.3 },
    lfo: { target: 'none', rate: 0, depth: 0 },
    drive: 0.15
  },

  'Flute': {
    oscType: 'sine',
    unison: 1,
    detune: 0,
    spread: 0,
    filter: { type: 'lowpass', cutoff: 6000, resonance: 0.3 },
    lfo: { target: 'pitch', rate: 5, depth: 0.15 },
    drive: 0
  },

  'Saxophone': {
    oscType: 'sawtooth',
    unison: 2,
    detune: 5,
    spread: 7,
    filter: { type: 'bandpass', cutoff: 3000, resonance: 1.2 },
    lfo: { target: 'pitch', rate: 6, depth: 0.2 },
    drive: 0.4
  },

  'Trumpet': {
    oscType: 'square',
    unison: 2,
    detune: 4,
    spread: 6,
    filter: { type: 'bandpass', cutoff: 3500, resonance: 1 },
    lfo: { target: 'amp', rate: 5, depth: 0.2 },
    drive: 0.35
  },

  'Violin': {
    oscType: 'sawtooth',
    unison: 3,
    detune: 7,
    spread: 10,
    filter: { type: 'lowpass', cutoff: 6500, resonance: 0.8 },
    lfo: { target: 'pitch', rate: 6, depth: 0.25 },
    drive: 0.25
  },

  'Cello': {
    oscType: 'sawtooth',
    unison: 3,
    detune: 6,
    spread: 9,
    filter: { type: 'lowpass', cutoff: 4000, resonance: 0.9 },
    lfo: { target: 'pitch', rate: 4, depth: 0.2 },
    drive: 0.3
  },

  'Guitar-Acoustic': {
    oscType: 'triangle',
    unison: 2,
    detune: 3,
    spread: 5,
    filter: { type: 'lowpass', cutoff: 5000, resonance: 0.6 },
    lfo: { target: 'amp', rate: 4, depth: 0.15 },
    drive: 0.15
  },

  'Guitar-Electric': {
    oscType: 'square',
    unison: 3,
    detune: 6,
    spread: 8,
    filter: { type: 'lowpass', cutoff: 3500, resonance: 1 },
    lfo: { target: 'none', rate: 0, depth: 0 },
    drive: 0.6
  },

  'Bass-Slap': {
    oscType: 'square',
    unison: 2,
    detune: 4,
    spread: 5,
    filter: { type: 'lowpass', cutoff: 2000, resonance: 1.3 },
    lfo: { target: 'amp', rate: 7, depth: 0.25 },
    drive: 0.7
  },

  'Bass-Double': {
    oscType: 'triangle',
    unison: 1,
    detune: 0,
    spread: 0,
    filter: { type: 'lowpass', cutoff: 1200, resonance: 0.8 },
    lfo: { target: 'none', rate: 0, depth: 0 },
    drive: 0.3
  }
};
