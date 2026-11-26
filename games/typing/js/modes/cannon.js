/*!
 * modes/cannon.js — りんごキャノン：ボスとのタイピングバトルが中心のモード
 *   1ステージの流れ：アイテムタイム → WARNING → ボス戦 → K.O. → 休憩（スペースキーで次へ）
 *   ・アイテムタイム：6〜8語だけ落ちてくる。★のついた言葉を撃ち落とすとアイテム。落とすとHPが少し減る（ライフは減らない）
 *   ・ボスは5体：ニセチャッピー → ワルチャッピー → メカチャッピー → ゴーストチャッピー → 魔王チャッピー（たおせばゲームクリア）
 *     ボスごとに「必要な速さ」（1秒に打つ数・やさしいの場合）がある：2.2 → 2.8 → 3.4 → 4.2 → 5.0
 *     言葉を打ち切るまでの時間はこの速さから決まり、遅いとボスの大技を受け続ける（魔王は 5.0 くらいないと勝てない）
 *   ・ボス戦：チャッピーとボスのHPが出る。言葉を打ち切るとりんごで攻撃。ミスタイプするとボスの反撃
 *     ボスごとに得意な攻撃パターンがあり、ランダムに出てくる：
 *       ふつう（ゲージがたまると大技。ため中に打ち切ればかわせる）／かくれ文字（よみが消える）／早打ち勝負
 *       れんぞくことば（時間内に3〜4語）／ミサイル（飛んでくる言葉を撃ち落とす。全部落とせばボスがフラフラ）
 *       回復をとめろ（間に合わないとボスが回復）／必殺技（HP70％・怒り・15％のとき。打ち返せばカウンター）
 *     HPが減ると怒りモード（曲が変わり、攻撃が速く・強くなる）
 *     チャッピーのHPが0になるとライフを1つ使って復活。ライフがなくなるとゲームオーバー
 *     HPは次のボス戦に持ちこし、休憩で少し回復する
 *   ・ノーミス優遇：ミスなしで打ち切った言葉が続くほどダメージアップ（最大＋50％、3連続からりんご3連射）。
 *     5語続くごとにHP回復。ボス戦の正確さが95％以上ならボーナス点＋アイテム。アイテムタイムもノーミスなら点数2倍
 *   ・アイテムは Shift＋A で使う（3つまで持てる）
 */
(function (global) {
"use strict";

const LIVES = 3;
const ITEM_WORDS_FIRST = 6;  // 最初のアイテムタイムの言葉の数
const ITEM_WORDS = 8;        // 2回目からのアイテムタイムの言葉の数
const ITEM_RATE = 0.35;
const ITEM_MAX = 3;
const MY_HP = 100;
const REST_HEAL = 40;        // 休憩で回復するHP（HPは次のボス戦に持ちこす）
const DROP_DMG = 5;          // アイテムタイムで言葉を落としたときに減るHP
const STREAK_HEAL = 10;      // ノーミスが5語続くごとに回復するHP
const DMG_PER_CHAR = 2;      // 1文字（ローマ字）あたりのダメージ
const STAGE_SONGS = ["battle", "cannon2", "cannon3"];
const ORDER = ["fake", "evil", "mecha", "ghost", "king"];
// ボスの req は「フリー計測（やさしい）の平均タイプ数」の目安。自動テストで、平均タイプ数5.0前後で魔王に勝てるように合わせた。
// もっときびしく（やさしく）したいときは、この倍率を上げる（下げる）
const REQ_SCALE = 1.1;

const ITEMS = {
  bomb:   { icon: "💥", name: "ばくだん", say: "ばくだん！ 言葉をまとめて吹き飛ばせ！", sayBoss: "ばくだん！ ボスに大ダメージ！" },
  ice:    { icon: "❄️", name: "こおり",   say: "こおり！ しばらくゆっくりになるよ",     sayBoss: "こおり！ ボスの攻撃がゆっくりになったよ" },
  heal:   { icon: "❤️", name: "かいふく", say: "かいふく！ HPがもどったよ",             sayBoss: "かいふく！ HPがもどったよ" },
  shield: { icon: "🛡️", name: "バリア",   say: "バリア！ 次のボスの攻撃を1回ふせぐよ",   sayBoss: "バリア！ 次の攻撃を1回ふせぐよ" },
};
const ITEM_IDS = Object.keys(ITEMS);

const BOSSES = {
  fake: {
    name: "ニセチャッピー", title: "バグから生まれた にせもの", song: "bossFake",
    req: 2.2, words: 10, missDmg: 3, bigDmg: 16, rageAt: 0.4,
    patterns: { normal: 3, hidden: 2, quick: 2 }, missile: "バグ弾",
    intro: ["本物はボクだよ。キミはいらない！", "島ごとコピーしてあげる…！", "また会ったね。今度こそボクが本物だ！"],
    hit: ["ノイズが…！", "バグるっ…！", "コピーが こわれる…！"],
    taunt: ["ミスった？ ボクのほうが本物だね！", "ほらほら、手がとまってるよ？"],
    rage: "もう怒った！ ぜんぶバグらせてやる！", lose: "ボ、ボクがにせもの…だった…", win: "やったー！ これでボクが本物！",
    attackName: "バグ・ビーム", special: "フルコピー・バースト", healLine: "コピーで回復だ！",
  },
  evil: {
    name: "ワルチャッピー", title: "島をねらう 闇のチャッピー", song: "bossEvil",
    req: 2.8, words: 12, missDmg: 4, bigDmg: 20, rageAt: 0.4,
    patterns: { normal: 3, missiles: 2, rush: 2 }, missile: "ほのおの玉",
    intro: ["フハハ！ この島はいただくぜ！", "りんごなど、闇の炎で焼きつくす！", "前のようにはいかんぞ、チャッピー！"],
    hit: ["ぐっ…やるな！", "まだまだぁ！", "なにぃ！？"],
    taunt: ["フハハ、スキだらけだ！", "その程度か、チャッピー！"],
    rage: "本気を出してやる…！ 闇の力よ！", lose: "お、おぼえてろよー！", win: "フハハ！ 島はいただいた！",
    attackName: "ダーク・フレイム", special: "ヘル・インフェルノ", healLine: "闇の炎よ、力をよこせ！",
  },
  mecha: {
    name: "メカチャッピー", title: "ネジとモーターで動く 鋼鉄のコピー", song: "bossMecha",
    req: 3.4, words: 13, missDmg: 4, bigDmg: 22, rageAt: 0.4,
    patterns: { normal: 2, missiles: 3, rush: 2, quick: 1 }, missile: "ミサイル",
    intro: ["ピピッ…ターゲット、チャッピー。排除スル。", "システム起動。タイピング能力ヲ解析中…", "バージョンアップ完了。今度コソ勝ツ。"],
    hit: ["ガガッ…損傷率上昇！", "エラー！ エラー！", "装甲ガ…！"],
    taunt: ["ミスヲ検知。ザンネンデシタ。", "入力エラー、確認。"],
    rage: "リミッター解除…フルパワーモード！", lose: "システム…ダウン…プシュー…", win: "任務完了。島ヲ制圧シマシタ。",
    attackName: "ロケット・パンチ", special: "ギガ・レーザー", healLine: "自動修理プログラム、起動。",
  },
  ghost: {
    name: "ゴーストチャッピー", title: "夜の島をさまよう まぼろし", song: "bossGhost",
    req: 4.2, words: 14, missDmg: 5, bigDmg: 25, rageAt: 0.4,
    patterns: { normal: 2, hidden: 3, heal: 2, quick: 1 }, missile: "おばけ玉",
    intro: ["うらめしや〜… キミのりんご、ちょうだい…", "ふふふ…見えないでしょ…？", "また来たの…？ 今度は消してあげる…"],
    hit: ["ひゃっ…！", "すけてるのに…当たった…！", "うう…成仏しそう…"],
    taunt: ["ふふ…まちがえた…", "こっちだよ〜…"],
    rage: "もう…ゆるさない…！ ぜんぶ闇に…！", lose: "あぁ…成仏…しちゃう…", win: "ふふふ…島は夜のまま…",
    attackName: "ひんやりタッチ", special: "ナイトメア・パレード", healLine: "りんごのパワーを…すいとる…",
  },
  king: {
    name: "魔王チャッピー", title: "すべてのニセモノをたばねる王", song: "bossKing",
    req: 5.0, words: 18, missDmg: 6, bigDmg: 30, rageAt: 0.5,
    patterns: { normal: 2, hidden: 1, quick: 1, rush: 2, missiles: 2, heal: 1 }, missile: "魔王の星",
    intro: ["よくぞここまで来た、チャッピーよ。", "我こそは魔王。ニセモノたちの王である！", "何度来ても同じこと。ひれ伏すがよい！"],
    hit: ["ほう…やるではないか。", "この魔王に傷を…！", "ぐぬぬ…！"],
    taunt: ["遅い、遅すぎる！", "その指で我に勝てるものか！"],
    rage: "よかろう…真の姿を見せてやる！", lose: "ば、ばかな…この魔王が…！", win: "ふはははは！ 島は我のものだ！",
    attackName: "魔王の雷", special: "ダークネス・エンド", healLine: "闇よ、我に力を…！",
  },
};
const bossOf = (stage) => ({ kind: ORDER[(stage - 1) % ORDER.length], lv: 1 + Math.floor((stage - 1) / ORDER.length), idx: (stage - 1) % ORDER.length });

function create(app, opts) {
  const CT = global.CT;
  const lang = opts.lang;
  const listDiff = opts.diff === "easy" ? "easy" : "normal";
  const speedMul = { easy: 0.85, normal: 1, hard: 1.3 }[opts.diff] || 1;
  const reqMul = { easy: 1, normal: 1.15, hard: 1.3 }[opts.diff] || 1.15; // 難しさによって「必要な速さ」を上げる
  const pool = CT.shuffle(CT.wordsFor(lang, listDiff));
  const lenOf = (w) => (w.text != null ? w.text.length : w.kana.length);
  const byLen = pool.slice().sort((a, b) => lenOf(b) - lenOf(a));
  const shortPool = CT.shuffle(byLen.slice(Math.floor(byLen.length * 0.35))); // 早打ち・れんぞく・ミサイル用（短めの言葉）
  let poolIdx = 0, shortIdx = 0;
  const arena = app.arena;
  const words = [];   // アイテムタイムで落ちてくる言葉
  const stats = { correct: 0, miss: 0, words: 0, combo: 0, maxCombo: 0, keyStats: {} };
  let target = null, lives = LIVES, kills = 0, score = 0;
  let stage = 1, bosses = 0, items = [], shield = false, slowUntil = 0, clock = 0, myHp = MY_HP;
  let phase = "items";  // items / warning / intro / battle / ko / rest / over
  let bt = null;         // ボス戦の状態
  let itemLeft = 0, dropsLeft = 0, itemEnding = false, itemBar = null;
  let rest = null;       // 休憩の画面
  let running = false, startAt = 0, raf = 0, lastT = 0, spawnIn = 0.4;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (running) fn(); }, ms); timers.add(id); return id; };

  const itemInterval = () => (lang === "en" ? 1.8 : 2.0) * (1 - Math.min(stage - 1, 10) * 0.04);
  const fallSpeed = () => (arena.clientHeight / 9.5) * speedMul * (1 + Math.min(stage - 1, 12) * 0.06);
  const groundY = () => arena.clientHeight - 175;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const stageSong = () => STAGE_SONGS[(stage - 1) % STAGE_SONGS.length];
  const div = (cls, text) => { const d = document.createElement("div"); d.className = cls; if (text != null) d.textContent = text; return d; };
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };

  function bump(k, field) {
    const name = CT.keyName(k);
    const s = stats.keyStats[name] || (stats.keyStats[name] = { ok: 0, ng: 0 });
    s[field]++;
  }

  function nextWord() {
    for (let i = 0; i < pool.length; i++) {
      const w = pool[poolIdx++ % pool.length];
      if (!words.some((x) => x.w.display === w.display)) return w;
    }
    return pool[poolIdx++ % pool.length];
  }
  function nextShort() {
    const busy = new Set();
    if (bt && bt.ms) bt.ms.list.forEach((m) => busy.add(m.w.display));
    if (bt && bt.word) busy.add(bt.word.w.display);
    for (let i = 0; i < shortPool.length; i++) {
      const w = shortPool[shortIdx++ % shortPool.length];
      if (!busy.has(w.display)) return w;
    }
    return shortPool[shortIdx++ % shortPool.length];
  }

  function makeTyper(w) {
    return w.text != null ? CT.createTyper({ lang: "en", text: w.text }) : CT.createTyper({ lang: "ja", kana: w.kana, pref: global.Store.data.romajiPref });
  }

  function render(item) {
    const t = item.typer, rest = t.rest(), typed = t.typed();
    const parts = [];
    const sp = (cls, txt) => { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = txt; return s; };
    if (item.w.text != null) {
      const d = document.createElement("div");
      d.className = "cn-text";
      d.append(sp("typed", typed), sp("cur" + (item.missFlash ? " miss" : ""), rest[0] === " " ? "␣" : rest[0] || ""), sp("rest", rest.slice(1)));
      parts.push(d);
    } else {
      const d = document.createElement("div");
      d.className = "cn-disp";
      d.textContent = item.w.display;
      const r = document.createElement("div");
      r.className = "cn-roma";
      r.append(sp("typed", typed), sp("cur" + (item.missFlash ? " miss" : ""), rest[0] || ""), sp("rest", rest.slice(1)));
      parts.push(d, r);
    }
    if (item.drop) parts.push(sp("cn-item", ITEMS[item.drop].icon));
    item.el.replaceChildren(...parts);
    item.el.classList.toggle("target", item === target || !!item.isBoss || (!!bt && item === bt.mTarget));
  }

  function remove(item, cls) {
    const i = words.indexOf(item);
    if (i >= 0) words.splice(i, 1);
    if (target === item) target = null;
    item.el.classList.add(cls);
    setTimeout(() => item.el.remove(), 450);
  }

  // ---- HUD ----
  function hearts() {
    return "♥".repeat(Math.max(0, lives)) + "♡".repeat(LIVES - Math.max(0, lives)) + (shield ? " 🛡️" : "");
  }
  function showItems() { app.hud.set("items", items.length ? items.map((id) => ITEMS[id].icon).join("") : "ー"); }
  function showStage() {
    const tag = phase === "items" ? "ITEM" : phase === "rest" ? "REST" : "BOSS";
    app.hud.set("stage", `${stage}-${tag}`);
  }
  function addScore(n) { score += n; app.hud.set("score", score); }

  function gainItem(id, x, y) {
    if (items.length >= ITEM_MAX) { addScore(50); app.floatAt("+50", x, y - 30); return; }
    items.push(id);
    showItems();
    app.floatAt(`${ITEMS[id].icon} ゲット！`, x, y - 30);
    if (!gainItem.told) { gainItem.told = true; app.say("アイテムゲット！ ボス戦で Shift＋A を押すと使えるよ", 2600); }
  }

  // 画面に数字や文字を出す（ダメージなど）
  function pop(text, x, y, cls) {
    const d = div("float-text bt-pop " + (cls || ""), text);
    d.style.left = x + "px"; d.style.top = y + "px";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }
  // 画面をゆらす・光らせる
  const calm = () => (global.Store && global.Store.data.settings.reduceMotion) || (global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function shake(strong) {
    const m = document.querySelector("main");
    if (!m || !m.animate || calm()) return;
    const a = strong ? 14 : 6;
    m.animate([{ transform: "translate(0,0)" }, { transform: `translate(${-a}px,${a / 2}px)` }, { transform: `translate(${a}px,${-a / 2}px)` },
      { transform: `translate(${-a / 2}px,${a / 3}px)` }, { transform: "translate(0,0)" }], { duration: strong ? 420 : 220, easing: "ease-out" });
  }
  function flash(cls) {
    const f = div("bt-flash " + cls);
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ======== アイテムタイム ========
  function startItemTime() {
    phase = "items";
    itemLeft = stage === 1 ? ITEM_WORDS_FIRST : ITEM_WORDS;
    dropsLeft = 2; // 1回のアイテムタイムで、少なくとも2つはアイテムが出る
    itemEnding = false;
    spawnIn = stage === 1 ? 0.4 : 1.2;
    target = null;
    arena.classList.remove("frozen");
    itemBar = div("cn-itembar");
    arena.appendChild(itemBar);
    showItemBar();
    showStage();
    global.Sound.bgm(stageSong());
    if (stage > 1) { app.banner(`STAGE ${stage}`); global.Sound.se("wave"); }
    const nb = bossOf(stage);
    app.say(stage === 1 ? "まずはアイテムタイム！ ★のついた言葉をねらおう" : `アイテムタイム！ 次は ${BOSSES[nb.kind].name} Lv.${nb.lv} だよ`, 2600);
  }

  function showItemBar() {
    if (!itemBar) return;
    const n = itemLeft + words.length;
    itemBar.replaceChildren(
      Object.assign(document.createElement("span"), { textContent: n > 0 ? `⭐ アイテムタイム ・ あと ${n}こ` : "⭐ アイテムタイム おわり！" }),
      Object.assign(document.createElement("b"), { className: myHp <= MY_HP * 0.3 ? "low" : "", textContent: `❤️ HP ${myHp} / ${MY_HP}` }));
  }

  function spawn() {
    const w = nextWord();
    const el = document.createElement("div");
    el.className = "cn-word";
    el.style.left = 10 + Math.random() * 80 + "%";
    arena.appendChild(el);
    let drop = Math.random() < ITEM_RATE ? pick(ITEM_IDS) : null;
    if (!drop && dropsLeft > 0 && itemLeft <= dropsLeft) drop = pick(ITEM_IDS);
    if (drop) dropsLeft = Math.max(0, dropsLeft - 1);
    const item = { w, el, typer: makeTyper(w), y: 0, speed: fallSpeed() * (0.85 + Math.random() * 0.3), missFlash: false, drop, missed: false };
    if (drop) el.classList.add("has-item");
    words.push(item);
    render(item);
    return item;
  }

  function destroy(item) {
    const typedLen = item.typer.typed().length;
    const perfect = !item.missed;
    const pts = (Math.round(typedLen * 10 * (1 + Math.min(stats.combo, 10) * 0.1)) + (stage - 1) * 5) * (perfect ? 2 : 1);
    addScore(pts);
    kills++;
    stats.words++;
    const rect = item.el.getBoundingClientRect();
    words.splice(words.indexOf(item), 1);
    target = null;
    item.el.classList.add("locked");
    const drop = item.drop;
    app.shoot(rect, () => {
      global.Sound.se("pop");
      app.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 16);
      app.floatAt(perfect ? `ノーミス +${pts}` : `+${pts}`, rect.left + rect.width / 2, rect.top);
      if (drop) gainItem(drop, rect.left + rect.width / 2, rect.top);
      item.el.classList.add("boom");
      setTimeout(() => item.el.remove(), 400);
    });
    global.Sound.se("shoot");
    app.chappy.play("nod");
    showItemBar();
  }

  // 下まで落ちた（ライフは減らないが、HPが少し減る。HPは次のボス戦に持ちこす）
  function hitGround(item) {
    stats.combo = 0;
    const c = centerOf(item.el);
    myHp = Math.max(1, myHp - DROP_DMG);
    global.Sound.se("jab");
    pop(`HP -${DROP_DMG}`, c.x, c.y - 10, "hurt");
    app.say(item.drop ? "あっ、アイテムが落ちちゃった！" : pick(["あっ、落ちちゃった！ HPが減ったよ", "おしい！ 次はねらってね"]), 1400);
    remove(item, "fall");
    showItemBar();
  }

  // ======== ボス戦：WARNING → 画面切りかえ → FIGHT! ========
  function startWarning() {
    phase = "warning";
    showStage();
    target = null;
    for (const item of words.slice()) remove(item, "boom");
    if (itemBar) { itemBar.remove(); itemBar = null; }
    arena.classList.remove("frozen");
    global.Sound.bgm(null);
    global.Sound.se("alarm");
    const { kind } = bossOf(stage);
    const w = div("bt-warning" + (kind === "king" ? " king" : ""));
    w.append(div("bt-warn-band"), div("bt-warn-text", "WARNING"), div("bt-warn-sub", kind === "king" ? "とてつもない力が近づいてくる…！" : "なにかが島に近づいている…！"), div("bt-warn-band b2"));
    arena.appendChild(w);
    app.chappy.flashMood("think", 2400);
    later(() => { w.remove(); startBattle(); }, 2600);
  }

  function startBattle() {
    const { kind, lv, idx } = bossOf(stage);
    const def = BOSSES[kind];
    // レベルが上がるほど長い言葉が出る
    const frac = lv <= 1 ? 0.45 : lv === 2 ? 0.3 : 0.2;
    const bpool = CT.shuffle(byLen.slice(0, Math.max(12, Math.ceil(byLen.length * frac))));
    // HP：平均的な言葉で「何語くらいで倒せるか」から決める（言語・難しさが変わっても、戦いの長さがそろう）
    const sample = bpool.slice(0, 30);
    const avgLen = sample.reduce((a, w) => a + makeTyper(w).rest().length, 0) / Math.max(1, sample.length);
    const need = Math.min(40, def.words + (lv - 1) * 5 + idx);
    const maxHp = Math.max(50, Math.round((avgLen * DMG_PER_CHAR * 1.4 * need) / 10) * 10);
    phase = "intro";
    flash("white");
    document.body.dataset.battle = kind;

    const root = div("bt bt-" + kind);
    // HPバー（左：チャッピー、右：ボス）
    const bar = (cls, name) => {
      const side = div("bt-side " + cls);
      const hp = div("bt-hp"); const lag = document.createElement("b"); const fill = document.createElement("i");
      hp.append(lag, fill);
      const num = div("bt-num");
      const nm = div("bt-name", name);
      side.append(nm, hp, num);
      return { side, lag, fill, num, nm };
    };
    const me = bar("me", "チャッピー");
    const foe = bar("foe", `${def.name} Lv.${lv}`);
    const bars = div("bt-bars");
    bars.append(me.side, div("bt-vs", "VS"), foe.side);
    // ボス
    const art = CT.Bosses.make(kind);
    const bossBox = div("bt-boss");
    const cpBox = div("bt-boss-cp");
    cpBox.appendChild(art.el);
    const say = div("bt-say");
    const alert = div("bt-alert", "!");
    bossBox.append(div("bt-aura"), cpBox, alert, say, div("bt-dizzy", "💫"));
    // 攻撃パターンの表示・打つ言葉・ボスの攻撃ゲージ
    const label = div("bt-label");
    const center = div("bt-center");
    const wordEl = div("cn-word bt-word");
    const gauge = div("bt-gauge");
    const gFill = document.createElement("i");
    gauge.append(gFill, div("bt-gauge-label", "ボスのこうげき"));
    const streakEl = div("bt-streak");
    center.append(wordEl, gauge, streakEl);
    // 名前のカットイン
    const cut = div("bt-cutin");
    cut.append(div("bt-cut-title", def.title), div("bt-cut-name", def.name), div("bt-cut-lv", `Lv.${lv}`));

    root.append(bars, bossBox, label, center, cut);
    arena.appendChild(root);

    bt = {
      kind, def, lv, idx, art, root, bossBox, say, alert, label, center, wordEl, gFill, streakEl, me, foe, pool: bpool, poolIdx: 0,
      hp: maxHp, maxHp, myHp, missDmg: def.missDmg + (lv - 1) * 2, bigDmg: def.bigDmg + (lv - 1) * 6,
      req: def.req * REQ_SCALE * reqMul * (1 + (lv - 1) * 0.15), word: null, wordMiss: false, gauge: 0, gaugeTime: 10,
      action: "normal", lastAction: "", charging: 0, frozenUntil: 0, rage: false, sp70: false, sp15: false, pendingSpecial: false,
      stunNext: false, rush: null, ms: null, mTarget: null, hideAt: 0,
      lastJab: -1, guardUntil: 0, tickAt: 0,
      st: { start: 0, end: 0, correct: 0, miss: 0, crit: 0, counter: 0, words: 0, streak: 0, maxStreak: 0 },
    };
    showHp(true);
    showStage();
    global.Sound.se("fight");
    app.chappy.setMood("normal");
    const first = lv === 1;
    const meet = {
      fake: first ? "チャッピーがもう1人！？ にせものだ！" : "またニセチャッピー！ もっと強くなってる！",
      evil: first ? "ワルチャッピーだ！ 島を守るよ！" : "ワルチャッピーがパワーアップしてる！",
      mecha: first ? "ロボットのチャッピー！？ ミサイルに気をつけて！" : "メカチャッピーが改造されてる！",
      ghost: first ? "おばけのチャッピー…！ 文字が消えるかも！" : "ゴーストチャッピーがまた出た…！",
      king: first ? "あれが魔王…！ 全部の技を使ってくるよ！" : "魔王チャッピーが復活した…！",
    }[kind];
    app.say(meet, 2600);
    later(() => bossSay(first ? def.intro[Math.floor(Math.random() * 2)] : def.intro[2], 2400), 700);
    later(() => {
      cut.remove();
      root.classList.add("ready");
      app.banner("FIGHT!");
      global.Sound.se("go");
      global.Sound.bgm(def.song);
      phase = "battle";
      bt.st.start = clock;
      nextAction();
    }, 2300);
  }

  function showHp(instant) {
    if (!bt) return;
    const set = (b, v, max) => {
      const r = Math.max(0, v) / max * 100 + "%";
      b.fill.style.width = r;
      if (instant) b.lag.style.width = r; else setTimeout(() => { b.lag.style.width = r; }, 380);
      b.num.textContent = `HP ${Math.max(0, Math.ceil(v))} / ${max}`;
    };
    set(bt.me, bt.myHp, MY_HP);
    set(bt.foe, bt.hp, bt.maxHp);
    bt.me.side.classList.toggle("pinch", bt.myHp <= MY_HP * 0.3);
    bt.me.nm.textContent = "チャッピー" + (shield ? " 🛡️" : "");
  }

  // ノーミス連続の表示
  const streakBonus = (n) => 1 + 0.1 * Math.min(Math.max(0, n - 1), 5);
  function showStreak() {
    if (!bt) return;
    const n = bt.st.streak;
    bt.streakEl.textContent = n >= 1 ? `✨ ノーミス ${n}れんぞく ・ 次の言葉はダメージ +${Math.round((1.5 * streakBonus(n + 1) - 1) * 100)}%` : "";
    bt.streakEl.classList.toggle("hot", n >= 3);
  }

  function bossSay(text, ms) {
    if (!bt) return;
    bt.say.textContent = text;
    restart(bt.say, "pop");
    clearTimeout(bt.sayTimer);
    bt.sayTimer = setTimeout(() => { if (bt) bt.say.textContent = ""; }, ms || 1800);
  }

  function setLabel(type, a, b) {
    if (!bt) return;
    const d = bt.def;
    const hide = lang === "en" ? "👻 かくれ文字！ つづりを覚えて打て！" : "👻 かくれ文字！ よみを覚えて打て！";
    const text = {
      special: `💥 必殺技「${d.special}」がくる！ 打ち返せ！`,
      hidden: hide,
      quick: "⚡ 早打ち勝負！ すぐに打て！",
      heal: "💚 ボスが回復しようとしている！ 止めろ！",
      stun: "💫 ボスがフラフラ！ チャンス！（ダメージ1.5倍）",
      rush: `🔥 れんぞくことば ${a}/${b}！ 時間内に全部打て！`,
      missiles: `🚀 ${d.missile}を撃ち落とせ！ のこり ${a}`,
    }[type] || "";
    bt.label.textContent = text;
    bt.label.className = "bt-label" + (text ? " on act-" + type : "");
  }

  function nextBossWord() {
    const p = bt.pool;
    for (let i = 0; i < p.length; i++) {
      const w = p[bt.poolIdx++ % p.length];
      if (bt.lastWord !== w.display) return w;
    }
    return p[bt.poolIdx++ % p.length];
  }

  // 「必要な速さ」で打ち切ったときの時間（反応のよゆう 0.3秒をふくむ）
  const reqNow = (mul) => bt.req * (bt.rage ? 1.06 : 1) * (mul || 1);
  const deadline = (chars, mul) => chars / reqNow(mul) + 0.3;
  // ゲージがたまるまでの時間（このあと「ため」が 0.8秒あるので、そのぶん引く）
  const gaugeFor = (chars, mul, charge) => Math.max(0.7, deadline(chars, mul) - (charge == null ? 0.8 : charge));

  // 次のボスの行動を決める
  function chooseAction() {
    if (bt.pendingSpecial) { bt.pendingSpecial = false; return "special"; }
    if (bt.stunNext) { bt.stunNext = false; return "stun"; }
    if (bt.st.words < 2) return "normal";
    const rate = Math.min(0.78, 0.42 + (bt.lv - 1) * 0.12 + bt.idx * 0.03 + (bt.rage ? 0.1 : 0));
    if (Math.random() > rate) return "normal";
    const list = Object.entries(bt.def.patterns).filter(([k]) => k !== "normal" && k !== bt.lastAction);
    const total = list.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of list) { if ((r -= w) <= 0) return k; }
    return "normal";
  }

  function nextAction() {
    if (!bt || phase !== "battle") return;
    const type = chooseAction();
    bt.action = type;
    bt.lastAction = type;
    if (type !== "stun") bt.bossBox.classList.remove("dizzy");
    if (bt.kind === "ghost" && Math.random() < 0.55) warpBoss();
    if (type === "missiles") return startMissiles();
    if (type === "rush") return startRush();
    newWord(type);
  }

  function newWord(type, given) {
    let w = given;
    if (!w) {
      if (type === "quick") w = nextShort();
      else {
        w = nextBossWord();
        if (type === "special") { for (let i = 0; i < 5; i++) { const c = nextBossWord(); if (lenOf(c) > lenOf(w)) w = c; } } // 必殺技は長い言葉
      }
    }
    const item = { w, el: bt.wordEl, typer: makeTyper(w), missFlash: false, isBoss: true };
    bt.word = item;
    bt.lastWord = w.display;
    bt.wordMiss = false;
    bt.hideAt = 0;
    // ゲージがたまるまでの時間：「必要な速さ」で打ち切れる時間
    const chars = item.typer.rest().length;
    if (type !== "rush") {
      let gt = gaugeFor(chars);
      if (type === "special") gt = gaugeFor(chars, 1.05);
      if (type === "hidden") { gt = gaugeFor(chars) + 0.6; bt.hideAt = clock + 1.0; }
      if (type === "quick") gt = gaugeFor(chars, 1.25, 0.35);
      if (type === "stun") gt = gaugeFor(chars) + 0.8;
      if (type === "heal") gt = deadline(chars); // 回復は「ため」がないので、そのまま
      bt.gaugeTime = gt;
      bt.gauge = 0;
    }
    bt.charging = 0;
    bt.alert.classList.remove("on");
    bt.bossBox.classList.remove("charge");
    if (type !== "rush") setLabel(type);
    bt.center.classList.remove("away");
    bt.wordEl.className = "cn-word bt-word" + (type !== "normal" ? " act-" + type : "");
    restart(bt.wordEl, "in");
    render(item);
    if (type === "special") { global.Sound.se("charge"); bossSay(`必殺技…「${bt.def.special}」！`, 2200); }
    else if (type === "quick") { global.Sound.se("count"); bossSay("早打ちで勝負だ！", 1200); }
    else if (type === "heal") { global.Sound.se("heal"); bossSay(bt.def.healLine, 1800); bt.bossBox.classList.add("healing"); }
    else if (type === "hidden") bossSay(bt.kind === "ghost" ? "ふふ…文字が消えていく…" : "ノイズで よみを消してやる！", 1600);
    if (type !== "heal") bt.bossBox.classList.remove("healing");
  }

  function startRush() {
    const n = bt.lv >= 3 ? 4 : 3;
    const list = [];
    for (let i = 0; i < n; i++) list.push(nextShort());
    const chars = list.reduce((a, w) => a + makeTyper(w).rest().length, 0);
    bt.rush = { list, i: 0, n };
    bt.gaugeTime = Math.max(1, chars / reqNow() + 0.3 * n - 0.8);
    bt.gauge = 0;
    setLabel("rush", 1, n);
    bossSay(bt.kind === "mecha" ? "連続攻撃モード、起動！" : "れんぞくで行くぞ！", 1400);
    newWord("rush", list[0]);
  }

  // ---- ミサイル：飛んでくる言葉を撃ち落とす ----
  function startMissiles() {
    bt.word = null;
    bt.center.classList.add("away");
    const n = Math.min(6, 1 + bt.lv + (bt.idx >= 2 ? 1 : 0) + (bt.rage ? 1 : 0));
    bt.ms = { left: n, total: n, list: [], next: 0.5, hits: 0 };
    bt.mTarget = null;
    setLabel("missiles", n);
    bossSay(`くらえ、${bt.def.missile}！`, 1400);
  }

  function launchMissile() {
    const w = nextShort();
    const el = div("cn-word bt-missile m-" + bt.kind);
    bt.root.appendChild(el);
    const rr = bt.root.getBoundingClientRect();
    const from = centerOf(bt.art.el), to = centerOf(app.chappy.el);
    const m = {
      w, el, typer: makeTyper(w), missFlash: false, missed: false, t: 0,
      sx: from.x - rr.left + (Math.random() - 0.5) * 120, sy: from.y - rr.top + (Math.random() - 0.5) * 100,
      ex: to.x - rr.left + 30 + (Math.random() - 0.5) * 60, ey: to.y - rr.top - 40 + (Math.random() - 0.5) * 40, arc: 40 + Math.random() * 110,
    };
    const chars = m.typer.rest().length;
    m.dur = chars / reqNow() + 1.3; // 発射から当たるまで
    bt.ms.list.push(m);
    bt.ms.left--;
    render(m);
    placeMissile(m);
    global.Sound.se("launch");
    restart(bt.bossBox, "jab");
  }

  function placeMissile(m) {
    const t = Math.min(1, m.t);
    const x = m.sx + (m.ex - m.sx) * t;
    const y = m.sy + (m.ey - m.sy) * t - Math.sin(Math.PI * t) * m.arc;
    m.el.style.left = x + "px"; m.el.style.top = y + "px";
  }

  function missileHit(m) {
    bt.ms.list.splice(bt.ms.list.indexOf(m), 1);
    if (bt.mTarget === m) bt.mTarget = null;
    bt.ms.hits++;
    m.el.classList.add("boom");
    setTimeout(() => m.el.remove(), 400);
    const c = centerOf(app.chappy.el);
    app.burstAt(c.x, c.y - 40, 14);
    hurtMe(Math.round(bt.bigDmg * 0.45 * (bt.rage ? 1.2 : 1)), true);
    if (bt && bt.ms) setLabel("missiles", bt.ms.left + bt.ms.list.length);
  }

  function missileShot(m) {
    bt.ms.list.splice(bt.ms.list.indexOf(m), 1);
    bt.mTarget = null;
    const perfect = !m.missed;
    bt.st.words++;
    if (perfect) { bt.st.crit++; bt.st.streak++; bt.st.maxStreak = Math.max(bt.st.maxStreak, bt.st.streak); } else bt.st.streak = 0;
    showStreak();
    addScore(m.typer.typed().length * (perfect ? 30 : 15));
    stats.words++;
    const rect = m.el.getBoundingClientRect();
    m.el.classList.add("locked");
    app.shoot(rect, () => {
      global.Sound.se("pop");
      app.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 16);
      m.el.classList.add("boom");
      setTimeout(() => m.el.remove(), 400);
    });
    global.Sound.se("shoot");
    app.chappy.play("nod");
    setLabel("missiles", bt.ms.left + bt.ms.list.length);
  }

  function endMissiles() {
    const allShot = bt.ms.hits === 0;
    bt.ms = null;
    bt.mTarget = null;
    if (allShot) {
      bt.stunNext = true;
      bt.bossBox.classList.add("dizzy");
      bt.art.face("hurt");
      global.Sound.se("stun");
      const c = centerOf(bt.art.el);
      pop("全弾げきつい！", c.x - 60, c.r.top, "good");
      bossSay(pick(bt.def.hit), 1400);
    }
    later(nextAction, allShot ? 700 : 500);
  }

  function warpBoss() {
    const b = bt.bossBox;
    restart(b, "warp");
    global.Sound.se("warp");
    setTimeout(() => {
      if (!bt || bt.bossBox !== b) return;
      b.style.right = 3 + Math.random() * 14 + "%";
      b.style.top = 64 + Math.random() * 70 + "px";
    }, 220);
  }

  // チャッピーの攻撃（言葉を打ち切った）
  function playerAttack() {
    const type = bt.action;
    const crit = !bt.wordMiss;
    const len = bt.word.typer.typed().length;
    // ノーミスで打ち切った言葉が続くほど強くなる（ミスすると0にもどる）
    if (crit) bt.st.streak++; else bt.st.streak = 0;
    bt.st.maxStreak = Math.max(bt.st.maxStreak, bt.st.streak);
    let mul = crit ? 1.5 * streakBonus(bt.st.streak) : 1;
    let tag = "";
    const rushLast = type === "rush" && bt.rush && bt.rush.i >= bt.rush.n - 1;
    if (type === "special") { mul *= 2; tag = "COUNTER!"; bt.st.counter++; }
    else if (type === "hidden") { mul *= 1.3; tag = "かくれ文字クリア！"; }
    else if (type === "quick") { mul *= 2; tag = "早打ち勝利！"; }
    else if (type === "heal") { mul *= 1.2; tag = "回復をとめた！"; }
    else if (type === "stun") { mul *= 1.5; tag = "チャンス！"; }
    else if (type === "rush") { mul *= rushLast ? 1.5 : 0.7; if (rushLast) tag = "れんぞく成功！"; }
    const dmg = Math.max(1, Math.round(len * DMG_PER_CHAR * mul));
    addScore(dmg * (crit ? 15 : 10));
    stats.words++;
    bt.st.words++;
    if (crit) bt.st.crit++;
    showStreak();
    // ノーミスが5語続くごとにHP回復
    if (crit && bt.st.streak % 5 === 0) {
      const before = bt.myHp;
      bt.myHp = Math.min(MY_HP, bt.myHp + STREAK_HEAL);
      const cc = centerOf(app.chappy.el);
      pop(`ノーミス ${bt.st.streak}れんぞく！ HP +${bt.myHp - before}`, cc.x + 40, cc.r.top - 30, "good");
      global.Sound.se("star");
      showHp();
    }
    const dodged = bt.charging > 0;
    if (dodged) {
      bt.charging = 0;
      bt.alert.classList.remove("on");
      bt.bossBox.classList.remove("charge");
      global.Sound.se("dodge");
      const c = centerOf(app.chappy.el);
      pop("かわした！", c.x, c.r.top - 10, "good");
      addScore(100);
    }
    // れんぞくことばは、すぐに次の言葉へ
    const rushNext = type === "rush" && bt.rush && !rushLast;
    if (rushNext) {
      bt.rush.i++;
      setLabel("rush", bt.rush.i + 1, bt.rush.n);
      newWord("rush", bt.rush.list[bt.rush.i]);
    } else {
      bt.word = null; // 撃っているあいだは打てない
      if (type === "rush") bt.rush = null;
      bt.bossBox.classList.remove("healing");
      bt.wordEl.classList.add("boom");
    }
    // りんごを撃つ（ノーミス3連続から3連射）
    const aim = bt.art.el;
    const shots = crit && bt.st.streak >= 3 ? 3 : 1;
    const hit = () => {
      if (!bt || phase !== "battle") return;
      global.Sound.se(crit || tag ? "crit" : "bossHit");
      const c = centerOf(aim);
      if (tag) { pop(tag, c.x, c.r.top - 20, "crit"); flash("gold"); if (type === "special") global.Sound.se("dodge"); }
      else if (crit) { pop(bt.st.streak >= 2 ? `CRITICAL ×${bt.st.streak}!` : "CRITICAL!", c.x, c.r.top - 20, "crit"); flash("gold"); }
      damageBoss(dmg, crit || !!tag);
      if (!rushNext && phase === "battle") later(nextAction, 280);
    };
    for (let k = 0; k < shots; k++) {
      const last = k === shots - 1;
      setTimeout(() => { if (bt) app.shoot(aim.getBoundingClientRect(), last ? hit : () => {}); }, k * 80);
    }
    global.Sound.se("shoot");
    app.chappy.play("jump");
  }

  function damageBoss(dmg, big) {
    if (!bt) return;
    bt.hp = Math.max(0, bt.hp - dmg);
    const c = centerOf(bt.art.el);
    pop(String(dmg), c.x + (Math.random() - 0.5) * 60, c.y - 30, big ? "dmg big" : "dmg");
    app.burstAt(c.x, c.y, big ? 30 : 18);
    shake(big);
    restart(bt.bossBox, "hurt");
    bt.art.face("hurt");
    clearTimeout(bt.faceTimer);
    bt.faceTimer = setTimeout(() => bt && phase === "battle" && !bt.bossBox.classList.contains("dizzy") && bt.art.face("normal"), 450);
    showHp();
    if (bt.hp <= 0) { bossKO(); return; }
    if (!bt.rage && bt.hp <= bt.maxHp * bt.def.rageAt) { enrage(); return; }
    if (!bt.sp70 && bt.hp <= bt.maxHp * 0.7) { bt.sp70 = true; bt.pendingSpecial = true; return; }
    if (bt.rage && !bt.sp15 && bt.hp <= bt.maxHp * 0.15) { bt.sp15 = true; bt.pendingSpecial = true; bossSay("まだだ…最後の力で…！", 1600); return; }
    if (Math.random() < 0.4) bossSay(pick(bt.def.hit), 1300);
  }

  function enrage() {
    bt.rage = true;
    bt.sp70 = true;
    bt.pendingSpecial = true; // 怒ったら、すぐに必殺技
    bt.root.classList.add("rage");
    global.Sound.se("rage");
    global.Sound.bgm("bossRage");
    bossSay(bt.def.rage, 2000);
    app.banner("怒りモード！");
    shake(true);
    flash("red");
    app.say("ボスが怒った！ 攻撃が速くなるよ！", 2200);
  }

  // ボスの攻撃：ミスタイプの反撃（小）
  function bossJab() {
    const dmg = bt.missDmg + (bt.rage ? 1 : 0);
    const showFx = clock - bt.lastJab > 0.18;
    bt.lastJab = clock;
    if (showFx) {
      restart(bt.bossBox, "jab");
      fireShot(false);
      if (Math.random() < 0.25) bossSay(pick(bt.def.taunt), 1400);
    }
    hurtMe(dmg, false);
  }

  // ボスが回復する（「回復をとめろ」に間に合わなかった）
  function bossHeal() {
    const amt = Math.round(bt.maxHp * (0.1 + bt.lv * 0.02));
    bt.hp = Math.min(bt.maxHp, bt.hp + amt);
    bt.word = null;
    bt.gauge = 0;
    bt.wordEl.classList.add("boom");
    bt.bossBox.classList.remove("healing");
    restart(bt.bossBox, "healed");
    global.Sound.se("heal");
    const c = centerOf(bt.art.el);
    pop(`+${amt}`, c.x, c.y - 30, "heal");
    bossSay("ふっかつ〜！", 1200);
    showHp();
    setLabel("");
    later(nextAction, 800);
  }

  // ボスの攻撃：ゲージがたまったときの大技（必殺技のときは、もっと強い）
  function bossBigAttack() {
    const sp = bt.action === "special";
    const wasRush = bt.action === "rush";
    bt.charging = 0;
    bt.alert.classList.remove("on");
    restart(bt.bossBox, "lunge");
    bt.bossBox.classList.remove("charge");
    global.Sound.se("blast");
    bossSay(`${sp ? bt.def.special : bt.def.attackName}！`, 1200);
    fireShot(true);
    if (sp) flash("red");
    const dmg = Math.round(bt.bigDmg * (bt.rage ? 1.3 : 1) * (sp ? 1.6 : 1));
    later(() => { if (bt && phase === "battle") hurtMe(dmg, true); }, 260);
    bt.gauge = 0;
    if (wasRush) {
      // れんぞく失敗：言葉を消して、次の行動へ
      bt.rush = null;
      bt.word = null;
      bt.wordEl.classList.add("boom");
      setLabel("");
      later(nextAction, 1000);
      return;
    }
    // 言葉はそのまま。ふつうの言葉にもどして続ける
    bt.action = "normal";
    setLabel("");
    bt.wordEl.classList.remove("hide", "act-special", "act-quick", "act-hidden", "act-stun");
    const chars = bt.word ? bt.word.typer.rest().length : 6;
    bt.gaugeTime = gaugeFor(chars); // 残りの文字を「必要な速さ」で打てないと、また攻撃される
  }

  function fireShot(big) {
    const from = centerOf(bt.art.el), to = centerOf(app.chappy.el);
    const s = div("bt-shot " + bt.kind + (big ? " big" : ""));
    s.style.left = from.x + "px"; s.style.top = from.y + "px";
    document.body.appendChild(s);
    if (!s.animate) { s.remove(); return; }
    const anim = s.animate([
      { transform: "translate(-50%,-50%) scale(.6)" },
      { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(${big ? 1.6 : 1})` },
    ], { duration: big ? 260 : 170, easing: "cubic-bezier(.5,0,.8,.6)" });
    anim.onfinish = () => s.remove();
  }

  function hurtMe(dmg, big) {
    if (!bt) return;
    if (clock < bt.guardUntil) return; // 復活した直後は少しだけ無敵
    const c = centerOf(app.chappy.el);
    if (shield) {
      shield = false;
      global.Sound.se("guard");
      pop("ガード！", c.x, c.r.top - 10, "good");
      app.hud.set("lives", hearts());
      showHp();
      return;
    }
    bt.myHp -= dmg;
    stats.combo = 0;
    global.Sound.se(big ? "hit" : "jab");
    pop(`-${dmg}`, c.x + (Math.random() - 0.5) * 40, c.r.top + 10, big ? "hurt big" : "hurt");
    app.chappy.play("oops");
    app.chappy.flashMood("think", big ? 900 : 450);
    shake(big);
    flash(big ? "red" : "red soft");
    showHp();
    if (big) app.say(pick(["いたたっ！", "まけないぞ！", "うわっ！"]), 1200);
    if (bt.myHp <= 0) {
      lives--;
      app.hud.set("lives", hearts());
      if (lives <= 0) { gameOver(); return; }
      bt.myHp = MY_HP;
      bt.guardUntil = clock + 1.5;
      showHp(true);
      global.Sound.se("star");
      app.banner("ピンチ！");
      app.say(`ライフを1つ使って復活！ のこり ${"♥".repeat(lives)}`, 2400);
      app.chappy.play("jump");
    }
  }

  function bossKO() {
    phase = "ko";
    const b = bt;
    bosses++;
    b.st.end = clock;
    myHp = Math.max(1, b.myHp);
    b.word = null;
    b.charging = 0;
    if (b.ms) { b.ms.list.forEach((m) => { m.el.classList.add("boom"); setTimeout(() => m.el.remove(), 400); }); b.ms = null; }
    b.alert.classList.remove("on");
    b.label.className = "bt-label";
    b.bossBox.classList.remove("charge", "hurt", "dizzy", "healing");
    b.art.face("ko");
    b.bossBox.classList.add("ko");
    b.wordEl.classList.add("boom");
    clearTimeout(b.sayTimer);
    b.say.textContent = b.def.lose;
    global.Sound.bgm(null);
    global.Sound.se("ko");
    flash("white");
    shake(true);
    app.banner("K.O.!");
    const c = centerOf(b.art.el);
    app.burstAt(c.x, c.y, 50);
    later(() => {
      global.Sound.se("fanfare");
      const bonus = 400 * stage + Math.max(0, Math.round(b.myHp)) * 5;
      addScore(bonus);
      pop(`BOSS BONUS +${bonus}`, window.innerWidth / 2, window.innerHeight * 0.42, "bonus");
      // 正確さボーナス（ミスが少ないほどお得）
      const acc = b.st.correct + b.st.miss ? b.st.correct / (b.st.correct + b.st.miss) : 1;
      b.accBonus = acc >= 0.98 ? 1000 * stage : acc >= 0.95 ? 500 * stage : 0;
      if (b.accBonus) {
        addScore(b.accBonus);
        setTimeout(() => pop(`${acc >= 0.98 ? "パーフェクト" : "正確さ"}ボーナス +${b.accBonus}`, window.innerWidth / 2, window.innerHeight * 0.52, "bonus"), 600);
        setTimeout(() => gainItem(pick(ITEM_IDS), window.innerWidth / 2, window.innerHeight * 0.6), 900);
      }
      if (lives < LIVES) { lives++; app.hud.set("lives", hearts()); }
      app.chappy.play("jump");
      app.chappy.flashMood("happy", 2600);
      app.say(`${b.def.name}をやっつけた！`, 2400);
    }, 1300);
    later(b.kind === "king" ? gameClear : showRest, 4000);
  }

  // ======== ゲームクリア（魔王をたおした） ========
  function gameClear() {
    phase = "over";
    if (bt) { bt.root.classList.add("leave"); }
    delete document.body.dataset.battle;
    flash("white");
    global.Sound.bgm(null);
    global.Sound.se("record");
    app.chappy.setMood("happy");
    app.chappy.play("jump");
    const c = centerOf(app.chappy.el);
    app.burstAt(window.innerWidth / 2, window.innerHeight / 2, 60);
    app.burstAt(c.x, c.y, 30);
    finishGame(true);
  }

  // ======== 休憩：バトルの成績を見て、ひと休み。スペースキーで次へ ========
  function showRest() {
    const b = bt;
    if (b) {
      clearTimeout(b.sayTimer); clearTimeout(b.faceTimer);
      const r = b.root;
      r.classList.add("leave");
      setTimeout(() => r.remove(), 500);
    }
    bt = null;
    flash("white");
    delete document.body.dataset.battle;
    phase = "rest";
    showStage();
    global.Sound.bgm("rest");
    const st = b ? b.st : { start: 0, end: 1, correct: 0, miss: 0, crit: 0, counter: 0, words: 0, maxStreak: 0 };
    const sec = Math.max(1, Math.round(st.end - st.start));
    const kpm = Math.round((st.correct / sec) * 60);
    const acc = st.correct + st.miss ? Math.round((st.correct / (st.correct + st.miss)) * 1000) / 10 : 100;
    const nb = bossOf(stage + 1);
    const before = myHp;
    myHp = Math.min(MY_HP, myHp + REST_HEAL);
    const panel = div("bt-rest");
    const statsEl = document.createElement("dl");
    for (const [k, v] of [["たたかった時間", `${sec}秒`], ["速さ", `${kpm} 打/分`], ["正確さ", `${acc}%`], ["ノーミスの言葉", `${st.crit} / ${st.words || 0}`], ["最高ノーミス連続", `${st.maxStreak || 0}`]]) {
      const d = document.createElement("div");
      d.append(Object.assign(document.createElement("dt"), { textContent: k }), Object.assign(document.createElement("dd"), { textContent: v }));
      statsEl.appendChild(d);
    }
    const lap = nb.idx === 0 && stage >= ORDER.length;
    panel.append(
      div("bt-rest-head", `STAGE ${stage} CLEAR!`),
      div("bt-rest-sub", b ? `${b.def.name} Lv.${b.lv} をたおした！ おつかれさま、手をぶらぶらさせてひと休みしよう` : ""),
      b && b.accBonus ? div("bt-rest-bonus", `🎯 正確さボーナス +${b.accBonus} と アイテムをゲット！`) : div("bt-rest-bonus off", "🎯 正確さ95％以上で、正確さボーナス＋アイテム！"),
      statsEl,
      div("bt-rest-heal", myHp > before ? `❤️ 休憩でHPが ${myHp - before} 回復！（いま ${myHp} / ${MY_HP}）` : `❤️ HPは満タン！（${myHp} / ${MY_HP}）`),
      div("bt-rest-tip", restTip(acc, st)),
      div("bt-rest-next", (nb.kind === "king" ? "👑 いよいよ最後の戦い！ 魔王をたおせばゲームクリア！ " : lap ? "🔥 ここから次の周！ ボスがみんなレベルアップ！ " : "") + `つぎ ▸ アイテムタイム → ${BOSSES[nb.kind].name}`),
      div("bt-rest-go", "スペースキーで つぎへ"),
    );
    arena.appendChild(panel);
    rest = { panel, readyAt: clock + 1.5 };
    later(() => { if (rest && rest.panel === panel) panel.classList.add("ready"); }, 1500);
    document.body.dataset.rest = "1"; // チャッピーを左へよけて、パネルと重ならないようにする
    app.chappy.setMood("happy");
  }

  function restTip(acc, st) {
    if (acc < 85) return "💡 ミスタイプが多めだったよ。ゆっくり正確に打つと、ボスの反撃が減るよ";
    if ((st.maxStreak || 0) < 3) return "💡 ミスなしの言葉が続くほどダメージアップ！ 5語続けばHPも回復するよ";
    if (!st.counter) return "💡 必殺技の言葉を打ち返すと、カウンターで2倍のダメージ！";
    return pick(["💡 ミサイルを全部撃ち落とすと、ボスがフラフラになってチャンス！", "💡 かくれ文字は、消える前によみを覚えるのがコツ！", "💡 いい調子！ 次のボスはもっと強いよ。アイテムも集めておこう"]);
  }

  function leaveRest() {
    if (!rest) return;
    const p = rest.panel;
    p.classList.add("leave");
    setTimeout(() => p.remove(), 400);
    rest = null;
    delete document.body.dataset.rest;
    global.Sound.se("click");
    app.chappy.setMood("normal");
    stage++;
    startItemTime();
  }

  // ======== アイテム ========
  function useItem() {
    if (phase !== "items" && phase !== "battle") return;
    const id = items.shift();
    if (!id) { app.say("アイテムを持っていないよ。★のついた言葉をねらおう", 1800); return; }
    showItems();
    const it = ITEMS[id];
    global.Sound.se("star");
    app.say(bt ? it.sayBoss : it.say, 1800);
    const cr = centerOf(app.chappy.el);
    app.floatAt(it.icon, cr.x, cr.r.top - 20);
    if (bt) {
      if (id === "bomb") {
        global.Sound.se("blast");
        if (bt.ms) { // ミサイルもまとめて吹き飛ばす
          bt.ms.list.forEach((m) => { const c = centerOf(m.el); app.burstAt(c.x, c.y, 12); m.el.classList.add("boom"); setTimeout(() => m.el.remove(), 400); });
          bt.ms.list = []; bt.ms.left = 0; bt.mTarget = null;
        }
        damageBoss(Math.round(bt.maxHp * 0.12), true);
      } else if (id === "ice") { bt.frozenUntil = clock + 6; bt.root.classList.add("frozen"); }
      else if (id === "heal") { bt.myHp = Math.min(MY_HP, bt.myHp + 35); showHp(); }
      else if (id === "shield") { shield = true; app.hud.set("lives", hearts()); showHp(); }
      return;
    }
    if (id === "bomb") {
      for (const item of words.slice()) {
        const c = centerOf(item.el);
        addScore(20); kills++;
        app.burstAt(c.x, c.y, 12);
        if (item.drop) gainItem(item.drop, c.x, c.y);
        remove(item, "boom");
      }
      global.Sound.se("pop");
      showItemBar();
    } else if (id === "ice") {
      slowUntil = clock + 6;
      arena.classList.add("frozen");
    } else if (id === "heal") {
      myHp = Math.min(MY_HP, myHp + 35);
      showItemBar();
    } else if (id === "shield") {
      shield = true;
      app.hud.set("lives", hearts());
    }
  }

  // ======== 毎フレーム ========
  function loop(t) {
    if (!running) return;
    const now = t / 1000;
    const dt = Math.min(0.1, lastT ? now - lastT : 0.016); // 描画が遅いパソコンでも、落ちる速さは同じ
    lastT = now;
    clock += dt;
    if (phase === "items") {
      const slow = clock < slowUntil ? 0.4 : 1;
      if (slow === 1 && arena.classList.contains("frozen")) arena.classList.remove("frozen");
      spawnIn -= dt * slow;
      if (itemLeft > 0 && spawnIn <= 0 && words.length < 5) { spawn(); itemLeft--; spawnIn = itemInterval(); showItemBar(); }
      const g = groundY();
      for (const item of words.slice()) {
        item.y += item.speed * dt * slow * (item === target ? 0.7 : 1); // ねらった言葉は少しゆっくり
        item.el.style.transform = `translate(-50%, ${item.y}px)`;
        if (item.y >= g) hitGround(item);
      }
      if (itemLeft === 0 && words.length === 0 && !itemEnding) { itemEnding = true; later(startWarning, 900); }
    } else if (phase === "battle" && bt) {
      battleTick(dt);
      if (!running) return;
    }
    const el = (performance.now() - startAt) / 1000;
    app.hud.set("speed", CT.summarize(stats, Math.max(el, 1), lang).kpm);
    raf = requestAnimationFrame(loop);
  }

  function battleTick(dt) {
    const frozen = clock < bt.frozenUntil;
    if (!frozen && bt.root.classList.contains("frozen")) bt.root.classList.remove("frozen");
    // ミサイル
    if (bt.ms) {
      const ms = bt.ms;
      ms.next -= dt * (frozen ? 0.35 : 1);
      if (ms.left > 0 && ms.next <= 0) { launchMissile(); ms.next = bt.rage ? 0.8 : 1.0; }
      for (const m of ms.list.slice()) {
        m.t += (dt * (frozen ? 0.35 : 1) * (m === bt.mTarget ? 0.75 : 1)) / m.dur;
        placeMissile(m);
        if (m.t >= 1) { missileHit(m); if (!bt || !running) return; }
      }
      if (bt.ms && bt.ms.left === 0 && bt.ms.list.length === 0) endMissiles();
      return;
    }
    // かくれ文字：少したったら よみを消す
    if (bt.hideAt && clock >= bt.hideAt && bt.word) { bt.wordEl.classList.add("hide"); bt.hideAt = 0; }
    if (bt.charging > 0) {
      bt.charging -= dt;
      if (bt.charging <= 0) bossBigAttack();
    } else if (bt.word && !frozen) {
      bt.gauge += dt / bt.gaugeTime;
      if (bt.gauge >= 1) {
        bt.gauge = 1;
        if (bt.action === "heal") { bossHeal(); return; }
        bt.charging = bt.action === "quick" ? 0.35 : 0.8; // ため（このあいだに打ち切れば、かわせる）
        bt.alert.classList.add("on");
        bt.bossBox.classList.add("charge");
        global.Sound.se("charge");
      } else if (bt.gauge > 0.7 && clock - bt.tickAt > 0.5) {
        bt.tickAt = clock;
        global.Sound.se("tick");
      }
    }
    if (!bt) return;
    bt.gFill.style.width = Math.min(100, bt.gauge * 100) + "%";
    bt.gFill.parentNode.classList.toggle("warn", bt.gauge > 0.7);
    bt.gFill.parentNode.classList.toggle("heal", bt.action === "heal");
  }

  function gameOver() {
    phase = "over";
    running = false;
    cancelAnimationFrame(raf);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const item of words.slice()) remove(item, "fall");
    if (bt) {
      bt.art.face("normal");
      bt.alert.classList.remove("on");
      bt.bossBox.classList.remove("charge", "dizzy", "healing");
      bt.bossBox.classList.add("win");
      bossSay(bt.def.win, 3000);
    }
    global.Sound.bgm(null);
    global.Sound.se("gameover");
    app.chappy.setMood("sleep");
    finishGame(false);
  }

  function finishGame(clear) {
    running = false;
    cancelAnimationFrame(raf);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    const el = (performance.now() - startAt) / 1000;
    const sum = CT.summarize(stats, el, lang);
    app.flashWord(clear ? "ゲームクリア！" : "ゲームオーバー", () => {
      delete document.body.dataset.battle;
      delete document.body.dataset.rest;
      app.chappy.setMood("normal");
      app.finish({
        mode: "cannon", lang, diff: opts.diff, bestKey: `cannon:${lang}:${opts.diff}`,
        headType: "score", score, wave: stage, kills, stage, bosses, clear: !!clear, ...sum,
        miss: stats.miss, correct: stats.correct, words: kills, maxCombo: stats.maxCombo,
        keyStats: stats.keyStats, seconds: Math.round(el), date: Date.now(),
      });
    });
  }

  function typeInto(item, key) {
    const exp = item.typer.expected();
    const ok = item.typer.input(key).ok;
    if (!ok) bump(exp, "ng");
    return ok;
  }

  function battleMiss(item) {
    stats.miss++;
    stats.combo = 0;
    bt.st.miss++;
    if (bt.st.streak) { bt.st.streak = 0; showStreak(); }
    global.Sound.se("miss");
    if (item) { item.missed = true; item.missFlash = true; render(item); item.missFlash = false; }
    bossJab();
  }

  // ミサイルへの入力（いちばん近いものから、このキーで始められるものをねらう）
  function typeMissile(key) {
    const list = bt.ms.list;
    if (!list.length) return null;
    let m = bt.mTarget && list.includes(bt.mTarget) ? bt.mTarget : null;
    let ok = false;
    if (m) ok = typeInto(m, key);
    else {
      const order = list.slice().sort((a, b) => b.t - a.t);
      for (const c of order) if (c.typer.input(key).ok) { m = c; ok = true; bt.mTarget = c; break; }
      if (!ok && order[0]) bump(order[0].typer.expected(), "ng");
    }
    if (!ok) { battleMiss(m); return false; }
    stats.correct++;
    bt.st.correct++;
    bump(key, "ok");
    global.Sound.se("key");
    for (const o of list) if (o !== m) o.el.classList.remove("target");
    if (m.typer.done()) missileShot(m);
    else render(m);
    return true;
  }

  return {
    start() {
      app.layout("cannon");
      arena.replaceChildren();
      arena.classList.remove("frozen");
      delete document.body.dataset.battle;
      delete document.body.dataset.rest;
      app.hud.setup([
        { k: "score", label: "スコア", big: true },
        { k: "stage", label: "ステージ" },
        { k: "lives", label: "ライフ", hearts: true },
        { k: "items", label: "アイテム（Shift＋A）", wide: true },
        { k: "speed", label: "打/分" },
      ]);
      app.hud.set("score", 0); showStage(); app.hud.set("lives", hearts()); showItems(); app.hud.set("speed", 0);
      app.hud.bar(null);
      app.say("ボスとタイピングバトル！ まずはアイテムを集めよう", 2600);
      app.countdown(() => {
        running = true; startAt = performance.now(); lastT = 0;
        startItemTime();
        raf = requestAnimationFrame(loop);
      }, { bgm: "battle" });
    },
    onKey(key, ev) {
      if (!running) return;
      if (key.length !== 1) return;
      // 休憩：スペースキーで次へ
      if (phase === "rest") {
        if (key === " " && rest && clock >= rest.readyAt) leaveRest();
        return null;
      }
      if (phase !== "items" && phase !== "battle") return null; // 画面が切りかわっているあいだは打てない
      // Shift＋A：アイテムを使う（英語で大文字の A を打つところは、そのまま打てる）
      if (ev && ev.shiftKey && (key === "A" || key === "a")) {
        const cur = phase === "battle" ? bt && (bt.mTarget || bt.word) : target;
        if (!cur || cur.typer.expected() !== "A") { useItem(); return null; }
      }

      // ボス戦
      if (phase === "battle") {
        if (!bt) return null;
        if (bt.ms) return typeMissile(key);
        const item = bt.word;
        if (!item) return null;
        if (!typeInto(item, key)) {
          bt.wordMiss = true;
          battleMiss(item);
          if (bt) restart(bt.wordEl, "shake");
          return false;
        }
        stats.correct++;
        bt.st.correct++;
        bump(key, "ok");
        global.Sound.se("key");
        if (item.typer.done()) {
          stats.combo++;
          stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
          playerAttack();
        } else {
          render(item);
        }
        return true;
      }

      // アイテムタイム
      let item = target;
      let ok = false;
      if (item) {
        ok = typeInto(item, key);
      } else {
        // いちばん下の言葉から順に、このキーで始められるものをさがす
        const order = words.slice().sort((a, b) => b.y - a.y);
        for (const w of order) {
          if (w.typer.input(key).ok) { item = w; ok = true; target = w; break; }
        }
        if (!ok && order[0]) bump(order[0].typer.expected(), "ng");
      }
      if (!ok) {
        stats.miss++;
        stats.combo = 0;
        global.Sound.se("miss");
        app.missFx(true);
        if (target) { target.missed = true; target.missFlash = true; render(target); target.missFlash = false; }
        return false;
      }
      stats.correct++;
      bump(key, "ok");
      global.Sound.se("key");
      for (const w of words) if (w !== item) w.el.classList.remove("target");
      if (item.typer.done()) {
        stats.combo++;
        stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
        destroy(item);
      } else {
        render(item);
      }
      return true;
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      if (bt) { clearTimeout(bt.sayTimer); clearTimeout(bt.faceTimer); }
      bt = null;
      rest = null;
      delete document.body.dataset.battle;
      delete document.body.dataset.rest;
      arena.classList.remove("frozen");
      arena.replaceChildren();
      document.querySelectorAll(".bt-flash, .bt-shot, .bt-pop").forEach((n) => n.remove());
    },
  };
}

global.CT = global.CT || {};
global.CT.modes = global.CT.modes || {};
global.CT.modes.cannon = { create };
})(window);
