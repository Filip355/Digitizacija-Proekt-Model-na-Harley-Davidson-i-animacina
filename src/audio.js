// Chill ambient music player.
// Tries /sounds/music.mp3 first — drop any track there (MP3/OGG/WAV)
// and it will loop seamlessly, fading in/out with RIDE / STOP.
// Falls back to a synthesised Am7–Fmaj7–Cmaj7–G pad progression.

let _audioCtx   = null;
let _masterGain = null;

export async function startMusic() {
  _audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  _masterGain = _audioCtx.createGain();
  _masterGain.gain.setValueAtTime(0, _audioCtx.currentTime);
  _masterGain.connect(_audioCtx.destination);

  // ── Try user-provided music file ────────────────────────────────────────
  try {
    const res = await fetch('/sounds/music.mp3');
    if (!res.ok) throw new Error('not found');
    const src = _audioCtx.createBufferSource();
    src.buffer = await _audioCtx.decodeAudioData(await res.arrayBuffer());
    src.loop   = true;
    src.connect(_masterGain);
    src.start();
    _masterGain.gain.linearRampToValueAtTime(0.75, _audioCtx.currentTime + 2.0);
    return;
  } catch (_) { /* fall through to synthesis */ }

  // ── Synthesised chill pad fallback ──────────────────────────────────────
  const ctx = _audioCtx;
  const t0  = ctx.currentTime;

  // Reverb: four feedback delay lines at prime-ish times
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.38;
  reverbOut.connect(_masterGain);

  [[0.17, 0.42], [0.24, 0.36], [0.33, 0.28], [0.43, 0.20]].forEach(([dt, fb]) => {
    const d = ctx.createDelay(1.0);
    d.delayTime.value = dt;
    const g = ctx.createGain();
    g.gain.value = fb;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2400;
    d.connect(g); g.connect(f); f.connect(d); // feedback loop
    f.connect(reverbOut);                      // tap to output
    // reverbOut will be fed by the dry signal below
  });

  // Dry signal chain
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass'; padFilter.frequency.value = 900; padFilter.Q.value = 0.8;
  padFilter.connect(_masterGain);
  padFilter.connect(reverbOut); // also send dry into reverb input

  // Am7 – Fmaj7 – Cmaj7 – G  (chill lo-fi progression)
  const BPM       = 75;
  const BEAT      = 60 / BPM;         // 0.8 s
  const CHORD_DUR = BEAT * 8;         // 6.4 s per chord  (slow & relaxed)
  const LOOP_DUR  = CHORD_DUR * 4;    // 25.6 s full loop

  const CHORDS = [
    { freqs: [220.00, 261.63, 329.63, 392.00], bass: 110.00 }, // Am7
    { freqs: [174.61, 220.00, 261.63, 329.63], bass:  87.31 }, // Fmaj7
    { freqs: [130.81, 164.81, 196.00, 246.94], bass:  65.41 }, // Cmaj7
    { freqs: [196.00, 246.94, 293.66, 392.00], bass:  98.00 }, // G
  ];

  // Melody arpeggios: one note per beat, taken from the chord tones
  const ARPS = [
    [329.63, 261.63, 392.00, 220.00, 329.63, 392.00, 261.63, 220.00], // Am7
    [261.63, 174.61, 329.63, 220.00, 261.63, 329.63, 174.61, 220.00], // Fmaj7
    [246.94, 130.81, 196.00, 164.81, 246.94, 196.00, 130.81, 164.81], // Cmaj7
    [293.66, 196.00, 392.00, 246.94, 293.66, 392.00, 246.94, 196.00], // G
  ];

  const scheduleLoop = (loopStart) => {
    CHORDS.forEach(({ freqs, bass }, ci) => {
      const cStart = loopStart + ci * CHORD_DUR;
      const cEnd   = cStart + CHORD_DUR;

      // ── Pad voices: 3 detuned sawtooth oscillators per chord tone ────────
      freqs.forEach((freq) => {
        [-4, 0, 4].forEach((cents) => {
          const osc = ctx.createOscillator();
          osc.type  = 'sawtooth';
          osc.frequency.value = freq * Math.pow(2, cents / 1200);
          const env = ctx.createGain();
          env.gain.setValueAtTime(0,               cStart);
          env.gain.linearRampToValueAtTime(0.018,  cStart + 1.2); // slow attack
          env.gain.setValueAtTime(0.018,           cEnd - 1.0);
          env.gain.linearRampToValueAtTime(0,      cEnd + 0.1);   // tail
          osc.connect(env);
          env.connect(padFilter);
          osc.start(cStart);
          osc.stop(cEnd + 0.3);
        });
      });

      // ── Bass: sine an octave below root ──────────────────────────────────
      const bassOsc = ctx.createOscillator();
      bassOsc.type  = 'sine';
      bassOsc.frequency.value = bass;
      const bassEnv = ctx.createGain();
      bassEnv.gain.setValueAtTime(0,    cStart);
      bassEnv.gain.linearRampToValueAtTime(0.28, cStart + 0.08);
      bassEnv.gain.setValueAtTime(0.22, cStart + CHORD_DUR * 0.6);
      bassEnv.gain.linearRampToValueAtTime(0,    cEnd);
      bassOsc.connect(bassEnv);
      bassEnv.connect(_masterGain);
      bassOsc.start(cStart);
      bassOsc.stop(cEnd + 0.1);

      // ── Melody: single soft sine, one per beat ───────────────────────────
      ARPS[ci].forEach((freq, bi) => {
        const noteStart = cStart + bi * BEAT;
        const noteEnd   = noteStart + BEAT * 0.7;
        const mel = ctx.createOscillator();
        mel.type  = 'sine';
        mel.frequency.value = freq * 2; // one octave up
        const melEnv = ctx.createGain();
        melEnv.gain.setValueAtTime(0,      noteStart);
        melEnv.gain.linearRampToValueAtTime(0.045, noteStart + 0.04);
        melEnv.gain.linearRampToValueAtTime(0,     noteEnd);
        mel.connect(melEnv);
        melEnv.connect(padFilter);
        mel.start(noteStart);
        mel.stop(noteEnd + 0.05);
      });
    });
  };

  // Schedule 30 loops (~12.8 minutes) — well beyond any typical session
  for (let i = 0; i < 30; i++) scheduleLoop(t0 + i * LOOP_DUR);

  _masterGain.gain.linearRampToValueAtTime(0.70, t0 + 2.5);
}

export function stopMusic() {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;
  _masterGain.gain.cancelScheduledValues(now);
  _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
  _masterGain.gain.linearRampToValueAtTime(0, now + 2.0);
  setTimeout(() => { try { _audioCtx.close(); } catch (_) {} _audioCtx = null; _masterGain = null; }, 2200);
}
