'use strict';
/*
 * Bendy Bus Counting Fun
 * A counting game for young children: a Singapore-style bendy (articulated) bus
 * drives from stop to stop; passengers get off and on, and the child counts them.
 * Everything (graphics, sound, music) is generated in code — no asset files.
 */
(() => {
  // ====================================================================
  // Basics
  // ====================================================================
  const W = 1280, H = 720;
  const FONT = '"Baloo 2","Comic Sans MS","Chalkboard SE","Trebuchet MS",system-ui,sans-serif';
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (a, n) => ((a % n) + n) % n;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    const sw = Math.floor(W * s), sh = Math.floor(H * s);
    stage.style.width = sw + 'px';
    stage.style.height = sh + 'px';
    stage.style.setProperty('--u', (sw / 100) + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(sw * dpr);
    canvas.height = Math.round(sh * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- drawing helpers ----------
  function rrPath(x, y, w, h, r) {
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br); ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }
  function rr(x, y, w, h, r, fill) { rrPath(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function ellipse(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function wrapText(text, maxW) {
    const words = text.split(' '); const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ====================================================================
  // Sound (Web Audio, all synthesised)
  // ====================================================================
  const store = {
    get(k, d) { try { const v = localStorage.getItem('bendybus.' + k); return v === null ? d : v === '1'; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bendybus.' + k, v ? '1' : '0'); } catch (e) { /* ignore */ } },
  };

  const Sound = {
    ac: null, master: null, sfx: null, mus: null, noiseBuf: null, eng: null,
    sfxOn: store.get('sound', true),
    musicOn: store.get('music', true),
    lastEngine: 0,
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = this.ac = new AC();
      this.master = ac.createGain(); this.master.gain.value = 0.9; this.master.connect(ac.destination);
      this.sfx = ac.createGain(); this.sfx.gain.value = this.sfxOn ? 1 : 0; this.sfx.connect(this.master);
      this.mus = ac.createGain(); this.mus.gain.value = this.musicOn ? 0.55 : 0; this.mus.connect(this.master);
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.makeEngine();
      Music.start();
    },
    setSfx(on) { this.sfxOn = on; store.set('sound', on); if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ac.currentTime, 0.05); if (!on) Voice.stop(); },
    setMusic(on) { this.musicOn = on; store.set('music', on); if (this.mus) this.mus.gain.setTargetAtTime(on ? 0.55 : 0, this.ac.currentTime, 0.1); },
    tone(freq, dur, o = {}) {
      const ac = this.ac; if (!ac) return;
      const t = ac.currentTime + (o.when || 0);
      const osc = ac.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
      const g = ac.createGain();
      const v = o.vol ?? 0.25, a = o.attack ?? 0.01;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(o.dest || this.sfx);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(dur, o = {}) {
      const ac = this.ac; if (!ac) return;
      const t = ac.currentTime + (o.when || 0);
      const src = ac.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = o.filter || 'bandpass';
      f.frequency.setValueAtTime(o.freq || 1000, t);
      if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
      f.Q.value = o.q ?? 1;
      const g = ac.createGain(); const v = o.vol ?? 0.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(o.dest || this.sfx);
      src.start(t, Math.random()); src.stop(t + dur + 0.05);
    },
    // Bus "stop requested" bell
    ding() { this.tone(1568, 1.1, { vol: 0.22 }); this.tone(3136, 0.6, { vol: 0.05 }); this.tone(1175, 1.3, { vol: 0.2, when: 0.22 }); },
    // Card tap beep when boarding
    beep() { this.tone(2093, 0.14, { type: 'square', vol: 0.09, attack: 0.003 }); },
    hiss() { this.noise(1.0, { freq: 5000, freqTo: 2500, q: 0.6, vol: 0.22, attack: 0.02 }); },
    doorOpen() { this.noise(0.6, { freq: 900, freqTo: 400, q: 0.8, vol: 0.12, attack: 0.05 }); this.tone(988, 0.2, { vol: 0.12, when: 0.1 }); this.tone(784, 0.3, { vol: 0.12, when: 0.3 }); },
    doorClose() { for (let i = 0; i < 3; i++) this.tone(1245, 0.13, { type: 'square', vol: 0.06, when: i * 0.24 }); this.noise(0.5, { freq: 700, freqTo: 1100, vol: 0.1, when: 0.75, attack: 0.05 }); },
    pop(n) { this.tone(420 + n * 55, 0.18, { type: 'triangle', vol: 0.22, slide: 760 + n * 70 }); },
    step() { this.noise(0.05, { freq: 700, q: 1.5, vol: 0.05 }); },
    honk() { [0, 0.32].forEach((w) => { this.tone(311, 0.26, { type: 'sawtooth', vol: 0.07, when: w }); this.tone(392, 0.26, { type: 'sawtooth', vol: 0.06, when: w }); }); },
    correct() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.38, { type: 'triangle', vol: 0.22, when: i * 0.1 }));
      [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.25, { vol: 0.07, when: 0.45 + i * 0.07 }));
    },
    wrong() { this.tone(392, 0.22, { vol: 0.18, slide: 370 }); this.tone(311, 0.35, { vol: 0.18, when: 0.22, slide: 290 }); },
    whoosh() { this.noise(0.6, { freq: 600, freqTo: 4000, q: 2, vol: 0.12, attack: 0.1 }); },
    fanfare() {
      const n = [523, 523, 523, 659, 784, 659, 784, 1047];
      const d = [0, 0.15, 0.3, 0.45, 0.75, 1.0, 1.15, 1.35];
      n.forEach((f, i) => { this.tone(f, i === 7 ? 0.9 : 0.25, { type: 'triangle', vol: 0.22, when: d[i] }); this.tone(f / 2, 0.25, { type: 'sine', vol: 0.12, when: d[i] }); });
    },
    makeEngine() {
      const ac = this.ac;
      const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 42;
      const o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = 84;
      const g2 = ac.createGain(); g2.gain.value = 0.3;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 2;
      const g = ac.createGain(); g.gain.value = 0;
      const lfo = ac.createOscillator(); lfo.frequency.value = 7;
      const lg = ac.createGain(); lg.gain.value = 0;
      lfo.connect(lg); lg.connect(g.gain);
      o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this.sfx);
      o1.start(); o2.start(); lfo.start();
      this.eng = { o1, o2, f, g, lg };
    },
    setEngine(speed01, running) {
      if (!this.eng) return;
      const now = performance.now();
      if (now - this.lastEngine < 90) return;
      this.lastEngine = now;
      const t = this.ac.currentTime, e = this.eng;
      const base = running ? 0.03 + speed01 * 0.045 : 0;
      e.g.gain.setTargetAtTime(base, t, 0.25);
      e.lg.gain.setTargetAtTime(base * 0.3, t, 0.25);
      e.o1.frequency.setTargetAtTime(38 + speed01 * 48, t, 0.3);
      e.o2.frequency.setTargetAtTime(76 + speed01 * 96, t, 0.3);
      e.f.frequency.setTargetAtTime(240 + speed01 * 420, t, 0.3);
    },
  };

  // Cheerful looping background tune (pentatonic, very quiet)
  const Music = {
    timer: null, next: 0, step: 0, bpm: 116,
    melody: [72, 0, 76, 0, 79, 0, 76, 74, 72, 0, 74, 76, 74, 0, 0, 0,
      69, 0, 72, 0, 76, 0, 74, 72, 74, 0, 76, 74, 72, 0, 0, 0,
      76, 0, 79, 0, 81, 0, 79, 76, 79, 0, 76, 74, 72, 0, 74, 0,
      76, 0, 74, 72, 69, 0, 72, 0, 74, 0, 72, 0, 72, 0, 0, 0],
    bass: [48, 55, 52, 55, 45, 52, 50, 55, 48, 55, 52, 55, 50, 55, 48, 48],
    start() {
      if (this.timer || !Sound.ac) return;
      this.next = Sound.ac.currentTime + 0.2;
      this.timer = setInterval(() => this.tick(), 80);
    },
    tick() {
      const ac = Sound.ac; if (!ac || ac.state !== 'running') return;
      const spb = 60 / this.bpm / 2;
      if (this.next < ac.currentTime) this.next = ac.currentTime + 0.05;
      while (this.next < ac.currentTime + 0.25) {
        if (Sound.musicOn) {
          const i = this.step % this.melody.length;
          const when = this.next - ac.currentTime;
          const m = this.melody[i];
          if (m) Sound.tone(midi(m), spb * 1.7, { type: 'triangle', vol: 0.05, when, dest: Sound.mus });
          if (i % 4 === 0) {
            const b = this.bass[(i / 4) % this.bass.length];
            Sound.tone(midi(b), spb * 3.2, { type: 'sine', vol: 0.08, when, dest: Sound.mus });
          }
          if (i % 4 === 2) Sound.noise(0.05, { freq: 7000, q: 1, vol: 0.012, when, dest: Sound.mus });
        }
        this.next += spb; this.step++;
      }
    },
  };
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Spoken words (Web Speech API, if available)
  const Voice = {
    voice: null,
    ok: 'speechSynthesis' in window,
    pick() {
      if (!this.ok) return;
      const vs = speechSynthesis.getVoices();
      if (!vs.length) return;
      this.voice = vs.find((v) => /en[-_]SG/i.test(v.lang))
        || vs.find((v) => /Google UK English Female|Samantha|Karen|Moira|Tessa|Serena/i.test(v.name))
        || vs.find((v) => /en[-_](GB|AU|IE)/i.test(v.lang))
        || vs.find((v) => /^en/i.test(v.lang)) || null;
    },
    say(text, interrupt = false) {
      if (!this.ok || !Sound.sfxOn) return;
      try {
        if (!this.voice) this.pick();
        if (interrupt) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang; }
        u.rate = 0.95; u.pitch = 1.15; u.volume = 1;
        speechSynthesis.speak(u);
      } catch (e) { /* speech not available */ }
    },
    stop() { if (this.ok) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } },
  };
  if (Voice.ok) { Voice.pick(); speechSynthesis.onvoiceschanged = () => Voice.pick(); }
  const say = (t, i) => Voice.say(t, i);

  document.addEventListener('visibilitychange', () => {
    if (!Sound.ac) return;
    if (document.hidden) { Sound.ac.suspend(); Voice.stop(); } else Sound.ac.resume();
  });

  // ====================================================================
  // Layout of the bus and the street
  // ====================================================================
  const BUS = { front: 180, j0: 640, j1: 668, rear: 1104, top: 368, bot: 588, winTop: 396, winBot: 470 };
  const GREEN = '#5dbb46', GREEN_D = '#3d8a2c', GREEN_L = '#9ad97a';
  const DOORS = [{ x: 202, w: 60 }, { x: 494, w: 58 }, { x: 822, w: 60 }];
  const WHEELS = [322, 600, 990];
  const WINDOWS = [[270, 338], [344, 412], [418, 488], [558, 634], [676, 744], [750, 816], [888, 956], [962, 1030], [1036, 1098]];
  const SLOTS = [];
  WINDOWS.forEach(([a, b]) => { const w = b - a; SLOTS.push(a + w * 0.28, a + w * 0.72); });
  const DOOR_IN = DOORS[0].x + DOORS[0].w / 2;
  const DOOR_OUT = DOORS[2].x + DOORS[2].w / 2;
  const PAVE_Y = 688;
  const QUEUE = [300, 356, 412, 468, 524];
  const POLE_X = 95;
  const LEG = 1800, VMAX = 380, ACC = 220, BRAKE = 260;
  const ROUTE_NO = '88';

  const LEVELS = {
    easy: { cap: 5, maxOn: 3, maxOff: 2, name: 'Easy' },
    medium: { cap: 10, maxOn: 4, maxOff: 3, name: 'Medium' },
    big: { cap: 15, maxOn: 5, maxOff: 4, name: 'Big Kid' },
  };
  const PLACES = [
    ['Hawker Centre', '🍜'], ['Playground', '🛝'], ['Library', '📚'], ['MRT Station', '🚇'],
    ['Wet Market', '🐟'], ['Botanic Gardens', '🌺'], ['Zoo', '🦒'], ['Bird Park', '🦜'],
    ['Science Centre', '🔬'], ['Beach', '🏖️'], ['Swimming Pool', '🏊'], ['School', '🏫'],
    ['Hospital', '🏥'], ['Kopitiam', '☕'], ['Airport', '✈️'], ['Stadium', '⚽'],
  ];
  const PRAISE = ['Well done!', 'Great counting!', 'Shiok! You got it!', 'Wah, so clever!', 'Steady lah!', 'Super duper!', 'You are a counting champion!', 'Fantastic!'];

  // ---------- people ----------
  const SKINS = ['#f7d7bd', '#eec09a', '#d39b71', '#b07650', '#8a5a3c', '#f3c8a2'];
  const HAIRS = ['#1b1b1b', '#3b2a20', '#5a3825', '#2a2a2a', '#7a5230'];
  const GREYS = ['#d6d6d6', '#bdbdbd', '#e8e8e8', '#9e9e9e'];
  const SHIRTS = ['#ff6b6b', '#4d96ff', '#ffd93d', '#6bcb77', '#c77dff', '#ff9f43', '#00bcd4', '#ff70a6', '#ffffff', '#8d6e63'];
  const PANTS = ['#2d3a5a', '#4a4a4a', '#1f5f8b', '#6b4f3a', '#3d405b', '#5c6bc0'];
  const TUDUNG = ['#7e57c2', '#26a69a', '#ec407a', '#5c6bc0', '#8d6e63', '#ffb74d'];

  function makeLook() {
    const kind = pick(['adult', 'adult', 'adult', 'kid', 'kid', 'elder']);
    let style;
    if (kind === 'kid') style = pick(['short', 'pigtails', 'cap', 'short', 'bun']);
    else if (kind === 'elder') style = pick(['bald', 'short', 'bun', 'cap']);
    else style = pick(['short', 'short', 'long', 'bun', 'cap', 'tudung', 'long']);
    const dress = (style === 'long' || style === 'pigtails' || style === 'bun' || style === 'tudung') && Math.random() < 0.6;
    let bag = null;
    const r = Math.random();
    if (kind === 'kid' && r < 0.6) bag = 'backpack';
    else if (kind === 'adult' && r < 0.35) bag = pick(['backpack', 'shopping']);
    else if (kind === 'elder' && r < 0.5) bag = 'cane';
    return {
      kind, style, dress, bag,
      skin: pick(SKINS),
      hair: kind === 'elder' ? pick(GREYS) : pick(HAIRS),
      shirt: pick(SHIRTS), pants: pick(PANTS), cap: pick(['#ff5252', '#2979ff', '#ffc400', '#00c853']),
      tudung: pick(TUDUNG), bagColor: pick(['#ff7043', '#42a5f5', '#ab47bc', '#26c6da', '#ffca28']),
      glasses: kind === 'elder' ? Math.random() < 0.6 : Math.random() < 0.15,
      size: kind === 'kid' ? 0.72 : kind === 'elder' ? 0.94 : rand(0.97, 1.06),
      seed: Math.random() * 10,
    };
  }

  // ====================================================================
  // Game state
  // ====================================================================
  const game = {
    mode: 'title',
    time: 0, dist: 0, v: 0, cruise: 170,
    distTarget: null, legStart: 0, arriveResolve: null, bellAt: null, bellFlash: 0,
    wheelAng: 0, doors: [0, 0, 0], doorT: [0, 0, 0], kneel: 0,
    level: null, levelKey: 'easy', stops: [], stopIndex: 0, stars: 0,
    onboard: [], people: [], signs: [], puffs: [], parts: [], pops: [], labels: [],
    puffTimer: 0, nextDest: 'Bus Interchange',
    map: { a: 0, open: false, manual: false, pts: [], decor: null, timer: null },
  };

  // ---------- async flow helpers (with abort support) ----------
  class Abort extends Error {}
  let run = null;
  function sleep(ms) {
    const r = run;
    return new Promise((res, rej) => setTimeout(() => (r && !r.aborted ? res() : rej(new Abort())), ms));
  }
  function guard(p) {
    const r = run;
    return p.then((v) => { if (!r || r.aborted) throw new Abort(); return v; });
  }

  // ====================================================================
  // UI (DOM overlay)
  // ====================================================================
  const ui = {
    title: $('title'), end: $('end'), hud: $('hud'), banner: $('banner'),
    question: $('question'), qText: $('qText'), choices: $('choices'),
    stars: $('stars'), starCount: $('starCount'),
    btnSound: $('btnSound'), btnMusic: $('btnMusic'), btnHome: $('btnHome'), btnMap: $('btnMap'),
  };
  let bannerTimer = null;
  function banner(text, ms = 2500, cls = '') {
    clearTimeout(bannerTimer);
    const b = ui.banner;
    b.className = cls;
    b.textContent = text;
    // restart animation
    void b.offsetWidth;
    if (ms > 0) bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
  }
  function hideBanner() { clearTimeout(bannerTimer); ui.banner.classList.add('hidden'); }
  function updateStars(bump) {
    ui.starCount.textContent = game.stars;
    if (bump) { ui.stars.classList.remove('bump'); void ui.stars.offsetWidth; ui.stars.classList.add('bump'); }
  }
  function refreshToggles() {
    ui.btnSound.textContent = Sound.sfxOn ? '🔊' : '🔇';
    ui.btnSound.classList.toggle('off', !Sound.sfxOn);
    ui.btnMusic.classList.toggle('off', !Sound.musicOn);
  }
  refreshToggles();
  ui.btnSound.addEventListener('click', () => { Sound.init(); Sound.setSfx(!Sound.sfxOn); refreshToggles(); if (Sound.sfxOn) Sound.pop(3); });
  ui.btnMusic.addEventListener('click', () => { Sound.init(); Sound.setMusic(!Sound.musicOn); refreshToggles(); });
  ui.btnHome.addEventListener('click', () => { Sound.pop(1); toTitle(); });
  ui.btnMap.addEventListener('click', () => {
    Sound.init();
    if (game.map.open) hideMap(); else showMap(0);
  });
  document.querySelectorAll('.level').forEach((b) => b.addEventListener('click', () => {
    Sound.init(); Sound.honk();
    startRoute(b.dataset.level);
  }));
  $('btnAgain').addEventListener('click', () => { Sound.init(); Sound.honk(); startRoute(game.levelKey); });
  $('btnLevels').addEventListener('click', () => { Sound.pop(2); toTitle(); });
  canvas.addEventListener('pointerdown', (e) => {
    if (game.map.open) { hideMap(); return; }
    // Tap the bus on the title screen for a honk
    if (game.mode !== 'title') return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (x > BUS.front && x < BUS.rear && y > BUS.top && y < BUS.bot + 30) { Sound.init(); Sound.honk(); }
  });

  function makeChoices(ans, cap) {
    const hi = Math.max(cap, ans + 2);
    const near = shuffle([ans - 1, ans + 1]).filter((n) => n >= 0 && n <= hi);
    const far = shuffle([ans - 2, ans + 2, ans - 3, ans + 3]).filter((n) => n >= 0 && n <= hi);
    const set = new Set([ans]);
    for (const n of [...near, ...far]) { if (set.size >= 3) break; set.add(n); }
    return [...set].sort((a, b) => a - b);
  }

  // Ask a question; resolves when the child picks the right answer.
  function ask(text, answer, speakText, hintFn) {
    return guard(new Promise((resolve) => {
      const r = run;
      let busy = false, firstTry = true;
      ui.qText.textContent = text;
      ui.choices.innerHTML = '';
      makeChoices(answer, game.level.cap).forEach((n, i) => {
        const b = document.createElement('button');
        b.className = 'choice c' + i;
        b.innerHTML = `<span class="num">${n}</span><span class="dots">${'<i></i>'.repeat(n)}</span>`;
        b.setAttribute('aria-label', String(n));
        b.addEventListener('click', async () => {
          if (busy || r.aborted || b.disabled) return;
          if (n === answer) {
            busy = true;
            b.classList.add('right');
            Sound.correct();
            setTimeout(() => { ui.question.classList.add('hidden'); resolve(firstTry); }, 750);
          } else {
            busy = true; firstTry = false;
            b.classList.add('wrong'); b.disabled = true;
            Sound.wrong();
            say("Hmm, not quite. Let's count together!", true);
            try { await hintFn(); } catch (e) { if (!(e instanceof Abort)) console.error(e); }
            if (r.aborted) return;
            busy = false;
            say('Now, which number is it?');
          }
        });
        ui.choices.appendChild(b);
      });
      hideMap();
      ui.question.classList.remove('hidden');
      void ui.question.offsetWidth;
      say(speakText || text, true);
    }));
  }

  // Count things one by one with number labels (used as a hint)
  async function countAloud(targets) {
    game.labels = [];
    await sleep(1600);
    if (!targets.length) { say('Nobody! That is zero.'); await sleep(1500); return; }
    for (let i = 0; i < targets.length; i++) {
      game.labels.push({ pos: targets[i], n: i + 1, t: 0 });
      Sound.pop(i + 1);
      say(String(i + 1), true);
      await sleep(850);
    }
    await sleep(300);
    say(`${targets.length}!`, true);
    await sleep(900);
  }
  const busTargets = () => [...game.onboard].sort((a, b) => SLOTS[a.slot] - SLOTS[b.slot])
    .map((p) => () => ({ x: SLOTS[p.slot], y: 462 + game.kneel }));
  const peopleTargets = (list) => [...list].sort((a, b) => a.wx - b.wx)
    .map((p) => () => ({ x: p.wx + game.dist, y: p.y - 112 * p.look.size * depth(p.y) }));

  // ====================================================================
  // Entities
  // ====================================================================
  const depth = (y) => 0.86 + clamp((y - 600) / 90, 0, 1) * 0.14;
  const toWorld = (sx) => sx - game.dist;

  function newPerson(look, sx, y, front = true) {
    const p = { look, wx: toWorld(sx), y, path: [], speed: 190, walking: false, phase: 0, facing: 1, front, alpha: 1, fading: false, badge: null, wave: false, done: null, remove: false, leaveScreen: false, stepT: 0 };
    game.people.push(p);
    return p;
  }
  function walk(p, pts, speed) {
    if (speed) p.speed = speed;
    p.path = pts.map((q) => ({ x: toWorld(q.x), y: q.y }));
    return new Promise((res) => { p.done = res; });
  }
  function freeSlot() {
    const used = new Set(game.onboard.map((p) => p.slot));
    const free = SLOTS.map((_, i) => i).filter((i) => !used.has(i));
    return pick(free);
  }
  function addPop(x, y, n, color = '#ffcf3f') { game.pops.push({ x, y, n, t: 0, color }); }

  function confetti(n = 120) {
    const cols = ['#ff6b6b', '#4d96ff', '#ffd93d', '#6bcb77', '#c77dff', '#ff9f43', '#ff70a6'];
    for (let i = 0; i < n; i++) {
      game.parts.push({ kind: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-60, 60), vy: rand(60, 240), rot: rand(0, 6), vr: rand(-8, 8), w: rand(8, 14), h: rand(5, 9), color: pick(cols), life: 4.5 });
    }
  }
  function starBurst(x, y) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      game.parts.push({ kind: 'sparkle', x, y, vx: Math.cos(a) * rand(160, 320), vy: Math.sin(a) * rand(160, 320), life: 0.9, max: 0.9, r: rand(5, 9), color: pick(['#ffd93d', '#fff', '#ffb300']) });
    }
  }
  function flyStar(onDone) {
    Sound.whoosh();
    game.parts.push({ kind: 'flystar', t: 0, dur: 1.0, fx: W / 2, fy: 320, tx: 48, ty: 42, onDone });
  }

  // ====================================================================
  // Route & stops
  // ====================================================================
  function makeRoute(level) {
    const places = shuffle(PLACES.slice()).slice(0, 5);
    const stops = [];
    let onboard = 0;
    places.forEach(([name, icon], i) => {
      let off = 0, on;
      if (i > 0) off = randi(onboard > 0 ? 1 : 0, Math.min(level.maxOff, onboard));
      if (i > 0 && Math.random() < 0.25) off = randi(0, Math.min(level.maxOff, onboard));
      const room = level.cap - (onboard - off);
      on = randi(i === 0 ? Math.min(2, room) : 0, Math.min(level.maxOn, room));
      if (off + on === 0) { if (room > 0) on = 1; else off = 1; }
      if (i === 4 && onboard - off + on === 0) on = 1;
      stops.push({ name, icon, off, on, terminus: false });
      onboard = onboard - off + on;
    });
    stops.push({ name: 'Bus Interchange', icon: '🚌', off: onboard, on: 0, terminus: true });
    return stops;
  }

  function driveTo(stop) {
    game.legStart = game.dist;
    game.distTarget = game.dist + LEG;
    game.cruise = 0;
    game.nextDest = stop.name;
    game.signs.push({ wx: POLE_X - game.distTarget, name: stop.name, icon: stop.icon });
    game.bellAt = stop.off > 0 ? game.distTarget - 1050 : null;
    if (game.mode === 'play') showMap(3400);
    return guard(new Promise((res) => { game.arriveResolve = res; }));
  }

  function setDoors(a, b, c) { game.doorT = [a, b, c]; }

  async function startRoute(levelKey) {
    if (run) run.aborted = true;
    run = { aborted: false };
    resetScene(false);
    game.mode = 'play';
    game.levelKey = levelKey;
    game.level = LEVELS[levelKey];
    game.stars = 0; updateStars(false);
    game.stops = makeRoute(game.level);
    game.stopIndex = 0;
    layoutMap();
    ui.btnMap.classList.remove('hidden');
    ui.title.classList.add('hidden');
    ui.end.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.btnHome.classList.remove('hidden');
    try {
      banner(`Bus ${ROUTE_NO} is leaving! 🚌💨`, 2200);
      say("Let's go! All aboard Bus " + ROUTE_NO + '!', true);
      for (let i = 0; i < game.stops.length; i++) {
        game.stopIndex = i;
        await doStop(game.stops[i], i);
      }
      await finale();
    } catch (e) {
      if (!(e instanceof Abort)) console.error(e);
    }
  }

  async function doStop(stop, idx) {
    const before = game.onboard.length;
    // People waiting at the stop (they arrive on screen with the bus stop)
    const arrivalDist = game.dist + LEG;
    const waiting = [];
    for (let j = 0; j < stop.on; j++) {
      const p = newPerson(makeLook(), 0, PAVE_Y + (j % 2) * 8);
      p.wx = QUEUE[j] - arrivalDist;
      waiting.push(p);
    }

    const arrive = driveTo(stop);
    await sleep(idx === 0 ? 2300 : 300);
    banner(`Next stop: ${stop.icon} ${stop.name}`, 3200);
    say(`Next stop, ${stop.name}!`);
    await arrive;
    Sound.hiss();
    await sleep(700);

    // Warm-up question at the first stop: count the people waiting
    if (idx === 0 && waiting.length) {
      const first = await ask('How many people are waiting at the bus stop?', waiting.length, null,
        () => countAloud(peopleTargets(waiting)));
      await reward(first, `${waiting.length} ${waiting.length === 1 ? 'person is' : 'people are'} waiting!`, null);
    }

    // Open doors
    setDoors(stop.on > 0 ? 1 : 0, 0, stop.off > 0 ? 1 : 0);
    Sound.doorOpen();
    await sleep(800);

    // ---- Getting off ----
    if (stop.off > 0) {
      banner(stop.terminus ? 'Last stop! Everybody off! 👋' : "Let's count who gets OFF! 👋", 2400);
      say(stop.terminus ? 'Last stop! Everybody gets off. Count with me!' : "Let's count who gets off!", true);
      await sleep(2000);
      const spots = [];
      if (stop.terminus) {
        const n = stop.off;
        const span = Math.min(940, n * 68);
        for (let k = 0; k < n; k++) spots.push({ x: 1220 - span + (k + 0.5) * (span / n), y: PAVE_Y - 6 + (k % 2) * 14 });
        spots.sort((a, b) => Math.abs(a.x - DOOR_OUT) - Math.abs(b.x - DOOR_OUT));
      }
      game.alighted = [];
      for (let k = 0; k < stop.off; k++) {
        await alightOne(k + 1, stop.terminus ? spots[k] : null);
      }
      await sleep(900);
      say(`${stop.off} got off.`, true);
      await sleep(1500);
    }

    // ---- Getting on ----
    if (stop.on > 0) {
      banner("Now count who gets ON! 🎫", 2400);
      say("Now let's count who gets on!", true);
      await sleep(1900);
      for (let k = 0; k < waiting.length; k++) {
        await boardOne(waiting[k], k + 1, waiting.slice(k + 1));
      }
      await sleep(700);
      say(`${stop.on} got on.`, true);
      await sleep(1500);
    } else if (!stop.terminus) {
      banner('Nobody is getting on here 🙂', 2200);
      say('Nobody is getting on here.', true);
      await sleep(2200);
    }

    if (!stop.terminus) {
      setDoors(0, 0, 0);
      Sound.doorClose();
      await sleep(1200);
    }

    // ---- Question ----
    const after = game.onboard.length;
    if (stop.terminus) {
      const first = await ask('How many people got off the bus?', stop.off, null,
        () => countAloud(peopleTargets(game.alighted)));
      await reward(first, `${stop.off} got off!`, null);
    } else {
      const first = await ask('How many passengers are on the bus now?', after,
        'How many passengers are on the bus now? Count the people in the windows!', () => countAloud(busTargets()));
      let eq = `${before}`;
      if (stop.off) eq += ` − ${stop.off}`;
      if (stop.on) eq += ` + ${stop.on}`;
      eq += ` = ${after}`;
      await reward(first, eq, `${after} ${after === 1 ? 'passenger' : 'passengers'} on the bus!`);
    }
  }

  async function reward(firstTry, bannerText, spoken) {
    const praise = pick(PRAISE);
    say(praise + (spoken ? ' ' + spoken : ''), true);
    starBurst(W / 2, 300);
    if (firstTry) confetti(90);
    flyStar(() => { game.stars++; updateStars(true); Sound.pop(8); });
    banner(bannerText, 2800, 'eq');
    await sleep(3000);
    game.labels = [];
  }

  async function alightOne(n, spot) {
    // pick a passenger, fade them out of the window
    const pas = pick(game.onboard);
    pas.leaving = true;
    await sleep(350);
    game.onboard.splice(game.onboard.indexOf(pas), 1);
    const p = newPerson(pas.look, DOOR_OUT, 600, false);
    p.alpha = 0;
    p.fadeIn = true;
    p.badge = { n, t: 0 };
    game.alighted.push(p);
    Sound.pop(n);
    say(String(n), true);
    if (spot) {
      walk(p, [{ x: DOOR_OUT, y: 650 }, { x: spot.x, y: spot.y }], 200).then(() => { p.front = true; p.wave = true; });
      await sleep(1150);
    } else {
      walk(p, [{ x: DOOR_OUT, y: PAVE_Y }, { x: DOOR_OUT + 90, y: PAVE_Y + 4 }, { x: W + 140, y: PAVE_Y + 4 }], 170)
        .then(() => { p.remove = true; });
      await sleep(1150);
    }
  }

  async function boardOne(p, n, rest) {
    p.front = false;
    // everyone behind shuffles forward in the queue
    rest.forEach((q, j) => walk(q, [{ x: QUEUE[j], y: q.y }], 120).then(() => { q.front = true; }));
    await guard(walk(p, [{ x: DOOR_IN + 10, y: PAVE_Y }, { x: DOOR_IN, y: 604 }], 200));
    p.fading = true;
    Sound.beep();
    const slot = freeSlot();
    game.onboard.push({ look: p.look, slot, appear: 0, leaving: false });
    addPop(DOOR_IN, 540, n);
    Sound.pop(n);
    say(String(n), true);
    await sleep(650);
  }

  async function finale() {
    hideBanner();
    Sound.fanfare();
    confetti(200);
    game.people.forEach((p) => { p.wave = true; });
    say('Hooray! We reached the bus interchange. You are a super counter!', true);
    await sleep(1600);
    const total = game.stars;
    $('endMsg').textContent = `You counted at all ${game.stops.length} bus stops!`;
    const es = $('endStars');
    es.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const s = document.createElement('span');
      s.textContent = '⭐';
      s.style.animationDelay = (0.15 * i) + 's';
      es.appendChild(s);
    }
    for (let i = 0; i < total; i++) setTimeout(() => Sound.pop(i + 1), 150 * i + 100);
    hideMap();
    ui.end.classList.remove('hidden');
    ui.btnHome.classList.add('hidden');
    ui.btnMap.classList.add('hidden');
  }

  function resetScene(keepCruise) {
    game.people = []; game.onboard = []; game.labels = []; game.pops = [];
    game.alighted = [];
    game.parts = game.parts.filter((p) => p.kind === 'confetti');
    game.signs = [];
    game.distTarget = null; game.arriveResolve = null; game.bellAt = null;
    setDoors(0, 0, 0);
    game.cruise = keepCruise ? 170 : game.v;
    hideBanner();
    ui.question.classList.add('hidden');
  }

  function toTitle() {
    if (run) run.aborted = true;
    run = null;
    Voice.stop();
    resetScene(true);
    game.mode = 'title';
    game.nextDest = 'Bus Interchange';
    ui.title.classList.remove('hidden');
    ui.end.classList.add('hidden');
    ui.hud.classList.add('hidden');
    ui.btnHome.classList.add('hidden');
    ui.btnMap.classList.add('hidden');
    hideMap();
  }

  // ====================================================================
  // Update
  // ====================================================================
  function update(dt) {
    game.time += dt;

    // --- bus motion ---
    if (game.distTarget != null) {
      const rem = game.distTarget - game.dist;
      const vb = Math.sqrt(2 * BRAKE * Math.max(rem, 0));
      game.v = Math.min(game.v + ACC * dt, VMAX, Math.max(vb, 14));
      game.dist += game.v * dt;
      if (game.bellAt != null && game.dist >= game.bellAt) {
        game.bellAt = null; game.bellFlash = 4;
        Sound.ding();
        setTimeout(() => say('Ding! Someone wants to get off.'), 900);
      }
      if (game.dist >= game.distTarget) {
        game.dist = game.distTarget; game.v = 0; game.distTarget = null;
        const r = game.arriveResolve; game.arriveResolve = null;
        if (r) r();
      }
    } else {
      game.v += clamp(game.cruise - game.v, -ACC * dt, ACC * dt);
      game.dist += game.v * dt;
    }
    game.wheelAng -= (game.v * dt) / 30;
    game.bellFlash = Math.max(0, game.bellFlash - dt);
    Sound.setEngine(game.v / VMAX, true);

    // --- doors & kneeling ---
    for (let i = 0; i < 3; i++) game.doors[i] += clamp(game.doorT[i] - game.doors[i], -2.2 * dt, 2.2 * dt);
    const anyOpen = game.doorT.some((d) => d > 0);
    game.kneel += clamp((anyOpen ? 5 : 0) - game.kneel, -12 * dt, 12 * dt);

    // --- people ---
    for (const p of game.people) {
      if (p.path.length) {
        const t = p.path[0];
        const dx = t.x - p.wx, dy = t.y - p.y;
        const d = Math.hypot(dx, dy), step = p.speed * dt;
        if (Math.abs(dx) > 0.5) p.facing = dx > 0 ? 1 : -1;
        p.walking = true; p.front = false;
        p.phase += dt * 11;
        p.stepT += dt;
        if (p.stepT > 0.32) { p.stepT = 0; if (Math.random() < 0.6) Sound.step(); }
        if (d <= step) {
          p.wx = t.x; p.y = t.y; p.path.shift();
          if (!p.path.length) { p.walking = false; p.phase = 0; const r = p.done; p.done = null; if (r) r(); }
        } else { p.wx += (dx / d) * step; p.y += (dy / d) * step; }
      }
      if (p.fadeIn) { p.alpha = Math.min(1, p.alpha + dt * 4); if (p.alpha >= 1) p.fadeIn = false; }
      if (p.fading) { p.alpha -= dt * 3.5; if (p.alpha <= 0) p.remove = true; }
      if (p.badge) p.badge.t += dt;
      const sx = p.wx + game.dist;
      if (sx > W + 160 && !p.path.length) p.remove = true;
    }
    game.people = game.people.filter((p) => !p.remove);
    if (game.alighted) game.alighted = game.alighted.filter((p) => !p.remove);
    game.signs = game.signs.filter((s) => s.wx + game.dist < W + 200);

    // --- passengers inside the bus ---
    for (const b of game.onboard) b.appear = clamp(b.appear + (b.leaving ? -dt * 3 : dt * 3), 0, 1);

    // --- exhaust ---
    game.puffTimer -= dt;
    if (game.puffTimer <= 0) {
      game.puffTimer = game.v > 20 ? 0.12 : 0.45;
      game.puffs.push({ x: BUS.rear + 4, y: 586 + game.kneel, r: rand(5, 8), life: 1.3, max: 1.3, vy: rand(-22, -10) });
    }
    for (const f of game.puffs) { f.life -= dt; f.x += (game.v * 0.85 + 25) * dt; f.y += f.vy * dt; f.r += dt * 14; }
    game.puffs = game.puffs.filter((f) => f.life > 0);

    // --- particles ---
    for (const q of game.parts) {
      if (q.kind === 'confetti') { q.vy += 50 * dt; q.x += q.vx * dt + Math.sin(game.time * 3 + q.rot) * 30 * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.life -= dt; }
      else if (q.kind === 'sparkle') { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.93; q.vy *= 0.93; q.life -= dt; }
      else if (q.kind === 'flystar') { q.t += dt; if (q.t >= q.dur) { q.life = 0; if (q.onDone) { q.onDone(); q.onDone = null; } } else q.life = 1; }
    }
    game.parts = game.parts.filter((q) => q.life > 0 && (q.y === undefined || q.y < H + 40));

    for (const p of game.pops) p.t += dt;
    game.pops = game.pops.filter((p) => p.t < 1.4);
    for (const l of game.labels) l.t += dt;
    game.map.a = clamp(game.map.a + (game.map.open ? dt * 4 : -dt * 4), 0, 1);
  }

  // ====================================================================
  // Draw: scenery
  // ====================================================================
  const HDB = [['#f6d6a8', '#e07a5f'], ['#c9e4f2', '#3d85c6'], ['#f4c2c2', '#d1495b'], ['#d4ecc5', '#5aa469'],
    ['#fbe7a1', '#e09f3e'], ['#e2d4f0', '#7e57c2'], ['#f9d0b0', '#ef8354'], ['#d9f2ef', '#2a9d8f']];

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, 440);
    g.addColorStop(0, '#5db7f0'); g.addColorStop(1, '#d4f0ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 440);
    // happy sun
    const sx = 168, sy = 150;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(game.time * 0.25);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(54, 0); ctx.lineTo(68 + (i % 2) * 6, 0); ctx.stroke(); }
    ctx.restore();
    circle(sx, sy, 46, '#ffc93c'); circle(sx, sy, 40, '#ffe066');
    circle(sx - 13, sy - 7, 4.5, '#7a4a00'); circle(sx + 13, sy - 7, 4.5, '#7a4a00');
    circle(sx - 22, sy + 6, 6, 'rgba(255,120,80,.35)'); circle(sx + 22, sy + 6, 6, 'rgba(255,120,80,.35)');
    ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(sx, sy + 4, 13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // clouds
    for (let i = 0; i < 6; i++) {
      const x = mod(i * 260 + game.dist * 0.05 + game.time * 10, W + 320) - 160;
      const y = 50 + hash(i + 5) * 150, s = 0.7 + hash(i + 9) * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,.93)';
      [[0, 0, 28], [26, -14, 32], [58, 0, 26], [28, 8, 26]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); });
    }
  }

  function drawBlocks() {
    const off = game.dist * 0.25, sp = 250, base = 436;
    const i0 = Math.floor((-260 - off) / sp), i1 = Math.ceil((W + 40 - off) / sp);
    for (let i = i0; i <= i1; i++) {
      const h1 = hash(i), h2 = hash(i + 77), h3 = hash(i + 191);
      const bw = 150 + h2 * 50, bh = 170 + h1 * 160;
      const x = i * sp + off + h3 * 40, top = base - bh;
      const [col, acc] = HDB[Math.floor(hash(i + 3) * HDB.length)];
      ctx.fillStyle = col; ctx.fillRect(x, top, bw, bh);
      ctx.fillStyle = acc; ctx.fillRect(x, top + 6, 10, bh - 34); ctx.fillRect(x + bw - 10, top + 6, 10, bh - 34);
      // roof + water tank
      ctx.fillStyle = '#eeeeee'; ctx.fillRect(x - 4, top - 8, bw + 8, 10);
      ctx.fillStyle = acc; ctx.fillRect(x + bw * 0.35, top - 22, bw * 0.3, 15);
      // windows
      ctx.fillStyle = 'rgba(55,85,120,.38)';
      for (let y = top + 16; y < base - 40; y += 20) {
        for (let wx = x + 18; wx < x + bw - 26; wx += 22) ctx.fillRect(wx, y, 12, 9);
      }
      // laundry poles (very Singapore!)
      for (let k = 0; k < 4; k++) {
        if (hash(i * 13 + k) < 0.5) continue;
        const rows = Math.max(1, Math.floor((bh - 60) / 20));
        const ly = top + 16 + Math.floor(hash(i * 7 + k) * rows) * 20 + 11;
        const lx = x + 18 + Math.floor(hash(i * 5 + k) * 4) * 22;
        ctx.fillStyle = '#9e9e9e'; ctx.fillRect(lx - 4, ly, 26, 2);
        ctx.fillStyle = SHIRTS[Math.floor(hash(i + k * 3) * SHIRTS.length)]; ctx.fillRect(lx - 2, ly + 2, 7, 8);
        ctx.fillStyle = SHIRTS[Math.floor(hash(i + k * 5 + 1) * SHIRTS.length)]; ctx.fillRect(lx + 9, ly + 2, 7, 6);
      }
      // void deck
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x, base - 30, bw, 30);
      ctx.fillStyle = col;
      for (let px = x + 4; px < x + bw - 6; px += 34) ctx.fillRect(px, base - 30, 8, 30);
      // block number
      ctx.fillStyle = acc; ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(String(100 + Math.floor(hash(i + 11) * 800)), x + bw / 2, top + 12);
    }
  }

  function drawVerge() {
    ctx.fillStyle = '#7cc56a'; ctx.fillRect(0, 422, W, 24);
    const off = game.dist * 0.55, sp = 190;
    const i0 = Math.floor((-150 - off) / sp), i1 = Math.ceil((W + 150 - off) / sp);
    for (let i = i0; i <= i1; i++) {
      const x = i * sp + off + hash(i + 40) * 60, s = 0.8 + hash(i + 50) * 0.4;
      ctx.fillStyle = '#7b5233'; ctx.fillRect(x - 5 * s, 400 - 20 * s, 10 * s, 46 * s);
      ctx.fillStyle = '#3f9b3a';
      [[-40, -30, 32], [0, -44, 36], [40, -30, 32], [-18, -20, 30], [20, -20, 30]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, 410 + dy * s, r * s, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#56b54c';
      [[-24, -40, 20], [12, -54, 22], [38, -36, 16]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, 410 + dy * s, r * s, 0, 7); ctx.fill(); });
    }
  }

  function drawRoad() {
    ctx.fillStyle = '#666b73'; ctx.fillRect(0, 444, W, 174);
    ctx.fillStyle = '#5c6168'; ctx.fillRect(0, 444, W, 6);
    ctx.fillStyle = '#f5f5f5';
    for (let x = mod(game.dist, 130) - 130; x < W; x += 130) ctx.fillRect(x, 462, 66, 6);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 606, W, 4);
    // kerb
    ctx.fillStyle = '#c7c7c7'; ctx.fillRect(0, 616, W, 12);
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 616, W, 4);
    // pavement
    ctx.fillStyle = '#e8dcc8'; ctx.fillRect(0, 628, W, 92);
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = mod(game.dist, 72) - 72; x < W; x += 72) { ctx.moveTo(x, 628); ctx.lineTo(x - 18, 708); }
    ctx.moveTo(0, 668); ctx.lineTo(W, 668);
    ctx.stroke();
    // grass edge with flowers
    ctx.fillStyle = '#7cc56a'; ctx.fillRect(0, 708, W, 12);
    for (let x = mod(game.dist, 90) - 90; x < W; x += 90) {
      circle(x + 20, 712, 4, '#ff70a6'); circle(x + 52, 714, 4, '#ffd93d');
    }
  }

  function drawSign(sg) {
    const x = sg.wx + game.dist;
    if (x < -120 || x > W + 120) return;
    ellipse(x, 704, 18, 5, 'rgba(0,0,0,.18)');
    ctx.fillStyle = '#8a939c'; ctx.fillRect(x - 4, 520, 8, 184);
    rr(x - 74, 444, 148, 86, 12, '#ffffff');
    ctx.strokeStyle = '#1e5aa8'; ctx.lineWidth = 4; rrPath(x - 74, 444, 148, 86, 12); ctx.stroke();
    rr(x - 74, 444, 148, 24, [12, 12, 0, 0], '#1e5aa8');
    ctx.fillStyle = '#fff'; ctx.font = `800 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BUS STOP', x, 457);
    ctx.font = `30px ${EMOJI}`; ctx.fillText(sg.icon, x - 46, 500);
    ctx.fillStyle = '#1e2d3d'; ctx.font = `800 16px ${FONT}`; ctx.textAlign = 'left';
    const lines = wrapText(sg.name, 94);
    lines.forEach((l, i) => ctx.fillText(l, x - 26, 500 + (i - (lines.length - 1) / 2) * 17));
    rr(x - 22, 534, 44, 20, 5, '#ffd23f');
    ctx.fillStyle = '#1e2d3d'; ctx.textAlign = 'center'; ctx.font = `800 14px ${FONT}`; ctx.fillText(ROUTE_NO, x, 545);
    ctx.textBaseline = 'alphabetic';
  }

  // ====================================================================
  // Draw: people
  // ====================================================================
  function drawHead(lk, side) {
    // origin = head centre, radius 15. In side view the person faces +x.
    const tud = lk.style === 'tudung';
    if (lk.style === 'long') rr(side ? -17 : -17, -4, side ? 24 : 34, 26, 8, lk.hair);
    if (tud) { rrPath(-19, -20, 38, 46, 18); ctx.fillStyle = lk.tudung; ctx.fill(); }
    circle(0, 0, tud ? 12.5 : 15, lk.skin);
    ctx.fillStyle = lk.hair;
    const top = () => { ctx.beginPath(); ctx.arc(0, -2, 15.6, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); };
    switch (lk.style) {
      case 'short': case 'long':
        top();
        if (side) { ctx.beginPath(); ctx.arc(0, 0, 15.6, Math.PI * 0.55, Math.PI * 1.1); ctx.lineTo(0, 0); ctx.fill(); }
        else { ctx.beginPath(); ctx.ellipse(-6, -4, 8, 4, 0.4, 0, 7); ctx.fill(); }
        break;
      case 'bun':
        top(); circle(side ? -10 : 0, side ? -13 : -17, 7, lk.hair); break;
      case 'pigtails':
        top();
        if (side) circle(-15, 2, 6.5, lk.hair); else { circle(-17, 3, 6.5, lk.hair); circle(17, 3, 6.5, lk.hair); }
        break;
      case 'cap':
        ctx.fillStyle = lk.cap; ctx.beginPath(); ctx.arc(0, -3, 15.8, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
        if (side) rr(8, -6, 14, 5, 2, lk.cap); else ellipse(0, -3, 17, 4, lk.cap);
        break;
      case 'bald':
        ctx.beginPath(); ctx.arc(0, 0, 15.6, Math.PI * 0.75, Math.PI * 1.05); ctx.lineTo(0, 0); ctx.fill();
        if (!side) { ctx.beginPath(); ctx.arc(0, 0, 15.6, Math.PI * 1.95, Math.PI * 2.25); ctx.lineTo(0, 0); ctx.fill(); }
        break;
      default: break;
    }
    // face
    const ink = '#2b2118';
    if (side) {
      circle(7, 1, 2.2, ink);
      circle(4, 7, 3, 'rgba(255,110,110,.35)');
      ctx.strokeStyle = ink; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(8, 5, 4, 0.15 * Math.PI, 0.7 * Math.PI); ctx.stroke();
      if (lk.glasses) { ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(7, 1, 4.5, 0, 7); ctx.stroke(); }
    } else {
      circle(-5, 1, 2.2, ink); circle(5, 1, 2.2, ink);
      circle(-9, 6, 3, 'rgba(255,110,110,.35)'); circle(9, 6, 3, 'rgba(255,110,110,.35)');
      ctx.strokeStyle = ink; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 5, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      if (lk.glasses) { ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-5, 1, 4.5, 0, 7); ctx.moveTo(9.5, 1); ctx.arc(5, 1, 4.5, 0, 7); ctx.moveTo(-0.5, 1); ctx.lineTo(0.5, 1); ctx.stroke(); }
    }
  }

  function limb(x, y, ang, len, w, color, endColor, endR) {
    const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len;
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    if (endColor) circle(ex, ey, endR, endColor);
    return [ex, ey];
  }

  function drawPerson(p) {
    const lk = p.look;
    const sx = p.wx + game.dist, sy = p.y;
    if (sx < -80 || sx > W + 80) return;
    const s = depth(sy) * lk.size;
    ctx.save();
    ctx.globalAlpha = clamp(p.alpha, 0, 1);
    ellipse(sx, sy, 17 * s, 4.5 * s, 'rgba(0,0,0,.18)');
    ctx.translate(sx, sy);
    ctx.scale(s, s);
    const darker = 'rgba(0,0,0,.18)';
    if (p.walking || !p.front) {
      ctx.scale(p.facing, 1);
      const sw = p.walking ? Math.sin(p.phase) * 0.55 : 0;
      const bob = p.walking ? Math.abs(Math.cos(p.phase)) * 2.5 : 0;
      ctx.translate(0, -bob);
      if (lk.bag === 'backpack') rr(-21, -80, 12, 30, 4, lk.bagColor);
      limb(0, -40, -sw, 38, 9, lk.pants, '#333', 5);
      limb(0, -40, -sw, 38, 9, darker);
      limb(0, -74, sw * 0.9, 30, 7, lk.shirt, lk.skin, 4);
      if (lk.dress) { ctx.fillStyle = lk.pants; ctx.beginPath(); ctx.moveTo(-10, -80); ctx.lineTo(10, -80); ctx.lineTo(15, -30); ctx.lineTo(-15, -30); ctx.closePath(); ctx.fill(); }
      limb(0, -40, sw, 38, 9, lk.pants, '#333', 5);
      rr(-11, -82, 22, 44, 8, lk.shirt);
      const [hx, hy] = limb(0, -74, -sw * 0.9, 30, 7, lk.shirt, lk.skin, 4);
      if (lk.bag === 'shopping') { rr(hx - 7, hy, 14, 16, 3, lk.bagColor); }
      if (lk.bag === 'cane') { ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy - 4); ctx.lineTo(hx + 4, 0); ctx.stroke(); }
      ctx.save(); ctx.translate(2, -97); drawHead(lk, true); ctx.restore();
    } else {
      const breathe = Math.sin(game.time * 2.2 + lk.seed) * 1;
      ctx.translate(0, -breathe * 0.5);
      if (lk.bag === 'backpack') { ctx.strokeStyle = lk.bagColor; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -82); ctx.lineTo(-8, -58); ctx.moveTo(8, -82); ctx.lineTo(8, -58); ctx.stroke(); }
      limb(-6, -40, 0, 38, 9, lk.pants, '#333', 5);
      limb(6, -40, 0, 38, 9, lk.pants, '#333', 5);
      if (lk.dress) { ctx.fillStyle = lk.pants; ctx.beginPath(); ctx.moveTo(-12, -78); ctx.lineTo(12, -78); ctx.lineTo(18, -30); ctx.lineTo(-18, -30); ctx.closePath(); ctx.fill(); }
      rr(-13, -82, 26, 44, 9, lk.shirt);
      const [lx, ly] = limb(-13, -76, 0.15, 30, 7, lk.shirt, lk.skin, 4);
      if (p.wave) {
        const a = Math.PI - 0.5 + Math.sin(game.time * 9 + lk.seed) * 0.45;
        limb(13, -76, a, 30, 7, lk.shirt, lk.skin, 4.5);
      } else {
        const [rx, ry] = limb(13, -76, -0.15, 30, 7, lk.shirt, lk.skin, 4);
        if (lk.bag === 'shopping') rr(rx - 7, ry, 14, 16, 3, lk.bagColor);
        if (lk.bag === 'cane') { ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rx, ry - 4); ctx.lineTo(rx + 3, 0); ctx.stroke(); }
      }
      void lx; void ly;
      ctx.save(); ctx.translate(0, -97); drawHead(lk, false); ctx.restore();
    }
    ctx.restore();
    if (p.badge && p.badge.t < 1.8) {
      const t = p.badge.t;
      const sc = easeOutBack(Math.min(1, t * 3));
      const a = t > 1.4 ? 1 - (t - 1.4) / 0.4 : 1;
      drawBadge(sx, sy - 128 * s - t * 12, p.badge.n, sc, a, '#ffcf3f');
    }
  }

  function drawBadge(x, y, n, sc = 1, a = 1, color = '#ffcf3f', r = 22) {
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.translate(x, y); ctx.scale(sc, sc);
    circle(0, 3, r, 'rgba(0,0,0,.2)');
    circle(0, 0, r, color);
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    ctx.fillStyle = '#24405a'; ctx.font = `800 ${Math.round(r * 1.25)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, 2);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  // ====================================================================
  // Draw: the bendy bus
  // ====================================================================
  function busBodyPath(x0, x1, isFront) {
    const top = BUS.top, bot = BUS.bot;
    rrPath(x0, top, x1 - x0, bot - top, isFront ? [30, 10, 6, 14] : [10, 26, 14, 6]);
  }

  function drawSection(x0, x1, isFront) {
    const w = x1 - x0;
    ctx.save();
    busBodyPath(x0, x1, isFront);
    ctx.clip();
    ctx.fillStyle = GREEN; ctx.fillRect(x0, BUS.top, w, BUS.bot - BUS.top);
    ctx.fillStyle = '#f7faf5'; ctx.fillRect(x0, BUS.top, w, 24);
    ctx.fillStyle = GREEN_L; ctx.fillRect(x0, BUS.top + 24, w, 4);
    ctx.fillStyle = '#28343c'; ctx.fillRect(x0, 390, w, 86);
    ctx.fillStyle = GREEN_L; ctx.fillRect(x0, 500, w, 6);
    ctx.fillStyle = GREEN_D; ctx.fillRect(x0, 560, w, 30);
    // little highlight along the top
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x0, BUS.top + 3, w, 3);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2.5;
    busBodyPath(x0, x1, isFront); ctx.stroke();
  }

  function drawBus() {
    const bob = game.v > 5 ? Math.sin(game.time * 15) * 1.3 : Math.sin(game.time * 3) * 0.4;
    const dy = bob + game.kneel;
    ellipse(642, 616, 480, 10, 'rgba(0,0,0,.25)');

    ctx.save();
    ctx.translate(0, dy);

    // accordion joint (squishes a little while driving)
    const wob = game.v > 5 ? Math.sin(game.time * 4) * 2 : 0;
    rr(BUS.j0 - 4, BUS.top + 8, BUS.j1 - BUS.j0 + 8, BUS.bot - BUS.top - 14, 4, '#2a2a2a');
    ctx.strokeStyle = '#4c4c4c'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = BUS.j0; x <= BUS.j1; x += 4.5 + wob * 0.2) { ctx.moveTo(x, BUS.top + 10); ctx.lineTo(x, BUS.bot - 8); }
    ctx.stroke();

    drawSection(BUS.front, BUS.j0, true);
    drawSection(BUS.j1, BUS.rear, false);

    // wheel arches
    for (const wx of WHEELS) { ctx.beginPath(); ctx.arc(wx, BUS.bot, 38, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#1b1b1b'; ctx.fill(); }

    // windscreen + mirror + lights (front is on the LEFT: the bus drives left)
    const fx = BUS.front;
    ctx.fillStyle = '#9cd3ea'; rrPath(fx + 3, 392, 16, 118, [16, 2, 2, 6]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(fx + 7, 400, 3, 80);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx + 6, 396); ctx.lineTo(fx - 16, 392); ctx.lineTo(fx - 16, 400); ctx.stroke();
    rr(fx - 24, 398, 11, 30, 4, '#222');
    circle(fx + 8, 546, 8, '#fff6c7'); circle(fx + 8, 546, 5, '#ffe066');
    rr(fx - 4, 568, 26, 20, 5, '#2a2a2a');
    // route number on the front
    rr(fx + 8, BUS.top + 4, 26, 15, 3, '#111');
    ctx.fillStyle = '#ffb000'; ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(ROUTE_NO, fx + 21, BUS.top + 16);
    // rear lights
    rr(BUS.rear - 8, 536, 7, 22, 2, '#e53935');
    rr(BUS.rear - 8, 512, 7, 14, 2, '#ffb300');
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let y = 520; y < 556; y += 7) { ctx.moveTo(BUS.rear - 70, y); ctx.lineTo(BUS.rear - 22, y); }
    ctx.stroke();

    // LED destination display on the side
    rr(272, BUS.top + 5, 210, 16, 3, '#111');
    ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'left';
    if (game.bellFlash > 0 && Math.floor(game.time * 3) % 2 === 0) {
      ctx.fillStyle = '#ff5252'; ctx.fillText('🔔 BUS STOPPING', 280, BUS.top + 17);
    } else {
      ctx.fillStyle = '#ffb000'; ctx.fillText(`${ROUTE_NO}  ▸  ${game.nextDest}`, 280, BUS.top + 17);
    }

    // windows: seats + passengers
    WINDOWS.forEach(([a, b], wi) => {
      const g = ctx.createLinearGradient(0, BUS.winTop, 0, BUS.winBot);
      g.addColorStop(0, '#d2eefa'); g.addColorStop(1, '#8fc3db');
      rr(a, BUS.winTop, b - a, BUS.winBot - BUS.winTop, 6, g);
      ctx.save();
      rrPath(a, BUS.winTop, b - a, BUS.winBot - BUS.winTop, 6); ctx.clip();
      for (let k = 0; k < 2; k++) {
        const sx = SLOTS[wi * 2 + k];
        rr(sx - 13, 444, 26, 30, 6, '#3f7fbf');
        rr(sx - 13, 444, 26, 6, 3, '#5d9de0');
      }
      for (const p of game.onboard) {
        if (Math.floor(p.slot / 2) !== wi) continue;
        const sx = SLOTS[p.slot];
        const sc = easeOutBack(p.appear) * 0.82;
        if (sc <= 0.01) continue;
        const jig = game.v > 5 ? Math.sin(game.time * 15 + p.slot) * 0.8 : 0;
        ctx.save();
        ctx.translate(sx, 430 + jig + (1 - p.appear) * 20);
        ctx.scale(sc, sc);
        rr(-16, 13, 32, 34, 11, p.look.shirt);
        drawHead(p.look, false);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.moveTo(a + 8, BUS.winTop); ctx.lineTo(a + 24, BUS.winTop); ctx.lineTo(a + 4, BUS.winBot); ctx.lineTo(a - 12, BUS.winBot); ctx.fill();
      ctx.restore();
    });

    // doors
    DOORS.forEach((d, i) => drawDoor(d, game.doors[i], i === 0 ? 'in' : 'out'));

    ctx.restore();

    // wheels (they don't bob)
    for (const wx of WHEELS) drawWheel(wx, BUS.bot - 4 + game.kneel * 0.3);
  }

  function drawDoor(d, open, kind) {
    const top = 392, h = BUS.bot - 6 - top;
    rr(d.x - 3, top - 3, d.w + 6, h + 6, 6, '#28343c');
    // interior
    rr(d.x, top, d.w, h, 4, '#3a3f44');
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(d.x + d.w / 2 - 2, top + 8, 4, h - 20);
    ctx.fillStyle = '#555'; ctx.fillRect(d.x, top + h - 14, d.w, 14);
    const pw = (d.w / 2 - 1) * (1 - 0.82 * open);
    const panel = (px) => {
      rr(px, top, pw, h, 3, GREEN_D);
      if (pw > 10) {
        const g = ctx.createLinearGradient(0, top, 0, top + h);
        g.addColorStop(0, '#cdebf7'); g.addColorStop(1, '#86bdd6');
        rr(px + 4, top + 6, pw - 8, h * 0.62, 3, g);
        rr(px + 4, top + h * 0.72, pw - 8, h * 0.2, 3, 'rgba(255,255,255,.25)');
      }
    };
    panel(d.x);
    panel(d.x + d.w - pw);
    // small sign above the door
    ctx.font = `800 9px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillStyle = kind === 'in' ? '#7CFC00' : '#ffb3b3';
    ctx.fillText(kind === 'in' ? 'ENTRY' : 'EXIT', d.x + d.w / 2, top - 6);
  }

  function drawWheel(x, y) {
    circle(x, y, 31, '#1d1d1d');
    circle(x, y, 18, '#c9ccd1');
    ctx.save(); ctx.translate(x, y); ctx.rotate(game.wheelAng);
    ctx.strokeStyle = '#8d9096'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 0); ctx.stroke(); }
    ctx.restore();
    circle(x, y, 6, '#666');
  }

  // ====================================================================
  // Draw: HUD route strip, labels, particles
  // ====================================================================
  function routeProgress() {
    let frac = 1;
    if (game.distTarget != null) frac = clamp((game.dist - game.legStart) / (game.distTarget - game.legStart), 0, 1);
    return game.stopIndex + frac;
  }

  function drawRoute() {
    if (game.mode !== 'play' || !game.stops.length) return;
    const n = game.stops.length, x0 = 370, x1 = 910, y = 42;
    rr(x0 - 46, 18, x1 - x0 + 92, 48, 24, 'rgba(255,255,255,.9)');
    const prog = routeProgress();
    const frac = prog - game.stopIndex;
    const px = (k) => x0 + (k * (x1 - x0)) / n;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#d7dde3'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.strokeStyle = '#35c46a'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, prog / n), y); ctx.stroke();
    circle(x0, y, 8, '#35c46a');
    game.stops.forEach((s, k) => {
      const x = px(k + 1);
      const done = k < game.stopIndex || (k === game.stopIndex && frac >= 1);
      const cur = k === game.stopIndex;
      const r = cur ? 17 + Math.sin(game.time * 5) * 1.5 : 15;
      circle(x, y, r + 3, done ? '#35c46a' : cur ? '#ffcf3f' : '#c5ccd3');
      circle(x, y, r, '#fff');
      ctx.font = `${cur ? 19 : 16}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.icon, x, y + 1);
    });
    ctx.textBaseline = 'alphabetic';
    // tiny bus marker
    const bx = lerp(x0, x1, prog / n), by = y - 22 + (game.v > 5 ? Math.sin(game.time * 15) : 0);
    rr(bx - 17, by - 7, 34, 13, 4, GREEN);
    ctx.fillStyle = '#28343c'; ctx.fillRect(bx - 13, by - 5, 26, 5);
    circle(bx - 9, by + 7, 3.5, '#222'); circle(bx + 9, by + 7, 3.5, '#222');
  }

  // ====================================================================
  // Route map (top-down cartoon map with the bus moving along the route)
  // ====================================================================
  const MAP = { x: 70, y: 88, w: 1140, h: 612 };
  const MAP_TEMPLATE = [[170, 600], [320, 460], [500, 565], [640, 390], [820, 480], [965, 315], [1105, 455]];

  function showMap(autoMs) {
    const m = game.map;
    clearTimeout(m.timer);
    if (!m.open) Sound.noise(0.35, { freq: 1800, freqTo: 900, q: 0.7, vol: 0.06, attack: 0.03 });
    m.open = true;
    m.manual = !autoMs;
    if (autoMs) m.timer = setTimeout(() => { if (!m.manual) hideMap(); }, autoMs);
  }
  function hideMap() {
    const m = game.map;
    clearTimeout(m.timer);
    if (m.open) Sound.noise(0.3, { freq: 900, freqTo: 1800, q: 0.7, vol: 0.05, attack: 0.03 });
    m.open = false; m.manual = false;
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  function layoutMap() {
    const pts = MAP_TEMPLATE.map(([x, y], i) => ({ x: x + (i ? rand(-22, 22) : 0), y: y + (i ? rand(-22, 22) : 0) }));
    const nearRoute = (x, y, d) => pts.some((p, i) => i < pts.length - 1 && segDist(x, y, p.x, p.y, pts[i + 1].x, pts[i + 1].y) < d);
    const inSea = (x, y) => x > 990 && y > 560;
    const decor = { trees: [], blocks: [] };
    for (let tries = 0; decor.blocks.length < 9 && tries < 400; tries++) {
      const x = rand(MAP.x + 40, MAP.x + MAP.w - 60), y = rand(MAP.y + 90, MAP.y + MAP.h - 50);
      if (nearRoute(x, y, 70) || inSea(x, y) || decor.blocks.some((b) => Math.hypot(b.x - x, b.y - y) < 90)) continue;
      decor.blocks.push({ x, y, c: HDB[Math.floor(Math.random() * HDB.length)] });
    }
    for (let tries = 0; decor.trees.length < 46 && tries < 900; tries++) {
      const x = rand(MAP.x + 20, MAP.x + MAP.w - 20), y = rand(MAP.y + 70, MAP.y + MAP.h - 20);
      if (nearRoute(x, y, 42) || inSea(x, y) || decor.blocks.some((b) => Math.abs(b.x - x) < 40 && Math.abs(b.y - y) < 40)) continue;
      decor.trees.push({ x, y, r: rand(9, 15) });
    }
    game.map.pts = pts;
    game.map.decor = decor;
  }

  function mapBusPos(prog) {
    const pts = game.map.pts;
    const i = clamp(Math.floor(prog), 0, pts.length - 2);
    const f = clamp(prog - i, 0, 1);
    const a = pts[i], b = pts[i + 1];
    return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  function drawMapBus(x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const bob = game.v > 5 ? Math.sin(game.time * 16) * 0.8 : 0;
    ctx.translate(0, bob);
    ellipse(2, 5, 42, 15, 'rgba(0,0,0,.25)');
    // rear section, joint, front section (front points along the route)
    rr(-40, -13, 37, 26, 6, GREEN);
    rr(-3, -10, 7, 20, 2, '#2a2a2a');
    rr(4, -13, 38, 26, [6, 11, 11, 6], GREEN);
    ctx.fillStyle = '#f7faf5';
    ctx.fillRect(-36, -7, 29, 14); ctx.fillRect(8, -7, 24, 14);
    ctx.fillStyle = '#28343c'; rr(33, -10, 6, 20, 3, '#28343c');
    ctx.fillStyle = '#ffb000'; ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ROUTE_NO, 20, 0.5);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function drawMap() {
    const m = game.map;
    if (m.a <= 0.001 || !m.pts.length) return;
    const a = m.a, e = easeOutBack(a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,40,60,.45)'; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2 + 20);
    ctx.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e);
    ctx.translate(-W / 2, -H / 2 - 20);

    // paper card + land
    rr(MAP.x - 10, MAP.y - 10, MAP.w + 20, MAP.h + 20, 30, '#fff7e0');
    ctx.save();
    rrPath(MAP.x, MAP.y, MAP.w, MAP.h, 24); ctx.clip();
    ctx.fillStyle = '#c8e8a4'; ctx.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    // faint street grid
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = MAP.x + 60; x < MAP.x + MAP.w; x += 150) { ctx.moveTo(x, MAP.y); ctx.lineTo(x - 40, MAP.y + MAP.h); }
    for (let y = MAP.y + 120; y < MAP.y + MAP.h; y += 130) { ctx.moveTo(MAP.x, y); ctx.lineTo(MAP.x + MAP.w, y + 30); }
    ctx.stroke();
    // river
    ctx.strokeStyle = '#7cc8f0'; ctx.lineWidth = 30; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(MAP.x + 380, MAP.y - 20);
    ctx.bezierCurveTo(MAP.x + 300, MAP.y + 200, MAP.x + 560, MAP.y + 300, MAP.x + 470, MAP.y + MAP.h + 20); ctx.stroke();
    ctx.strokeStyle = '#a9dcf7'; ctx.lineWidth = 10; ctx.stroke();
    // sea with waves
    ctx.fillStyle = '#5bb8ec';
    ctx.beginPath(); ctx.moveTo(MAP.x + MAP.w, MAP.y + 470);
    ctx.bezierCurveTo(MAP.x + 1040, MAP.y + 480, MAP.x + 960, MAP.y + 540, MAP.x + 900, MAP.y + MAP.h);
    ctx.lineTo(MAP.x + MAP.w, MAP.y + MAP.h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      const wx = MAP.x + 1010 + k * 30 + Math.sin(game.time * 2 + k) * 6, wy = MAP.y + 540 + k * 16;
      ctx.beginPath(); ctx.arc(wx, wy, 8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    ctx.font = `30px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⛵', MAP.x + 1090 + Math.sin(game.time) * 8, MAP.y + 575);
    // HDB blocks (little rooftops) and trees
    for (const b of m.decor.blocks) {
      rr(b.x - 26, b.y - 18, 56, 40, 5, 'rgba(0,0,0,.15)');
      rr(b.x - 30, b.y - 22, 56, 40, 5, b.c[0]);
      ctx.fillStyle = b.c[1]; ctx.fillRect(b.x - 30, b.y - 22, 56, 7);
      ctx.fillStyle = 'rgba(55,85,120,.35)';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(b.x - 24 + c * 12, b.y - 10 + r * 9, 7, 5);
    }
    for (const t of m.decor.trees) { circle(t.x + 2, t.y + 3, t.r, 'rgba(0,0,0,.12)'); circle(t.x, t.y, t.r, '#4caf50'); circle(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, '#6cc56c'); }
    ctx.restore();
    ctx.strokeStyle = '#e3c27a'; ctx.lineWidth = 5; rrPath(MAP.x, MAP.y, MAP.w, MAP.h, 24); ctx.stroke();

    // the bus route road
    const pts = m.pts;
    const prog = routeProgress();
    const path = (upto) => {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      const n = Math.floor(upto);
      for (let i = 1; i <= Math.min(n, pts.length - 1); i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (upto < pts.length - 1) { const p = mapBusPos(upto); ctx.lineTo(p.x, p.y); }
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(pts.length - 1); ctx.strokeStyle = '#7d848c'; ctx.lineWidth = 26; ctx.stroke();
    ctx.strokeStyle = '#9aa1a8'; ctx.lineWidth = 20; ctx.stroke();
    ctx.setLineDash([14, 14]); ctx.lineDashOffset = -game.time * 30;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.setLineDash([]);
    path(prog); ctx.strokeStyle = 'rgba(53,196,106,.85)'; ctx.lineWidth = 12; ctx.stroke();

    // start flag
    const s0 = pts[0];
    circle(s0.x, s0.y, 20, '#fff'); circle(s0.x, s0.y, 16, '#35c46a');
    ctx.font = `20px ${EMOJI}`; ctx.fillText('🏁', s0.x, s0.y + 1);
    mapLabel('Start', s0.x, s0.y + 36, false);

    // stops
    game.stops.forEach((st, k) => {
      const p = pts[k + 1];
      const done = k < Math.floor(prog) || (k === game.stopIndex && prog - k >= 1);
      const cur = k === game.stopIndex && !done;
      const r = (st.terminus ? 30 : 25) + (cur ? Math.sin(game.time * 5) * 2.5 : 0);
      if (cur) { ctx.globalAlpha = a * (0.35 + 0.25 * Math.sin(game.time * 5)); circle(p.x, p.y, r + 16, '#ffcf3f'); ctx.globalAlpha = a; }
      circle(p.x + 2, p.y + 4, r + 4, 'rgba(0,0,0,.18)');
      circle(p.x, p.y, r + 4, done ? '#35c46a' : cur ? '#ffcf3f' : '#1e5aa8');
      circle(p.x, p.y, r, '#fff');
      ctx.font = `${Math.round(r * 1.05)}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(st.icon, p.x, p.y + 1);
      if (done) { circle(p.x + r * 0.8, p.y - r * 0.8, 11, '#35c46a'); ctx.fillStyle = '#fff'; ctx.font = `800 15px ${FONT}`; ctx.fillText('✓', p.x + r * 0.8, p.y - r * 0.8 + 1); }
      mapLabel(st.name, p.x, p.y + r + 20, cur);
    });

    // the bus itself, with a "you are here" ring
    const bp = mapBusPos(prog);
    ctx.globalAlpha = a * (0.5 - 0.5 * ((game.time * 1.2) % 1));
    ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(bp.x, bp.y, 20 + ((game.time * 1.2) % 1) * 40, 0, 7); ctx.stroke();
    ctx.globalAlpha = a;
    drawMapBus(bp.x, bp.y - 16, bp.ang);

    // title
    const tx = MAP.x + MAP.w - 350, ty = MAP.y + MAP.h - 66;
    rr(tx, ty, 330, 50, 25, 'rgba(255,255,255,.92)');
    ctx.fillStyle = '#24405a'; ctx.font = `800 26px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`🗺️ Bus ${ROUTE_NO} route map`, tx + 20, ty + 26);
    if (m.manual) {
      rr(tx + 60, ty - 36, 210, 28, 14, 'rgba(255,255,255,.85)');
      ctx.textAlign = 'center'; ctx.font = `700 17px ${FONT}`; ctx.fillStyle = '#24405a';
      ctx.fillText('Tap anywhere to close', tx + 165, ty - 21);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function mapLabel(text, x, y, highlight) {
    ctx.font = `800 17px ${FONT}`;
    const w = ctx.measureText(text).width + 22;
    rr(x - w / 2, y - 14, w, 28, 14, highlight ? '#ffcf3f' : 'rgba(255,255,255,.95)');
    ctx.fillStyle = '#24405a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  }

  function drawFX() {
    // exhaust
    for (const f of game.puffs) { ctx.globalAlpha = (f.life / f.max) * 0.5; circle(f.x, f.y, f.r, '#9aa0a6'); }
    ctx.globalAlpha = 1;
  }

  function drawOverlays() {
    // count pops
    for (const p of game.pops) {
      const t = p.t;
      drawBadge(p.x, p.y - t * 40, p.n, easeOutBack(Math.min(1, t * 3)), t > 1 ? 1 - (t - 1) / 0.4 : 1, p.color, 24);
    }
    // hint labels
    for (const l of game.labels) {
      const { x, y } = l.pos();
      drawBadge(x, y, l.n, easeOutBack(Math.min(1, l.t * 3.5)), 1, '#ffe14d', 15);
    }
    // particles
    for (const q of game.parts) {
      if (q.kind === 'confetti') {
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.globalAlpha = Math.min(1, q.life);
        ctx.fillStyle = q.color; ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.rot * 1.3)) + 1);
        ctx.restore();
      } else if (q.kind === 'sparkle') {
        ctx.globalAlpha = q.life / q.max; drawStar(q.x, q.y, q.r, q.color); ctx.globalAlpha = 1;
      } else if (q.kind === 'flystar') {
        const t = q.t / q.dur, e = t * t * (3 - 2 * t);
        const x = lerp(q.fx, q.tx, e), y = lerp(q.fy, q.ty, e) - Math.sin(t * Math.PI) * 140;
        const sc = t < 0.2 ? easeOutBack(t / 0.2) : 1 - (t - 0.2) * 0.5;
        drawStar(x, y, 34 * sc, '#ffd23f', '#e09b00');
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStar(x, y, r, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function draw() {
    drawSky();
    drawBlocks();
    drawVerge();
    drawRoad();
    drawBus();
    drawFX();
    for (const s of game.signs) drawSign(s);
    [...game.people].sort((a, b) => a.y - b.y).forEach(drawPerson);
    drawOverlays();
    drawMap();
    drawRoute();
  }

  // ====================================================================
  // Main loop
  // ====================================================================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // a few friendly passengers on the title-screen bus
  for (let i = 0; i < 4; i++) game.onboard.push({ look: makeLook(), slot: [3, 6, 10, 15][i], appear: 1, leaving: false });

  // test/debug hook
  window.__bendyBus = { game, startRoute, toTitle };
})();
