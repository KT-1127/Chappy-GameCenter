/*!
 * cgc.js — チャッピーGameセンターの共通部品
 *   ・ゲームの一覧（GAMES）
 *   ・ニックネーム
 *   ・設定（ゲームのON/OFF・お知らせ）とランキングの読み書き
 *
 * 保存先は2通り:
 *   1) config.js に Firebase の設定を書く → Firestore に保存してクラス全員で共有
 *   2) 書かない → この端末のブラウザの中だけに保存（おためし用）
 *
 * Firestore のコレクション
 *   cgc_settings/main : { games: { [id]: false で OFF }, notice }
 *   cgc_scores/{uid_date_game_board} : 1人・1日・1ボードのベスト
 *   cgc_admins/{uid}  : 管理者（Firebase コンソールで手で作る）
 */
(function (global) {
"use strict";

const CONF = Object.assign({ firebase: null, siteName: "チャッピーGameセンター" }, global.CGC_CONFIG || {});
const FB_VER = "10.12.2";

// ---------- ゲーム一覧 ----------
// order: "desc" = 大きいほど上位 / "asc" = 小さいほど上位
// banner: カードに出す画像（top2.png = 1882×836 の元画像から tools/shrink.py で作った thumb.jpg）
const fmtTime = ms => { const s = ms / 1000, m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(1).padStart(4, "0"); };
const pts = v => v.toLocaleString() + "点";
const GAMES = [
  { id: "link",    name: "チャッピーリンク",   kana: "LINK",   ready: true,  color: "#ff5a9a", color2: "#ffc2dd", icon: "link",
    desc: "同じ色のチャッピーをなぞって消そう！", order: "desc", fmt: pts, note: "20秒のハイスコア" },
  { id: "cannon",  name: "チャッピーキャノン", kana: "CANNON", ready: true,  color: "#ff8a3d", color2: "#ffd29c", icon: "cannon",
    desc: "りんごを発射して、つみ木をたおそう！", order: "desc", fmt: pts, note: "「タイムアタック」の点数" },
  { id: "ringo",   name: "チャッピーりんご便", kana: "RINGO",  ready: true,  color: "#ef4b4b", color2: "#ffb0a6", icon: "truck",
    desc: "トラックで同じ色のりんごを運ぼう！", order: "desc", fmt: v => "レベル " + v, note: "クリアしたいちばん大きいレベル" },
  { id: "paku",    name: "パクパクチャッピー", kana: "PAKU",   ready: true,  color: "#3cc47c", color2: "#b6f0c9", icon: "mouth",
    desc: "パクパク食べて、ぜんぶたいらげよう！", order: "asc", fmt: fmtTime, note: "ステージごとのクリアタイム（はやいほど上）" },
  { id: "rhythm",  name: "チャッピーリズム",   kana: "RHYTHM", ready: true,  color: "#8b6cff", color2: "#d4c8ff", icon: "note",
    desc: "音楽にあわせてタイミングよくタップ！", order: "desc", fmt: pts, note: "曲・むずかしさごとのスコア" },
  { id: "home",    name: "チャッピーhome",     kana: "HOME",   ready: true,  color: "#f2b134", color2: "#ffe7a8", icon: "house",
    desc: "チャッピーたちを、正しい色のおうちに入れよう！", order: "asc", fmt: fmtTime, note: "レベルごとのクリアタイム（はやいほど上）" },
  { id: "sagashi", name: "チャッピー探し",     kana: "SEARCH", ready: true,  color: "#2bb673", color2: "#bdf0d2", icon: "glass",
    desc: "スマホをかざして、森のチャッピーを見つけよう！", order: "desc", fmt: pts, note: "とくてん（きんいろは10てん）" }
];
GAMES.forEach(g => { g.url = "games/" + g.id + "/index.html"; g.banner = "games/" + g.id + "/thumb.jpg"; });
const gameById = id => GAMES.find(g => g.id === id);

// ---------- 小物 ----------
const todayJST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Firestore のドキュメントIDに使えるように（ルールでも同じ形をチェックしている）
const safeBoard = b => String(b || "main").replace(/[^A-Za-z0-9-]/g, "-").slice(0, 60) || "main";

// ---------- ニックネーム ----------
const NICK_KEY = "cgc-nick", AGREE_KEY = "cgc-agree";
// 悪口・個人情報っぽいものをざっくりはじく（管理者が管理ページで直せる）
const NG = ["しね", "死ね", "ころす", "殺す", "きもい", "キモい", "うざい", "ウザい", "ばか", "バカ", "あほ", "アホ", "くそ", "クソ", "ぶす", "ブス", "でぶ", "デブ", "ちび", "fuck", "shit", "sex"];
function checkNick(raw) {
  const n = String(raw || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
  if (!n) return { ok: false, msg: "ニックネームを入れてね" };
  if ([...n].length > 10) return { ok: false, msg: "10文字までにしてね" };
  if (/\d{3,}|@|https?:/i.test(n)) return { ok: false, msg: "数字の続けすぎ・メールやURLはつかえないよ" };
  const low = n.toLowerCase();
  if (NG.some(w => low.includes(w.toLowerCase()))) return { ok: false, msg: "そのことばはつかえないよ。やさしい名前にしよう" };
  return { ok: true, nick: n };
}
const getNick = () => ls.get(NICK_KEY, "");
const setNick = n => ls.set(NICK_KEY, n);
const hasAgreed = () => !!ls.get(AGREE_KEY, false);
const setAgreed = () => ls.set(AGREE_KEY, true);

// ---------- ランキングの計算 ----------
// 人（uid）ごとのベストにまとめて並べる。同点は同じ順位。me = 自分の uid
function rankRows(rows, order, me, limit = 30) {
  const best = new Map(), key = r => r.uid || r.nick;
  const better = (a, b) => order === "asc" ? a.score < b.score : a.score > b.score;
  for (const r of rows) {
    const o = best.get(key(r));
    if (!o || better(r, o) || (r.score === o.score && r.ts < o.ts)) best.set(key(r), r);
  }
  const list = [...best.values()].sort((a, b) => (order === "asc" ? a.score - b.score : b.score - a.score) || a.ts - b.ts);
  let rank = 0, prev = null;
  return list.slice(0, limit).map((r, i) => {
    if (r.score !== prev) { rank = i + 1; prev = r.score; }
    return { rank, nick: r.nick, score: r.score, date: r.date, me: !!me && r.uid === me };
  });
}
function boardsOf(rows) {
  const m = new Map();
  for (const r of rows) { const o = m.get(r.board); if (!o) m.set(r.board, { board: r.board, boardName: r.boardName, n: 1, last: r.ts }); else { o.n++; if (r.ts > o.last) { o.last = r.ts; o.boardName = r.boardName; } } }
  return [...m.values()].sort((a, b) => b.last - a.last);
}
function rankingFrom(all, game, board, me) {
  const boards = boardsOf(all);
  board = board || (boards[0] && boards[0].board) || "";
  const rows = all.filter(r => r.board === board), order = (gameById(game) || {}).order || "desc";
  return { boards, board, daily: rankRows(rows.filter(r => r.date === todayJST()), order, me), total: rankRows(rows, order, me) };
}
function myRanks(rows, order, uid) {
  const find = l => (l.find(x => x.me) || {}).rank || null;
  return { dailyRank: find(rankRows(rows.filter(r => r.date === todayJST()), order, uid, 1e6)), totalRank: find(rankRows(rows, order, uid, 1e6)) };
}
const isBetter = (order, a, b) => order === "asc" ? a < b : a > b;

/* ============================================================
 *  おためしモード（この端末だけ・パスワードは chappy）
 * ============================================================ */
const DB_KEY = "cgc-db";
const DEFAULT_PASS_HASH = "6c8b6f93864ca3153d9dc6fd7a1ece62b547be3c4251474b77ee7c96bee39b6b"; // "chappy"
const Local = {
  adminPass: null,
  db() { return Object.assign({ rows: [], games: {}, notice: "", passHash: DEFAULT_PASS_HASH }, ls.get(DB_KEY, {})); },
  save(d) { ls.set(DB_KEY, d); },
  uid() { let u = ls.get("cgc-uid", ""); if (!u) { u = "local-" + Math.random().toString(36).slice(2, 10); ls.set("cgc-uid", u); } return u; },
  async settings() { const d = this.db(); return { games: d.games, notice: d.notice }; },
  async ranking(game, board) { return rankingFrom(this.db().rows.filter(r => r.game === game), game, board, this.uid()); },
  async submit(p) {
    const d = this.db(), uid = this.uid(), date = todayJST();
    if (d.games[p.game] === false) return { ok: false, error: "off" };
    const id = [uid, date, p.game, p.board].join("_");
    let row = d.rows.find(r => r.id === id);
    const improved = !row || isBetter(p.order, p.score, row.score);
    if (!row) { row = { id }; d.rows.push(row); }
    if (improved) Object.assign(row, p, { uid, date, ts: Date.now() });
    this.save(d);
    return Object.assign({ ok: true, improved }, myRanks(d.rows.filter(r => r.game === p.game && r.board === p.board), p.order, uid));
  },
  async login(email, pass) { const ok = await sha256(pass || "") === this.db().passHash; this.adminPass = ok ? pass : null; return ok ? { ok: true, defaultPass: this.db().passHash === DEFAULT_PASS_HASH } : { ok: false, error: "pass" }; },
  async restore() { return { ok: false }; },
  async logout() { this.adminPass = null; },
  async admin(op, p) {
    if (this.adminPass == null) return { ok: false, error: "auth" };
    const d = this.db(), today = todayJST();
    const match = r => (!p.game || r.game === p.game) && (!p.board || r.board === p.board) && (p.scope !== "today" || r.date === today);
    let res;
    switch (op) {
      case "setGame": d.games[p.game] = !!p.enabled; res = { ok: true }; break;
      case "setNotice": d.notice = String(p.notice || "").slice(0, 300); res = { ok: true }; break;
      case "list": return { ok: true, rows: d.rows.filter(match).sort((a, b) => b.ts - a.ts).slice(0, 1000), boards: boardsOf(d.rows.filter(r => !p.game || r.game === p.game)) };
      case "update": { const r = d.rows.find(x => x.id === p.id); if (!r) return { ok: false, error: "notfound" }; r.nick = String(p.nick).slice(0, 10); r.score = Number(p.score); res = { ok: true }; break; }
      case "delete": { const ids = new Set(p.ids), n = d.rows.length; d.rows = d.rows.filter(r => !ids.has(r.id)); res = { ok: true, deleted: n - d.rows.length }; break; }
      case "clear": { const n = d.rows.length; d.rows = d.rows.filter(r => !match(r)); res = { ok: true, deleted: n - d.rows.length }; break; }
      case "setPass": d.passHash = await sha256(p.newPass); this.adminPass = p.newPass; res = { ok: true }; break;
      default: return { ok: false, error: "op" };
    }
    this.save(d);
    return Object.assign({ defaultPass: d.passHash === DEFAULT_PASS_HASH }, res);
  }
};

/* ============================================================
 *  Firebase モード（Firestore + Authentication）
 * ============================================================ */
const Fire = {
  _p: null,
  load() {
    if (this._p) return this._p;
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    this._p = Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")]).then(([app, auth, fs]) => {
      const a = app.initializeApp(CONF.firebase);
      const au = auth.getAuth(a), db = fs.getFirestore(a);
      const ready = new Promise(res => { const off = auth.onAuthStateChanged(au, () => { off(); res(); }); });
      return { auth, fs, au, db, ready };
    });
    return this._p;
  },
  async uid() { const f = await this.load(); await f.ready; return f.au.currentUser ? f.au.currentUser.uid : null; },
  // 生徒は匿名ログイン（ブラウザごとに1つのIDが自動でつく）
  async ensureUser() {
    const f = await this.load(); await f.ready;
    if (!f.au.currentUser) await f.auth.signInAnonymously(f.au);
    return f.au.currentUser.uid;
  },
  async rows(where) {
    const f = await this.load(), { fs } = f;
    const q = fs.query(fs.collection(f.db, "cgc_scores"), ...where.map(w => fs.where(w[0], "==", w[1])));
    return (await fs.getDocs(q)).docs.map(d => Object.assign({ id: d.id }, d.data()));
  },
  async settings() {
    const f = await this.load(), s = await f.fs.getDoc(f.fs.doc(f.db, "cgc_settings", "main"));
    const d = s.exists() ? s.data() : {};
    return { games: d.games || {}, notice: d.notice || "" };
  },
  async ranking(game, board) { const [rows, uid] = await Promise.all([this.rows([["game", game]]), this.uid()]); return rankingFrom(rows, game, board, uid); },
  async submit(p) {
    const f = await this.load(), { fs } = f, uid = await this.ensureUser(), date = todayJST();
    const id = [uid, date, p.game, p.board].join("_"), ref = fs.doc(f.db, "cgc_scores", id);
    const old = await fs.getDoc(ref);
    const improved = !old.exists() || isBetter(p.order, p.score, old.data().score);
    if (improved) {
      try { await fs.setDoc(ref, Object.assign({}, p, { uid, date, ts: Date.now() })); }
      catch (e) { if (e.code === "permission-denied") return { ok: false, error: "off" }; throw e; }
    }
    const rows = await this.rows([["game", p.game], ["board", p.board]]);
    return Object.assign({ ok: true, improved }, myRanks(rows, p.order, uid));
  },
  async isAdmin() {
    const f = await this.load(); await f.ready;
    const u = f.au.currentUser; if (!u || u.isAnonymous) return false;
    try { return (await f.fs.getDoc(f.fs.doc(f.db, "cgc_admins", u.uid))).exists(); } catch (e) { return false; }
  },
  async login(email, pass) {
    const f = await this.load();
    try { await f.auth.signInWithEmailAndPassword(f.au, email, pass); }
    catch (e) { return { ok: false, error: "pass" }; }
    if (!(await this.isAdmin())) { await f.auth.signOut(f.au); return { ok: false, error: "notadmin" }; }
    return { ok: true, email: f.au.currentUser.email };
  },
  async restore() { const f = await this.load(); return (await this.isAdmin()) ? { ok: true, email: f.au.currentUser.email } : { ok: false }; },
  async logout() { const f = await this.load(); await f.auth.signOut(f.au); },
  async admin(op, p) {
    const f = await this.load(), { fs } = f, today = todayJST();
    if (!(await this.isAdmin())) return { ok: false, error: "auth" };
    const setRef = fs.doc(f.db, "cgc_settings", "main");
    const where = [];
    if (p.game) where.push(["game", p.game]);
    if (p.board) where.push(["board", p.board]);
    if (p.scope === "today") where.push(["date", today]);
    const delAll = async rows => {
      for (let i = 0; i < rows.length; i += 450) {
        const b = fs.writeBatch(f.db);
        rows.slice(i, i + 450).forEach(r => b.delete(fs.doc(f.db, "cgc_scores", r.id)));
        await b.commit();
      }
      return rows.length;
    };
    switch (op) {
      case "setGame": await fs.setDoc(setRef, { games: { [p.game]: !!p.enabled } }, { merge: true }); return { ok: true };
      case "setNotice": await fs.setDoc(setRef, { notice: String(p.notice || "").slice(0, 300) }, { merge: true }); return { ok: true };
      case "list": {
        const rows = await this.rows(where), all = p.game ? await this.rows([["game", p.game]]) : rows;
        return { ok: true, rows: rows.sort((a, b) => b.ts - a.ts).slice(0, 1000), boards: boardsOf(all) };
      }
      case "update": await fs.updateDoc(fs.doc(f.db, "cgc_scores", p.id), { nick: String(p.nick).slice(0, 10), score: Number(p.score) }); return { ok: true };
      case "delete": return { ok: true, deleted: await delAll(p.ids.map(id => ({ id }))) };
      case "clear": return { ok: true, deleted: await delAll(await this.rows(where)) };
      case "setPass":
        try { await f.auth.updatePassword(f.au.currentUser, p.newPass); return { ok: true }; }
        catch (e) { return { ok: false, error: e.code === "auth/requires-recent-login" ? "relogin" : e.code === "auth/weak-password" ? "weak" : "pass-change" }; }
    }
    return { ok: false, error: "op" };
  }
};

const isShared = !!(CONF.firebase && CONF.firebase.apiKey);
const backend = isShared ? Fire : Local;
const SET_CACHE = "cgc-settings-cache";

async function getSettings() {
  try { const s = await backend.settings(); ls.set(SET_CACHE, s); return Object.assign({ online: true }, s); }
  catch (e) { return Object.assign({ games: {}, notice: "" }, ls.get(SET_CACHE, {}), { online: false }); }
}
const isEnabled = (settings, id) => !settings.games || settings.games[id] !== false;

function submit(o) {
  const g = gameById(o.game), nick = getNick();
  if (!g || !nick || !isFinite(o.score)) return Promise.resolve({ ok: false, error: !nick ? "nick" : "bad" });
  return backend.submit({ game: o.game, board: safeBoard(o.board), boardName: String(o.boardName || "ランキング").slice(0, 60),
    nick: String(nick).slice(0, 10), score: Number(o.score), order: g.order }).catch(e => ({ ok: false, error: "net" }));
}
const ranking = (game, board) => backend.ranking(game, board || "");

// 管理者
const adminMode = isShared ? "firebase" : "local";
const adminLogin = (email, pass) => backend.login(email, pass);
const adminRestore = () => backend.restore();
const adminLogout = () => backend.logout();
const admin = (op, args = {}) => backend.admin(op, args);

global.CGC = { CONF, GAMES, gameById, isShared, todayJST, esc, checkNick, getNick, setNick, hasAgreed, setAgreed,
  getSettings, isEnabled, submit, ranking, adminMode, adminLogin, adminRestore, adminLogout, admin, rankRows };
})(window);
