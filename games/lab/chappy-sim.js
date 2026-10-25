/* チャッピー画面シミュレータ（④問題解決の「ためす」用）
   program = { actions:[...], threads:[{actions:[...]}, ...] }  ← 実機に送る形と同じ
   - ずっと が2つ以上(threads)なら同時に動く
   - 待つ は speed 倍に早送りして見せる */
(function(global){
  const FACE_SVG = `
  <svg x="0" y="8" width="220" height="200" viewBox="0 0 220 190">
    <rect x="80" y="158" width="60" height="14" rx="7" fill="#C7D2DE"/>
    <rect x="102" y="146" width="16" height="16" rx="4" fill="#AEBDCB"/>
    <g class="head">
      <rect x="28" y="10" width="164" height="140" rx="22" fill="#14181F"/>
      <rect x="36" y="18" width="148" height="124" rx="16" fill="#0B0E13"/>
      <circle class="eyeL" cx="76"  cy="72" r="15" fill="#FFFFFF"/>
      <circle class="eyeR" cx="144" cy="72" r="15" fill="#FFFFFF"/>
      <path class="browL" d="" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path class="browR" d="" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path class="mouth" d="M 78 116 Q 110 116 142 116" stroke="#FFFFFF" stroke-width="7" fill="none" stroke-linecap="round"/>
    </g>
  </svg>
  <text class="say" x="110" y="212" fill="#5B6B7E" font-size="12" font-weight="700" text-anchor="middle"></text>`;

  const COLOR_HEX = { white:'#FFFFFF', black:'#FFFFFF', red:'#FF5A5A', blue:'#39D6E8', green:'#5AE07A',
                      yellow:'#FFD23F', pink:'#FF7FB6', purple:'#B98CFF' };

  function drawFace(svg, st){
    const eye = COLOR_HEX[st.color] || '#FFFFFF';
    const q = s => svg.querySelector(s);
    const eyeL = q('.eyeL'), eyeR = q('.eyeR'), mouth = q('.mouth'), browL = q('.browL'), browR = q('.browR'), head = q('.head');
    if(!eyeL) return;
    [eyeL, eyeR].forEach(e => e.setAttribute('fill', eye));
    [mouth, browL, browR].forEach(e => e.setAttribute('stroke', eye));
    browL.setAttribute('d', ''); browR.setAttribute('d', '');
    eyeL.setAttribute('r', '15'); eyeR.setAttribute('r', '15');
    eyeL.setAttribute('cy', '72'); eyeR.setAttribute('cy', '72');
    const f = st.face;
    if(f === 'happy'){
      mouth.setAttribute('d', 'M 76 110 Q 110 140 144 110');
      eyeL.setAttribute('cy', '70'); eyeR.setAttribute('cy', '70');
    } else if(f === 'sad'){
      mouth.setAttribute('d', 'M 76 126 Q 110 102 144 126');
      browL.setAttribute('d', 'M 62 58 L 88 48'); browR.setAttribute('d', 'M 158 58 L 132 48');
    } else if(f === 'angry'){
      mouth.setAttribute('d', 'M 78 124 Q 110 112 142 124');
      browL.setAttribute('d', 'M 62 50 L 88 60'); browR.setAttribute('d', 'M 158 50 L 132 60');
    } else if(f === 'sleepy'){
      mouth.setAttribute('d', 'M 88 118 Q 110 124 132 118');
      eyeL.setAttribute('r', '5'); eyeR.setAttribute('r', '5');
    } else if(f === 'doubt'){
      mouth.setAttribute('d', 'M 80 120 Q 110 112 140 124');
      browL.setAttribute('d', 'M 62 50 L 88 56'); browR.setAttribute('d', 'M 158 56 L 132 48');
    } else {
      mouth.setAttribute('d', 'M 78 116 Q 110 116 142 116');
    }
    const rot = (st.pan - 90) / 3, dy = (15 - st.tilt) * 0.5;
    head.setAttribute('transform', 'translate(0 ' + dy + ') rotate(' + rot + ' 110 88)');
    q('.say').textContent = st.speech ? '「' + st.speech + '」' : '';
  }

  function newState(){
    return { face:'neutral', speech:'', color:'white', pan:90, tilt:15, led:false, fan:false, camera:false };
  }

  function evalCond(c, s){
    if(!c) return false;
    if(c.type === 'and') return evalCond(c.left, s) && evalCond(c.right, s);
    if(c.type === 'or')  return evalCond(c.left, s) || evalCond(c.right, s);
    const a = Number(s[c.sensor] || 0), b = Number(c.value);
    switch(c.op){
      case '<': return a < b;   case '<=': return a <= b;
      case '>': return a > b;   case '>=': return a >= b;
      case '==': return a === b; case '!=': return a !== b;
    }
    return false;
  }

  // opts: { sensors:()=>({distance,light,temp,hour,minute,pir,button_red,button_blue}), paint:(state)=>void,
  //         speed:()=>number, onEnd:()=>void }
  function createRunner(opts){
    let token = 0, running = false;
    const st = newState();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const paint = () => { try { opts.paint(st); } catch(e){} };

    async function wait(ms, my){
      const end = Date.now() + ms;
      while(Date.now() < end){
        if(token !== my) return;
        await sleep(Math.min(40, Math.max(1, end - Date.now())));
      }
    }
    const cond = c => evalCond(c, opts.sensors());

    async function list(arr, my){
      for(const a of (arr || [])){
        if(token !== my) return;
        await one(a, my);
      }
    }
    async function one(a, my){
      if(!a) return;
      switch(a.type){
        case 'face':   st.face = a.value || 'neutral'; paint(); await wait(150, my); break;
        case 'speak': {
          st.speech = a.value || a.text || ''; paint();
          await wait(Math.min(3000, 900 + st.speech.length * 90), my);
          st.speech = ''; paint(); break;
        }
        case 'color':  st.color = a.value || 'white'; paint(); await wait(150, my); break;
        case 'pan':    st.pan = Number(a.value); paint(); await wait(350, my); break;
        case 'tilt':   st.tilt = Number(a.value); paint(); await wait(350, my); break;
        case 'led':    st.led = !!a.value; paint(); await wait(150, my); break;
        case 'fan':    st.fan = !!a.value; paint(); await wait(150, my); break;
        case 'camera': st.camera = !!a.value; paint(); await wait(150, my); break;
        case 'ai':
          st.face = 'happy'; st.speech = '🤖 AIとおはなし（実機で動くよ）'; paint();
          await wait(1500, my); st.speech = ''; paint(); break;
        case 'wait': {
          const sp = Math.max(1, Number(opts.speed ? opts.speed() : 1) || 1);
          await wait(Math.max(20, Number(a.value) * 1000 / sp), my); break;
        }
        case 'forever':
          while(token === my){ await list(a.actions, my); await wait(60, my); }
          break;
        case 'repeat': {
          const n = Math.max(0, Number(a.times) || 0);
          for(let i = 0; i < n && token === my; i++) await list(a.actions, my);
          break;
        }
        case 'until':
          while(token === my && !cond(a.condition)){ await list(a.actions, my); await wait(60, my); }
          break;
        case 'if':
          if(cond(a.condition)) await list(a.then, my);
          else await list(a.else, my);
          break;
      }
    }

    async function start(program){
      stop();
      const my = ++token; running = true;
      Object.assign(st, newState()); paint();
      try {
        await list(program.actions, my);
        const th = program.threads || [];
        if(th.length && token === my){
          await Promise.all(th.map(async t => {
            while(token === my){ await list(t.actions, my); await wait(60, my); }
          }));
        }
      } catch(e){ console.error(e); }
      if(token === my){ running = false; if(opts.onEnd) opts.onEnd(); }
    }
    function stop(){ token++; running = false; }
    return { start, stop, isRunning: () => running, state: st, reset: () => { Object.assign(st, newState()); paint(); } };
  }

  // 「ずっと」が複数のとき、2本以上のスレッドが同じ出力(表情・LED…)を変えていないか調べる。
  // 同時に動くと あとから動いた方が上書きして、片方の動きが見えなくなるため。
  const STATE_OUT = { face:'表情', color:'目と口の色', pan:'首の左右', tilt:'首の上下', led:'LED', fan:'ファン', camera:'カメラ' };
  function collectOutputs(list, set){
    (list || []).forEach(a => {
      if(!a) return;
      if(STATE_OUT[a.type]) set.add(a.type);
      collectOutputs(a.actions || a.body, set);
      collectOutputs(a.then, set);
      collectOutputs(a.else, set);
    });
  }
  function findConflicts(prog){
    const th = (prog && prog.threads) || [];
    if(th.length < 2) return [];
    const count = {};
    th.forEach(t => {
      const s = new Set(); collectOutputs(t.actions, s);
      s.forEach(k => { count[k] = (count[k] || 0) + 1; });
    });
    return Object.keys(count).filter(k => count[k] >= 2).map(k => STATE_OUT[k]);
  }

  // 実機のファームが「並列・〜になるまで・時刻」に対応しているか（テレメトリの fw が2以上）
  function needsNewFirmware(prog){
    if(prog && prog.threads && prog.threads.length > 0) return true;
    const s = JSON.stringify(prog || {});
    return s.includes('"type":"until"') || s.includes('"sensor":"hour"') || s.includes('"sensor":"minute"');
  }
  // 戻り値: 接続中でなければ null（わからない）／ 接続中なら fw 番号（fw を送らない古い実機は 1）
  async function deviceFw(device){
    try {
      const j = await (await fetch('/api/telemetry?device=' + encodeURIComponent(device))).json();
      if(!(j.devices || []).includes(device)) return null;
      return Number((j.latest || {}).fw) || 1;
    } catch(e){ return null; }
  }
  const FW_WARN = '⚠ この実機のプログラム（ファーム）が古くて、「ずっと2つ（並列）」「〜になるまで」「いまの時」は動きません。先生に、実機の書き込み直し（main.cpp）をお願いしてね';

  global.ChappySim = { FACE_SVG, drawFace, createRunner, newState, findConflicts, needsNewFirmware, deviceFw, FW_WARN };
})(window);
