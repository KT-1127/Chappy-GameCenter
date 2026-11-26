/*!
 * audio.js — 効果音と BGM（Web Audio API でその場で作る。音源ファイルは使わない）
 *
 *   Sound.unlock()            最初のクリックやキー入力のときに呼ぶ（ブラウザの決まりで、それまで音は出せない）
 *   Sound.se("key")           効果音：key / miss / word / apple / combo / count / go / finish / result / record / click / hover / tick
 *   Sound.bgm("title")        BGM：title / play / battle / cannon2 / cannon3 / bossFake / bossEvil / bossMecha / bossGhost / bossKing / bossRage / rest / null（止める）
 *                             りんごキャノンのボス戦の効果音：alarm / fight / bossHit / crit / hit / jab / charge / blast / guard / dodge / rage / ko / fanfare / gameover
 *                             launch（ミサイル）/ heal（ボスの回復）/ warp（ワープ）/ stun（フラフラ）
 *   Sound.setVolume(bgm, se)  0〜1
 *   Sound.setMuted(true)
 */
(function (global) {
"use strict";

let ctx = null, master, comp, bgmBus, seBus, noiseBuf;
let vol = { bgm: 0.5, se: 0.8 }, muted = false;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function init() {
  if (ctx) return true;
  const AC = global.AudioContext || global.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
  master = ctx.createGain();
  master.connect(comp); comp.connect(ctx.destination);
  bgmBus = ctx.createGain(); bgmBus.connect(master);
  seBus = ctx.createGain(); seBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolume();
  return true;
}

function applyVolume() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.03);
  bgmBus.gain.setTargetAtTime(vol.bgm * 0.55, t, 0.05);
  seBus.gain.setTargetAtTime(vol.se, t, 0.02);
}

function unlock() {
  if (!init()) return;
  if (ctx.state === "suspended") ctx.resume();
  if (pendingSong !== undefined) { const s = pendingSong; pendingSong = undefined; bgm(s); }
}

// ---- 音の部品 ----
/** 音程のある音（エンベロープつき） */
function tone(dest, { type = "sine", freq, t, dur = 0.2, gain = 0.2, attack = 0.005, slideTo, filter, detune = 0 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || "lowpass"; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7;
    o.connect(f); node = f;
  }
  node.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

/** ノイズ（打楽器・クリック音） */
function noise(dest, { t, dur = 0.05, gain = 0.2, type = "highpass", freq = 6000, q = 0.7 }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

/** ベルのような音（倍音を少し足す） */
function bell(dest, freq, t, dur, gain) {
  tone(dest, { type: "sine", freq, t, dur, gain });
  tone(dest, { type: "sine", freq: freq * 2, t, dur: dur * 0.5, gain: gain * 0.25 });
  tone(dest, { type: "triangle", freq: freq * 3.01, t, dur: dur * 0.25, gain: gain * 0.08 });
}

// ---- 効果音 ----
const SE = {
  key(t) {
    const f = 1700 + Math.random() * 260;
    tone(seBus, { type: "triangle", freq: f, t, dur: 0.045, gain: 0.07, slideTo: f * 0.7 });
    noise(seBus, { t, dur: 0.018, gain: 0.05, freq: 7000 });
  },
  miss(t) {
    tone(seBus, { type: "square", freq: 190, t, dur: 0.16, gain: 0.07, slideTo: 120, filter: { freq: 900 } });
    tone(seBus, { type: "sine", freq: 95, t, dur: 0.18, gain: 0.12 });
  },
  word(t) {
    bell(seBus, mtof(88), t, 0.35, 0.09);
    bell(seBus, mtof(95), t + 0.07, 0.5, 0.08);
  },
  apple(t) {
    [84, 88, 91, 96].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.045, 0.3, 0.06));
  },
  combo(t) {
    [79, 83, 86, 91, 95].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.05, 0.45, 0.07));
    noise(seBus, { t, dur: 0.4, gain: 0.03, type: "bandpass", freq: 9000, q: 1.5 });
  },
  count(t) { bell(seBus, mtof(81), t, 0.3, 0.12); },
  go(t) {
    [72, 76, 79, 84].forEach((m) => bell(seBus, mtof(m + 12), t, 0.7, 0.07));
  },
  tick(t) {
    tone(seBus, { type: "sine", freq: 1050, t, dur: 0.08, gain: 0.1 });
    noise(seBus, { t, dur: 0.03, gain: 0.05, type: "bandpass", freq: 2500, q: 3 });
  },
  finish(t) {
    [84, 79, 76, 72].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.06, 0.5, 0.08));
  },
  result(t) {
    [72, 76, 79, 84, 88].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.09, 0.8, 0.07));
  },
  record(t) {
    const seq = [72, 76, 79, 84, 79, 84, 88, 91, 96];
    seq.forEach((m, i) => bell(seBus, mtof(m), t + i * 0.08, 0.9, 0.07));
    noise(seBus, { t: t + 0.4, dur: 1.2, gain: 0.03, type: "bandpass", freq: 8000, q: 1 });
  },
  // りんごキャノン
  shoot(t) {
    noise(seBus, { t, dur: 0.18, gain: 0.08, type: "bandpass", freq: 1800, q: 0.8 });
    tone(seBus, { type: "triangle", freq: 520, t, dur: 0.16, gain: 0.08, slideTo: 1400 });
  },
  pop(t) {
    tone(seBus, { type: "sine", freq: 300, t, dur: 0.2, gain: 0.2, slideTo: 70 });
    noise(seBus, { t, dur: 0.22, gain: 0.12, type: "lowpass", freq: 2400 });
    bell(seBus, mtof(91), t + 0.03, 0.3, 0.05);
  },
  lose(t) {
    tone(seBus, { type: "sawtooth", freq: 260, t, dur: 0.45, gain: 0.06, slideTo: 90, filter: { freq: 1200 } });
    tone(seBus, { type: "sine", freq: 130, t, dur: 0.4, gain: 0.15, slideTo: 60 });
  },
  wave(t) {
    [72, 79, 84, 88, 91].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.06, 0.6, 0.07));
    tone(seBus, { type: "sine", freq: 110, t, dur: 0.5, gain: 0.15, slideTo: 220 });
  },
  star(t) {
    bell(seBus, mtof(88), t, 0.6, 0.1);
    bell(seBus, mtof(95), t + 0.05, 0.7, 0.07);
    noise(seBus, { t, dur: 0.3, gain: 0.03, type: "bandpass", freq: 9000, q: 2 });
  },
  badge(t) {
    [84, 88, 91, 96, 100].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.07, 0.7, 0.06));
  },
  // ---- りんごキャノンのボス戦 ----
  alarm(t) { // ボスが近づく警報（ウーウー×3）
    for (let k = 0; k < 3; k++) {
      const s = t + k * 0.62;
      tone(seBus, { type: "square", freq: 660, t: s, dur: 0.3, gain: 0.07, slideTo: 990, filter: { freq: 2600 } });
      tone(seBus, { type: "square", freq: 990, t: s + 0.3, dur: 0.3, gain: 0.07, slideTo: 660, filter: { freq: 2600 } });
      tone(seBus, { type: "sine", freq: 82, t: s, dur: 0.5, gain: 0.16 });
    }
  },
  fight(t) { // 「FIGHT!」の合図（力強い和音）
    [48, 55, 60, 64, 67].forEach((m) => {
      tone(seBus, { type: "sawtooth", freq: mtof(m), t, dur: 0.9, gain: 0.035, filter: { freq: 2400 }, detune: -8 });
      tone(seBus, { type: "sawtooth", freq: mtof(m), t, dur: 0.9, gain: 0.035, filter: { freq: 2400 }, detune: 8 });
    });
    tone(seBus, { type: "sine", freq: 120, t, dur: 0.4, gain: 0.3, slideTo: 40 });
    noise(seBus, { t, dur: 0.8, gain: 0.06, freq: 5000 });
  },
  bossHit(t) { // ボスにりんごが当たった
    noise(seBus, { t, dur: 0.16, gain: 0.16, type: "bandpass", freq: 900, q: 0.9 });
    tone(seBus, { type: "square", freq: 420, t, dur: 0.14, gain: 0.07, slideTo: 90, filter: { freq: 1800 } });
    tone(seBus, { type: "sine", freq: 180, t, dur: 0.22, gain: 0.22, slideTo: 50 });
  },
  crit(t) { // クリティカル
    SE.bossHit(t);
    [91, 96, 100, 103].forEach((m, i) => bell(seBus, mtof(m), t + 0.04 + i * 0.04, 0.5, 0.06));
    noise(seBus, { t: t + 0.02, dur: 0.5, gain: 0.04, type: "bandpass", freq: 9000, q: 1.5 });
  },
  hit(t) { // チャッピーが攻撃を受けた（大）
    tone(seBus, { type: "sine", freq: 170, t, dur: 0.45, gain: 0.34, slideTo: 36 });
    tone(seBus, { type: "square", freq: 110, t, dur: 0.3, gain: 0.08, slideTo: 45, filter: { freq: 700 } });
    noise(seBus, { t, dur: 0.4, gain: 0.2, type: "lowpass", freq: 1600 });
  },
  jab(t) { // ミスタイプの反撃（小）
    noise(seBus, { t, dur: 0.1, gain: 0.1, type: "bandpass", freq: 2400, q: 1.4 });
    tone(seBus, { type: "square", freq: 300, t, dur: 0.12, gain: 0.05, slideTo: 120, filter: { freq: 1400 } });
    tone(seBus, { type: "sine", freq: 120, t, dur: 0.16, gain: 0.14, slideTo: 60 });
  },
  charge(t) { // ボスが力をためる
    tone(seBus, { type: "sawtooth", freq: 160, t, dur: 0.75, gain: 0.05, slideTo: 1300, filter: { freq: 2200 } });
    tone(seBus, { type: "sine", freq: 80, t, dur: 0.75, gain: 0.1, slideTo: 260 });
    noise(seBus, { t, dur: 0.75, gain: 0.03, type: "bandpass", freq: 3000, q: 3 });
  },
  blast(t) { // ボスの大きな攻撃
    noise(seBus, { t, dur: 0.7, gain: 0.22, type: "lowpass", freq: 2200 });
    tone(seBus, { type: "sawtooth", freq: 900, t, dur: 0.5, gain: 0.06, slideTo: 60, filter: { freq: 2000 } });
    tone(seBus, { type: "sine", freq: 140, t: t + 0.05, dur: 0.6, gain: 0.3, slideTo: 32 });
  },
  guard(t) { // バリアで防いだ
    bell(seBus, 1250, t, 0.5, 0.1);
    bell(seBus, 1870, t + 0.02, 0.4, 0.06);
    noise(seBus, { t, dur: 0.12, gain: 0.06, freq: 6000 });
  },
  dodge(t) { // ぎりぎりで攻撃をかわした
    noise(seBus, { t, dur: 0.25, gain: 0.08, type: "bandpass", freq: 1200, q: 0.8 });
    tone(seBus, { type: "sine", freq: 400, t, dur: 0.25, gain: 0.08, slideTo: 1600 });
    bell(seBus, mtof(96), t + 0.12, 0.4, 0.06);
  },
  rage(t) { // ボスが怒った
    tone(seBus, { type: "sawtooth", freq: 70, t, dur: 1.2, gain: 0.1, slideTo: 140, filter: { freq: 900 } });
    tone(seBus, { type: "sawtooth", freq: 72, t, dur: 1.2, gain: 0.1, slideTo: 146, filter: { freq: 900 } });
    noise(seBus, { t, dur: 1.2, gain: 0.08, type: "lowpass", freq: 700 });
  },
  ko(t) { // ボスをたおした
    noise(seBus, { t, dur: 1.4, gain: 0.25, type: "lowpass", freq: 1800 });
    tone(seBus, { type: "sine", freq: 220, t, dur: 1.2, gain: 0.32, slideTo: 30 });
    tone(seBus, { type: "sawtooth", freq: 600, t, dur: 1, gain: 0.05, slideTo: 80, filter: { freq: 1500 } });
  },
  fanfare(t) { // 勝利のファンファーレ
    const n = (m, s, d, g) => {
      tone(seBus, { type: "sawtooth", freq: mtof(m), t: t + s, dur: d, gain: g, filter: { freq: 2800 }, detune: -6 });
      tone(seBus, { type: "square", freq: mtof(m), t: t + s, dur: d, gain: g * 0.6, filter: { freq: 2000 }, detune: 6 });
    };
    const b = 0.13;
    [0, 1, 2, 3].forEach((i) => n(72, i * b, b * 0.9, 0.05));
    n(68, 4 * b, b * 2.6, 0.05); n(70, 7 * b, b * 2.6, 0.05); n(72, 10 * b, b * 1.4, 0.05);
    n(70, 11.5 * b, b * 0.8, 0.05); n(72, 12.5 * b, b * 8, 0.06);
    [48, 55, 60, 64].forEach((m) => tone(seBus, { type: "triangle", freq: mtof(m), t: t + 12.5 * b, dur: b * 8, gain: 0.05 }));
    noise(seBus, { t: t + 12.5 * b, dur: 1.2, gain: 0.05, freq: 5000 });
  },
  gameover(t) { // ゲームオーバー
    [67, 66, 65, 64].forEach((m, i) => tone(seBus, { type: "sawtooth", freq: mtof(m), t: t + i * 0.32, dur: 0.34, gain: 0.05, filter: { freq: 1400 } }));
    [52, 55, 58, 61].forEach((m) => tone(seBus, { type: "triangle", freq: mtof(m), t: t + 1.3, dur: 1.6, gain: 0.05 }));
    tone(seBus, { type: "sine", freq: 90, t: t + 1.3, dur: 1.4, gain: 0.2, slideTo: 40 });
  },
  launch(t) { // ミサイル発射
    noise(seBus, { t, dur: 0.35, gain: 0.08, type: "bandpass", freq: 900, q: 0.7 });
    tone(seBus, { type: "sawtooth", freq: 220, t, dur: 0.3, gain: 0.04, slideTo: 880, filter: { freq: 1800 } });
  },
  heal(t) { // ボスの回復
    [76, 79, 83, 88].forEach((m, i) => tone(seBus, { type: "triangle", freq: mtof(m), t: t + i * 0.07, dur: 0.4, gain: 0.05 }));
    noise(seBus, { t, dur: 0.5, gain: 0.025, type: "bandpass", freq: 6000, q: 2 });
  },
  warp(t) { // ワープ
    tone(seBus, { type: "sine", freq: 1400, t, dur: 0.25, gain: 0.06, slideTo: 200 });
    tone(seBus, { type: "sine", freq: 300, t: t + 0.18, dur: 0.25, gain: 0.05, slideTo: 1600 });
  },
  stun(t) { // ボスがフラフラ
    [84, 88, 84, 88, 91].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.08, 0.3, 0.05));
    tone(seBus, { type: "sine", freq: 400, t, dur: 0.6, gain: 0.05, slideTo: 150 });
  },
  click(t) { tone(seBus, { type: "sine", freq: 880, t, dur: 0.08, gain: 0.08, slideTo: 1320 }); },
  hover(t) { tone(seBus, { type: "sine", freq: 1320, t, dur: 0.04, gain: 0.025 }); },
};

function se(name) {
  if (!ctx || muted || ctx.state !== "running" || !SE[name]) return;
  SE[name](ctx.currentTime + 0.001);
}

// ---- BGM ----
// 和音は MIDI の音番号。1小節に1つ。
const SONGS = {
  // メニュー：ゆったり、やわらかい
  title: {
    bpm: 84, swing: 0.12,
    bars: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59],
           [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 62], [55, 59, 62, 65]],
    drums: "soft", arp: "slow", melody: 0.35, seed: 7,
  },
  // プレイ中：明るく前向き、でも打つ邪魔にならない
  play: {
    bpm: 112, swing: 0,
    bars: [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67],
           [53, 57, 60, 64], [55, 59, 62, 65], [48, 52, 55, 60], [48, 52, 55, 59]],
    drums: "beat", arp: "fast", melody: 0.55, seed: 21,
  },
  // りんごキャノン（ステージ1）：少し緊張感のある曲
  battle: {
    bpm: 128, swing: 0,
    bars: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65],
           [57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]],
    drums: "beat", arp: "fast", melody: 0.6, seed: 33,
  },
  // りんごキャノン（ステージ2）：速くてかっこいい（ホ短調）
  cannon2: {
    bpm: 138, swing: 0, key: 4, scale: "minor",
    bars: [[52, 55, 59, 62], [48, 52, 55, 60], [50, 54, 57, 62], [47, 51, 54, 59],
           [52, 55, 59, 62], [48, 52, 55, 60], [45, 48, 52, 55], [47, 51, 54, 57]],
    drums: "rock", bass: "drive", arp: "fast", lead: "square", melody: 0.62, seed: 58,
  },
  // りんごキャノン（ステージ3〜）：さらに速く、暗め（ハ短調）
  cannon3: {
    bpm: 148, swing: 0, key: 0, scale: "minor",
    bars: [[48, 51, 55, 58], [44, 48, 51, 55], [46, 50, 53, 58], [43, 47, 50, 55],
           [48, 51, 55, 58], [44, 48, 51, 55], [41, 44, 48, 51], [43, 47, 50, 53]],
    drums: "rock", bass: "drive", arp: "fast", lead: "saw", melody: 0.65, seed: 71,
  },
  // ボス戦：ニセチャッピー（ふしぎで、ちょっとこわい・バグった感じ）
  bossFake: {
    bpm: 150, swing: 0, key: 6, scale: "minor",
    bars: [[54, 57, 61, 64], [50, 54, 57, 61], [52, 56, 59, 62], [49, 53, 56, 59],
           [54, 57, 61, 64], [50, 54, 57, 62], [47, 50, 54, 57], [49, 53, 56, 60]],
    drums: "rock", bass: "drive", arp: "glitch", lead: "square", melody: 0.66, seed: 90,
  },
  // ボス戦：ワルチャッピー（重くて激しい）
  bossEvil: {
    bpm: 158, swing: 0, key: 2, scale: "minor",
    bars: [[50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 60], [45, 49, 52, 55],
           [50, 53, 57, 60], [51, 55, 58, 62], [48, 52, 55, 60], [49, 52, 55, 58]],
    drums: "metal", bass: "drive", arp: "fast", lead: "saw", melody: 0.7, seed: 104,
  },
  // ボス戦：メカチャッピー（機械的で速い・きざむ音）
  bossMecha: {
    bpm: 162, swing: 0, key: 9, scale: "minor",
    bars: [[57, 60, 64, 67], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65],
           [57, 60, 64, 67], [50, 53, 57, 60], [52, 56, 59, 62], [52, 56, 59, 64]],
    drums: "metal", bass: "drive", arp: "glitch", lead: "square", melody: 0.6, seed: 141,
  },
  // ボス戦：ゴーストチャッピー（ふわふわ、ぞくっとする）
  bossGhost: {
    bpm: 132, swing: 0.18, key: 11, scale: "minor",
    bars: [[47, 50, 54, 57], [43, 47, 50, 54], [45, 48, 52, 55], [42, 46, 49, 52],
           [47, 50, 54, 57], [48, 52, 55, 58], [45, 48, 52, 55], [46, 50, 53, 56]],
    drums: "rock", bass: "drive", arp: "slow", lead: "bell", melody: 0.55, seed: 157,
  },
  // ボス戦：魔王チャッピー（重く、壮大）
  bossKing: {
    bpm: 144, swing: 0, key: 5, scale: "minor",
    bars: [[53, 56, 60, 63], [49, 53, 56, 60], [51, 55, 58, 62], [48, 52, 55, 58],
           [53, 56, 60, 63], [54, 58, 61, 65], [51, 55, 58, 62], [52, 55, 58, 61]],
    drums: "metal", bass: "drive", arp: "fast", lead: "saw", melody: 0.7, seed: 171,
  },
  // ボス戦のあとの休憩（ゆったり、ほっとする）
  rest: {
    bpm: 78, swing: 0.16,
    bars: [[53, 57, 60, 64], [50, 53, 57, 60], [52, 55, 59, 62], [48, 52, 55, 60],
           [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 64], [48, 52, 55, 59]],
    drums: "soft", arp: "slow", melody: 0.38, seed: 133,
  },
  // ボスが怒ったとき（さらに速く、半音上げて追いつめる）
  bossRage: {
    bpm: 176, swing: 0, key: 3, scale: "minor",
    bars: [[51, 54, 58, 61], [47, 51, 54, 58], [49, 53, 56, 61], [46, 50, 53, 56],
           [51, 54, 58, 61], [52, 56, 59, 63], [49, 53, 56, 61], [50, 53, 56, 59]],
    drums: "metal", bass: "drive", arp: "glitch", lead: "saw", melody: 0.75, seed: 117,
  },
};

let current = null;       // { name, song, gain, step, nextTime, timer }
let pendingSong;          // 音が出せるようになる前に頼まれた曲
let hurry = false;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 8小節ぶんのメロディを作る（毎回同じになるよう、種を固定） */
function makeMelody(song) {
  const r = rng(song.seed);
  const rhythms = [
    [1,0,0,0, 1,0,1,0, 0,0,1,0, 0,0,0,0],
    [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,0,0,0],
    [0,0,1,0, 1,0,0,0, 1,0,1,0, 1,0,0,0],
    [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,1,0],
  ];
  const key = song.key || 0;
  const scale = (song.scale === "minor" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]).map((x) => (x + key) % 12); // ペンタトニック
  return song.bars.map((chord, bar) => {
    const rh = rhythms[Math.floor(r() * rhythms.length)];
    const notes = [];
    let last = 76;
    for (let i = 0; i < 16; i++) {
      if (!rh[i] || r() > song.melody + 0.35) { notes.push(0); continue; }
      // 拍の頭は和音の音、それ以外は音階から近い音
      let n;
      if (i % 4 === 0) {
        const c = chord[Math.floor(r() * chord.length)] % 12;
        n = 72 + c; if (n < 74) n += 12;
      } else {
        const step = scale[Math.floor(r() * scale.length)];
        n = 72 + step + (r() < 0.4 ? 12 : 0);
        if (n > 91) n -= 12;
      }
      while (Math.abs(n - last) > 7) n += n > last ? -12 : 12;
      last = n;
      notes.push(n);
    }
    if (bar % 4 === 3) { notes.fill(0, 10); notes[8] = notes[8] || 72 + (chord[0] % 12); }
    return notes;
  });
}

function scheduleStep(cur, step, t) {
  const s = cur.song;
  const g = cur.gain;
  const spb = 60 / s.bpm;             // 1拍の長さ
  const st = spb / 4;                 // 16分音符の長さ
  const bar = Math.floor(step / 16) % s.bars.length;
  const i = step % 16;
  const chord = s.bars[bar];

  // パッド（小節の頭で和音を長くのばす）
  if (i === 0) {
    for (const m of chord) {
      tone(g, { type: "sawtooth", freq: mtof(m), t, dur: spb * 4.1, gain: 0.012, attack: 0.35, filter: { freq: 1100 }, detune: -7 });
      tone(g, { type: "triangle", freq: mtof(m), t, dur: spb * 4.1, gain: 0.02, attack: 0.3, detune: 6 });
    }
  }
  // ベース
  const root = chord[0] - 12;
  if (s.bass === "drive") {
    // 8分音符で刻むベース（激しい曲）
    if (i % 2 === 0) {
      const n = i === 6 || i === 14 ? root + 12 : root;
      tone(g, { type: "sawtooth", freq: mtof(n), t, dur: st * 1.7, gain: 0.07, filter: { freq: 520, q: 2 } });
      tone(g, { type: "sine", freq: mtof(n - 12), t, dur: st * 1.8, gain: 0.11 });
    }
  }
  const bassHit = s.bass !== "drive" && (s.drums === "beat" ? [0, 6, 8, 14].includes(i) : [0, 8].includes(i));
  if (bassHit) {
    const n = i === 14 ? root + 7 : root;
    tone(g, { type: "triangle", freq: mtof(n), t, dur: st * (i === 0 || i === 8 ? 3.5 : 1.8), gain: 0.16, filter: { freq: 600 } });
    tone(g, { type: "sine", freq: mtof(n - 12), t, dur: st * 3, gain: 0.12 });
  }
  // アルペジオ（ころころした音）
  const arpEvery = s.arp === "slow" ? 4 : 2;
  if (s.arp === "glitch") {
    // バグったような16分のアルペジオ（音の高さがとびはねる）
    const m = chord[(i * 3 + bar) % chord.length] + 12 + ((i * 7 + bar) % 3 === 0 ? 12 : 0);
    tone(g, { type: "square", freq: mtof(m), t, dur: st * 0.8, gain: 0.018, filter: { freq: 3200 } });
  } else if (i % arpEvery === 0) {
    const idx = (i / arpEvery) % chord.length;
    const up = Math.floor(i / (arpEvery * chord.length)) % 2;
    const m = chord[up ? chord.length - 1 - idx : idx] + 12;
    tone(g, { type: "sine", freq: mtof(m), t, dur: st * 3, gain: 0.05 });
    tone(g, { type: "triangle", freq: mtof(m + 12), t, dur: st * 1.2, gain: 0.012 });
  }
  // メロディ（ベルの音）
  const mel = cur.melody[bar][i];
  if (mel) {
    if (s.lead === "square") {
      tone(g, { type: "square", freq: mtof(mel), t, dur: st * 3, gain: 0.028, filter: { freq: 2600 } });
      tone(g, { type: "triangle", freq: mtof(mel), t, dur: st * 3, gain: 0.03 });
    } else if (s.lead === "saw") {
      tone(g, { type: "sawtooth", freq: mtof(mel), t, dur: st * 3, gain: 0.022, filter: { freq: 3000 }, detune: -9 });
      tone(g, { type: "sawtooth", freq: mtof(mel), t, dur: st * 3, gain: 0.022, filter: { freq: 3000 }, detune: 9 });
    } else bell(g, mtof(mel), t, st * 5, 0.045);
  }

  // ドラム
  if (s.drums === "beat") {
    if (i % 4 === 0) { // キック
      tone(g, { type: "sine", freq: 130, t, dur: 0.22, gain: 0.28, slideTo: 42 });
    }
    if (i === 4 || i === 12) { // クラップ
      noise(g, { t, dur: 0.12, gain: 0.09, type: "bandpass", freq: 1500, q: 1.2 });
      noise(g, { t: t + 0.012, dur: 0.1, gain: 0.06, type: "bandpass", freq: 1800, q: 1.2 });
    }
    if (i % 2 === 0 || hurry) { // ハイハット
      noise(g, { t, dur: i % 4 === 2 ? 0.05 : 0.025, gain: i % 4 === 2 ? 0.05 : 0.03, freq: 8000 });
    }
  } else if (s.drums === "rock" || s.drums === "metal") {
    const metal = s.drums === "metal";
    const kick = metal ? (i % 2 === 0 || (i >= 12 && hurry)) : [0, 6, 8, 10].includes(i);
    if (kick) tone(g, { type: "sine", freq: 140, t, dur: 0.18, gain: metal ? 0.22 : 0.28, slideTo: 40 });
    if (i === 4 || i === 12) { // スネア
      noise(g, { t, dur: 0.16, gain: 0.12, type: "bandpass", freq: 1900, q: 0.9 });
      tone(g, { type: "triangle", freq: 210, t, dur: 0.1, gain: 0.08, slideTo: 140 });
    }
    if (metal || i % 2 === 0) noise(g, { t, dur: 0.03, gain: i % 4 === 2 ? 0.05 : 0.03, freq: 8500 });
    if (i === 14 && !metal) noise(g, { t, dur: 0.18, gain: 0.04, freq: 6500 }); // オープンハイハット
    if (i === 0 && bar % (metal ? 2 : 4) === 0) noise(g, { t, dur: 1.4, gain: 0.05, freq: 4500 }); // シンバル
  } else if (s.drums === "soft") {
    if (i === 0 || i === 10) tone(g, { type: "sine", freq: 90, t, dur: 0.25, gain: 0.12, slideTo: 45 });
    if (i === 4 || i === 12) noise(g, { t, dur: 0.15, gain: 0.025, type: "bandpass", freq: 2200, q: 0.8 });
    if (i % 2 === 0) noise(g, { t, dur: 0.03, gain: 0.015, freq: 9000 });
  }
}

function startSong(name) {
  const song = SONGS[name];
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
  gain.connect(bgmBus);
  const cur = { name, song, gain, step: 0, nextTime: ctx.currentTime + 0.1, melody: makeMelody(song) };
  const spb = 60 / song.bpm;
  cur.timer = setInterval(() => {
    // タブが裏に回って遅れたときは、たまった音を一度に鳴らさず、今から再開する
    if (cur.nextTime < ctx.currentTime - 0.1) {
      const skip = Math.ceil((ctx.currentTime - cur.nextTime) / (spb / 4));
      cur.step += skip;
      cur.nextTime += skip * (spb / 4);
    }
    while (cur.nextTime < ctx.currentTime + 0.15) {
      const swing = cur.step % 2 === 1 ? song.swing * spb / 4 : 0;
      scheduleStep(cur, cur.step, cur.nextTime + swing);
      cur.step++;
      cur.nextTime += spb / 4;
    }
  }, 30);
  return cur;
}

function stopSong(cur, fade) {
  clearInterval(cur.timer);
  const t = ctx.currentTime;
  cur.gain.gain.cancelScheduledValues(t);
  cur.gain.gain.setValueAtTime(Math.max(cur.gain.gain.value, 0.0001), t);
  cur.gain.gain.exponentialRampToValueAtTime(0.0001, t + (fade || 0.6));
  setTimeout(() => cur.gain.disconnect(), ((fade || 0.6) + 0.5) * 1000);
}

function bgm(name) {
  if (!ctx || ctx.state !== "running") { pendingSong = name; return; }
  if (current && current.name === name) return;
  if (current) { stopSong(current); current = null; }
  hurry = false;
  if (name && SONGS[name]) current = startSong(name);
}

global.Sound = {
  unlock,
  se,
  bgm,
  setHurry(v) { hurry = !!v; },
  setVolume(b, s) { vol.bgm = b; vol.se = s; applyVolume(); },
  setMuted(m) { muted = !!m; applyVolume(); },
  get muted() { return muted; },
};
})(window);
