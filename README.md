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

# Live Demo

Live demo:

```txt
https://mraheem99.github.io/MR-DAW/
```

---

# Technologies Used

* HTML5
* CSS3
* JavaScript
* Web Audio API
* Canvas API
* GitHub Pages

---

# Project Structure

```txt
mr-daw/
│
├── index.html
│
├── css/
│   ├── styles.css
│   ├── popup.css
│
├── js/
│   ├── ui/
|       ├── circleKnob.js
|       ├── classicKnob.js
|       ├── effect_panels.js
|       ├── rn_slider.js
|       ├── sliderAdapter.js
│   ├── audio.js
│   ├── beatMarkers.js
│   ├── effects.js
│   ├── globals.js
│   ├── history.js
│   ├── instruments.js
│   ├── lasso.js
│   └── operator.js
│   └── player.js
│   └── popups.js
│   └── project.js
│   └── script.js
│   └── synthPresets.js
│   └── tracks.js
│
├── samples/
├── img/
├── ir/
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

