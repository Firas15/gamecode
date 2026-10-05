/* =========================================================
   ГЛЮК-АТАКА — звук. Всё синтезируется Web Audio, файлов нет.
   Эффекты — квадратные волны и шум, как в других играх GameCode.
   Музыка — чиптюн-петля через планировщик с упреждением.
   ========================================================= */
(function () {
  'use strict';

  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('glitch.muted') === '1'; } catch (e) { /* приватный режим */ }

  // AudioContext создаём только после первого действия игрока —
  // иначе телефоны и Chrome не дают звук.
  function init() {
    if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // ---------- базовые «инструменты» ----------
  function tone(freq, start, dur, opts) {
    opts = opts || {};
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(freq, start);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, start + dur);
    const v = opts.vol == null ? 0.5 : opts.vol;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(v, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(opts.bus || sfxBus);
    o.start(start); o.stop(start + dur + 0.02);
  }
  function noise(start, dur, opts) {
    opts = opts || {};
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = opts.filter || 'lowpass'; f.frequency.setValueAtTime(opts.freq || 2000, start);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, start + dur);
    const v = opts.vol == null ? 0.5 : opts.vol;
    g.gain.setValueAtTime(v, start); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    s.start(start); s.stop(start + dur + 0.02);
  }

  // ---------- эффекты ----------
  const SFX = {
    click(t)  { tone(880, t, 0.05, { vol: 0.25 }); },
    shot(t)   { tone(1400, t, 0.16, { to: 180, vol: 0.35 }); noise(t, 0.08, { freq: 6000, vol: 0.15, filter: 'highpass' }); },
    hit(t)    { noise(t, 0.35, { freq: 4000, to: 300, vol: 0.4 });
                [523, 659, 784, 1047].forEach((f, i) => tone(f, t + 0.04 + i * 0.045, 0.09, { vol: 0.22 })); },
    wrong(t)  { tone(220, t, 0.14, { to: 140, vol: 0.4 }); tone(150, t + 0.12, 0.22, { to: 90, vol: 0.4 }); },
    server(t) { noise(t, 0.5, { freq: 900, to: 80, vol: 0.7 }); tone(110, t, 0.4, { type: 'sawtooth', to: 40, vol: 0.4 }); },
    wave(t)   { [392, 523, 659, 784].forEach((f, i) => tone(f, t + i * 0.08, 0.12, { vol: 0.25 })); },
    boss(t)   { for (let i = 0; i < 4; i++) { tone(140, t + i * 0.22, 0.18, { type: 'sawtooth', to: 100, vol: 0.4 });
                  tone(147, t + i * 0.22, 0.18, { type: 'square', vol: 0.2 }); }
                noise(t, 1.0, { freq: 300, vol: 0.3 }); },
    bossHit(t){ noise(t, 0.3, { freq: 3000, to: 200, vol: 0.45 }); tone(330, t, 0.25, { to: 90, vol: 0.4 }); },
    win(t)    { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.11, 0.16, { vol: 0.28 })); },
    lose(t)   { [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.2, 0.25, { type: 'triangle', vol: 0.45 }));
                noise(t + 0.8, 0.6, { freq: 600, to: 60, vol: 0.4 }); },
    tick(t)   { tone(1200, t, 0.03, { vol: 0.12 }); },
  };
  function sfx(name) {
    if (!ctx || muted || !SFX[name]) return;
    SFX[name](ctx.currentTime + 0.01);
  }

  // ---------- музыка ----------
  // 2 такта по 16 шагов: бас + арпеджио в ля-миноре, на боссе — быстрее и с «тревожной» гармонией.
  const N = n => 440 * Math.pow(2, (n - 69) / 12);       // MIDI → Гц
  const SONGS = {
    normal: { bpm: 128, bass: [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47],
              lead: [69, 72, 76, 72, 67, 71, 74, 71, 65, 69, 72, 69, 67, 71, 74, 79] },
    boss:   { bpm: 156, bass: [45, 45, 46, 45, 45, 45, 46, 48, 44, 44, 45, 44, 44, 44, 46, 47],
              lead: [81, 80, 81, 76, 81, 80, 81, 77, 80, 79, 80, 76, 80, 79, 83, 84] },
  };
  let song = SONGS.normal, playing = false, step = 0, nextTime = 0, timer = null, paused = false;

  function schedule() {
    const stepDur = 60 / song.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      const i = step % 16, bar = Math.floor(step / 16) % 2;
      if (i % 2 === 0) tone(N(song.bass[i]), nextTime, stepDur * 1.6, { type: 'triangle', vol: 0.55, bus: musicBus });
      if (bar === 1 || i % 4 !== 3) tone(N(song.lead[i]), nextTime, stepDur * 0.8, { type: 'square', vol: 0.16, bus: musicBus });
      if (i % 4 === 0) noise(nextTime, 0.05, { freq: 8000, filter: 'highpass', vol: 0.12, bus: musicBus });
      if (i % 8 === 4) noise(nextTime, 0.12, { freq: 1800, vol: 0.25, bus: musicBus });
      nextTime += stepDur; step++;
    }
  }
  function startMusic(name) {
    if (!ctx) return;
    song = SONGS[name] || SONGS.normal;
    if (playing) return;
    playing = true; step = 0; nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }
  function setSong(name) { song = SONGS[name] || SONGS.normal; }
  function stopMusic() { playing = false; clearInterval(timer); timer = null; }

  // Пауза останавливает всё — и музыку, и хвосты эффектов.
  function pause()  { paused = true;  if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { paused = false; if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('glitch.muted', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02);
  }

  window.GlitchAudio = { init, sfx, startMusic, setSong, stopMusic, pause, resume, setMuted, isMuted: () => muted };
})();
