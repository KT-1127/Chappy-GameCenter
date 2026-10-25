/* チャッピーのブロック定義・ツールボックス・プログラム変換（①つくる・④問題解決で共通）
   ★ブロックを増やす・変えるときは、このファイルだけを直す（①と④が自動でそろう）★ */
(function(global){

  function defineBlocks(){
    const B = Blockly.Blocks, F = Blockly.FieldDropdown;
    const FACES = [['ふつう','neutral'],['笑顔','happy'],['悲しい','sad'],['怒り','angry'],['眠い','sleepy'],['困り','doubt']];
    const ONOFF = [['つける','on'],['消す','off']];

    function sensor(name, label, color){
      B[name] = { init(){ this.appendDummyInput().appendField(label); this.setOutput(true,'Number'); this.setColour(color); } };
    }
    sensor('sc_distance','📏 きょり(cm)',174);
    sensor('sc_light','💡 明るさ',174);
    sensor('sc_temp','🌡️ 温度(℃)',174);
    sensor('sc_hour','🕐 いまの時(0-23)',174);
    sensor('sc_minute','🕐 いまの分(0-59)',174);
    B['sc_pir'] = { init(){ this.appendDummyInput().appendField('👤 人がいる'); this.setOutput(true,'Boolean'); this.setColour(174); } };
    B['sc_button_red'] = { init(){ this.appendDummyInput().appendField('🔴 赤ボタン'); this.setOutput(true,'Boolean'); this.setColour(174); } };
    B['sc_button_blue'] = { init(){ this.appendDummyInput().appendField('🔵 青ボタン'); this.setOutput(true,'Boolean'); this.setColour(174); } };
    B['sc_button_both'] = { init(){ this.appendDummyInput().appendField('🔴🔵 赤と青を同時におした'); this.setOutput(true,'Boolean'); this.setColour(174);
      this.setTooltip('赤ボタンと青ボタンの両方を いっしょに おしているとき「本当」になる'); } };

    B['sc_face'] = { init(){
      this.appendDummyInput().appendField('😊 表情').appendField(new F(FACES),'FACE');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_speak'] = { init(){
      this.appendDummyInput().appendField('💬 しゃべる').appendField(new Blockly.FieldTextInput('こんにちは'),'TEXT');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_ai'] = { init(){
      this.appendDummyInput().appendField('🤖 AIとおはなし').appendField(new Blockly.FieldTextInput(''),'PROMPT');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_camera'] = { init(){
      this.appendDummyInput().appendField('📷 カメラ').appendField(new F(ONOFF),'STATE');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_pan'] = { init(){
      this.appendDummyInput().appendField('↔ 首よこ').appendField(new Blockly.FieldNumber(90,0,180),'ANGLE').appendField('°');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_tilt'] = { init(){
      this.appendDummyInput().appendField('↕ 首たて').appendField(new Blockly.FieldNumber(15,0,30),'ANGLE').appendField('°');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_led'] = { init(){
      this.appendDummyInput().appendField('💡 LED').appendField(new F(ONOFF),'STATE');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_fan'] = { init(){
      this.appendDummyInput().appendField('🌀 ファン').appendField(new F(ONOFF),'STATE');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_color'] = { init(){
      this.appendDummyInput().appendField('🎨 色').appendField(new F([
        ['くろ','black'],['あか','red'],['あお','blue'],['みどり','green'],
        ['きいろ','yellow'],['ピンク','pink'],['むらさき','purple'],['しろ','white']]),'COLOR');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_wait'] = { init(){
      this.appendDummyInput().appendField('⏱ 待つ').appendField(new Blockly.FieldNumber(1,0.1,3600),'SEC').appendField('秒');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(16); }};
    B['sc_forever'] = { init(){
      this.appendDummyInput().appendField('🔁 ずっと');
      this.appendStatementInput('DO');
      this.setPreviousStatement(true); this.setColour(120); }};
    B['sc_until'] = { init(){
      this.appendValueInput('COND').setCheck('Boolean').appendField('🔁');
      this.appendDummyInput().appendField('になるまで くりかえす');
      this.appendStatementInput('DO');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(120);
      this.setInputsInline(true); }};
  }

  const toolbox = { kind:'categoryToolbox', contents:[
    { kind:'category', name:'センサー', colour:'174', contents:[
      {kind:'block',type:'sc_distance'},{kind:'block',type:'sc_light'},
      {kind:'block',type:'sc_temp'},{kind:'block',type:'sc_pir'},
      {kind:'block',type:'sc_button_red'},{kind:'block',type:'sc_button_blue'},{kind:'block',type:'sc_button_both'},
      {kind:'block',type:'sc_hour'},{kind:'block',type:'sc_minute'} ]},
    { kind:'category', name:'すう字', colour:'230', contents:[
      {kind:'block',type:'math_number'} ]},
    { kind:'category', name:'はんだん', colour:'40', contents:[
      {kind:'block', type:'controls_if', extraState:{ hasElse:true } },
      {kind:'block', type:'controls_if'},
      {kind:'block',type:'logic_compare'},
      {kind:'block',type:'logic_operation'},
      {kind:'block',type:'logic_boolean'} ]},
    { kind:'category', name:'うごき・はなす', colour:'16', contents:[
      {kind:'block',type:'sc_face'},{kind:'block',type:'sc_speak'},{kind:'block',type:'sc_ai'},{kind:'block',type:'sc_camera'},
      {kind:'block',type:'sc_pan'},{kind:'block',type:'sc_tilt'},
      {kind:'block',type:'sc_led'},{kind:'block',type:'sc_fan'},{kind:'block',type:'sc_color'},{kind:'block',type:'sc_wait'} ]},
    { kind:'category', name:'くりかえし', colour:'120', contents:[
      {kind:'block',type:'sc_forever'},
      {kind:'block',type:'controls_repeat_ext',
        inputs:{ TIMES:{ shadow:{ type:'math_number', fields:{ NUM:5 } } } } },
      {kind:'block',type:'sc_until'} ]},
  ]};

  const OP = { EQ:'==', NEQ:'!=', LT:'<', LTE:'<=', GT:'>', GTE:'>=' };
  const SENSOR = { sc_distance:'distance', sc_light:'light', sc_temp:'temp', sc_pir:'pir', sc_button_red:'button_red', sc_button_blue:'button_blue', sc_button_both:'button_both', sc_hour:'hour', sc_minute:'minute' };

  function blockChainToActions(block){
    const acts = [];
    while(block){ const a = oneBlockToAction(block); if(a) acts.push(a); block = block.getNextBlock(); }
    return acts;
  }
  function oneBlockToAction(b){
    const t = b.type;
    if(t==='sc_face') return {type:'face', value:b.getFieldValue('FACE')};
    if(t==='sc_speak') return {type:'speak', value:b.getFieldValue('TEXT')};
    if(t==='sc_ai') return {type:'ai', value:b.getFieldValue('PROMPT')};
    if(t==='sc_camera') return {type:'camera', value:b.getFieldValue('STATE')==='on'};
    if(t==='sc_pan') return {type:'pan', value:Number(b.getFieldValue('ANGLE'))};
    if(t==='sc_tilt') return {type:'tilt', value:Number(b.getFieldValue('ANGLE'))};
    if(t==='sc_led') return {type:'led', value:b.getFieldValue('STATE')==='on'};
    if(t==='sc_fan') return {type:'fan', value:b.getFieldValue('STATE')==='on'};
    if(t==='sc_color') return {type:'color', value:b.getFieldValue('COLOR')};
    if(t==='sc_wait') return {type:'wait', value:Number(b.getFieldValue('SEC'))};
    if(t==='sc_forever'){
      const inner = b.getInputTargetBlock('DO');
      return {type:'forever', actions:inner ? blockChainToActions(inner) : []};
    }
    if(t==='controls_if') return buildIf(b);
    if(t==='controls_repeat_ext'){
      const times = numberFrom(b.getInputTargetBlock('TIMES')) || 5;
      const body = b.getInputTargetBlock('DO');
      return {type:'repeat', times, actions:body ? blockChainToActions(body) : []};
    }
    if(t==='sc_until'){
      const cond = parseCond(b.getInputTargetBlock('COND'));
      const body = b.getInputTargetBlock('DO');
      return {type:'until', condition:cond, actions:body ? blockChainToActions(body) : []};
    }
    return null;
  }
  function buildIf(b){
    const cond = parseCond(b.getInputTargetBlock('IF0'));
    const then = b.getInputTargetBlock('DO0');
    const els = b.getInputTargetBlock('ELSE');
    return {type:'if', condition:cond, then:then?blockChainToActions(then):[], else:els?blockChainToActions(els):[]};
  }
  function parseCond(cmp){
    if(!cmp) return {sensor:'distance',op:'<',value:0};
    if(cmp.type==='logic_boolean') return {sensor:'button_red',op:'==',value:cmp.getFieldValue('BOOL')==='TRUE'};
    if(SENSOR[cmp.type]) return {sensor:SENSOR[cmp.type],op:'==',value:true};
    if(cmp.type==='logic_operation'){
      const op=cmp.getFieldValue('OP')==='AND'?'and':'or';
      return {type:op, left:parseCond(cmp.getInputTargetBlock('A')), right:parseCond(cmp.getInputTargetBlock('B'))};
    }
    if(cmp.type!=='logic_compare') return {sensor:'distance',op:'<',value:0};
    const rawOp = OP[cmp.getFieldValue('OP')] || '<';
    const A = cmp.getInputTargetBlock('A'), B = cmp.getInputTargetBlock('B');
    // プログラムは「センサー 記号 数」の形で持つ。
    // 生徒が「数 記号 センサー」（例：28 < 温度）と置いたときは、
    // 左右を入れかえる分だけ 記号の向きも 反対にしないと、意味が逆になる。
    let sensor = null, value = 0, sensorOnRight = false;
    if(A && SENSOR[A.type]) sensor = SENSOR[A.type];
    if(B && SENSOR[B.type] && sensor === null){ sensor = SENSOR[B.type]; sensorOnRight = true; }
    [A,B].forEach(x => { if(x && !SENSOR[x.type]){ const n = numberFrom(x); if(n != null) value = n; } });
    if(sensor === null) sensor = 'distance';
    const FLIP = { '<':'>', '>':'<', '<=':'>=', '>=':'<=', '==':'==', '!=':'!=' };
    return { sensor, op: sensorOnRight ? FLIP[rawOp] : rawOp, value };
  }
  function numberFrom(b){ return b && b.type==='math_number' ? Number(b.getFieldValue('NUM')) : null; }

  // ワークスペース → 実機に送る形。「ずっと」が2つ以上あれば並列スレッドに分ける
  function buildProgram(ws){
    if(!ws) return {actions:[]};
    const tops = ws.getTopBlocks(true).filter(b => !b.outputConnection);
    let actions = [];
    tops.forEach(t => { actions = actions.concat(blockChainToActions(t)); });
    const forevers = actions.filter(a => a.type === 'forever');
    if(forevers.length >= 2){
      const rest = actions.filter(a => a.type !== 'forever');
      return { actions: rest, threads: forevers.map(f => ({ actions: f.actions || [] })) };
    }
    return {actions};
  }

  global.ChappyBlocks = { defineBlocks, toolbox, buildProgram };
})(window);
