# MR-DAW
MR DAW is a Digital Audio Workstation (DAW) written in pure Vanilla Javascript to create music on browser. Create your own beats and remix songs.

# MR DAW — Web Audio Synthesizer, Drum Machine & Sequencer

A powerful mobile-friendly browser DAW built with the Web Audio API.

MR DAW is a modern HTML5 music workstation featuring a real-time synthesizer, piano keyboard, drum pads, sequencer, effects rack, sample engine, modulation system, and advanced audio controls — all running directly in the browser without plugins.

---

## Features

### Synth Engine

* Polyphonic synthesizer
* Multiple oscillator waveforms
* Sub oscillator
* ADSR envelope
* Filter section
* Stereo panning
* Pitch modulation
* Vibrato
* Real-time keyboard play

### Drum Machine

* 8 customizable drum pads
* Sample loading
* Individual pad effects
* Velocity support
* Pad-specific FX chains
* Mobile touch optimized

### Effects Rack

* Echo / Delay
* Reverb
* Chorus
* Flanger
* Phaser
* Compressor
* Distortion
* Bitcrusher
* Equalizer
* Vibrato

### Sequencer

* Step sequencer
* BPM sync
* Swing control
* Time signatures
* Multi-bar projects
* Pattern playback
* Loop sequencing

* ## Euclidean Sequencer

This project includes a powerful built-in **Euclidean Sequencer** for generating complex rhythmic patterns with minimal input.

The Euclidean rhythm algorithm distributes pulses as evenly as possible across a number of steps, creating natural and musical groove patterns commonly used in:

* Techno
* IDM
* Afrobeat
* Ambient
* Experimental electronic music

### Features

* Adjustable steps and pulses
* Pattern rotation
* Real-time BPM sync
* Swing support
* Per-track sequencing
* Drum pad integration
* Live playback updates
* Multi-bar sequencing
* Independent track timing
* Browser-based low latency scheduling

### Example

```js
generateEuclidean(16,5)
```

Output:

```text
x . . x . . x . x . . x . . x .
```

This creates a 5-hit rhythm distributed evenly across 16 steps.

### Use Cases

* Drum grooves
* Hi-hat patterns
* Percussion layers
* Bassline triggering
* Polyrhythms
* Experimental timing structures

### Sample Engine

* WAV / MP3 / OGG support
* Sample reversing
* Sample start offset
* Fine tuning
* Pitch shifting
* Sample libraries
* Drum kit browser

### Mobile Optimized

* Multi-touch piano keyboard
* Touch scrolling
* Swipe pitch bending
* Responsive UI
* Android optimized
* iOS compatible

---

# Technologies Used

* HTML5
* CSS3
* JavaScript
* Web Audio API
* Canvas API
* The Euclidean sequencer is implemented entirely in JavaScript using the Web Audio API scheduling engine for accurate browser-based timing and low-latency playback.
* GitHub Pages

## Live Demo

🎹 Try the app online:

[▶ Open Live Demo](https://mraheem99.github.io/MR-DAW/)

---

# Project Structure

```txt
mr-daw/
│
├── index.html
│
├── css/
│   ├── styles.css
│   └── popup.css
│
├── js/
│   ├── ui/
│   │   ├── circleKnob.js
│   │   ├── classicKnob.js
│   │   ├── effect_panels.js
│   │   ├── rn_slider.js
│   │   └── sliderAdapter.js
│   ├── audio.js
│   ├── beatMarkers.js
│   ├── effects.js
│   ├── globals.js
│   ├── history.js
│   ├── instruments.js
│   ├── lasso.js
│   ├── operator.js
│   ├── player.js
│   ├── popups.js
│   ├── project.js
│   ├── script.js
│   ├── synthPresets.js
│   └── tracks.js
│
├── samples/
├── img/
└── ir/
```

---

# Installation

Clone the repository:

```bash
git clone https://github.com/MRaheem99/mr-daw.git
```

Open the project folder:

```bash
cd sound-engine
```

Run locally using any local server.

Example:

```bash
python -m http.server
```

or

```bash
npx serve
```

---

# GitHub Pages Deployment

1. Push repository to GitHub
2. Open Repository Settings
3. Go to Pages
4. Select:

   * Branch: `main`
   * Folder: `/root`
5. Save

Live demo at:

```txt
https://mraheem99.github.io/MR-DAW/
```

---

# Browser Support

* Chrome
* Edge
* Firefox
* Safari
* Android browsers
* Chromium WebView

---

# Performance Notes

For best audio latency:

* Use Chrome or Edge
* Enable hardware acceleration
* Use headphones
* Close background apps

---

# Roadmap

* MIDI support
* Piano roll editor
* Automation lanes
* Preset manager
* Audio export
* Cloud project saving
* Collaboration mode
* Synth presets
* Multi-track mixer
* Audio recording

---

# Contributing

Pull requests are welcome.

For major changes, please open an issue first to discuss improvements.

---

# License

MIT License

---

# Keywords

Javascript DAW, Online Digital Audio Workstation, Web Audio API, browser synthesizer, drum machine, HTML5 music workstation, online synthesizer, browser sequencer, mobile music app, WebAudio synth, audio effects engine, browser piano, virtual instrument, music production app

