/* =====================================================================
   チャッピーラボ お試し版：④問題解決の「きまりによる判定」
   ---------------------------------------------------------------------
   授業版（server.py）の「実機の点検」と「困りごとの判定」を、そのまま
   ブラウザの中で動くように書きうつしたものです。生成AIは使いません。
   同じプログラムなら、いつも同じ結果になります。
   ===================================================================== */
(function(global){
'use strict';

/* ---------- Python と同じ ふるまいをする小さな道具 ---------- */
function T(x){                       // Python の「真」かどうか
  if(x === null || x === undefined || x === false || x === 0 || x === '') return false;
  if(typeof x === 'number' && isNaN(x)) return false;
  if(Array.isArray(x)) return x.length > 0;
  if(typeof x === 'object') return Object.keys(x).length > 0;
  return true;
}
const or_ = (a, b) => T(a) ? a : b;
const isDict = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isList = x => Array.isArray(x);
const get = (o, k) => (isDict(o) && k in o) ? o[k] : undefined;
function pyFloat(v){                 // float(v)。変換できなければ null
  if(typeof v === 'boolean') return v ? 1 : 0;
  if(typeof v === 'number') return v;
  if(typeof v === 'string'){
    const s = v.trim();
    if(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
    if(/^[+-]?(inf|infinity)$/i.test(s)) return s[0] === '-' ? -Infinity : Infinity;
    if(/^[+-]?nan$/i.test(s)) return NaN;
  }
  return null;
}
function pyInt(v){                   // int(v)。変換できなければ null
  if(typeof v === 'boolean') return v ? 1 : 0;
  if(typeof v === 'number') return isFinite(v) ? Math.trunc(v) : null;
  if(typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return parseInt(v, 10);
  return null;
}
function pyStr(v){                   // str(v) / "%s" % v
  if(v === null || v === undefined) return 'None';
  if(v === true) return 'True';
  if(v === false) return 'False';
  if(typeof v === 'number'){
    if(Number.isInteger(v) && !Object.is(v, -0)) return String(v);
    if(!isFinite(v)) return isNaN(v) ? 'nan' : (v > 0 ? 'inf' : '-inf');
    return String(v);
  }
  if(isList(v)) return '[' + v.map(pyRepr).join(', ') + ']';
  return String(v);
}
function pyRepr(v){ return typeof v === 'string' ? "'" + v + "'" : pyStr(v); }
function fmtG(x){                    // "%g" % x
  x = Number(x);
  if(!isFinite(x)) return isNaN(x) ? 'nan' : (x > 0 ? 'inf' : '-inf');
  if(x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if(e < -4 || e >= 6){
    let s = x.toExponential(5).replace(/\.?0+e/, 'e');
    return s.replace(/e([+-])(\d)$/, 'e$10$2');
  }
  return String(Number(x.toPrecision(6)));
}
function pyRound1(x){                // round(x, 1)（偶数丸めまで まねる）
  const y = x * 10, f = Math.floor(y), d = y - f;
  let r;
  if(Math.abs(d - 0.5) < 1e-9) r = (f % 2 === 0) ? f : f + 1;
  else r = Math.round(y);
  return r / 10;
}
const chars = s => Array.from(String(s));
const cut = (s, n) => chars(s).slice(0, n).join('');
const setOf = arr => new Set(arr);
const inter = (a, b) => new Set([...a].filter(x => b.has(x)));
const minus = (a, b) => new Set([...a].filter(x => !b.has(x)));
const union = (a, b) => new Set([...a, ...b]);
const sortedArr = s => [...s].sort();
const range = (a, b) => { const r = []; for(let i = a; i < b; i++) r.push(i); return r; };

/* ---------- 名前の表 ---------- */
const SENSOR_JA = {distance:'距離(cm)', light:'明るさ(lx)', temp:'温度(℃)', pir:'人感', button_red:'赤ボタン',
  button_blue:'青ボタン', button_both:'赤と青の同時おし', hour:'いまの時', minute:'いまの分'};
const OUT_JA = {fan:'ファン', led:'LED', camera:'カメラ', face:'表情', color:'目と口の色', pan:'首の左右', tilt:'首の上下'};
const LONG_SENSORS = ['hour', 'minute', 'temp', 'light', 'distance', 'pir'];
const PRESS_SENSORS = ['button_red', 'button_blue', 'button_both'];
const SWITCH_OUT = ['fan', 'led', 'camera'];
const INFO_HEADS = ['くりかえしの間かく', '警報のくりかえし'];
const SPACED_ENOUGH = 600;
const OP_JA = {'==':'＝', '=':'＝', '>':'＞', '<':'＜', '>=':'≧', '<=':'≦', '!=':'≠', '≠':'≠', '≥':'≧', '≤':'≦'};
const BLOCK_JA = {pir:'人がいる', button_red:'赤ボタン', button_blue:'青ボタン', button_both:'赤と青の同時おし',
  hour:'いまの時', minute:'いまの分', temp:'温度', light:'明るさ', distance:'きょり'};
const BTN_JA = {button_red:'赤ボタン', button_blue:'青ボタン', button_both:'赤と青の同時おし'};
const DOMAIN = {
  pir:[0,1], button_red:[0,1], button_blue:[0,1], button_both:[0,1],
  hour:range(0,24), minute:range(0,60),
  temp:range(-40,121).map(x => x / 2), light:range(0,1001).map(x => x * 5), distance:range(0,1001).map(x => x / 2),
};

let FACTS = {};                      // ペルソナの設定表（persona_facts.json）
let SCOPE_OFF = new Set();

const condOf = a => or_(get(a, 'condition'), or_(get(a, 'cond'), {}));
const bodyOf = a => or_(get(a, 'actions'), get(a, 'body'));

function sensorsIn(cond){
  let out = [];
  if(!isDict(cond)) return out;
  for(const key of ['all', 'any']) if(isList(cond[key])) for(const sub of cond[key]) out = out.concat(sensorsIn(sub));
  for(const key of ['left', 'right']) if(isDict(cond[key])) out = out.concat(sensorsIn(cond[key]));
  if(T(cond.sensor)) out.push([cond.sensor, cond.op, cond.value]);
  return out;
}
function flat(acts){
  const out = [];
  (function walk(l){
    for(const a of (isList(l) ? l : [])){
      if(!isDict(a)) continue;
      out.push(a);
      for(const k of ['actions', 'then', 'else', 'body']) walk(a[k]);
    }
  })(acts);
  return out;
}
function flatShallow(acts){
  const out = [];
  (function walk(l){
    for(const a of (isList(l) ? l : [])){
      if(!isDict(a)) continue;
      out.push(a);
      if(['forever', 'repeat', 'until'].includes(a.type)) continue;
      for(const k of ['then', 'else']) walk(a[k]);
    }
  })(acts);
  return out;
}
const speakText = a => pyStrOrEmpty(or_(get(a, 'value'), or_(get(a, 'text'), '')));
function pyStrOrEmpty(v){ return T(v) ? pyStr(v) : ''; }

function waitSeconds(acts, mult){
  if(mult === undefined) mult = 1;
  let total = 0;
  for(const a of (isList(acts) ? acts : [])){
    if(!isDict(a)) continue;
    const t = a.type;
    if(t === 'wait'){
      let v = a.value;
      if(v === null || v === undefined) v = (pyFloat(or_(get(a, 'ms'), 0)) || 0) / 1000;
      const f = pyFloat(v);
      if(f !== null) total += f * mult;
    } else if(t === 'repeat'){
      let n = a.times;
      if(n === null || n === undefined) n = 1;
      else { n = pyInt(n); if(n === null) n = 1; }
      total += waitSeconds(bodyOf(a), mult * Math.max(n, 0));
    } else if(t === 'if'){
      const names = setOf(sensorsIn(condOf(a)).map(c => c[0]));
      if(names.size && [...names].every(n => PRESS_SENSORS.includes(n))){
        total += waitSeconds(a.else, mult);
      } else {
        total += Math.min(waitSeconds(a.then, mult), waitSeconds(a.else, mult));
      }
    }
  }
  return total;
}

function numJa(v){
  const f = pyFloat(v);
  if(f === null || !isFinite(f)) return pyStr(v);
  return Number.isInteger(f) ? String(f) : pyStr(f);
}
function cmpOk(x, op, v){
  switch(op){
    case '==': case '=': return x === v;
    case '!=': case '≠': return x !== v;
    case '>': return x > v;
    case '<': return x < v;
    case '>=': case '≥': return x >= v;
    case '<=': case '≤': return x <= v;
  }
  return true;
}
function minutesTrue(longs){
  const conds = longs.filter(x => x[0] === 'minute');
  if(!conds.length) return null;
  const ok = (m, op, v) => { const f = pyFloat(v); return f === null ? true : cmpOk(m, op, f); };
  return range(0, 60).filter(m => conds.every(c => ok(m, c[1], c[2])));
}
function leafOk(v, op, val){
  if(typeof val === 'boolean') val = val ? 1 : 0;
  const f = pyFloat(val);
  if(f === null) return true;
  return cmpOk(v, op, f);
}
function condNever(cond){
  if(!isDict(cond)) return false;
  let kidsAll = isList(cond.all) ? [...cond.all] : [];
  let kidsAny = isList(cond.any) ? [...cond.any] : [];
  if(cond.type === 'and' || (T(cond.left) && T(cond.right) && cond.type !== 'or'))
    kidsAll = kidsAll.concat([cond.left, cond.right].filter(isDict));
  if(cond.type === 'or') kidsAny = kidsAny.concat([cond.left, cond.right].filter(isDict));
  if(kidsAny.length && !kidsAll.length && !T(cond.sensor)) return kidsAny.every(k => condNever(k));
  const leaves = kidsAll.filter(k => T(get(k, 'sensor')));
  if(T(cond.sensor)) leaves.push(cond);
  for(const k of kidsAll) if(!T(get(k, 'sensor')) && condNever(k)) return true;
  const by = new Map();
  for(const lf of leaves){ const s = lf.sensor; if(!by.has(s)) by.set(s, []); by.get(s).push(lf); }
  for(const [sn, lfs] of by){
    const dom = DOMAIN[sn];
    if(!dom) continue;
    if(!dom.some(v => lfs.every(lf => leafOk(v, lf.op, lf.value)))) return true;
  }
  return false;
}
function condJa(cond){
  return sensorsIn(cond).map(([n, op, v]) => {
    const vv = numJa(v === true ? 1 : v === false ? 0 : v);
    return (BLOCK_JA[n] || SENSOR_JA[n] || pyStr(n)) + ' ' + (OP_JA[op] || pyStr(op)) + ' ' + vv;
  }).join(' かつ ');
}
function pruneNever(acts){
  const out = [];
  for(const a of (isList(acts) ? acts : [])){
    if(!isDict(a)) continue;
    const b = Object.assign({}, a);
    if(b.type === 'if'){
      b.then = condNever(condOf(b)) ? [] : pruneNever(b.then);
      b.else = pruneNever(b.else);
    }
    for(const k of ['actions', 'body']) if(isList(b[k])) b[k] = pruneNever(b[k]);
    out.push(b);
  }
  return out;
}
function outsideLoopIfs(program){
  const acts = or_(program.actions, []);
  const hasLoop = T(program.threads) || acts.some(a => isDict(a) && ['forever', 'until'].includes(a.type));
  if(!hasLoop) return [];
  return acts.filter(a => isDict(a) && a.type === 'if' && (T(a.then) || T(a.else)) && sensorsIn(condOf(a)).length);
}
function pruneProgram(program){
  const outside = new Set(outsideLoopIfs(program));
  return { actions: pruneNever(or_(program.actions, []).filter(a => !outside.has(a))),
           threads: or_(program.threads, []).map(th => ({actions: pruneNever(bodyOf(th))})) };
}
const DOING = ['speak', 'ai', 'pan', 'tilt', 'color'];
function allActs(program){
  let acts = flat(or_(program.actions, []));
  for(const th of or_(program.threads, [])) acts = acts.concat(flat(bodyOf(th)));
  return acts;
}
function doesSomething(program){
  for(const x of allActs(program)){
    const t = x.type;
    if(DOING.includes(t) || (['led', 'fan', 'camera'].includes(t) && T(x.value)) ||
       (t === 'face' && ![null, undefined, '', 'neutral'].includes(x.value))) return true;
  }
  return false;
}

/* ---------- 点検 ---------- */
function scan(acts, inLoop, out, gated, armed){
  armed = !!armed;
  for(const a of (isList(acts) ? acts : [])){
    if(!isDict(a)) continue;
    const t = a.type;
    if(['forever', 'repeat', 'until'].includes(t)){
      const nowArmed = armed || (T(gated) && gated.some(x => PRESS_SENSORS.includes(x[0])));
      scan(bodyOf(a), true, out, null, nowArmed);
      continue;
    }
    if(t === 'if'){
      const cond = condOf(a);
      const sens = sensorsIn(cond);
      const then = or_(a.then, []);
      const els = or_(a.else, []);
      for(const [name, op, val] of sens){
        if(['temp', 'light', 'distance'].includes(name) && ['==', '!='].includes(op)){
          const ja = SENSOR_JA[name] || name;
          out.push(['ほぼ動かない条件',
            '「' + ja + ' ' + (op === '==' ? '＝' : '≠') + ' ' + pyStr(val) + '」は小数どうしのぴったり比較です。実機の' + ja +
            'は 29.7 や 30.2 のような細かい数字なので、ちょうど一致することはまずありません。この「もし」の中身は動かないままになります。']);
        }
      }
      const longs = sens.filter(x => LONG_SENSORS.includes(x[0]));
      const presses = sens.filter(x => PRESS_SENSORS.includes(x[0]));
      const underPress = T(gated) && gated.some(x => PRESS_SENSORS.includes(x[0]));
      const trig = setOf(longs.map(x => x[0]));
      const waits = flat(then).filter(x => x.type === 'until');
      const released = waits.some(w => inter(setOf(sensorsIn(condOf(w)).map(c => c[0])), trig).size > 0);
      const btnWait = waits.some(w => inter(setOf(sensorsIn(condOf(w)).map(c => c[0])), setOf(PRESS_SENSORS)).size > 0);
      const stopBtns = sortedArr(setOf([].concat(...waits.map(w => sensorsIn(condOf(w)).map(c => c[0]).filter(n => n in BTN_JA)))));
      const stopName = stopBtns.map(b => b === 'button_both' ? '赤と青の同時おし' : (BTN_JA[b] || b)).join('・') || 'ボタン';

      let windowS = null;
      const mins = minutesTrue(longs);
      const never = (mins !== null && mins.length === 0) || condNever(cond);
      if(never){
        const bools = sens.filter(x => ['pir', 'button_red', 'button_blue', 'button_both'].includes(x[0]) && !['==', '='].includes(x[1]));
        const why = sortedArr(setOf(bools.map(x => x[0]))).map(n => n === 'pir'
          ? '「人がいる」は いる＝1・いない＝0 のどちらかしかないので、'
          : '「' + (BLOCK_JA[n] || n) + '」は おしている＝1・おしていない＝0 のどちらかしかないので、').join('');
        out.push(['一度も動かない条件', '「' + condJa(cond) + '」は、' + why + 'どんなときも 真になりません。この『もし』の中は 一度も動きません。']);
      }
      if(longs.some(x => x[0] === 'hour' && x[1] === '==') || mins !== null){
        if(mins !== null) windowS = mins.length ? Math.max(60, mins.length * 60) : null;
        else windowS = 3600;
      }
      const waited = waitSeconds(then);
      const covered = (windowS !== null && waited >= windowS);
      const spaced = (!covered) && waited >= SPACED_ENOUGH;
      const alarm = armed && trig.size === 1 && trig.has('pir');
      if(inLoop && alarm && !released){
        const talk3 = flat(then).filter(x => ['speak', 'ai'].includes(x.type));
        if(talk3.length){
          out.push(['警報のくりかえし', 'ボタンで入れた見張りモードの中なので、人がいるあいだ「' + (cut(speakText(talk3[0]), 20) || '声') +
            '」をくりかえすのは、留守中に入ってきた人への警報で、ねらいどおりの動きです。帰ってきたら、モードを終えるボタンを押して使います。']);
        }
      }
      let skipRest = false;
      if(inLoop && longs.length && !released && !covered && !spaced && !underPress && !alarm && !never){
        const talk = flat(then).filter(x => ['speak', 'ai'].includes(x.type));
        if(talk.length){
          const hourEq = longs.filter(x => x[0] === 'hour' && x[1] === '==');
          let how;
          if(mins && mins.length){
            const h = hourEq.length ? pyStr(hourEq[0][2]) + '時' : '';
            const span = mins.length === 1 ? h + mins[0] + '分' : h + mins[0] + '分〜' + h + mins[mins.length - 1] + '分';
            how = 'この時こくの条件は、' + span + 'の あいだ（' + mins.length + '分間）ずっと真のままです';
          } else if(hourEq.length){
            how = '「いまの時 ＝ ○」は、その1時間のあいだ ずっと真のままです';
          } else if(longs.some(x => x[0] === 'pir')){
            how = '人感センサーは、人がそこにいるあいだ ずっと真のままです（住んでいる本人にも反応します）';
          } else {
            how = 'この条件は、いちど真になるとしばらく真のままです';
          }
          const what = cut(speakText(talk[0]), 20) || 'AIとの会話';
          if(waited > 0 && windowS){
            const times = Math.max(2, Math.floor(windowS / waited));
            out.push(['鳴りっぱなし',
              how + '。「待つ' + fmtG(waited) + '秒」があるので すぐにではありませんが、' +
              (waited < 60 ? fmtG(waited) + '秒' : fmtG(pyRound1(waited / 60)) + '分') + 'ほどおきに また始まります。条件が真の' +
              Math.floor(windowS / 60) + '分のあいだに、「' + what + '」が およそ' + times + '回 くりかえされます。' +
              (btnWait ? stopName + 'で止めても、次の周でまた鳴り出します。' : '') +
              '一度知らせたら、その時間が終わるまで止まる作りにはなっていません。']);
            scan(then, inLoop, out, T(presses) ? presses : (T(longs) ? longs : gated), armed);
            scan(els, inLoop, out, gated, armed);
            skipRest = true;
          } else {
            const nrep = flat(then).filter(x => x.type === 'repeat');
            let extra = '';
            if(nrep.length){
              const n = pyStr(nrep[0].times);
              extra = '「' + n + '回くりかえす」で止まるように見えますが、外の『ずっと』がすぐ次の周に入るので、条件が真のあいだまた' + n + '回…とくりかえし続けます。';
            } else if(btnWait){
              extra = 'ボタンを押すまで待つ作りになっていますが、押してもう一周したときにまだ同じ条件のままなので、すぐにまた始まってしまいます。きっかけになった状態そのものが変わるまで待つ必要があります。';
            }
            out.push(['鳴りっぱなし', how + '。くりかえしの中なので、そのあいだ「' + what + '」を何十回もくりかえします。一度だけ知らせて止まる作りにはなっていません。' + extra]);
          }
        }
      }
      if(skipRest) continue;
      if(inLoop && longs.length && spaced){
        const talk2 = flat(then).filter(x => ['speak', 'ai'].includes(x.type));
        if(talk2.length){
          out.push(['くりかえしの間かく', '条件が続いているあいだ、' + fmtG(waited / 60) + '分ほどおきに くりかえします。十分に間があいているので、うるさくはありません。']);
        }
      }
      const on = setOf(flat(then).filter(x => SWITCH_OUT.includes(x.type) && T(x.value)).map(x => x.type));
      const off = setOf(flat(els).filter(x => SWITCH_OUT.includes(x.type) && !T(x.value)).map(x => x.type));
      const offAny = union(off, setOf(flat(then).filter(x => SWITCH_OUT.includes(x.type) && !T(x.value)).map(x => x.type)));
      for(const o of sortedArr(minus(minus(on, offAny), SCOPE_OFF))){
        out.push(['消し忘れ', '「' + (OUT_JA[o] || o) + '」をつける向きしかありません。「そうでなければ」で消していないので、条件に合わなくなっても ついたままになります。']);
      }
      if(inLoop && presses.length && !longs.length && latchedOn(then, true).size === 0){
        const watch = [];
        for(const x of flatShallow(then)){
          if(['if', 'until'].includes(x.type)){
            for(const c of sensorsIn(condOf(x))) if(!PRESS_SENSORS.includes(c[0]) && !watch.includes(c[0])) watch.push(c[0]);
          }
        }
        if(watch.length){
          const btn = sortedArr(setOf(presses.map(x => SENSOR_JA[x[0]] || x[0]))).join('・');
          const w = watch.map(x => SENSOR_JA[x] || x).join('・');
          out.push(['押しているあいだだけ', '「' + btn + '」の『もし』の中で ' + w + ' を見張っているので、見張るのは' + btn +
            'を押しているあいだだけです。指をはなすと、すぐに見張りも止まります。一度押せばずっと続く『モード』にはなっていません。']);
        }
      }
      if(presses.length){
        const both = minus(inter(on, off), latchedOn(then));
        for(const o of sortedArr(both)){
          out.push(['押しているあいだだけ', '「' + (OUT_JA[o] || o) + '」はボタンを押しているあいだだけ動き、指をはなすと止まります。その場にいない時間に使うことはできません。']);
        }
      }
      const seq = (isList(then) ? then : []).filter(x => isDict(x) && x.type === 'speak');
      if(seq.length >= 3){
        out.push(['返事を待っていない', '「' + cut(speakText(seq[0]), 16) + '」など3つ以上のセリフを続けて言います。あいだに「まつ」も分かれ道もないので、相手の返事を聞かずに全部言ってしまいます。']);
      }
      scan(then, inLoop, out, T(presses) ? presses : (T(longs) ? longs : gated), armed);
      scan(els, inLoop, out, gated, armed);
      continue;
    }
    if(t === 'ai'){
      const pr = pyStrOrEmpty(or_(get(a, 'value'), or_(get(a, 'prompt'), ''))).trim();
      if(chars(pr).length < 5 || /^[0-9０-９]+$/.test(pr)){
        out.push(['AIへの指示が足りない', 'AIとおはなしの指示が「' + (pr || '空っぽ') + '」だけです。どんな話し相手になってほしいかが書かれていないので、何を話すかが決まっていません。']);
      }
      if(inLoop && !T(gated)){
        out.push(['AIが鳴りっぱなし', 'AIとおはなしが「もし」の外にあるので、ずっと聞き取りをくりかえします。1回に十数秒かかるため、ほかの「ずっと」はそのあいだ ぜんぶ止まります。']);
      }
    }
  }
}
function talksWithoutIf(acts){
  for(const a of (isList(acts) ? acts : [])){
    if(!isDict(a)) continue;
    const t = a.type;
    if(['speak', 'ai'].includes(t)) return true;
    if(t === 'if') continue;
    if(['forever', 'repeat', 'until'].includes(t) && talksWithoutIf(bodyOf(a))) return true;
  }
  return false;
}
function inspectProgram(program){
  let out = [];
  if(!isDict(program)) return out;
  const acts = or_(program.actions, []);
  const threads = or_(program.threads, []);
  const loose = acts.filter(a => isDict(a) && a.type === 'if' && !(T(a.then) || T(a.else)));
  if(loose.length) out.push(['つないでいないブロック', '中身が空の「もし」が ' + loose.length + '個、くりかえしの外に置かれています。どこにもつながっていないので動きません。']);
  let everything = flat(acts);
  for(const th of threads) everything = everything.concat(flat(bodyOf(th)));
  const hasLoop = T(threads) || everything.some(x => ['forever', 'until'].includes(x.type));
  if(!hasLoop && everything.length){
    out.push(['1回で終わる', '「ずっとくりかえす」がありません。電源を入れた直後に一度だけ動いて、そのあとは何もしなくなります。見守りには使えません。']);
  }
  const outside = outsideLoopIfs(program);
  if(outside.length){
    const names = outside.slice(0, 3).map(a => '「もし ' + condJa(condOf(a)) + '」').join('、');
    out.push(['くりかえしの外', names + (outside.length > 3 ? ' など' + outside.length + 'つ' : '') +
      ' は『ずっと』の外にあります。『ずっと』より上なら 電源を入れたときに1回だけ調べて終わり、下なら 一度も動きません。その時刻や そのときになっても 動きません。']);
  }
  if(doesSomething(program) && !doesSomething(pruneProgram(program)) && !outside.length){
    out.push(['ほぼ動かない条件', '動かすブロックは、どれも 一度も真にならない『もし』の中にあります。このプログラムは、実機では 何もしないままです。']);
  }
  const offIn = l => setOf(flat(l).filter(x => SWITCH_OUT.includes(x.type) && !T(x.value)).map(x => x.type));
  SCOPE_OFF = offIn(acts);
  scan(acts, false, out, null);
  for(const th of threads){
    const body = bodyOf(th);
    SCOPE_OFF = offIn(body);
    scan(body, true, out, null);
  }
  SCOPE_OFF = new Set();
  if(threads.length >= 2){
    const sets = threads.map(th => setOf(flat(bodyOf(th)).filter(x => x.type in OUT_JA).map(x => x.type)));
    let clash = new Set();
    for(let i = 0; i < sets.length; i++) for(let j = i + 1; j < sets.length; j++) clash = union(clash, inter(sets[i], sets[j]));
    for(const o of sortedArr(clash)){
      out.push(['出力の取り合い', '2本以上の「ずっと」が同じ「' + (OUT_JA[o] || o) + '」を変えています。あとから動いたほうが上書きするので、片方の動きがほとんど見えなくなります。']);
    }
    const talkTh = threads.filter(th => flat(bodyOf(th)).some(x => ['speak', 'ai'].includes(x.type))).length;
    let noisy = out.some(([h]) => ['鳴りっぱなし', 'AIが鳴りっぱなし'].includes(h));
    for(const th of threads) if(talksWithoutIf(bodyOf(th))) noisy = true;
    if(talkTh >= 2 && noisy){
      out.push(['声の取り合い', talkTh + '本の「ずっと」が声を出します。実機は何か鳴っているあいだ、あとから来た声を捨てるので、鳴りっぱなしのものがあると ほかの知らせが聞こえなくなります。']);
    }
  }
  const seen = new Set(), uniq = [];
  for(const [h, m] of out){ const k = h + '\u0000' + m; if(seen.has(k)) continue; seen.add(k); uniq.push([h, m]); }
  return uniq;
}
function untilRelease(a){
  const cs = sensorsIn(condOf(a));
  return cs.length > 0 && cs.every(c => PRESS_SENSORS.includes(c[0]) && !T(c[2]));
}
function hasModeLoop(lst){
  return (isList(lst) ? lst : []).some(a => isDict(a) && (a.type === 'forever' || (a.type === 'until' && !untilRelease(a))));
}
function latchedOn(acts, anyLoop){
  let out = new Set();
  const lst = isList(acts) ? acts : [];
  if(hasModeLoop(lst)){
    for(const a of lst){
      if(isDict(a) && SWITCH_OUT.includes(a.type) && T(a.value)){ out.add(a.type); if(anyLoop) out.add('loop'); }
    }
  }
  for(const a of lst){
    if(!isDict(a)) continue;
    const t = a.type;
    if(['until', 'forever'].includes(t) && !(t === 'until' && untilRelease(a))){
      out = union(out, setOf(flat(bodyOf(a)).filter(x => SWITCH_OUT.includes(x.type) && T(x.value)).map(x => x.type)));
      if(anyLoop) out.add('loop');
    } else if(t === 'if'){
      out = union(out, union(latchedOn(a.then, anyLoop), latchedOn(a.else, anyLoop)));
    } else if(t === 'repeat'){
      out = union(out, latchedOn(bodyOf(a), anyLoop));
    }
  }
  return out;
}
function pressOnly(acts, want, gated, found){
  if(!found) found = [0, 0];
  gated = !!gated;
  if(gated && hasModeLoop(acts)) gated = false;
  for(const a of (isList(acts) ? acts : [])){
    if(!isDict(a)) continue;
    const t = a.type;
    if(t === want && T(a.value)){
      found[0] += 1;
      if(gated) found[1] += 1;
    } else if(t === 'if'){
      const press = sensorsIn(condOf(a)).some(c => PRESS_SENSORS.includes(c[0]));
      const off = flat(a.else).some(x => x.type === want && !T(x.value));
      pressOnly(a.then, want, gated || (press && off), found);
      pressOnly(a.else, want, gated, found);
    } else if(t === 'forever' || (t === 'until' && !untilRelease(a))){
      for(const k of ['actions', 'body']) pressOnly(a[k], want, false, found);
    } else {
      for(const k of ['actions', 'body']) pressOnly(a[k], want, gated, found);
    }
  }
  return found;
}
function pirWatch(acts, under, found){
  for(const a of (isList(acts) ? acts : [])){
    if(!isDict(a)) continue;
    const t = a.type;
    const names = setOf(sensorsIn(condOf(a)).map(c => c[0]));
    if(['if', 'until'].includes(t) && names.has('pir')){ found[0] += 1; if(under) found[1] += 1; }
    if(t === 'if'){
      const press = inter(names, setOf(PRESS_SENSORS)).size > 0;
      pirWatch(a.then, under || press, found);
      pirWatch(a.else, under, found);
    } else if(['forever', 'repeat', 'until'].includes(t)){
      pirWatch(bodyOf(a), false, found);
    } else {
      pirWatch(bodyOf(a), under, found);
    }
  }
  return found;
}
function personaConcernList(persona){
  if(!isDict(persona)) return [];
  const c = persona.concerns;
  if(isList(c) && c.length) return c;
  const f = FACTS[persona.name || ''];
  if(f && isList(f.concerns)) return f.concerns;
  const t = persona.trouble || '';
  return t.split('、').filter(x => x.trim());
}
function notifyHours(program){
  let hours = new Set();
  for(const a of allActs(program)){
    if(a.type !== 'if') continue;
    const allc = sensorsIn(condOf(a));
    const cs = allc.filter(c => c[0] === 'hour');
    if(!cs.length) continue;
    const mt = minutesTrue(allc);
    if(mt !== null && mt.length === 0) continue;
    if(!flat(a.then).some(x => ['speak', 'ai'].includes(x.type))) continue;
    const ok = (h, op, v) => { const f = pyFloat(v); return f === null ? true : cmpOk(h, op, f); };
    hours = union(hours, setOf(range(0, 24).filter(h => cs.every(c => ok(h, c[1], c[2])))));
  }
  return hours;
}
function fanStartTemp(program){
  let best = null;
  for(const a of allActs(program)){
    if(a.type !== 'if') continue;
    const cs = sensorsIn(condOf(a)).filter(c => c[0] === 'temp');
    if(!cs.length) continue;
    const onThen = flat(a.then).some(x => x.type === 'fan' && T(x.value));
    const onElse = flat(a.else).some(x => x.type === 'fan' && T(x.value));
    for(const [, op, v0] of cs){
      const v = pyFloat(v0);
      if(v === null) continue;
      let t = null;
      if(onThen && ['>', '>=', '≥'].includes(op)) t = op === '>' ? v : v - 1;
      else if(onElse && ['<', '<=', '≤'].includes(op)) t = op === '<=' ? v : v - 1;
      if(t !== null) best = best === null ? t : Math.min(best, t);
    }
  }
  return best;
}
function heatTells(program){
  for(const a of allActs(program)){
    if(a.type === 'if' && sensorsIn(condOf(a)).some(c => c[0] === 'temp')){
      if(flat(a.then).concat(flat(a.else)).some(x => ['speak', 'ai'].includes(x.type))) return true;
    }
  }
  return false;
}
function cameraHours(program){
  let hours = new Set(), found = false;
  for(const a of allActs(program)){
    if(a.type !== 'if') continue;
    const cs = sensorsIn(condOf(a)).filter(c => c[0] === 'hour');
    if(!cs.length || !flat(a.then).some(x => x.type === 'camera' && T(x.value))) continue;
    found = true;
    hours = union(hours, setOf(range(0, 24).filter(h => cs.every(c => leafOk(h, c[1], c[2])))));
  }
  return found ? hours : null;
}
function hourOf(t){ return parseInt(String(t).split(':')[0], 10); }
function inspectVsPersona(program, persona){
  const out = [];
  if(!isDict(persona) || !isDict(program)) return out;
  const concerns = personaConcernList(persona);
  const orig = program;
  program = pruneProgram(program);
  const facts = FACTS[persona.name || ''] || {};
  const acts = allActs(program);
  const types = setOf(acts.map(x => x.type));
  const cnames = new Set();
  for(const a of acts) for(const c of sensorsIn(condOf(a))) cnames.add(c[0]);
  let cam = pressOnly(program.actions, 'camera');
  for(const th of or_(program.threads, [])){
    const c2 = pressOnly(bodyOf(th), 'camera');
    cam = [cam[0] + c2[0], cam[1] + c2[1]];
  }
  const pn = String(persona.name || '').split(' ').pop() || 'この人';
  for(const c of concerns){
    if(c.indexOf('さみし') >= 0){
      if(!types.has('ai')) out.push(['さみしさ', 'AIとおはなしブロックがありません。決まったセリフを言うだけでは、その日の話し相手にはなれません。']);
    } else if(c.indexOf('薬') >= 0){
      if(!cnames.has('hour') && !cnames.has('minute')){
        out.push(['薬の飲み忘れ', '時こくの条件がありません。ボタンを押したときだけ知らせる作りでは、飲んだか分からなくなる人には届きません（押すことを思いつけないため）。']);
      } else {
        const need = facts.medTimes || [];
        const got = [...notifyHours(program)];
        const miss = need.filter(t => !got.some(h => Math.abs(hourOf(t) - h) <= 1));
        if(need.length && miss.length){
          const ja = t => hourOf(t) + '時' + (String(t).endsWith(':30') ? '半' : '');
          const have = need.filter(t => !miss.includes(t));
          out.push(['薬の飲み忘れ', '薬は1日' + need.length + '回（' + need.map(ja).join('・') + '）ですが、' +
            (have.length ? '知らせてくれるのは ' + have.map(ja).join('・') + ' だけです' : '知らせてくれる時刻が、薬の時刻と合っていません') +
            '。' + miss.map(ja).join('・') + ' の薬は、飲んだか分からなくなってしまいます。']);
        }
      }
    } else if(c.indexOf('防犯') >= 0){
      const camOn = acts.some(x => x.type === 'camera' && T(x.value));
      const away = facts.awayHours;
      const camHours = cameraHours(program);
      if(T(away) && camHours !== null){
        const lack = sortedNum(minus(setOf(range(parseInt(away[0], 10), parseInt(away[1], 10))), camHours));
        if(lack.length){
          out.push(['防犯', 'カメラを時刻で動かしていますが、' + pn + 'さんが 出かけている ' + parseInt(away[0], 10) + '時〜' + parseInt(away[1], 10) +
            '時 のうち、' + lack.join('・') + '時台は 見張っていません。']);
        }
      }
      if(!camOn){
        out.push(['防犯', 'カメラを使っていません。その場で声を出すだけでは、外出中に家のようすを確かめることはできません。']);
      } else if(cam[0] > 0 && cam[0] === cam[1]){
        out.push(['防犯', 'カメラはボタンを押しているあいだしか動きません。家を出た人はボタンを押せないので、外出中の見守りにはなりません。']);
      } else {
        let pw = pirWatch(program.actions, false, [0, 0]);
        for(const th of or_(program.threads, [])) pw = pirWatch(bodyOf(th), false, pw);
        if(pw[0] > 0 && pw[0] === pw[1]){
          out.push(['防犯', '人の見張りが、ボタンを押しているあいだしか動きません。外出中はだれもボタンを押せないので、留守のあいだは家を見張れません。']);
        }
      }
    } else if(c.indexOf('暑') >= 0){
      if(!cnames.has('temp')){
        out.push(['暑さ', '温度センサーの条件がありません。暑くなったことに気づけません。']);
      } else if(!types.has('fan')){
        out.push(['暑さ', '温度は見ていますが、ファンを動かしていません。暑さそのものは変わりません。']);
      } else {
        const heat = facts.heatC;
        const start = fanStartTemp(program);
        if(heat !== undefined && heat !== null && start !== null && start > heat){
          out.push(['暑さ', 'ファンが回り始めるのは、温度が ' + numJa(start) + '度をこえてから です。' + pn + 'さんは ' + numJa(heat) +
            '度をこえると つらくなるので、そのあいだは 暑いままです。']);
        } else if(heat !== undefined && heat !== null && start === null){
          out.push(['暑さ', '暑くなったときに ファンを回す『もし』が見つかりません（温度が上がったら回す形になっていません）。']);
        }
        if(T(facts.heatTell) && !heatTells(program)){
          out.push(['暑さ', '暑くなったことを 声で知らせていません。' + pn + 'さんは『暑くなったら教えてほしい』と言っています。']);
        }
      }
    }
  }
  return out;
}
const sortedNum = s => [...s].sort((a, b) => a - b);

const CAP2 = ['1回で終わる', 'ほぼ動かない条件'];
const CAP3_MISS = ['さみしさ', '薬の飲み忘れ', '防犯', '暑さ'];
const CAP3_BAD = ['鳴りっぱなし', '消し忘れ', 'AIが鳴りっぱなし', 'くりかえしの外'];
const CAP4 = ['出力の取り合い', '声の取り合い', '押しているあいだだけ', '一度も動かない条件',
  'AIへの指示が足りない', '返事を待っていない', 'つないでいないブロック'];
function capStars(stars, findings, coverage){
  const heads = setOf(findings.map(f => f[0]));
  let cap = 5;
  for(const c of (coverage || [])) if(isDict(c) && !T(c.done)){ cap = Math.min(cap, 3); break; }
  const any = list => list.some(h => heads.has(h));
  if(any(CAP2)) cap = Math.min(cap, 2);
  if(any(CAP3_MISS)) cap = Math.min(cap, 3);
  if(any(CAP3_BAD)) cap = Math.min(cap, 3);
  if(any(CAP4)) cap = Math.min(cap, 4);
  return Math.max(1, Math.min(Math.trunc(stars), cap));
}

function basicOk(program, persona, returnDetail){
  if(!isDict(program)) return false;
  const pr = pruneProgram(program);
  const acts = allActs(pr);
  const bigRepeat = x => { if(x.type !== 'repeat') return false; const f = pyFloat(or_(x.times, 0)); return f !== null && f >= 100; };
  if(!(T(pr.threads) || acts.some(x => ['forever', 'until'].includes(x.type) || bigRepeat(x)))) return returnDetail ? null : false;
  if(!doesSomething(pr)) return returnDetail ? null : false;
  const types = setOf(acts.map(x => x.type));
  const on = setOf(acts.filter(x => T(x.value) && ['camera', 'fan', 'led'].includes(x.type)).map(x => x.type));
  const sens = new Set();
  for(const a of acts) for(const c of sensorsIn(condOf(a))) sens.add(c[0]);
  const concerns = personaConcernList(persona || {});
  if(!concerns.length) return false;
  const talks = types.has('ai') || types.has('speak');
  const done = [], missing = [];
  for(const c of concerns){
    let ok;
    if(c.indexOf('さみし') >= 0) ok = talks;
    else if(c.indexOf('薬') >= 0) ok = ['hour', 'minute', 'pir', 'distance'].some(s => sens.has(s)) && talks;
    else if(c.indexOf('防犯') >= 0) ok = on.has('camera') || ((sens.has('pir') || sens.has('distance')) && (talks || on.has('led')));
    else if(c.indexOf('暑') >= 0) ok = sens.has('temp') && (on.has('fan') || talks);
    else return false;
    (ok ? done : missing).push(c);
  }
  if(returnDetail) return [done, missing];
  return !missing.length;
}

/* ---------- お試し版のレビュー（★と ことば） ---------- */
const GOOD = {
  'さみし': 'ボタンを押せば お話しできるので、さみしいときに心強いです。',
  '薬': '薬の時間を知らせてくれるので、飲み忘れが へりそうです。',
  '防犯': '出かけているあいだも 家のことを見てくれるので、安心です。',
  '暑': '暑くなったら ファンが回るので、たすかります。',
};
const FEEL = {   // 点検で見つかったときの、使う人の気もち（直し方は言わない）
  '1回で終わる': 'でも、すぐに止まってしまうみたいで、ふだんの生活では使えなさそうです。',
  'ほぼ動かない条件': 'でも、使ってみても 動かないところがあるみたいです。',
  '一度も動かない条件': 'でも、いつまでたっても 動かないところがあるみたいです。',
  '鳴りっぱなし': 'でも、同じことを 何度も何度も言われると、ちょっとつかれてしまいます。',
  'AIが鳴りっぱなし': 'でも、ずっと話しかけられて、落ち着きません。',
  '消し忘れ': 'でも、つけたものが ずっとつけっぱなしになって、気になります。',
  'くりかえしの外': 'でも、その時間になっても 動かないことがあるみたいです。',
  '出力の取り合い': 'でも、ときどき動きが ちらついて、どっちなのか分かりにくいです。',
  '声の取り合い': 'でも、声が重なって、大事な知らせが 聞こえないことがありそうです。',
  '押しているあいだだけ': 'でも、ボタンを押しているあいだしか 動かないのは こまります。',
  'AIへの指示が足りない': 'でも、お話の相手が どんな話をしてくれるのか、よく分かりません。',
  '返事を待っていない': 'でも、いっぺんに話されて、返事をするひまが ありません。',
  'つないでいないブロック': 'でも、使っていない部品が まざっているみたいです。',
};
const MISS_FEEL = {
  'さみしさ': '話し相手がほしいので、決まったことばだけだと 少しさみしいです。',
  '薬の飲み忘れ': '薬のことは、まだ 飲み忘れが 心配です。',
  '防犯': '出かけているあいだの家のことは、まだ 心配です。',
  '暑さ': '暑さのことは、まだ 心配です。',
};
function keyOf(c){ return Object.keys(GOOD).find(k => c.indexOf(k) >= 0) || ''; }
function shortConcern(c){ return String(c).split(/[（(]/)[0]; }

function review(program, persona){
  const name = (persona && persona.name) || '使う人';
  const findings = inspectProgram(program).concat(inspectVsPersona(program, persona));
  const real = findings.filter(f => !INFO_HEADS.includes(f[0]));
  const det = basicOk(program, persona, true);
  const concerns = personaConcernList(persona);
  let done = [], miss = concerns.slice();
  if(det){ done = det[0]; miss = det[1]; }
  // 点検で「その困りごとに足りないところ」が見つかったものも、まだ解決していないことにする
  const missHeads = setOf(real.map(f => f[0]).filter(h => CAP3_MISS.includes(h)));
  const headOf = c => c.indexOf('さみし') >= 0 ? 'さみしさ' : c.indexOf('薬') >= 0 ? '薬の飲み忘れ'
                    : c.indexOf('防犯') >= 0 ? '防犯' : c.indexOf('暑') >= 0 ? '暑さ' : '';
  const coverage = concerns.map(c => {
    const okBasic = done.includes(c);
    const ok = okBasic && !missHeads.has(headOf(c));
    let why = ok ? 'こたえる仕組みがある' : (okBasic ? '点検で 足りないところがある' : 'こたえる仕組みが まだない');
    return { trouble: c, done: ok, why };
  });
  const nDone = coverage.filter(c => c.done).length, n = coverage.length;
  let stars = nDone === n ? 5 : (nDone > 0 ? 3 : 2);
  if(det === null) stars = 2;
  stars = capStars(stars, real, coverage);

  // ことば：助かったこと → まだ困っていること → 使ってみての気もち
  const parts = [];
  coverage.filter(c => c.done).forEach(c => { const g = GOOD[keyOf(c.trouble)]; if(g && parts.indexOf(g) < 0) parts.push(g); });
  coverage.filter(c => !c.done).forEach(c => {
    const m = MISS_FEEL[headOf(c.trouble)] || ('「' + shortConcern(c.trouble) + '」のことは、まだ こまっています。');
    if(parts.indexOf(m) < 0) parts.push(m);
  });
  const feelHeads = [];
  real.forEach(f => { if(FEEL[f[0]] && feelHeads.indexOf(f[0]) < 0) feelHeads.push(f[0]); });
  feelHeads.slice(0, 2).forEach(h => parts.push(FEEL[h]));
  if(stars >= 5) parts.push('これなら 毎日 安心して使えそうです。ありがとう！');
  else if(!parts.length) parts.push('うーん、わたしの困りごとには まだ合っていないみたいです。');
  return { ok:true, mode:'normal', stars, comment: parts.join(''), match:'', coverage,
           findings: findings.map(([head, msg]) => ({head, msg})), persona: name };
}

global.TrialJudge = {
  setFacts(f){ FACTS = {}; Object.keys(f || {}).forEach(k => { if(isDict(f[k]) && k[0] !== '_') FACTS[k] = f[k]; }); },
  inspectProgram, inspectVsPersona, basicOk, capStars, review, INFO_HEADS,
};
})(window);
