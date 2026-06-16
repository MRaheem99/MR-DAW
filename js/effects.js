// effects.js

function createEchoChain(ctx, opts = {}) {
    const delay = ctx.createDelay(5.0);
    const feedback = ctx.createGain();
    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();

    delay.delayTime.value = opts.time ?? 0.25;
    feedback.gain.value = opts.feedback ?? 0.4;
    wetGain.gain.value = opts.mix ?? 0.3;
    dryGain.gain.value = 1 - wetGain.gain.value;

    delay.connect(feedback);
    feedback.connect(delay);

    return {
        input: dryGain,
        delay,
        wetGain,
        output: ctx.createGain(),
        connect(source) {
            source.connect(dryGain);
            source.connect(delay);

            delay.connect(wetGain);

            dryGain.connect(this.output);
            wetGain.connect(this.output);
        }
    };
}

function createAudioChain() {
    const ctx = audioContext;
    
    const muteGain = ctx.createGain();
    muteGain.gain.value = 1;

    const inputNode = ctx.createGain();
    const outputGain = ctx.createGain();

    const panNode = ctx.createStereoPanner();
    panNode.pan.value = 0;

    const eqBands = [60, 250, 1000, 4000, 8000].map(freq => {
        const f = ctx.createBiquadFilter();
        f.type = 'peaking';
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = 0;
        return f;
    });

    const delay = {
        enabled: false,

        delayNode: ctx.createDelay(4.0),
        feedback: ctx.createGain(),
        wetGain: ctx.createGain(),
        dryGain: ctx.createGain(),

        lowCut: ctx.createBiquadFilter(),
        highCut: ctx.createBiquadFilter(),

        widthSplitter: ctx.createChannelSplitter(2),
        widthMerger: ctx.createChannelMerger(2),
        widthGainL: ctx.createGain(),
        widthGainR: ctx.createGain()
    };
    
    const reverb = {
        enabled: false,
        convolver: ctx.createConvolver(),
        preDelay: ctx.createDelay(1.0),
        wetGain: ctx.createGain(),
        dryGain: ctx.createGain(),
        lowCut: ctx.createBiquadFilter(),
        highCut: ctx.createBiquadFilter(),
        widthSplitter: ctx.createChannelSplitter(2),
        widthMerger: ctx.createChannelMerger(2),
        widthGainL: ctx.createGain(),
        widthGainR: ctx.createGain()
    };

    reverb.wetGain.gain.value = 0;
    reverb.dryGain.gain.value = 1;
    reverb.preDelay.delayTime.value = 0;

    reverb.lowCut.type = "highpass";
    reverb.lowCut.frequency.value = 200;

    reverb.highCut.type = "lowpass";
    reverb.highCut.frequency.value = 8000;

    reverb.widthGainL.gain.value = 1;
    reverb.widthGainR.gain.value = 1;

    delay.delayNode.delayTime.value = 0.3;
    delay.feedback.gain.value = 0.35;
    delay.wetGain.gain.value = 0;
    delay.dryGain.gain.value = 1;

    delay.lowCut.type = 'highpass';
    delay.lowCut.frequency.value = 40;

    delay.highCut.type = 'lowpass';
    delay.highCut.frequency.value = 12000;

    delay.widthGainL.gain.value = 1;
    delay.widthGainR.gain.value = 1;

    muteGain.connect(inputNode);
    inputNode.connect(eqBands[0]);
    eqBands.reduce((a, b) => (a.connect(b), b));

    const postEQ = eqBands[eqBands.length - 1];

    postEQ.connect(delay.dryGain);
    delay.dryGain.connect(outputGain);

    postEQ.connect(delay.delayNode);
    delay.delayNode.connect(delay.lowCut);
    delay.lowCut.connect(delay.highCut);

    delay.highCut.connect(delay.feedback);
    delay.feedback.connect(delay.delayNode);

    delay.highCut.connect(delay.widthSplitter);

    delay.widthSplitter.connect(delay.widthGainL, 0);
    delay.widthSplitter.connect(delay.widthGainR, 1);

    delay.widthGainL.connect(delay.widthMerger, 0, 0);
    delay.widthGainR.connect(delay.widthMerger, 0, 1);

    delay.widthMerger.connect(delay.wetGain);
    delay.wetGain.connect(outputGain);
    
    postEQ.connect(reverb.dryGain);
    reverb.dryGain.connect(outputGain);
    
    postEQ.connect(reverb.preDelay);
    reverb.preDelay.connect(reverb.lowCut);
    reverb.lowCut.connect(reverb.highCut);
    reverb.highCut.connect(reverb.convolver);
    
    reverb.convolver.connect(reverb.widthSplitter);
    reverb.widthSplitter.connect(reverb.widthGainL, 0);
    reverb.widthSplitter.connect(reverb.widthGainR, 1);
    
    reverb.widthGainL.connect(reverb.widthMerger, 0, 0);
    reverb.widthGainR.connect(reverb.widthMerger, 0, 1);
    
    reverb.widthMerger.connect(reverb.wetGain);
    reverb.wetGain.connect(outputGain);

    outputGain.connect(panNode);
    panNode.connect(masterBus.input);


    return {
        muteGain, 
        inputNode: muteGain,
        outputGain,
        panNode,
        eqBands,
        delay,
        reverb
    };
}

function createReverbChain(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();

    const preDelay = ctx.createDelay(1.0);
    const convolver = ctx.createConvolver();

    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 200;

    const highCut = ctx.createBiquadFilter();
    highCut.type = 'lowpass';
    highCut.frequency.value = 8000;

    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();

    wetGain.gain.value = 0;
    dryGain.gain.value = 1;

    input.connect(dryGain);
    dryGain.connect(output);

    input.connect(preDelay);
    preDelay.connect(convolver);
    convolver.connect(lowCut);
    lowCut.connect(highCut);
    highCut.connect(wetGain);
    wetGain.connect(output);

    return {
        input,
        output,
        preDelay,
        convolver,
        lowCut,
        highCut,
        wetGain,
        dryGain
    };
}

async function loadTrackReverbIR(track, url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);

    track.effects.reverb.convolver.buffer = buffer;
}

function applyTrackEffects(track) {
    if (!track.effects) return;

    track.effects.outputGain.gain.setValueAtTime(
        track.settings.volume ?? 1,
        audioContext.currentTime
    );

    track.settings.eq?.forEach((gain, i) => {
        if (track.effects.eqBands[i]) {
            track.effects.eqBands[i].gain.setValueAtTime(
                gain,
                audioContext.currentTime
            );
        }
    });

    if (track.effects.panNode) {
        track.effects.panNode.pan.setValueAtTime(
            track.settings.pan ?? 0,
            audioContext.currentTime
        );
    }
}

function applyTrackDelay(track) {
    const d = track.effects.delay;
    const s = track.settings.delay;

    d.enabled = !!s.enabled;

    d.delayNode.delayTime.setValueAtTime(
        s.time,
        audioContext.currentTime
    );

    d.feedback.gain.setValueAtTime(
        s.feedback,
        audioContext.currentTime
    );

    d.wetGain.gain.setValueAtTime(
        d.enabled ? (s.mix ?? 0) : 0,
        audioContext.currentTime
    );

    d.dryGain.gain.setValueAtTime(
        d.enabled ? (1 - (s.mix ?? 0)) : 1,
        audioContext.currentTime
    );

    d.lowCut.frequency.setValueAtTime(
        s.lowCut,
        audioContext.currentTime
    );

    d.highCut.frequency.setValueAtTime(
        s.highCut,
        audioContext.currentTime
    );

    d.widthGainL.gain.setValueAtTime(
        1 - s.width * 0.5,
        audioContext.currentTime
    );

    d.widthGainR.gain.setValueAtTime(
        1 + s.width * 0.5,
        audioContext.currentTime
    );
}

function applyTrackReverbSettings(track) {
    if (!track.effects?.reverb) return;

    const fx = track.effects.reverb;
    const r = track.settings.reverb;
    const now = audioContext.currentTime;

    if (!r) return;

    fx.wetGain.gain.setValueAtTime(
        r.enabled ? (r.wetGain ?? 0) : 0,
        now
    );

    fx.dryGain.gain.setValueAtTime(
        r.enabled ? (r.dryGain ?? 1 - (r.wetGain ?? 0)) : 1,
        now
    );

    fx.preDelay.delayTime.setValueAtTime(
        r.enabled ? (r.preDelay ?? 0) : 0,
        now
    );

    fx.lowCut.frequency.setValueAtTime(
        r.lowCut ?? 200,
        now
    );

    fx.highCut.frequency.setValueAtTime(
        r.highCut ?? 8000,
        now
    );

    fx.widthGainL.gain.setValueAtTime(
        1 - (r.width ?? 0) * 0.5,
        now
    );

    fx.widthGainR.gain.setValueAtTime(
        1 + (r.width ?? 0) * 0.5,
        now
    );
}

function normalizeReverbSettings(settings) {
    if (!settings) settings = {};

    return {
        enabled: !!settings.enabled,

        sendGain: Number.isFinite(settings.sendGain)
            ? settings.sendGain
            : 0,

        preDelay: Number.isFinite(settings.preDelay)
            ? settings.preDelay
            : 0,
            
        wetGain: Number.isFinite(settings.wetGain)
            ? settings.wetGain
            : 0,
            
        dryGain: Number.isFinite(settings.dryGain)
            ? settings.dryGain
            : 0,

        lowCut: Number.isFinite(settings.lowCut)
            ? settings.lowCut
            : 200,

        highCut: Number.isFinite(settings.highCut)
            ? settings.highCut
            : 8000,

        width: Number.isFinite(settings.width)
            ? settings.width
            : 0,

        type: settings.type || 'hall'
    };
}


function applyTremolo(ctx, gainNode, tremolo, startTime, duration) {
    if (!tremolo || tremolo.depth <= 0) return null;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    lfo.type = 'sine';
    lfo.frequency.value = tremolo.rate;

    lfoGain.gain.value = tremolo.depth;

    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);

    lfo.start(startTime);
    lfo.stop(startTime + duration + 0.1);

    return lfo;
}

function applyWah(ctx, filterNode, wah, startTime, duration) {
    if (!wah || wah.depth <= 0) return null;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    lfo.type = 'sine';
    lfo.frequency.value = wah.rate;

    lfoGain.gain.value = wah.depth * 2000; // Hz sweep

    lfo.connect(lfoGain);
    lfoGain.connect(filterNode.frequency);

    lfo.start(startTime);
    lfo.stop(startTime + duration + 0.1);

    return lfo;
}

function applyPitchEnvelope(param, baseValue, pitchEnv, startTime, duration) {
    if (!Number.isFinite(baseValue)) return;

    param.cancelScheduledValues(startTime);

    if (!Array.isArray(pitchEnv) || pitchEnv.length < 2) {
        param.setValueAtTime(baseValue, startTime);
        return;
    }

    pitchEnv.forEach((pt, i) => {
        if (!Number.isFinite(pt.t) || !Number.isFinite(pt.v)) return;

        const t = startTime + pt.t * duration;
        const multiplier = Math.pow(2, pt.v / 12);
        const value = baseValue * multiplier;

        if (!Number.isFinite(value)) return;

        if (i === 0) {
            param.setValueAtTime(value, t);
        } else {
            param.linearRampToValueAtTime(value, t);
        }
    });
}
