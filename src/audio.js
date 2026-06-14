// Tries /sounds/engine.mp3 first.
// Drop any Harley recording there (MP3 / OGG / WAV) and it will loop
// seamlessly, fading in/out with the RIDE / STOP buttons.
// Falls back to a synthesised V-twin idle when the file is missing.

let _audioCtx   = null;
let _masterGain = null;

export async function startEngineAudio() {
  _audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  _masterGain = _audioCtx.createGain();
  _masterGain.gain.setValueAtTime(0, _audioCtx.currentTime);
  _masterGain.connect(_audioCtx.destination);

  let usedFile = false;

  try {
    const res = await fetch('/sounds/engine.mp3');
    if (!res.ok) throw new Error('not found');
    const audioBuf = await _audioCtx.decodeAudioData(await res.arrayBuffer());
    const src      = _audioCtx.createBufferSource();
    src.buffer     = audioBuf;
    src.loop       = true;
    src.connect(_masterGain);
    src.start();
    usedFile = true;
  } catch (_) { /* fall through to synthesis */ }

  if (!usedFile) {
    const ctx = _audioCtx;
    const SR  = ctx.sampleRate;
    const t0  = ctx.currentTime;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value    = 6;
    comp.ratio.value     = 5;   comp.attack.value  = 0.003;
    comp.release.value   = 0.08;
    comp.connect(_masterGain);

    const lpf = ctx.createBiquadFilter();
    lpf.type  = 'lowpass'; lpf.frequency.value = 650; lpf.Q.value = 1.2;
    lpf.connect(comp);

    const hpf = ctx.createBiquadFilter();
    hpf.type  = 'highpass'; hpf.frequency.value = 48; hpf.Q.value = 0.6;
    hpf.connect(lpf);

    const shaper = ctx.createWaveShaper();
    const SN     = 1024;
    const sc     = new Float32Array(SN);
    for (let i = 0; i < SN; i++) {
      const x = (i / (SN - 1)) * 2 - 1;
      sc[i]   = x >= 0
        ? Math.tanh(x * 4.5) / Math.tanh(4.5)
        : Math.tanh(x * 2.0) / Math.tanh(2.0) * 0.70;
    }
    shaper.curve      = sc;
    shaper.oversample = '4x';
    shaper.connect(hpf);

    // 45° V-twin firing pattern: asymmetric 315°/405° cycle at 900 RPM
    const cycleSec    = (60 / 900) * 2;
    const cycleFrames = Math.round(cycleSec * SR);
    const fire2Frame  = Math.round((315 / 720) * cycleFrames);
    const patBuf      = ctx.createBuffer(1, cycleFrames, SR);
    const pd          = patBuf.getChannelData(0);

    const addFire = (buf, start, amp) => {
      const decay = SR * 0.048;
      const len   = Math.min(buf.length - start, Math.round(SR * 0.21));
      for (let i = 0; i < len; i++) {
        const tt = i / SR, e = Math.exp(-i / decay);
        buf[start + i] = Math.max(-1, Math.min(1, buf[start + i] + amp * e * (
          0.58 * Math.sin(2 * Math.PI * 88  * tt) +
          0.28 * Math.sin(2 * Math.PI * 176 * tt + 0.25) +
          0.14 * Math.sin(2 * Math.PI * 264 * tt + 0.55)
        )));
      }
    };
    addFire(pd, 0,          1.00);
    addFire(pd, fire2Frame, 0.88);
    for (let i = 0; i < cycleFrames; i++) {
      pd[i] += 0.036 * Math.sin(2 * Math.PI * 44 * (i / SR));
      pd[i] += 0.015 * (Math.random() * 2 - 1);
      pd[i]  = Math.max(-1, Math.min(1, pd[i]));
    }

    const patSrc    = ctx.createBufferSource();
    patSrc.buffer   = patBuf;
    patSrc.loop     = true;
    patSrc.connect(shaper);
    patSrc.start(t0);

    // Sub-bass thump
    const sub  = ctx.createOscillator();
    sub.type   = 'sine'; sub.frequency.value = 14.5;
    const subG = ctx.createGain(); subG.gain.value = 0.18;
    sub.connect(subG); subG.connect(_masterGain); sub.start(t0);

    // Mechanical texture
    const nBuf = ctx.createBuffer(1, SR * 2, SR);
    const nd   = nBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf; nSrc.loop = true;
    const nBpf = ctx.createBiquadFilter();
    nBpf.type  = 'bandpass'; nBpf.frequency.value = 820; nBpf.Q.value = 0.5;
    const nG   = ctx.createGain(); nG.gain.value = 0.022;
    nSrc.connect(nBpf); nBpf.connect(nG); nG.connect(_masterGain); nSrc.start(t0);

    // Slow breathing LFO so the idle never drones
    const breathOsc       = ctx.createOscillator();
    breathOsc.type        = 'sine'; breathOsc.frequency.value = 0.25;
    const breathGain      = ctx.createGain(); breathGain.gain.value = 0.08;
    breathOsc.connect(breathGain);
    breathGain.connect(patSrc.playbackRate);
    breathOsc.start(t0);
  }

  _masterGain.gain.linearRampToValueAtTime(0.80, _audioCtx.currentTime + 1.8);
}

export function stopEngineAudio() {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;
  _masterGain.gain.cancelScheduledValues(now);
  _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
  _masterGain.gain.linearRampToValueAtTime(0, now + 2.0);
  setTimeout(() => { try { _audioCtx.close(); } catch (_) {} _audioCtx = null; _masterGain = null; }, 2200);
}
