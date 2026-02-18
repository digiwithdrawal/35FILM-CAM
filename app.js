// app.js — FilmRoll Cam V2.1
// Live film preview + photo only + film picker grouped by brand + random + flash toggle
// Scan selector: AUTO/GLOBAL/FRONTIER/NORITSU (AUTO rotates per SNAP)
// Hide HUD: button + long-press SNAP (only SNAP remains)

const $ = (id) => document.getElementById(id);

const video = $("video");
const view = $("view");
const vctx = view.getContext("2d", { willReadFrequently: true });

const ui = {
  ratio: $("ratio"),
  flashBtn: $("flashBtn"),
  screenFlash: $("screenFlash"),

  openFilm: $("openFilm"),
  closeFilm: $("closeFilm"),
  filmModal: $("filmModal"),
  filmList: $("filmList"),
  filmName: $("filmName"),
  randomFilm: $("randomFilm"),

  openScan: $("openScan"),
  closeScan: $("closeScan"),
  scanModal: $("scanModal"),
  scanList: $("scanList"),
  scanName: $("scanName"),

  hideHud: $("hideHud"),
  topBar: $("topBar"),
  hud: $("hud"),

  snap: $("snap"),
  tip: $("tip"),
};

function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function lerp(a,b,t){ return a + (b-a)*t; }

function srgbToLin(x){
  x = x/255;
  return x <= 0.04045 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4);
}
function linToSrgb(x){
  x = clamp(x,0,1);
  return x <= 0.0031308 ? (x*12.92)*255 : (1.055*Math.pow(x,1/2.4)-0.055)*255;
}

// ----------------- Film presets (stronger + more distinct) -----------------
// Key additions per film:
// - matrix: 3x3 color mixing (subtle but distinct)
// - shadowTint / highlightTint: split-tone character
// - channelCurve: per-channel bias to push Fuji/Kodak differences
const FILMS = [
  // CineStill (we include common variants to reach ~10)
  { id:"cs_50d", brand:"CineStill", name:"50D", bw:false, exp:-0.02, contrast:1.00, sat:1.10, temp:-0.06, tint:0.03, grain:0.06, vignette:0.10, halation:0.10, lift:0.02,
    matrix:[1.02,0.01,0.00, 0.00,1.00,0.00, 0.00,0.01,1.02],
    shadowTint:[-0.01,0.00,0.02], highlightTint:[0.02,0.01,0.00], curve:[1.02,1.00,1.00]
  },
  { id:"cs_50d_p", brand:"CineStill", name:"50D (Pushed)", bw:false, exp:0.05, contrast:1.07, sat:1.12, temp:-0.04, tint:0.04, grain:0.10, vignette:0.12, halation:0.12, lift:0.02,
    matrix:[1.03,0.01,0.00, 0.00,1.00,0.00, 0.00,0.01,1.03],
    shadowTint:[-0.01,0.00,0.02], highlightTint:[0.03,0.01,0.00], curve:[1.03,1.00,1.00]
  },
  { id:"cs_400d", brand:"CineStill", name:"400D", bw:false, exp:0.02, contrast:1.04, sat:1.18, temp:0.02, tint:0.06, grain:0.10, vignette:0.14, halation:0.14, lift:0.02,
    matrix:[1.02,0.02,0.00, 0.00,1.00,0.00, 0.00,0.01,1.02],
    shadowTint:[0.00,0.00,0.02], highlightTint:[0.03,0.02,0.00], curve:[1.02,1.00,1.01]
  },
  { id:"cs_400d_p", brand:"CineStill", name:"400D (Pushed)", bw:false, exp:0.07, contrast:1.10, sat:1.20, temp:0.04, tint:0.06, grain:0.14, vignette:0.16, halation:0.16, lift:0.02,
    matrix:[1.03,0.02,0.00, 0.00,1.00,0.00, 0.00,0.01,1.03],
    shadowTint:[0.00,0.00,0.02], highlightTint:[0.04,0.02,0.00], curve:[1.03,1.00,1.01]
  },
  // 800T: tungsten warmth + stronger halation/glow character :contentReference[oaicite:1]{index=1}
  { id:"cs_800t", brand:"CineStill", name:"800T", bw:false, exp:0.08, contrast:1.08, sat:1.18, temp:0.22, tint:0.10, grain:0.14, vignette:0.18, halation:0.30, lift:0.03,
    matrix:[1.04,0.02,0.00, 0.01,0.99,0.00, 0.00,0.02,0.98],
    shadowTint:[0.02,0.00,0.02], highlightTint:[0.06,0.03,-0.01], curve:[1.05,1.00,0.98]
  },
  { id:"cs_800t_p", brand:"CineStill", name:"800T (Pushed)", bw:false, exp:0.12, contrast:1.12, sat:1.20, temp:0.24, tint:0.10, grain:0.18, vignette:0.20, halation:0.34, lift:0.03,
    matrix:[1.05,0.02,0.00, 0.01,0.99,0.00, 0.00,0.02,0.97],
    shadowTint:[0.02,0.00,0.02], highlightTint:[0.07,0.03,-0.01], curve:[1.06,1.00,0.97]
  },
  { id:"cs_800t_soft", brand:"CineStill", name:"800T (Soft)", bw:false, exp:0.06, contrast:1.02, sat:1.16, temp:0.22, tint:0.10, grain:0.12, vignette:0.16, halation:0.26, lift:0.05,
    matrix:[1.04,0.02,0.00, 0.01,0.99,0.00, 0.00,0.02,0.98],
    shadowTint:[0.02,0.00,0.02], highlightTint:[0.05,0.03,-0.01], curve:[1.04,1.00,0.98]
  },
  { id:"cs_bwxx", brand:"CineStill", name:"BWXX", bw:true, exp:0.02, contrast:1.14, sat:0.00, temp:0.00, tint:0.00, grain:0.14, vignette:0.18, halation:0.00, lift:0.03,
    bwTone:[0.00,0.00,0.00], bwCurve:1.12
  },
  { id:"cs_bwxx_hc", brand:"CineStill", name:"BWXX (High Contrast)", bw:true, exp:0.02, contrast:1.26, sat:0.00, temp:0.00, tint:0.00, grain:0.16, vignette:0.20, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.00], bwCurve:1.22
  },
  { id:"cs_bwxx_soft", brand:"CineStill", name:"BWXX (Soft)", bw:true, exp:0.00, contrast:1.06, sat:0.00, temp:0.00, tint:0.00, grain:0.12, vignette:0.16, halation:0.00, lift:0.05,
    bwTone:[0.00,0.00,0.00], bwCurve:1.06
  },

  // Kodak (distinct warmth + consumer stocks)
  { id:"kd_portra160", brand:"Kodak", name:"Portra 160", bw:false, exp:-0.03, contrast:0.95, sat:0.98, temp:0.06, tint:0.04, grain:0.06, vignette:0.10, halation:0.06, lift:0.04,
    matrix:[1.02,0.01,0.00, 0.00,1.00,0.00, 0.00,0.01,1.00],
    shadowTint:[0.01,0.00,0.00], highlightTint:[0.03,0.02,0.00], curve:[1.02,1.00,1.00]
  },
  { id:"kd_portra400", brand:"Kodak", name:"Portra 400", bw:false, exp:0.02, contrast:0.98, sat:1.04, temp:0.08, tint:0.05, grain:0.10, vignette:0.12, halation:0.08, lift:0.04,
    matrix:[1.03,0.01,0.00, 0.00,1.00,0.00, 0.00,0.01,1.00],
    shadowTint:[0.01,0.00,0.00], highlightTint:[0.04,0.02,0.00], curve:[1.03,1.00,1.00]
  },
  { id:"kd_portra800", brand:"Kodak", name:"Portra 800", bw:false, exp:0.08, contrast:1.03, sat:1.08, temp:0.12, tint:0.06, grain:0.14, vignette:0.14, halation:0.10, lift:0.04,
    matrix:[1.03,0.01,0.00, 0.00,1.00,0.00, 0.00,0.01,0.99],
    shadowTint:[0.01,0.00,0.00], highlightTint:[0.05,0.02,0.00], curve:[1.03,1.00,0.99]
  },
  // Ektar: vivid/punchy
  { id:"kd_ektar100", brand:"Kodak", name:"Ektar 100", bw:false, exp:0.00, contrast:1.16, sat:1.42, temp:0.02, tint:0.03, grain:0.05, vignette:0.08, halation:0.04, lift:0.01,
    matrix:[1.06,0.00,0.00, 0.00,1.00,0.00, 0.00,0.00,1.02],
    shadowTint:[0.00,0.00,0.01], highlightTint:[0.03,0.01,0.00], curve:[1.06,1.00,1.02]
  },
  // Gold: warm + green-ish shadows vibe :contentReference[oaicite:2]{index=2}
  { id:"kd_gold200", brand:"Kodak", name:"Gold 200", bw:false, exp:0.03, contrast:1.08, sat:1.20, temp:0.18, tint:0.02, grain:0.12, vignette:0.16, halation:0.10, lift:0.03,
    matrix:[1.05,0.02,0.00, 0.00,1.00,0.00, 0.00,0.02,0.96],
    shadowTint:[-0.01,0.02,0.00], highlightTint:[0.06,0.03,0.00], curve:[1.05,1.00,0.96]
  },
  { id:"kd_ultramax400", brand:"Kodak", name:"UltraMax 400", bw:false, exp:0.04, contrast:1.10, sat:1.26, temp:0.14, tint:0.02, grain:0.15, vignette:0.16, halation:0.08, lift:0.03,
    matrix:[1.05,0.02,0.00, 0.00,1.00,0.00, 0.00,0.02,0.97],
    shadowTint:[-0.01,0.01,0.00], highlightTint:[0.05,0.03,0.00], curve:[1.05,1.00,0.97]
  },
  { id:"kd_colorplus200", brand:"Kodak", name:"ColorPlus 200", bw:false, exp:0.02, contrast:1.05, sat:1.18, temp:0.20, tint:0.01, grain:0.13, vignette:0.16, halation:0.08, lift:0.03,
    matrix:[1.05,0.02,0.00, 0.00,1.00,0.00, 0.00,0.02,0.95],
    shadowTint:[-0.01,0.02,0.00], highlightTint:[0.06,0.03,0.00], curve:[1.05,1.00,0.95]
  },
  { id:"kd_trix400", brand:"Kodak", name:"Tri-X 400", bw:true, exp:0.02, contrast:1.22, sat:0.00, temp:0.00, tint:0.00, grain:0.18, vignette:0.16, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.00], bwCurve:1.20
  },
  { id:"kd_tmax100", brand:"Kodak", name:"T-Max 100", bw:true, exp:-0.02, contrast:1.10, sat:0.00, temp:0.00, tint:0.00, grain:0.08, vignette:0.10, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.00], bwCurve:1.10
  },

  // Fujifilm (cool magenta/greenish tones typical) :contentReference[oaicite:3]{index=3}
  { id:"fj_superia400", brand:"Fujifilm", name:"Superia X-TRA 400", bw:false, exp:0.03, contrast:1.06, sat:1.18, temp:-0.06, tint:0.10, grain:0.15, vignette:0.14, halation:0.06, lift:0.03,
    matrix:[0.99,0.02,0.00, 0.00,1.03,0.00, 0.00,0.02,0.99],
    shadowTint:[0.01,-0.01,0.02], highlightTint:[0.00,0.01,0.00], curve:[0.99,1.03,0.99]
  },
  { id:"fj_c200", brand:"Fujifilm", name:"C200", bw:false, exp:0.02, contrast:1.02, sat:1.12, temp:-0.04, tint:0.08, grain:0.11, vignette:0.12, halation:0.06, lift:0.03,
    matrix:[1.00,0.02,0.00, 0.00,1.02,0.00, 0.00,0.02,0.99],
    shadowTint:[0.01,-0.01,0.02], highlightTint:[0.00,0.01,0.00], curve:[1.00,1.02,0.99]
  },
  { id:"fj_400h", brand:"Fujifilm", name:"Pro 400H (vibe)", bw:false, exp:-0.01, contrast:0.96, sat:0.98, temp:-0.06, tint:0.10, grain:0.11, vignette:0.10, halation:0.04, lift:0.06,
    matrix:[0.99,0.02,0.00, 0.00,1.02,0.00, 0.00,0.02,1.01],
    shadowTint:[0.01,-0.01,0.02], highlightTint:[0.00,0.01,0.01], curve:[0.99,1.02,1.01]
  },
  { id:"fj_velvia50", brand:"Fujifilm", name:"Velvia 50 (vibe)", bw:false, exp:-0.02, contrast:1.20, sat:1.50, temp:-0.02, tint:0.05, grain:0.06, vignette:0.08, halation:0.04, lift:0.01,
    matrix:[1.02,0.00,0.00, 0.00,1.04,0.00, 0.00,0.00,1.02],
    shadowTint:[0.00,0.00,0.02], highlightTint:[0.00,0.02,0.00], curve:[1.02,1.04,1.02]
  },
  { id:"fj_provia100f", brand:"Fujifilm", name:"Provia 100F (vibe)", bw:false, exp:-0.01, contrast:1.08, sat:1.22, temp:-0.04, tint:0.06, grain:0.06, vignette:0.08, halation:0.04, lift:0.02,
    matrix:[1.01,0.01,0.00, 0.00,1.03,0.00, 0.00,0.01,1.01],
    shadowTint:[0.00,0.00,0.02], highlightTint:[0.00,0.02,0.00], curve:[1.01,1.03,1.01]
  },
  { id:"fj_acros100", brand:"Fujifilm", name:"Acros 100 (vibe)", bw:true, exp:-0.02, contrast:1.12, sat:0.00, temp:0.00, tint:0.00, grain:0.09, vignette:0.10, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.01], bwCurve:1.10
  },
  { id:"fj_neopan400", brand:"Fujifilm", name:"Neopan 400 (vibe)", bw:true, exp:0.02, contrast:1.20, sat:0.00, temp:0.00, tint:0.00, grain:0.16, vignette:0.14, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.01], bwCurve:1.18
  },

  // Ilford (distinct BW characters)
  { id:"il_hp5", brand:"Ilford", name:"HP5 Plus 400", bw:true, exp:0.02, contrast:1.16, sat:0.00, temp:0.00, tint:0.00, grain:0.16, vignette:0.12, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.00], bwCurve:1.14
  },
  { id:"il_fp4", brand:"Ilford", name:"FP4 Plus 125", bw:true, exp:-0.02, contrast:1.10, sat:0.00, temp:0.00, tint:0.00, grain:0.10, vignette:0.10, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.00], bwCurve:1.08
  },
  { id:"il_delta100", brand:"Ilford", name:"Delta 100", bw:true, exp:-0.02, contrast:1.08, sat:0.00, temp:0.00, tint:0.00, grain:0.08, vignette:0.10, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.00], bwCurve:1.06
  },
  { id:"il_delta400", brand:"Ilford", name:"Delta 400", bw:true, exp:0.01, contrast:1.12, sat:0.00, temp:0.00, tint:0.00, grain:0.12, vignette:0.12, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.00], bwCurve:1.10
  },
  { id:"il_delta3200", brand:"Ilford", name:"Delta 3200", bw:true, exp:0.10, contrast:1.16, sat:0.00, temp:0.00, tint:0.00, grain:0.24, vignette:0.16, halation:0.00, lift:0.02,
    bwTone:[0.00,0.00,0.00], bwCurve:1.12
  },
];

let currentFilm = FILMS.find(f => f.id === "kd_portra400") || FILMS[0];
ui.filmName.textContent = `${currentFilm.brand} ${currentFilm.name}`;

// ----------------- Scan profiles -----------------
const SCANS = [
  { id:"auto", name:"AUTO" },
  { id:"global", name:"GLOBAL" },
  { id:"frontier", name:"FRONTIER" },
  { id:"noritsu", name:"NORITSU" },
];

const SCAN_PROFILES = {
  global: {
    sat: 1.06,
    contrast: 1.04,
    lift: 0.01,
    gamma: 1.00,
    shadowTint: [0.00, 0.00, 0.00],
    highlightTint: [0.00, 0.00, 0.00],
    chromaGrain: 0.015
  },
  frontier: {
    // “classic film look” / punch + color variation in grain (approx) :contentReference[oaicite:4]{index=4}
    sat: 1.14,
    contrast: 1.06,
    lift: 0.015,
    gamma: 0.98,
    shadowTint: [0.00, 0.01, 0.02],     // greener/cooler shadows
    highlightTint: [0.02, 0.01, 0.00],  // slightly warm highlights
    chromaGrain: 0.030
  },
  noritsu: {
    // Slightly muted/neutral + less chroma grain (approx) :contentReference[oaicite:5]{index=5}
    sat: 1.06,
    contrast: 1.03,
    lift: 0.008,
    gamma: 1.02,
    shadowTint: [0.00, 0.00, 0.00],
    highlightTint: [0.01, 0.005, 0.00],
    chromaGrain: 0.010
  }
};

let scanMode = "auto";           // auto/global/frontier/noritsu
let activeAutoScan = "frontier"; // rotates per SNAP
ui.scanName.textContent = "AUTO";

// auto scan rotation (avoid repeating)
function rotateAutoScan(){
  const options = ["frontier","noritsu","global"];
  const idx = options.indexOf(activeAutoScan);
  // rotate + random nudge so it’s not always a strict cycle
  let next = options[(idx + 1) % options.length];
  if (Math.random() < 0.35) next = options[(Math.random() * options.length) | 0];
  if (next === activeAutoScan) next = options[(idx + 1) % options.length];
  activeAutoScan = next;
}
function currentScanProfileId(){
  return scanMode === "auto" ? activeAutoScan : scanMode;
}
function scanLabel(){
  if (scanMode !== "auto") return SCANS.find(s=>s.id===scanMode)?.name || "SCAN";
  const inner = (activeAutoScan || "frontier").toUpperCase();
  return `AUTO (${inner})`;
}

// ----------------- Ratio helpers (Auto + Manual) -----------------
function viewportSize(){
  const vw = Math.floor(window.visualViewport?.width || window.innerWidth);
  const vh = Math.floor(window.visualViewport?.height || window.innerHeight);
  return { vw, vh };
}
function deviceIsLandscape(){
  const { vw, vh } = viewportSize();
  return vw > vh;
}
function chosenMode(){
  const m = ui.ratio.value;
  if (m === "auto") return deviceIsLandscape() ? "landscape" : "portrait";
  return m;
}
function modeAspect(mode){
  if (mode === "square") return 1;
  if (mode === "landscape") return 16/9;
  return 9/16;
}
function computeCropRect(srcW, srcH, mode){
  const ar = modeAspect(mode);
  const srcAR = srcW / srcH;

  let cropW, cropH;
  if (srcAR > ar){
    cropH = srcH;
    cropW = Math.round(srcH * ar);
  } else {
    cropW = srcW;
    cropH = Math.round(srcW / ar);
  }
  const cx = Math.floor((srcW - cropW) / 2);
  const cy = Math.floor((srcH - cropH) / 2);
  return { cx, cy, cropW, cropH };
}
function exportSizeForMode(mode){
  const longEdge = 2000;
  if (mode === "square") return { w: longEdge, h: longEdge };
  if (mode === "landscape") return { w: longEdge, h: Math.round(longEdge / (16/9)) };
  return { h: longEdge, w: Math.round(longEdge * (9/16)) };
}

// ----------------- Film processing -----------------
function softCurve(x, contrast){
  const y = (x - 0.5) * contrast + 0.5;
  const t = clamp(y,0,1);
  return t*t*(3 - 2*t);
}
function applyWhiteBalance(r,g,b, temp, tint){
  const rm = 1 + 0.20*temp - 0.06*tint;
  const gm = 1 - 0.10*temp - 0.10*tint;
  const bm = 1 - 0.22*temp + 0.14*tint;
  return { r:r*rm, g:g*gm, b:b*bm };
}
function saturateRGB(r,g,b, sat){
  const l = 0.2126*r + 0.7152*g + 0.0722*b;
  return { r:l+(r-l)*sat, g:l+(g-l)*sat, b:l+(b-l)*sat };
}
function vignetteFactor(nx, ny, strength){
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const d = Math.sqrt(dx*dx + dy*dy);
  const v = clamp(1 - d*1.35, 0, 1);
  return lerp(1, v, strength);
}
function randNoise(seed){
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17; seed >>>= 0;
  seed ^= seed << 5;  seed >>>= 0;
  return [(seed>>>0)/4294967296, seed>>>0];
}
function applyMatrix(r,g,b, m){
  // m is 9 values row-major
  const rr = r*m[0] + g*m[1] + b*m[2];
  const gg = r*m[3] + g*m[4] + b*m[5];
  const bb = r*m[6] + g*m[7] + b*m[8];
  return { r:rr, g:gg, b:bb };
}
function splitTone(r,g,b, lum, sh, hi, amount){
  // amount 0..1
  const t = clamp((lum - 0.35)/0.35, 0, 1); // 0 in shadows, 1 in highlights
  const sr = sh[0]*(1-t) + hi[0]*t;
  const sg = sh[1]*(1-t) + hi[1]*t;
  const sb = sh[2]*(1-t) + hi[2]*t;
  return {
    r: r + sr*amount,
    g: g + sg*amount,
    b: b + sb*amount,
  };
}

// Halation: glow on highlights (helps CineStill)
const off = document.createElement("canvas");
const offCtx = off.getContext("2d", { willReadFrequently:true });

function addHalation(imgData, w, h, amount){
  if (amount <= 0) return;

  const tmp = document.createElement("canvas");
  const tw = Math.max(120, Math.floor(w / 6));
  const th = Math.max(120, Math.floor(h / 6));
  tmp.width = tw; tmp.height = th;
  const tctx = tmp.getContext("2d", { willReadFrequently:true });

  tctx.drawImage(off, 0,0,w,h, 0,0,tw,th);
  tctx.globalAlpha = 0.35;
  for (let i=0;i<4;i++){
    tctx.drawImage(tmp, -2,0);
    tctx.drawImage(tmp,  2,0);
    tctx.drawImage(tmp, 0,-2);
    tctx.drawImage(tmp, 0, 2);
  }
  tctx.globalAlpha = 1;

  const blurData = tctx.getImageData(0,0,tw,th).data;
  const d = imgData.data;

  for (let y=0; y<h; y++){
    const ty = Math.floor(y * th / h);
    for (let x=0; x<w; x++){
      const tx = Math.floor(x * tw / w);
      const bi = (ty*tw + tx)*4;
      const i = (y*w + x)*4;

      const lum = (d[i]*0.2126 + d[i+1]*0.7152 + d[i+2]*0.0722)/255;
      const hi = clamp((lum - 0.55) / 0.45, 0, 1);

      d[i]   = clamp(d[i]   + blurData[bi]   * amount * hi * 0.60, 0, 255);
      d[i+1] = clamp(d[i+1] + blurData[bi+1] * amount * hi * 0.28, 0, 255);
      d[i+2] = clamp(d[i+2] + blurData[bi+2] * amount * hi * 0.10, 0, 255);
    }
  }
}

function applyScanProfile(imgData, w, h, scanId){
  const profile = SCAN_PROFILES[scanId] || SCAN_PROFILES.global;
  const d = imgData.data;

  const sat = profile.sat ?? 1.0;
  const contrast = profile.contrast ?? 1.0;
  const lift = profile.lift ?? 0.0;
  const gamma = profile.gamma ?? 1.0;
  const sh = profile.shadowTint || [0,0,0];
  const hi = profile.highlightTint || [0,0,0];

  // very subtle scan “grading amount”
  const toneAmt = 0.55;

  for (let i=0; i<d.length; i+=4){
    let r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;

    // lift + contrast curve
    r = r*(1-lift) + lift;
    g = g*(1-lift) + lift;
    b = b*(1-lift) + lift;

    r = softCurve(r, contrast);
    g = softCurve(g, contrast);
    b = softCurve(b, contrast);

    // gamma
    r = Math.pow(clamp(r,0,1), gamma);
    g = Math.pow(clamp(g,0,1), gamma);
    b = Math.pow(clamp(b,0,1), gamma);

    // saturation
    const s = saturateRGB(r,g,b,sat);
    r = s.r; g = s.g; b = s.b;

    // split tone
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    const st = splitTone(r,g,b, lum, sh, hi, toneAmt);
    r = st.r; g = st.g; b = st.b;

    d[i]   = clamp(Math.round(r*255), 0, 255);
    d[i+1] = clamp(Math.round(g*255), 0, 255);
    d[i+2] = clamp(Math.round(b*255), 0, 255);
  }

  return imgData;
}

function applyFilmPreset(imgData, w, h, film, scanId){
  const d = imgData.data;

  const exp = clamp(film.exp ?? 0, -0.6, 0.6);
  const contrast = clamp(film.contrast ?? 1.0, 0.75, 1.35);
  const sat = clamp(film.sat ?? 1.0, 0, 1.9);
  const temp = clamp(film.temp ?? 0, -1, 1);
  const tint = clamp(film.tint ?? 0, -1, 1);
  const grain = clamp(film.grain ?? 0, 0, 0.30);
  const vignette = clamp(film.vignette ?? 0, 0, 0.55);
  const lift = clamp(film.lift ?? 0, 0, 0.16);
  const hal = clamp(film.halation ?? 0, 0, 0.40);
  const mtx = film.matrix || null;
  const sh = film.shadowTint || [0,0,0];
  const hi = film.highlightTint || [0,0,0];
  const curve = film.curve || [1,1,1];

  const scanProfile = SCAN_PROFILES[scanId] || SCAN_PROFILES.global;
  const chromaGrain = clamp(scanProfile.chromaGrain ?? 0.015, 0, 0.05);

  let seed = (Date.now() ^ (w*1315423911) ^ (h*2654435761)) >>> 0;

  for (let y=0; y<h; y++){
    const ny = y / (h-1);
    for (let x=0; x<w; x++){
      const nx = x / (w-1);
      const i = (y*w + x)*4;

      // work in linear for nicer curves
      let rL = srgbToLin(d[i]);
      let gL = srgbToLin(d[i+1]);
      let bL = srgbToLin(d[i+2]);

      // exposure
      const e = Math.pow(2, exp);
      rL *= e; gL *= e; bL *= e;

      // lift
      rL = rL*(1 - lift) + lift;
      gL = gL*(1 - lift) + lift;
      bL = bL*(1 - lift) + lift;

      // white balance (still linear-ish)
      const wb = applyWhiteBalance(rL,gL,bL, temp, tint);
      rL = wb.r; gL = wb.g; bL = wb.b;

      // per-channel bias curve (helps Fuji vs Kodak separation)
      rL = Math.pow(clamp(rL,0,1), 1/curve[0]);
      gL = Math.pow(clamp(gL,0,1), 1/curve[1]);
      bL = Math.pow(clamp(bL,0,1), 1/curve[2]);

      // matrix mixing
      if (mtx){
        const mm = applyMatrix(rL,gL,bL, mtx);
        rL = mm.r; gL = mm.g; bL = mm.b;
      }

      // convert back to srgb for tone curve & split tone
      let r = clamp(linToSrgb(rL)/255, 0, 1);
      let g = clamp(linToSrgb(gL)/255, 0, 1);
      let b = clamp(linToSrgb(bL)/255, 0, 1);

      if (film.bw){
        // BW distinctness via curve + slight tone
        const l = clamp(0.2126*r + 0.7152*g + 0.0722*b, 0, 1);
        const bwc = clamp(film.bwCurve ?? 1.10, 0.9, 1.35);
        let L = softCurve(l, bwc);
        const tone = film.bwTone || [0,0,0];
        r = clamp(L + tone[0], 0, 1);
        g = clamp(L + tone[1], 0, 1);
        b = clamp(L + tone[2], 0, 1);
      } else {
        // contrast curve + saturation
        r = softCurve(r, contrast);
        g = softCurve(g, contrast);
        b = softCurve(b, contrast);
        const s = saturateRGB(r,g,b,sat);
        r = clamp(s.r,0,1); g = clamp(s.g,0,1); b = clamp(s.b,0,1);

        // split tone (film character)
        const lum = 0.2126*r + 0.7152*g + 0.0722*b;
        const st = splitTone(r,g,b, lum, sh, hi, 0.75);
        r = st.r; g = st.g; b = st.b;
      }

      // vignette
      const vf = vignetteFactor(nx, ny, vignette);
      r *= vf; g *= vf; b *= vf;

      // grain: luminance-weighted + scan-dependent chroma grain
      if (grain > 0){
        let n; [n, seed] = randNoise(seed);
        const lum = 0.2126*r + 0.7152*g + 0.0722*b;
        const shadowBoost = 0.55 + (1 - lum)*0.65; // more grain in shadows
        const gn = (n - 0.5) * grain * shadowBoost;

        // monochrome grain base
        r = clamp(r + gn, 0, 1);
        g = clamp(g + gn, 0, 1);
        b = clamp(b + gn, 0, 1);

        // chroma grain (Frontier-ish stronger than Noritsu-ish) :contentReference[oaicite:6]{index=6}
        let nr, ng, nb;
        [nr, seed] = randNoise(seed);
        [ng, seed] = randNoise(seed);
        [nb, seed] = randNoise(seed);
        const cg = grain * shadowBoost * chromaGrain;
        r = clamp(r + (nr-0.5)*cg, 0, 1);
        g = clamp(g + (ng-0.5)*cg, 0, 1);
        b = clamp(b + (nb-0.5)*cg, 0, 1);
      }

      d[i]   = Math.round(clamp(r,0,1)*255);
      d[i+1] = Math.round(clamp(g,0,1)*255);
      d[i+2] = Math.round(clamp(b,0,1)*255);
      d[i+3] = 255;
    }
  }

  if (hal > 0){
    addHalation(imgData, w, h, hal);
  }

  // apply scan AFTER film emulation for a consistent “lab” vibe
  imgData = applyScanProfile(imgData, w, h, scanId);

  return imgData;
}

// ----------------- Film picker UI -----------------
function buildBrandGroups(films){
  const by = new Map();
  for (const f of films){
    if (!by.has(f.brand)) by.set(f.brand, []);
    by.get(f.brand).push(f);
  }
  return Array.from(by.keys()).sort().map(brand => ({ brand, films: by.get(brand) }));
}

function renderFilmPicker(){
  ui.filmList.innerHTML = "";
  const groups = buildBrandGroups(FILMS);

  for (const g of groups){
    const details = document.createElement("details");
    const sum = document.createElement("summary");
    sum.textContent = g.brand;
    details.appendChild(sum);

    const wrap = document.createElement("div");
    wrap.className = "filmBtns";

    for (const f of g.films){
      const btn = document.createElement("button");
      btn.className = "filmPick";
      btn.innerHTML = `${f.name}<small>${f.bw ? "B&W" : "Color"} • 35mm preset</small>`;
      btn.addEventListener("click", ()=>{
        currentFilm = f;
        ui.filmName.textContent = `${currentFilm.brand} ${currentFilm.name}`;
        closeFilm();
      });
      wrap.appendChild(btn);
    }

    details.appendChild(wrap);
    ui.filmList.appendChild(details);
  }
}

function openFilm(){
  ui.filmModal.classList.remove("hidden");
  ui.filmModal.setAttribute("aria-hidden","false");
}
function closeFilm(){
  ui.filmModal.classList.add("hidden");
  ui.filmModal.setAttribute("aria-hidden","true");
}
ui.openFilm.addEventListener("click", openFilm);
ui.closeFilm.addEventListener("click", closeFilm);
ui.filmModal.addEventListener("click", (e)=>{ if (e.target === ui.filmModal) closeFilm(); });

ui.randomFilm.addEventListener("click", ()=>{
  currentFilm = FILMS[(Math.random() * FILMS.length) | 0];
  ui.filmName.textContent = `${currentFilm.brand} ${currentFilm.name}`;
  ui.tip.textContent = `Random: ${currentFilm.brand} ${currentFilm.name}`;
});

// ----------------- Scan picker UI -----------------
function renderScanPicker(){
  ui.scanList.innerHTML = "";
  const makeBtn = (id, label, desc) => {
    const btn = document.createElement("button");
    btn.className = "filmPick";
    btn.innerHTML = `${label}<small>${desc}</small>`;
    btn.addEventListener("click", ()=>{
      scanMode = id;
      if (scanMode !== "auto") {
        ui.scanName.textContent = SCANS.find(s=>s.id===scanMode)?.name || "SCAN";
      } else {
        // reset auto seed to something deterministic-ish but not fixed
        activeAutoScan = ["frontier","noritsu","global"][(Math.random()*3)|0];
        ui.scanName.textContent = scanLabel();
      }
      closeScan();
    });
    return btn;
  };

  ui.scanList.appendChild(makeBtn("auto","AUTO","Rotates scan style every SNAP"));
  ui.scanList.appendChild(makeBtn("global","GLOBAL","Balanced lab scan"));
  ui.scanList.appendChild(makeBtn("frontier","FRONTIER","Punchy, classic vibe"));
  ui.scanList.appendChild(makeBtn("noritsu","NORITSU","Softer/neutral vibe"));
}

function openScan(){
  ui.scanModal.classList.remove("hidden");
  ui.scanModal.setAttribute("aria-hidden","false");
}
function closeScan(){
  ui.scanModal.classList.add("hidden");
  ui.scanModal.setAttribute("aria-hidden","true");
}
ui.openScan.addEventListener("click", openScan);
ui.closeScan.addEventListener("click", closeScan);
ui.scanModal.addEventListener("click", (e)=>{ if (e.target === ui.scanModal) closeScan(); });

// ----------------- Flash (Torch + Screen fallback) -----------------
let stream = null;
let videoTrack = null;
let torchAvailable = false;
let flashMode = "off"; // off | torch | screen

function updateFlashButton(){
  ui.flashBtn.textContent =
    flashMode === "off" ? "FLASH: OFF" :
    flashMode === "torch" ? "FLASH: TORCH" :
    "FLASH: SCREEN";
}
function screenFlashPulse(){
  ui.screenFlash.classList.remove("hidden");
  requestAnimationFrame(()=> ui.screenFlash.classList.add("on"));
  setTimeout(()=>{
    ui.screenFlash.classList.remove("on");
    setTimeout(()=> ui.screenFlash.classList.add("hidden"), 120);
  }, 90);
}
async function detectTorchSupport(){
  try{
    videoTrack = stream?.getVideoTracks?.()[0] || null;
    if (!videoTrack) return false;
    const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
    torchAvailable = !!(caps && "torch" in caps);
    return torchAvailable;
  }catch{
    torchAvailable = false;
    return false;
  }
}
async function setTorch(on){
  if (!torchAvailable || !videoTrack) return false;
  try{
    await videoTrack.applyConstraints({ advanced: [{ torch: !!on }] });
    return true;
  }catch{
    return false;
  }
}
ui.flashBtn.addEventListener("click", async ()=>{
  if (flashMode === "off"){
    flashMode = torchAvailable ? "torch" : "screen";
  } else if (flashMode === "torch"){
    flashMode = "screen";
    await setTorch(false);
  } else {
    flashMode = "off";
    await setTorch(false);
  }
  updateFlashButton();
});
updateFlashButton();

// ----------------- HUD hide (button + long-press SNAP) -----------------
let hudHidden = false;
function setHudHidden(on){
  hudHidden = !!on;
  document.body.classList.toggle("hudOnlySnap", hudHidden);
}
ui.hideHud.addEventListener("click", ()=> setHudHidden(true));

// long-press SNAP toggles hide/show; short tap still snaps
let pressTimer = null;
let longPressed = false;

function startPress(){
  longPressed = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(()=>{
    longPressed = true;
    setHudHidden(!hudHidden);
  }, 550);
}
function endPress(){
  clearTimeout(pressTimer);
}

// Pointer events (works on iOS Safari)
ui.snap.addEventListener("pointerdown", startPress);
ui.snap.addEventListener("pointerup", endPress);
ui.snap.addEventListener("pointercancel", endPress);
ui.snap.addEventListener("pointerleave", endPress);

// If HUD is hidden: a double-tap on SNAP also reveals (backup)
let lastTap = 0;
ui.snap.addEventListener("pointerup", (e)=>{
  const now = Date.now();
  if (hudHidden && (now - lastTap) < 320){
    setHudHidden(false);
  }
  lastTap = now;
});

// ----------------- Live preview (filtered) -----------------
function fitCanvas(){
  const { vw, vh } = viewportSize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  view.width = Math.floor(vw * dpr);
  view.height = Math.floor(vh * dpr);
}
fitCanvas();
window.addEventListener("resize", fitCanvas);
window.visualViewport?.addEventListener("resize", fitCanvas);

const work = document.createElement("canvas");
const wctx = work.getContext("2d", { willReadFrequently:true });

function drawCover(ctx, srcCanvas, sw, sh, dw, dh){
  const s = Math.max(dw / sw, dh / sh);
  const rw = Math.round(sw * s);
  const rh = Math.round(sh * s);
  const dx = Math.floor((dw - rw) / 2);
  const dy = Math.floor((dh - rh) / 2);
  ctx.drawImage(srcCanvas, 0,0,sw,sh, dx,dy,rw,rh);
}

function tick(){
  if (!video.videoWidth || !video.videoHeight){
    requestAnimationFrame(tick);
    return;
  }

  const mode = chosenMode();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const { cx, cy, cropW, cropH } = computeCropRect(vw, vh, mode);

  // live preview performance target
  const targetW = 560;
  const scale = targetW / cropW;
  const outW = Math.max(320, Math.floor(cropW * scale));
  const outH = Math.max(320, Math.floor(cropH * scale));

  work.width = outW;
  work.height = outH;

  wctx.drawImage(video, cx, cy, cropW, cropH, 0, 0, outW, outH);

  const scanId = currentScanProfileId();
  if (scanMode === "auto") ui.scanName.textContent = scanLabel();

  let img = wctx.getImageData(0,0,outW,outH);
  img = applyFilmPreset(img, outW, outH, currentFilm, scanId);
  wctx.putImageData(img,0,0);

  vctx.setTransform(1,0,0,1,0,0);
  vctx.clearRect(0,0,view.width,view.height);
  drawCover(vctx, work, outW, outH, view.width, view.height);

  requestAnimationFrame(tick);
}

// ----------------- SNAP (exports strict ratio, not stretched) -----------------
ui.snap.addEventListener("click", async ()=>{
  // if a long-press just happened, don't snap
  if (longPressed) return;

  if (!video.videoWidth || !video.videoHeight){
    ui.tip.textContent = "Camera not ready.";
    return;
  }

  // AUTO scan rotates after each SNAP
  const scanId = currentScanProfileId();

  // flash pulse
  if (flashMode === "torch" && torchAvailable){
    await setTorch(true);
    await new Promise(r => setTimeout(r, 120));
    await setTorch(false);
  } else if (flashMode === "screen"){
    screenFlashPulse();
    await new Promise(r => setTimeout(r, 90));
  }

  const mode = chosenMode();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const { cx, cy, cropW, cropH } = computeCropRect(vw, vh, mode);

  const out = exportSizeForMode(mode);
  off.width = out.w;
  off.height = out.h;

  offCtx.imageSmoothingEnabled = true;
  offCtx.drawImage(video, cx, cy, cropW, cropH, 0, 0, out.w, out.h);

  let img = offCtx.getImageData(0,0,out.w,out.h);
  img = applyFilmPreset(img, out.w, out.h, currentFilm, scanId);
  offCtx.putImageData(img,0,0);

  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g,"-");
  a.download = `filmroll_${currentFilm.brand}_${currentFilm.name}_${scanId}_${stamp}.jpg`
    .replace(/\s+/g,"_")
    .replace(/[^\w\-\.]/g,"");
  a.href = off.toDataURL("image/jpeg", 0.92);
  a.click();

  // rotate auto scan AFTER snap so next shot is different
  if (scanMode === "auto"){
    rotateAutoScan();
    ui.scanName.textContent = scanLabel();
  }

  ui.tip.textContent = `Saved (${mode.toUpperCase()}): ${currentFilm.brand} ${currentFilm.name} • ${scanLabel()}`;
});

// ----------------- Camera start -----------------
async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    await detectTorchSupport();
    updateFlashButton();

    ui.tip.textContent = torchAvailable
      ? "Ready. Torch supported."
      : "Ready. Torch not supported (screen flash works).";

    tick();
  }catch(e){
    ui.tip.textContent = "Camera blocked. Use HTTPS + allow Camera in Safari.";
  }
}

// init
renderFilmPicker();
renderScanPicker();
startCamera();

