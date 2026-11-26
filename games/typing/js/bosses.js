/*!
 * bosses.js — りんごキャノンのボス（ニセチャッピー・ワルチャッピー）の見た目
 *
 *   const b = CT.Bosses.make("fake");   // "fake" / "evil" / "mecha" / "ghost" / "king"
 *   box.appendChild(b.el);
 *   b.face("hurt");                       // normal / hurt / ko / win
 *
 * チャッピーの絵（chappy.js）をもとに、目・口・しっぽの先を描きかえ、
 * うしろ（つばさ・マント・オーラ）と前（つの・ひび）に部品を足す。色は css/features.css の .boss-*。
 */
(function (global) {
"use strict";

const NS = "http://www.w3.org/2000/svg";

// 目と口（チャッピーの絵の座標）。右目は x=420 を中心に左右反転
const mirror = (d) => `<g transform="translate(840,0) scale(-1,1)">${d}</g>`;

const FACES = {
  fake: {
    eyeFill: "#d8ff3c", glow: "#d8ff3c",
    normal: {
      eyes: (() => {
        const one = '<path d="M226,382 L358,426 Q300,466 240,442 Z" fill="#d8ff3c"/><ellipse cx="300" cy="428" rx="7" ry="19" fill="#1a0022"/>';
        return one + mirror(one);
      })(),
      mouth: '<path d="M326,476 Q420,556 514,476 Q420,516 326,476 Z" fill="#ff3fd0"/>' +
             '<path d="M342,484 L356,500 L370,489 L384,506 L398,493 L412,510 L426,494 L440,510 L454,493 L468,506 L482,489 L496,500 L508,484" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>',
    },
  },
  evil: {
    eyeFill: "#ff2a1a", glow: "#ff2a1a",
    normal: {
      eyes: (() => {
        const one = '<path d="M222,376 L364,430 Q306,474 236,448 Z" fill="#ff2a1a"/><path d="M262,412 L332,436 Q300,454 268,440 Z" fill="#ffd9a8"/>';
        return one + mirror(one);
      })(),
      mouth: '<path d="M346,486 Q420,466 494,486 L482,520 Q420,502 358,520 Z" fill="#2a0000" stroke="#ff2a1a" stroke-width="6" stroke-linejoin="round"/>' +
             '<path d="M370,488 L384,524 L396,486 Z M444,486 L456,524 L470,488 Z" fill="#fff"/>',
    },
  },
};
FACES.mecha = {
  normal: {
    // 赤いバイザー（横に走る光）と、口のスリット
    eyes: '<rect x="214" y="384" width="412" height="58" rx="29" fill="#2a0303" stroke="#ff2a1a" stroke-width="7"/>' +
          '<rect class="bs-scan" x="232" y="396" width="96" height="34" rx="17" fill="#ff3b30"/>',
    mouth: '<path d="M352,486 H488 M352,506 H488 M352,526 H488" stroke="#5ff2ff" stroke-width="8" stroke-linecap="round" opacity=".9"/>',
  },
};
FACES.ghost = {
  normal: {
    // 大きな うつろな目と、ぽかんと開いた口
    eyes: (() => {
      const one = '<ellipse cx="296" cy="414" rx="44" ry="56" fill="#06121f"/><circle cx="304" cy="424" r="13" fill="#7fe8ff"/>';
      return one + mirror(one);
    })(),
    mouth: '<ellipse cx="420" cy="506" rx="28" ry="22" fill="#06121f"/>',
  },
};
FACES.king = {
  normal: {
    // 金色に光る目（赤いひとみ）と、きばのある笑い
    eyes: (() => {
      const one = '<path d="M222,382 L364,428 Q302,468 236,446 Z" fill="#ffd23f"/><ellipse cx="300" cy="430" rx="7" ry="18" fill="#c4001a"/>';
      return one + mirror(one);
    })(),
    mouth: '<path d="M326,478 Q420,548 514,478" fill="none" stroke="#ffd23f" stroke-width="10" stroke-linecap="round"/>' +
           '<path d="M372,500 L384,530 L396,506 Z M444,506 L456,530 L468,500 Z" fill="#fff"/>',
  },
};
const COMMON = {
  hurt: {
    eyes: '<path d="M244,392 L340,420 L244,448" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>' +
          mirror('<path d="M244,392 L340,420 L244,448" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>'),
    mouth: '<path d="M360,500 Q390,480 420,500 Q450,520 480,500" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>',
  },
  ko: {
    eyes: '<path d="M262,386 L330,454 M330,386 L262,454" stroke="#fff" stroke-width="16" stroke-linecap="round"/>' +
          mirror('<path d="M262,386 L330,454 M330,386 L262,454" stroke="#fff" stroke-width="16" stroke-linecap="round"/>'),
    mouth: '<path d="M350,500 Q372,482 394,500 Q416,518 438,500 Q460,482 482,500" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>',
  },
};

// うしろの部品（体よりうしろ）
const BACK = {
  // とげとげの結晶のオーラ
  fake: (() => {
    let pts = "";
    const cx = 440, cy = 400, n = 14;
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * 2 * i) / (n * 2) - Math.PI / 2;
      const r = i % 2 ? 250 : 420 + (i % 4 === 0 ? 40 : 0);
      pts += `${Math.round(cx + Math.cos(a) * r)},${Math.round(cy + Math.sin(a) * r * 0.92)} `;
    }
    return `<g class="bs-shards"><polygon points="${pts}" fill="url(#bsFakeGrad)" stroke="#ff4fe0" stroke-width="6" stroke-linejoin="round" opacity=".9"/></g>` +
      '<path d="M250,612 Q440,566 630,612 L700,930 L630,890 L560,960 L490,900 L420,970 L350,900 L280,960 L220,890 L170,930 Z" fill="#3a0f52" stroke="#ff4fe0" stroke-width="6" stroke-linejoin="round"/>';
  })(),
  // こうもりのつばさ と 赤いマント
  evil: (() => {
    const wing = '<g class="bs-wing">' +
      '<path d="M300,650 C190,520 50,420 -80,440 C-36,512 -44,560 -64,622 C0,592 40,612 50,676 C92,634 144,642 164,706 C196,664 238,668 268,724 Z" fill="#160709" stroke="#c4271c" stroke-width="7" stroke-linejoin="round"/>' +
      '<path d="M300,650 L-80,440 M300,650 L-64,622 M300,650 L50,676 M300,650 L164,706" stroke="#c4271c" stroke-width="5" opacity=".75"/></g>';
    return `<g class="bs-wing-l">${wing}</g><g class="bs-wing-r" transform="translate(880,0) scale(-1,1)">${wing}</g>` +
      '<path d="M248,612 Q440,560 632,612 L756,982 Q440,1036 124,982 Z" fill="#7a0d12" stroke="#2a0406" stroke-width="8" stroke-linejoin="round"/>' +
      '<path d="M300,640 Q440,610 580,640 L640,950 Q440,985 240,950 Z" fill="#4a070b"/>';
  })(),
};

// メカ：ジェットパック
BACK.mecha = '<rect x="176" y="560" width="78" height="210" rx="34" fill="#5b6b7c" stroke="#232b36" stroke-width="9"/>' +
  '<rect x="626" y="560" width="78" height="210" rx="34" fill="#5b6b7c" stroke="#232b36" stroke-width="9"/>' +
  '<g class="bs-jet"><path d="M186,770 Q215,900 244,770 Z M636,770 Q665,900 694,770 Z" fill="#ffb347"/>' +
  '<path d="M200,770 Q215,850 230,770 Z M650,770 Q665,850 680,770 Z" fill="#fff4c2"/></g>';
// ゴースト：ゆらめく影
BACK.ghost = '<g class="bs-wisp"><ellipse cx="440" cy="560" rx="380" ry="420" fill="url(#bsGhostGrad)"/></g>';
// 魔王：金ふちの大マントと、とげの えり
BACK.king = (() => {
  let spikes = "";
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.08 + (i / 8) * 0.84);
    const x1 = 440 + Math.cos(a - 0.09) * 300, y1 = 470 + Math.sin(a - 0.09) * 300;
    const x2 = 440 + Math.cos(a) * 470, y2 = 470 + Math.sin(a) * 470;
    const x3 = 440 + Math.cos(a + 0.09) * 300, y3 = 470 + Math.sin(a + 0.09) * 300;
    spikes += `${Math.round(x1)},${Math.round(y1)} ${Math.round(x2)},${Math.round(y2)} ${Math.round(x3)},${Math.round(y3)} `;
  }
  return `<polygon points="${spikes}" fill="#2a0a44" stroke="#f2c94c" stroke-width="7" stroke-linejoin="round"/>` +
    '<path d="M226,600 Q440,540 654,600 L820,1000 Q440,1060 60,1000 Z" fill="#3b0f5c" stroke="#f2c94c" stroke-width="12" stroke-linejoin="round"/>' +
    '<path d="M290,630 Q440,600 590,630 L680,960 Q440,1000 200,960 Z" fill="#22063a"/>';
})();

// 前の部品（頭の前）
const FRONT = {
  // 画面のひび と バグのかけら
  fake: '<path d="M650,292 L606,346 L632,370 L590,424 L612,444" fill="none" stroke="#ff7af0" stroke-width="7" stroke-linejoin="round" opacity=".85"/>' +
        '<g class="bs-glitch"><rect x="150" y="250" width="46" height="14" fill="#2ef2ff"/><rect x="700" y="520" width="60" height="12" fill="#ff4fe0"/>' +
        '<rect x="180" y="560" width="34" height="10" fill="#ff4fe0"/><rect x="690" y="270" width="28" height="10" fill="#2ef2ff"/></g>',
  // 大きなつの
  evil: (() => {
    const horn = '<path d="M306,226 C246,160 208,86 236,0 C280,70 330,112 384,196 Z" fill="#8e1b14" stroke="#2a0505" stroke-width="9" stroke-linejoin="round"/>' +
                 '<path d="M236,0 C246,40 262,66 284,92" fill="none" stroke="#ff8a6a" stroke-width="7" stroke-linecap="round" opacity=".8"/>';
    return horn + `<g transform="translate(900,0) scale(-1,1)">${horn}</g>`;
  })(),
};

// メカ：アンテナ と ほおのボルト
FRONT.mecha = '<path d="M450,196 L450,92" stroke="#8a97a6" stroke-width="13" stroke-linecap="round"/>' +
  '<circle class="bs-blink" cx="450" cy="80" r="22" fill="#ff3b30" stroke="#5a0a05" stroke-width="5"/>' +
  '<circle cx="196" cy="500" r="17" fill="#c9d3dd" stroke="#4b5866" stroke-width="5"/><circle cx="702" cy="500" r="17" fill="#c9d3dd" stroke="#4b5866" stroke-width="5"/>' +
  '<path d="M188,500 h16 M694,500 h16" stroke="#4b5866" stroke-width="5"/>';
FRONT.ghost = '<g class="bs-glitch"><circle cx="160" cy="300" r="10" fill="#7fe8ff" opacity=".7"/><circle cx="730" cy="260" r="8" fill="#7fe8ff" opacity=".6"/></g>';
// 魔王：大きな王冠 と 金のつの
FRONT.king = (() => {
  const horn = '<path d="M300,236 C220,200 170,120 200,30 C240,96 300,140 372,200 Z" fill="#f2c94c" stroke="#7a5a10" stroke-width="8" stroke-linejoin="round"/>';
  return horn + `<g transform="translate(900,0) scale(-1,1)">${horn}</g>` +
    '<g transform="translate(450,206)"><path d="M-120,0 L-120,-86 L-60,-40 L0,-120 L60,-40 L120,-86 L120,0 Z" fill="#ffd23f" stroke="#a7740f" stroke-width="9" stroke-linejoin="round"/>' +
    '<rect x="-124" y="-12" width="248" height="26" rx="10" fill="#e9b52a" stroke="#a7740f" stroke-width="7"/>' +
    '<circle cx="0" cy="-44" r="18" fill="#d01c3a"/><circle cx="-66" cy="-22" r="12" fill="#7a2bd6"/><circle cx="66" cy="-22" r="12" fill="#2ea6b3"/>' +
    '<circle cx="-120" cy="-92" r="12" fill="#ffd23f" stroke="#a7740f" stroke-width="5"/><circle cx="0" cy="-126" r="14" fill="#ffd23f" stroke="#a7740f" stroke-width="5"/><circle cx="120" cy="-92" r="12" fill="#ffd23f" stroke="#a7740f" stroke-width="5"/></g>';
})();
// ゴースト：足をかくす おばけの布（体の前・頭のうしろ）
const NECK = {
  ghost: '<path d="M232,630 C226,760 212,860 192,962 Q236,922 278,968 Q320,916 362,970 Q404,918 446,972 Q488,918 530,968 Q572,916 612,964 Q652,922 676,960 C656,860 650,760 648,630 Z" fill="rgba(214,240,255,.88)" stroke="#9fd8ff" stroke-width="7" stroke-linejoin="round"/>',
};

// しっぽの先（りんごの代わり）
const TAIL = {
  // ばくだん（ニセのりんご）
  fake: '<circle cx="858" cy="236" r="78" fill="#2a1036" stroke="#ff4fe0" stroke-width="7"/>' +
        '<ellipse cx="830" cy="206" rx="22" ry="14" fill="#fff" opacity=".35"/>' +
        '<rect x="840" y="146" width="36" height="24" rx="6" fill="#5b2a74"/>' +
        '<path d="M858,148 Q870,110 900,100" fill="none" stroke="#c9a46a" stroke-width="8" stroke-linecap="round"/>' +
        '<g class="bs-spark"><path d="M904,70 L912,92 L934,96 L914,106 L916,130 L902,112 L880,120 L892,100 L878,82 L900,88 Z" fill="#ffe14d"/></g>',
  // 闇の炎の玉
  evil: '<g class="bs-flame"><path d="M858,120 C900,160 930,190 922,240 C960,210 948,150 930,120 C960,140 990,200 960,260 C940,310 780,310 760,250 C740,200 780,170 800,130 C800,180 820,200 840,200 C830,170 834,140 858,120 Z" fill="#ff5a1a" opacity=".9"/></g>' +
        '<circle cx="858" cy="250" r="64" fill="url(#bsOrbGrad)" stroke="#ff2a1a" stroke-width="6"/>',
  // 歯車
  mecha: (() => {
    let d = "";
    const cx = 858, cy = 236, n = 12;
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * 2 * i) / (n * 2);
      const r = i % 2 ? 66 : 84;
      const a2 = a + Math.PI / (n * 2);
      d += `${i ? "L" : "M"}${Math.round(cx + Math.cos(a) * r)},${Math.round(cy + Math.sin(a) * r)} L${Math.round(cx + Math.cos(a2) * r)},${Math.round(cy + Math.sin(a2) * r)} `;
    }
    return `<g class="bs-gear"><path d="${d}Z" fill="#9aa8b8" stroke="#3a4552" stroke-width="7" stroke-linejoin="round"/><circle cx="${cx}" cy="${cy}" r="26" fill="#3a4552"/></g>`;
  })(),
  // 青いひとだま
  ghost: '<g class="bs-flame"><path d="M858,110 C900,150 930,190 920,240 C955,215 945,160 930,130 C960,150 985,205 958,262 C936,310 784,310 762,252 C742,204 780,170 800,136 C802,184 820,204 840,204 C830,172 834,138 858,110 Z" fill="#7fe8ff" opacity=".85"/></g>' +
         '<circle cx="858" cy="252" r="56" fill="#e8fbff" stroke="#7fe8ff" stroke-width="7"/>',
  // 魔王のつえの宝玉
  king: '<circle cx="858" cy="236" r="74" fill="url(#bsKingGrad)" stroke="#f2c94c" stroke-width="10"/>' +
        '<ellipse cx="858" cy="236" rx="104" ry="26" fill="none" stroke="#f2c94c" stroke-width="7" transform="rotate(-20 858 236)"/>' +
        '<g class="bs-spark"><path d="M906,150 L914,172 L936,176 L916,186 L918,210 L904,192 L882,200 L894,180 L880,162 L902,168 Z" fill="#fff4c2"/></g>',
};

function svgFrag(markup) {
  const g = document.createElementNS(NS, "g");
  g.innerHTML = markup;
  return g;
}

function make(kind) {
  const def = FACES[kind] ? kind : "fake";
  const cp = global.Chappy.create({ label: false, fixedSkin: true, skin: "none" });
  const svg = cp.el;
  svg.classList.add("bs", "bs-" + def);
  // グラデーション
  const defs = svg.querySelector("defs");
  defs.insertAdjacentHTML("beforeend",
    '<radialGradient id="bsFakeGrad"><stop offset="0" stop-color="#ff4fe0" stop-opacity=".75"/><stop offset=".6" stop-color="#7a2bd6" stop-opacity=".5"/><stop offset="1" stop-color="#2ef2ff" stop-opacity=".15"/></radialGradient>' +
    '<radialGradient id="bsOrbGrad"><stop offset="0" stop-color="#fff1b0"/><stop offset=".35" stop-color="#ff7a1a"/><stop offset=".75" stop-color="#9b0a0a"/><stop offset="1" stop-color="#1a0000"/></radialGradient>' +
    '<radialGradient id="bsGhostGrad"><stop offset="0" stop-color="#7fe8ff" stop-opacity=".35"/><stop offset=".7" stop-color="#3a6aa8" stop-opacity=".15"/><stop offset="1" stop-color="#3a6aa8" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="bsKingGrad"><stop offset="0" stop-color="#f3d9ff"/><stop offset=".4" stop-color="#9b4dff"/><stop offset=".85" stop-color="#3b0f5c"/><stop offset="1" stop-color="#14031f"/></radialGradient>');
  const all = svg.querySelector(".cp-all");
  const back = svgFrag(BACK[def]);
  back.setAttribute("class", "bs-back");
  all.insertBefore(back, all.firstChild);
  const front = svg.querySelector(".cp-acc-front");
  if (front) front.innerHTML = FRONT[def];
  const neck = svg.querySelector(".cp-acc-neck");
  if (neck) neck.innerHTML = NECK[def] || "";
  const apple = svg.querySelector(".cp-apple");
  if (apple) apple.innerHTML = TAIL[def];
  const eyes = svg.querySelector(".cp-eyes");
  const mouth = svg.querySelector(".cp-mouth");

  let cur = "";
  function face(name) {
    if (name === cur) return;
    cur = name;
    const f = name === "hurt" || name === "ko" ? COMMON[name] : FACES[def].normal;
    eyes.innerHTML = f.eyes;
    mouth.innerHTML = f.mouth;
    svg.classList.toggle("bs-hurt", name === "hurt");
    svg.classList.toggle("bs-ko", name === "ko");
  }
  face("normal");
  return { el: svg, cp, face, kind: def };
}

global.CT = global.CT || {};
global.CT.Bosses = { make };
})(window);
