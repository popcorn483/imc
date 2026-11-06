/* IMC background music: soft music made live in the browser (no recordings, no downloads), for the foyer player's
   showtimes cards, board, deals and welcome screens. Light enough for a slow PC: about two dozen oscillators at most.
   Warm detuned pads that slowly open and close, a soft sub bass, a gentle bell melody with an echo, and a long hall reverb.
   IMCMusic.create(mood, volume 0-100) → { start(), on(), off(), setMood(m), setVolume(v), chime(), whoosh(), stop() }  */
(function () {
  const MOODS = {
    cinema: { n: "Cinematic (calm)", bpm: 64, beatsPerChord: 8,
      chords: [[57, 64, 67, 71], [53, 60, 64, 69], [48, 55, 64, 67], [55, 62, 66, 71], [57, 64, 67, 72], [53, 60, 65, 69], [50, 57, 62, 65], [52, 59, 64, 68]],
      bass: [45, 41, 36, 43, 45, 41, 38, 40], scale: [69, 71, 72, 74, 76, 79, 81], arp: [0, 2, 3, 1], arpEvery: 4, arpVol: 0.035, bellEvery: 16, bellVol: 0.05,
      cutoff: 1300, drums: false, warm: 1 },
    chill: { n: "Chilled", bpm: 76, beatsPerChord: 4,
      chords: [[53, 60, 64, 69], [52, 59, 62, 67], [50, 57, 60, 65], [48, 55, 59, 64]], bass: [41, 40, 38, 36],
      scale: [64, 67, 69, 71, 72, 74, 76], arp: [0, 2, 1, 3, 2, 1, 3, 2], arpEvery: 1, arpVol: 0.045, bellEvery: 8, bellVol: 0.04,
      cutoff: 1500, drums: "soft", swing: 0.14, warm: 0.8 },
    bright: { n: "Upbeat", bpm: 104, beatsPerChord: 4,
      chords: [[60, 64, 67, 72], [55, 62, 67, 71], [57, 64, 69, 72], [53, 60, 65, 69]], bass: [48, 43, 45, 41],
      scale: [72, 74, 76, 79, 81, 84], arp: [0, 1, 2, 3, 2, 1, 2, 3], arpEvery: 1, arpVol: 0.055, bellEvery: 8, bellVol: 0.035,
      cutoff: 2300, drums: "pop", warm: 0.6 },
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function create(mood, volume) {
    let ctx = null, master = null, bus = null, conv = null, echo = null, noise = null, timer = null, playing = false, M = MOODS[mood] || MOODS.cinema, vol = volume == null ? 35 : volume;
    let nextTime = 0, step = 0;   /* step = 8th notes */
    const level = () => Math.max(0, Math.min(100, vol)) / 100 * 0.9;
    function setup() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ctx = new AC();
      /* master: soften the very top, then a gentle compressor so nothing jumps out */
      const shelf = ctx.createBiquadFilter(); shelf.type = "highshelf"; shelf.frequency.value = 7000; shelf.gain.value = -4;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 2.5; comp.attack.value = 0.02; comp.release.value = 0.4;
      master = ctx.createGain(); master.gain.value = 0; master.connect(shelf); shelf.connect(comp); comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.connect(master);
      /* hall reverb: a short pre-delay, then 3.4 seconds of smooth, darkening decay (different on each side for width) */
      const len = Math.floor(ctx.sampleRate * 3.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.9 - 0.75 * k); d[i] = lp * Math.pow(1 - k, 2.4) } }
      conv = ctx.createConvolver(); conv.buffer = ir;
      const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.035; const wet = ctx.createGain(); wet.gain.value = 0.42; const wlp = ctx.createBiquadFilter(); wlp.type = "lowpass"; wlp.frequency.value = 5200;
      bus.connect(pre); pre.connect(conv); conv.connect(wlp); wlp.connect(wet); wet.connect(master);
      /* a soft echo for the bells (left and right in turn) */
      const dl = ctx.createDelay(1.5), dr = ctx.createDelay(1.5), fb = ctx.createGain(), mg = ctx.createChannelMerger(2), elp = ctx.createBiquadFilter();
      dl.delayTime.value = 60 / M.bpm * 0.75; dr.delayTime.value = 60 / M.bpm * 0.75; fb.gain.value = 0.38; elp.type = "lowpass"; elp.frequency.value = 3200;
      echo = ctx.createGain(); echo.gain.value = 0.55; echo.connect(dl); dl.connect(elp); elp.connect(dr); dr.connect(fb); fb.connect(dl);
      dl.connect(mg, 0, 0); dr.connect(mg, 0, 1); const eo = ctx.createGain(); eo.gain.value = 0.5; mg.connect(eo); eo.connect(bus); echo._dl = dl; echo._dr = dr;
      const nb = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; noise = nb;
      return true;
    }
    function env(g, t, a, peak, hold, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); }
    const pan = (v) => { if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = v; return p } const g = ctx.createGain(); return g };
    /* warm pad: two detuned saws per note spread left/right, a soft triangle an octave down, through a filter that slowly opens and closes */
    function pad(notes, t, dur) {
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.7; const c0 = M.cutoff;
      f.frequency.setValueAtTime(c0 * 0.45, t); f.frequency.linearRampToValueAtTime(c0 * 1.15, t + dur * 0.55); f.frequency.linearRampToValueAtTime(c0 * 0.6, t + dur + 2);
      const out = ctx.createGain(); out.gain.value = 1; f.connect(out); out.connect(bus);
      notes.forEach((n, i) => {
        for (const [det, p] of [[-7, -0.45], [7, 0.45]]) {
          const o = ctx.createOscillator(), g = ctx.createGain(), pp = pan(p * (0.6 + i * 0.13)); o.type = "sawtooth"; o.frequency.value = mtof(n); o.detune.value = det + (Math.random() * 4 - 2);
          env(g, t, 2.2, 0.016, Math.max(0.1, dur - 2.2), 2.6); o.connect(g); g.connect(pp); pp.connect(f); o.start(t); o.stop(t + dur + 3);
        }
        if (i === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = mtof(n - 12); env(g, t, 2.5, 0.05 * M.warm, Math.max(0.1, dur - 2.5), 2.4); o.connect(g); g.connect(f); o.start(t); o.stop(t + dur + 3) }
      });
    }
    /* soft round pluck for the arpeggio */
    function pluck(n, t, v, p) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), pp = pan(p || 0); o.type = "triangle"; o2.type = "sine"; o.frequency.value = mtof(n); o2.frequency.value = mtof(n + 12);
      f.type = "lowpass"; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.6);
      env(g, t, 0.008, v, 0.03, 1.1); o.connect(f); const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(f); f.connect(g); g.connect(pp); pp.connect(bus); o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3);
    }
    /* bell: a sine with a bright, quickly fading overtone, into the echo and the hall */
    function bell(n, t, v) {
      const out = ctx.createGain(); out.gain.value = v; out.connect(bus); out.connect(echo);
      for (const [mul, a, d] of [[1, 1, 3.2], [2, 0.35, 1.6], [3.01, 0.12, 0.7], [4.2, 0.05, 0.4]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = mtof(n) * mul; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05) }
    }
    function bass(n, t, dur) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = "sine"; o2.type = "sawtooth"; o.frequency.value = mtof(n); o2.frequency.value = mtof(n);
      f.type = "lowpass"; f.frequency.value = 240; const g2 = ctx.createGain(); g2.gain.value = 0.18 * M.warm; o2.connect(g2); g2.connect(f); o.connect(f); f.connect(g);
      env(g, t, 0.06, 0.15, Math.max(0.05, dur - 0.3), 0.6); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + 0.8); o2.stop(t + dur + 0.8);
    }
    function kick(t, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.34); }
    function hat(t, v) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), pp = pan(0.25); s.buffer = noise; f.type = "highpass"; f.frequency.value = 8000; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045); s.connect(f); f.connect(g); g.connect(pp); pp.connect(master); s.start(t, Math.random()); s.stop(t + 0.06); }
    function schedule() {
      const eighth = 60 / M.bpm / 2, per = M.beatsPerChord * 2;
      while (nextTime < ctx.currentTime + 0.4) {
        const ci = Math.floor(step / per) % M.chords.length, inChord = step % per, ch = M.chords[ci];
        let t = nextTime + (M.swing && step % 2 ? eighth * M.swing : 0);
        if (inChord === 0) { pad(ch, t, per * eighth); bass(M.bass[ci], t, per * eighth * (M.drums === "pop" ? 0.45 : 0.95)); if (M.drums === "pop") bass(M.bass[ci], t + per * eighth / 2, per * eighth * 0.45); }
        if (step % M.arpEvery === 0 && (M.drums || inChord >= 2)) { const k = M.arp[(step / M.arpEvery) % M.arp.length]; pluck(ch[k % ch.length] + 12, t, M.arpVol * (0.75 + Math.random() * 0.5), (k % 2 ? 0.3 : -0.3)); }
        /* now and then a short bell phrase from the scale, mostly on notes of the chord */
        if (step % M.bellEvery === M.bellEvery / 2 && Math.random() < 0.75) { const pc = new Set(ch.map((x) => x % 12)), sc = M.scale.filter((x) => pc.has(x % 12)), L = sc.length ? sc : M.scale; let n = L[Math.floor(Math.random() * L.length)];
          bell(n, t, M.bellVol); if (Math.random() < 0.6) { const n2 = M.scale[Math.max(0, M.scale.indexOf(n) - 1)] || n; bell(n2, t + eighth * 2, M.bellVol * 0.7) } }
        if (M.drums === "soft") { if (step % 8 === 0 || step % 8 === 5) kick(t, 0.2); if (step % 2 === 1) hat(t, 0.022); }
        if (M.drums === "pop") { if (step % 4 === 0) kick(t, 0.28); if (step % 2 === 1) hat(t, 0.03); }
        nextTime += eighth; step++;
      }
    }
    return {
      moods: MOODS,
      /* call from a click (browsers only allow sound after one) */
      start() { if (!setup()) return false; if (ctx.state === "suspended") ctx.resume(); if (!timer) { nextTime = ctx.currentTime + 0.1; timer = setInterval(schedule, 120); } return true; },
      on(fade = 2) { if (!ctx || playing) return; playing = true; if (ctx.state === "suspended") ctx.resume(); const g = master.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(level(), t + fade); },
      off(fade = 1.2) { if (!ctx || !playing) return; playing = false; const g = master.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade); },
      setMood(m) { M = MOODS[m] || M; if (echo) { const d = 60 / M.bpm * 0.75; echo._dl.delayTime.value = d; echo._dr.delayTime.value = d } },
      setVolume(v) { vol = v; if (ctx && playing) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.2); },
      stop() { clearInterval(timer); timer = null; playing = false; if (ctx) { ctx.close(); ctx = null; } },
      /* a bright chime (for a priceboard coming on screen); plays whether or not the music is on */
      chime() { if (!setup()) return; if (ctx.state === "suspended") ctx.resume(); const t0 = ctx.currentTime + 0.05, out = ctx.createGain(); out.gain.value = Math.max(0.15, level()) * 0.55; out.connect(ctx.destination); out.connect(conv); out.connect(echo);
        [76, 79, 84, 88].forEach((n, i) => { const t = t0 + i * 0.12; for (const [mul, v] of [[1, 1], [2.76, 0.25], [5.4, 0.08]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = mtof(n) * mul; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + (mul > 1 ? 0.5 : 1.7)); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.8); } }); },
      /* a soft cinematic "whoosh" with a low swell, for a new screen coming in (only while the music is playing) */
      whoosh() { if (!ctx || !playing) return; const t = ctx.currentTime + 0.02, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), pp = pan(0);
        s.buffer = noise; f.type = "bandpass"; f.Q.value = 1.1; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.55); f.frequency.exponentialRampToValueAtTime(500, t + 1.3);
        if (pp.pan) { pp.pan.setValueAtTime(-0.5, t); pp.pan.linearRampToValueAtTime(0.5, t + 1.2) }
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
        s.connect(f); f.connect(g); g.connect(pp); pp.connect(bus); s.start(t); s.stop(t + 1.4);
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(70, t + 0.35); o.frequency.exponentialRampToValueAtTime(48, t + 1.4); og.gain.setValueAtTime(0.0001, t + 0.35); og.gain.exponentialRampToValueAtTime(0.1, t + 0.6); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); o.connect(og); og.connect(master); o.start(t + 0.35); o.stop(t + 1.7); },
      get mood() { return M; },
      get playing() { return playing; },
    };
  }
  window.IMCMusic = { MOODS, create };
})();
