/*!
 * bridge.js — 各ゲームとチャッピーGameセンターをつなぐ部品
 *
 * ゲームの <head> に入れる:
 *   <script src="../../assets/config.js"></script>
 *   <script src="../../assets/cgc.js"></script>
 *   <script src="../../assets/bridge.js" data-game="cannon"></script>
 *
 * 記録をとるところで:
 *   window.CGCBridge && CGCBridge.report({ board: "ta", boardName: "タイムアタック", score: 1234 });
 *
 * やること
 *   ・ニックネームが決まっていなければ、センターでニックネームを決めてもらう
 *   ・管理者がそのゲームを OFF にしていたら、プレイできないようにする（1分ごとに確認）
 *   ・左下に「センターへ もどる」ボタンとニックネームを出す
 */
(function () {
"use strict";
const me = document.currentScript;
const GAME = me && me.dataset.game;
const ROOT = new URL("../../", me ? me.src : location.href).href;
const g = CGC.gameById(GAME);

const CSS = `
#cgc-chip{position:fixed;left:4px;bottom:4px;z-index:2147482000;display:flex;align-items:center;gap:6px;padding:3px;
  border-radius:999px;background:rgba(255,255,255,.88);box-shadow:0 2px 10px rgba(0,0,0,.18);font:700 12px/1.2 "M PLUS Rounded 1c",system-ui,sans-serif;
  color:#30425a;text-decoration:none;opacity:.75;transition:opacity .2s;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#cgc-chip:hover{opacity:1;padding-right:10px}
#cgc-chip i{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:${g ? g.color : "#45bdfb"};color:#fff;font-style:normal;font-size:12px}
#cgc-chip span{display:none;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#cgc-chip:hover span{display:block}
#cgc-block{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;
  background:radial-gradient(circle at 50% 30%,#fff6d8,#ffd98a 60%,#ffb35c);font-family:"M PLUS Rounded 1c",system-ui,sans-serif;color:#3a2a10}
#cgc-block .box{max-width:420px;width:100%;background:#fff;border-radius:28px;padding:28px 22px 24px;text-align:center;box-shadow:0 12px 0 #e79a3c,0 20px 40px rgba(0,0,0,.18)}
#cgc-block h2{margin:10px 0 8px;font-size:22px}
#cgc-block p{margin:0 0 18px;line-height:1.7;font-size:15px}
#cgc-block .face{width:120px;margin:0 auto}
#cgc-block a{display:inline-block;padding:14px 26px;border-radius:999px;background:#ff8a3d;color:#fff;font-weight:800;text-decoration:none;font-size:16px;box-shadow:0 5px 0 #c85f1c}
#cgc-block a:active{transform:translateY(3px);box-shadow:0 2px 0 #c85f1c}
#cgc-toast{position:fixed;left:50%;top:14px;z-index:2147482500;transform:translate(-50%,-140%);transition:transform .45s cubic-bezier(.2,1.4,.4,1);
  background:#fff;color:#30425a;border-radius:18px;padding:10px 18px;box-shadow:0 6px 24px rgba(0,0,0,.22);font:800 14px/1.5 "M PLUS Rounded 1c",system-ui,sans-serif;
  border:3px solid ${g ? g.color : "#45bdfb"};text-align:center;pointer-events:none;max-width:calc(100vw - 32px)}
#cgc-toast.show{transform:translate(-50%,0)}
#cgc-toast b{color:${g ? g.color : "#45bdfb"};font-size:18px}`;

// チャッピーの顔（SVG だけで描いた かんたん版）
const FACE = `<svg class="face" viewBox="0 0 120 110" aria-hidden="true"><path d="M18 40 L22 6 L46 26 Z M102 40 L98 6 L74 26 Z" fill="#eef3f7" stroke="#cfd9e2" stroke-width="3" stroke-linejoin="round"/>
<rect x="10" y="22" width="100" height="80" rx="38" fill="#f7fafc" stroke="#cfd9e2" stroke-width="3"/><rect x="24" y="38" width="72" height="50" rx="22" fill="#1d2433"/>
<ellipse cx="45" cy="60" rx="7" ry="10" fill="#4fd3e0"/><ellipse cx="75" cy="60" rx="7" ry="10" fill="#4fd3e0"/>
<path d="M52 74 q4 5 8 0 q4 5 8 0" fill="none" stroke="#4fd3e0" stroke-width="3" stroke-linecap="round"/></svg>`;

let blocked = null;
function block(kind) {
  if (blocked === kind) return;
  unblock(); blocked = kind;
  const el = document.createElement("div"); el.id = "cgc-block";
  const name = g ? g.name : "このゲーム";
  el.innerHTML = kind === "off"
    ? `<div class="box">${FACE}<h2>いまは おやすみ中だよ</h2><p>「${CGC.esc(name)}」は、先生が いまは あそべないように しているよ。<br>ほかのゲームで あそんでね！</p><a href="${ROOT}index.html">センターへ もどる</a></div>`
    : `<div class="box">${FACE}<h2>ニックネームを きめよう！</h2><p>ランキングには ニックネームが のるよ。<br>センターで きめてから あそんでね。</p><a href="${ROOT}index.html?play=${encodeURIComponent(GAME)}">ニックネームを きめる</a></div>`;
  document.body.appendChild(el);
  // うしろのゲームのキー操作も止める
  addEventListener("keydown", stopKeys, true);
}
function unblock() { const el = document.getElementById("cgc-block"); if (el) el.remove(); blocked = null; removeEventListener("keydown", stopKeys, true); }
function stopKeys(e) { if (blocked) { e.stopPropagation(); e.preventDefault(); } }

async function check() {
  const s = await CGC.getSettings();
  if (!CGC.isEnabled(s, GAME)) block("off");
  else if (!CGC.getNick() || !CGC.hasAgreed()) block("nick");
  else unblock();
}

let toastT = 0;
function toast(html, ms = 3600) {
  let t = document.getElementById("cgc-toast");
  if (!t) { t = document.createElement("div"); t.id = "cgc-toast"; document.body.appendChild(t); }
  t.innerHTML = html; requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms);
}

async function report(o) {
  const r = await CGC.submit(Object.assign({ game: GAME }, o));
  if (r.ok) {
    const parts = [];
    if (r.dailyRank) parts.push(`きょう <b>${r.dailyRank}</b>位`);
    if (r.totalRank) parts.push(`そうごう <b>${r.totalRank}</b>位`);
    toast((r.improved ? "🏆 ランキングに とうろく！" : "✅ きろく OK（ベストは まえの記録）") + "<br>" + parts.join("　"));
  } else if (r.error === "off") { toast("いまは ランキングお休み中だよ"); check(); }
  else if (r.error === "nick") toast("ニックネームがないので きろくされなかったよ");
  else if (r.error === "net") toast("つうしんできなくて きろくできなかったよ…");
  return r;
}

function start() {
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  const chip = document.createElement("a"); chip.id = "cgc-chip"; chip.href = ROOT + "index.html"; chip.title = "チャッピーGameセンターへもどる";
  chip.innerHTML = `<i>◀</i><span>${CGC.esc(CGC.getNick() || "センターへ")}</span>`;
  // うっかり押してもゲームが消えないように確認する
  chip.addEventListener("click", e => { if (!confirm("チャッピーGameセンターに もどる？\n（あそんでいる とちゅうの ゲームは おわります）")) e.preventDefault(); });
  document.body.appendChild(chip);
  check();
  setInterval(check, 60000);
  addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
}

window.CGCBridge = { report, game: GAME };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
