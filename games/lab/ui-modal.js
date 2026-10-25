/* 画面のまん中に出す 確認・お知らせのウィンドウ（ブラウザの上から下りてくる confirm / alert のかわり）
   uiAsk('…よろしいですか？')  → Promise<true/false>
   uiTell('…しました')         → Promise（OK を押すまで） */
(function(){
  const CSS = `
  .uim-bg{ position:fixed; inset:0; background:rgba(20,28,40,.45); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px; }
  .uim-box{ background:#fff; border-radius:16px; box-shadow:0 12px 40px rgba(20,28,40,.3); width:min(460px,100%); padding:20px 20px 16px;
    font-family:"Hiragino Maru Gothic ProN","BIZ UDPGothic","Yu Gothic UI","Meiryo",sans-serif; color:#1E2A38; animation:uimIn .15s ease-out; }
  @keyframes uimIn{ from{ transform:scale(.96); opacity:0; } to{ transform:none; opacity:1; } }
  .uim-msg{ font-size:15px; font-weight:800; line-height:1.7; white-space:pre-wrap; }
  .uim-btns{ display:flex; gap:10px; justify-content:flex-end; margin-top:18px; flex-wrap:wrap; }
  .uim-btns button{ padding:10px 20px; border:0; border-radius:10px; font-weight:800; font-size:14px; cursor:pointer; font-family:inherit; }
  .uim-ok{ background:#2F6FB0; color:#fff; } .uim-cancel{ background:#E2E9F2; color:#24527F; }
  `;
  function css(){
    if(document.getElementById('uimCss')) return;
    const s = document.createElement('style'); s.id = 'uimCss'; s.textContent = CSS; document.head.appendChild(s);
  }
  function open(msg, withCancel, okLabel, cancelLabel){
    css();
    return new Promise(resolve => {
      const bg = document.createElement('div'); bg.className = 'uim-bg'; bg.id = 'uiModal';
      bg.innerHTML = '<div class="uim-box" role="dialog" aria-modal="true"><div class="uim-msg"></div><div class="uim-btns">' +
        (withCancel ? '<button type="button" class="uim-cancel" id="uiModalCancel"></button>' : '') +
        '<button type="button" class="uim-ok" id="uiModalOk"></button></div></div>';
      bg.querySelector('.uim-msg').textContent = String(msg == null ? '' : msg);
      bg.querySelector('.uim-ok').textContent = okLabel || 'OK';
      if(withCancel) bg.querySelector('.uim-cancel').textContent = cancelLabel || 'やめる';
      const done = v => { document.removeEventListener('keydown', key, true); bg.remove(); resolve(v); };
      const key = e => { if(e.key === 'Escape'){ e.preventDefault(); done(false); } else if(e.key === 'Enter'){ e.preventDefault(); done(true); } };
      bg.querySelector('.uim-ok').onclick = () => done(true);
      if(withCancel){
        bg.querySelector('.uim-cancel').onclick = () => done(false);
        bg.addEventListener('click', e => { if(e.target === bg) done(false); });
      }
      document.addEventListener('keydown', key, true);
      document.body.appendChild(bg);
      bg.querySelector('.uim-ok').focus();
    });
  }
  window.uiAsk = (msg, okLabel, cancelLabel) => open(msg, true, okLabel || 'はい', cancelLabel);
  window.uiTell = (msg) => open(msg, false);
})();
