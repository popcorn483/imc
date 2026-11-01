/* IMC background music: soft music made live in the browser (no recordings, no downloads), for the foyer player's
   showtimes cards, board, deals and welcome screens. Light enough for a slow PC: a handful of oscillators at a time.
   IMCMusic.create(mood, volume 0-100) → { start(), on(), off(), setMood(m), setVolume(v), chime(), stop() }  */
(function () {
  const MOODS = {
    cinema: { n: "Cinematic (calm)", bpm: 68, beatsPerChord: 8, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]], bass: [45, 41, 48, 43], arp: [0, 2, 3, 2, 1, 2, 3, 2], arpEvery: 2, arpOct: 12, arpVol: 0.05, cutoff: 1100, drums: false },
    chill: { n: "Chilled", bpm: 78, beatsPerChord: 4, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], bass: [41, 40, 38, 36], arp: [0, 2, 1, 3, 2, 1, 3, 2], arpEvery: 1, arpOct: 12, arpVol: 0.06, cutoff: 1400, drums: "soft", swing: 0.12 },
    bright: { n: "Upbeat", bpm: 104, beatsPerChord: 4, chords: [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], bass: [48, 43, 45, 41], arp: [0, 1, 2, 3, 2, 1, 2, 3], arpEvery: 1, arpOct: 12, arpVol: 0.07, cutoff: 2200, drums: "pop" },
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function create(mood, volume) {
    let conv = null, ctx = null, master = null, bus = null, wet = null, noise = null, timer = null, playing = false, M = MOODS[mood] || MOODS.cinema, vol = volume == null ? 35 : volume;
    let nextTime = 0, step = 0;   /* step = 8th notes */
    const level = () => Math.max(0, Math.min(100, vol)) / 100 * 0.9;
    function setup() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
      master = ctx.createGain(); master.gain.value = 0; master.connect(comp); comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.connect(master);
      /* small room reverb from decaying noise */
      const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      conv = ctx.createConvolver(); conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0.32; bus.connect(conv); conv.connect(wet); wet.connect(master);
      const nb = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; noise = nb;
      return true;
    }
    function env(g, t, a, peak, hold, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); }
    function pad(notes, t, dur) {
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = M.cutoff; f.Q.value = 0.4; f.connect(bus);
      for (const n of notes) for (const det of [-6, 6]) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = mtof(n); o.detune.value = det;
        env(g, t, 1.4, 0.022, Math.max(0.1, dur - 1.4), 1.8); o.connect(g); g.connect(f); o.start(t); o.stop(t + dur + 2);
      }
    }
    function pluck(n, t, v) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o2.type = "sine"; o.frequency.value = mtof(n); o2.frequency.value = mtof(n + 12);
      env(g, t, 0.006, v, 0.02, 0.9); o.connect(g); const g2 = ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + 1.1); o2.stop(t + 1.1);
    }
    function bass(n, t, dur) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = mtof(n); env(g, t, 0.04, 0.16, Math.max(0.05, dur - 0.3), 0.4); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.6); }
    function kick(t, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32); }
    function hat(t, v) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; f.type = "highpass"; f.frequency.value = 7500; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.06); }
    function schedule() {
      const eighth = 60 / M.bpm / 2, per = M.beatsPerChord * 2;
      while (nextTime < ctx.currentTime + 0.4) {
        const ci = Math.floor(step / per) % M.chords.length, inChord = step % per, ch = M.chords[ci];
        let t = nextTime + (M.swing && step % 2 ? eighth * M.swing : 0);
        if (inChord === 0) { pad(ch, t, per * eighth); bass(M.bass[ci], t, per * eighth * (M.drums === "pop" ? 0.45 : 0.95)); if (M.drums === "pop") bass(M.bass[ci], t + per * eighth / 2, per * eighth * 0.45); }
        if (step % M.arpEvery === 0 && (M.drums || inChord >= 2)) { const k = M.arp[(step / M.arpEvery) % M.arp.length]; pluck(ch[k % ch.length] + M.arpOct, t, M.arpVol * (0.8 + Math.random() * 0.4)); }
        if (M.drums === "soft") { if (step % 8 === 0 || step % 8 === 5) kick(t, 0.22); if (step % 2 === 1) hat(t, 0.025); }
        if (M.drums === "pop") { if (step % 4 === 0) kick(t, 0.3); if (step % 2 === 1) hat(t, 0.035); }
        nextTime += eighth; step++;
      }
    }
    return {
      moods: MOODS,
      /* call from a click (browsers only allow sound after one) */
      start() { if (!setup()) return false; if (ctx.state === "suspended") ctx.resume(); if (!timer) { nextTime = ctx.currentTime + 0.1; timer = setInterval(schedule, 120); } return true; },
      on(fade = 1.5) { if (!ctx || playing) return; playing = true; if (ctx.state === "suspended") ctx.resume(); const g = master.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(level(), t + fade); },
      off(fade = 1.2) { if (!ctx || !playing) return; playing = false; const g = master.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade); },
      setMood(m) { M = MOODS[m] || M; },
      setVolume(v) { vol = v; if (ctx && playing) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.2); },
      stop() { clearInterval(timer); timer = null; playing = false; if (ctx) { ctx.close(); ctx = null; } },
      /* a bright three-note chime (for a priceboard coming on screen); plays whether or not the music is on */
      chime() { if (!setup()) return; if (ctx.state === "suspended") ctx.resume(); const t0 = ctx.currentTime + 0.05, out = ctx.createGain(); out.gain.value = Math.max(0.15, level()) * 0.55; out.connect(ctx.destination); out.connect(conv);
        [76, 79, 84, 88].forEach((n, i) => { const t = t0 + i * 0.12; for (const [mul, v] of [[1, 1], [2.76, 0.25], [5.4, 0.08]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = mtof(n) * mul; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + (mul > 1 ? 0.5 : 1.7)); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.8); } }); },
      get mood() { return M; },
      get playing() { return playing; },
    };
  }
  window.IMCMusic = { MOODS, create };
})();
