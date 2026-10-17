/* FoleyForge — procedural SFX engine + continual-learning taste system.
   100% client-side. No samples, no API calls, no model weights.
   The "learning" is real: ratings re-weight the parameter space. */
'use strict';

/* ---------------- utilities ---------------- */
const $ = s => document.querySelector(s);
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const rand = (a,b)=>a+Math.random()*(b-a);
const pick = arr=>arr[Math.floor(Math.random()*arr.length)];

function noiseBuffer(ctx, seconds){
  const len = Math.max(1, Math.floor(ctx.sampleRate*seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  return buf;
}
function expEnv(g, t0, peak, decay){
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001,peak), t0+0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+decay);
}

/* ---------------- prompt parser ---------------- */
const CAT_KEYWORDS = {
  impact:  ['thunder','explosion','blast','boom','crash','slam','hit','crack','punch','thud','bang','quake','strike','collision'],
  riser:   ['riser','build','tension','swell','crescendo','rising','anticipation','climb'],
  whoosh:  ['whoosh','flyby','swoosh','pass','warp','zoom','sweep','fly'],
  ambience:['rain','city','street','forest','wind','ocean','room','cafe','night','dawn','storm','jungle','crowd','harbor','desert','cave'],
  ui:      ['click','beep','notification','ui','alert','confirm','pop','ding','chime'],
  foley:   ['footstep','footsteps','steps','walk','door','creak','glass','metal','chain','keys'],
  drone:   ['drone','hum','rumble','engine','ambient pad','pad','ominous']
};
const MODS = {
  size:  [['massive',.35],['huge',.3],['giant',.3],['big',.2],['powerful',.2],['soft',-.25],['gentle',-.25],['quiet',-.2],['subtle',-.2],['tiny',-.25]],
  bright:[['bright',.3],['shimmering',.3],['crisp',.2],['dark',-.35],['deep',-.25],['muffled',-.3],['warm',-.15]],
  dur:   [['long',.35],['endless',.4],['extended',.3],['short',-.3],['quick',-.3],['sudden',-.35],['snappy',-.25]],
  dense: [['heavy',.3],['dense',.3],['crowded',.3],['pouring',.35],['light',-.3],['sparse',-.35],['distant',-.25],['empty',-.3]]
};
function parsePrompt(text){
  const t = text.toLowerCase();
  const layers = [];
  const tags = [];
  for(const [cat, kws] of Object.entries(CAT_KEYWORDS)){
    if(kws.some(k=>t.includes(k))){ layers.push({type:cat}); tags.push(cat); }
  }
  if(!layers.length){ layers.push({type:'ambience'}); tags.push('ambience (inferred)'); }
  // ambience subtype
  const sub = t.includes('rain')?'rain': t.includes('city')||t.includes('street')||t.includes('neon')?'city'
    : t.includes('forest')||t.includes('dawn')||t.includes('bird')?'forest'
    : t.includes('ocean')||t.includes('sea')?'ocean' : t.includes('wind')?'wind' : 'rain';
  const mods = {size:0, bright:0, dur:0, dense:0};
  for(const [m, pairs] of Object.entries(MODS))
    for(const [w,d] of pairs) if(t.includes(w)) mods[m]+=d;
  for(const k of Object.keys(mods)) mods[k]=clamp(mods[k],-.6,.6);
  for(const l of layers){ l.params={ size:.5+mods.size, bright:.5+mods.bright, dur:.5+mods.dur, dense:.5+mods.dense, sub };
    for(const k of ['size','bright','dur','dense']) l.params[k]=clamp(l.params[k],0,1); }
  return {layers:layers.slice(0,3), tags, mods};
}

/* ---------------- generators (write into ctx -> dest) ---------------- */
const GEN = {
  impact(ctx,dest,p,t0){
    const size=p.size, decay=lerp(.35,2.6,p.dur);
    const o=ctx.createOscillator(), og=ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(lerp(150,42,size),t0);
    o.frequency.exponentialRampToValueAtTime(28,t0+decay*.45);
    expEnv(og,t0,lerp(.5,1.1,p.size),decay);
    // grit
    const ws=ctx.createWaveShaper();
    const curve=new Float32Array(256);
    for(let i=0;i<256;i++){const x=i/128-1;curve[i]=Math.tanh(x*(1+p.bright*4));}
    ws.curve=curve;
    o.connect(og).connect(ws).connect(dest); o.start(t0); o.stop(t0+decay+.1);
    // transient crack
    const n=ctx.createBufferSource(); n.buffer=noiseBuffer(ctx,decay);
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=lerp(900,220,size); bp.Q.value=1.2;
    const ng=ctx.createGain(); expEnv(ng,t0,lerp(.3,.9,p.size),decay*.3);
    n.connect(bp).connect(ng).connect(dest); n.start(t0); n.stop(t0+decay);
  },
  riser(ctx,dest,p,t0){
    const dur=lerp(1.2,5,p.dur);
    const n=ctx.createBufferSource(); n.buffer=noiseBuffer(ctx,dur+.2); n.loop=true;
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=8;
    bp.frequency.setValueAtTime(lerp(180,500,p.bright),t0);
    bp.frequency.exponentialRampToValueAtTime(lerp(2800,8200,p.bright),t0+dur);
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    const curve=1+p.dur*2;
    g.gain.exponentialRampToValueAtTime(.7,t0+dur);
    // shape with curve via setValueCurve would be nicer; exponential is fine
    n.connect(bp).connect(g).connect(dest); n.start(t0); n.stop(t0+dur+.1);
    g.gain.setValueAtTime(.7,t0+dur); g.gain.exponentialRampToValueAtTime(.0001,t0+dur+.05);
    // shimmer tail
    const o=ctx.createOscillator(), og=ctx.createGain();
    o.type='sine'; o.frequency.value=lerp(2000,5200,p.bright);
    expEnv(og,t0+dur-.25,.25,.5);
    o.connect(og).connect(dest); o.start(t0+dur-.25); o.stop(t0+dur+.4);
  },
  whoosh(ctx,dest,p,t0){
    const dur=lerp(.5,3,p.dur), up=p.bright>.45;
    const n=ctx.createBufferSource(); n.buffer=noiseBuffer(ctx,dur+.2);
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=lerp(3,.8,p.size);
    bp.frequency.setValueAtTime(up?280:4200,t0);
    bp.frequency.exponentialRampToValueAtTime(up?4200:280,t0+dur);
    const g=ctx.createGain();
    g.gain.setValueAtTime(.0001,t0);
    g.gain.linearRampToValueAtTime(.85,t0+dur*.5);
    g.gain.linearRampToValueAtTime(.0001,t0+dur);
    n.connect(bp).connect(g).connect(dest); n.start(t0); n.stop(t0+dur+.1);
  },
  ambience(ctx,dest,p,t0){
    const dur=7, sub=p.sub||'rain';
    const n=ctx.createBufferSource(); n.buffer=noiseBuffer(ctx,dur); n.loop=true;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass';
    lp.frequency.value=lerp(4200,380,p.bright<.5? (1-p.bright): .3);
    const g=ctx.createGain(); g.gain.value=.16;
    n.connect(lp).connect(g).connect(dest); n.start(t0); n.stop(t0+dur);
    const drops=Math.floor(lerp(6,50,p.dense));
    for(let i=0;i<drops;i++){
      const dt=t0+Math.random()*dur;
      const o=ctx.createOscillator(), og=ctx.createGain();
      if(sub==='rain'||sub==='ocean'){ o.type='sine'; o.frequency.value=rand(1800,5200); expEnv(og,dt,rand(.02,.09),rand(.05,.18)); }
      else if(sub==='city'){ if(Math.random()<.12){ o.type='sawtooth'; o.frequency.value=pick([196,220,174]); const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=600; expEnv(og,dt,.12,1.4); o.connect(f).connect(og).connect(dest); o.start(dt); o.stop(dt+1.6); continue; } else continue; }
      else if(sub==='forest'){ o.type='sine'; const f0=rand(2400,4800); o.frequency.setValueAtTime(f0,dt); o.frequency.exponentialRampToValueAtTime(f0*rand(1.2,1.8),dt+.12); expEnv(og,dt,rand(.03,.1),rand(.1,.3)); }
      else { o.type='sine'; o.frequency.value=rand(300,900); expEnv(og,dt,.05,rand(.4,1)); }
      o.connect(og).connect(dest); o.start(dt); o.stop(dt+2);
    }
    if(sub==='city'||sub==='wind'){
      const r=ctx.createOscillator(), rg=ctx.createGain();
      r.type='sine'; r.frequency.value=sub==='city'?52:70;
      rg.gain.value=.1; r.connect(rg).connect(dest); r.start(t0); r.stop(t0+dur);
    }
  },
  ui(ctx,dest,p,t0){
    const count=Math.floor(lerp(1,4,p.dense))+1;
    for(let i=0;i<count;i++){
      const dt=t0+i*lerp(.05,.22,1-p.dur);
      const car=ctx.createOscillator(), mod=ctx.createOscillator(), mg=ctx.createGain(), g=ctx.createGain();
      car.type='sine'; car.frequency.value=lerp(520,1320,p.bright);
      mod.type='sine'; mod.frequency.value=car.frequency.value*2.01; mg.gain.value=car.frequency.value*.8;
      mod.connect(mg).connect(car.frequency);
      expEnv(g,dt,.5,lerp(.08,.35,p.dur));
      car.connect(g).connect(dest); car.start(dt); car.stop(dt+.5); mod.start(dt); mod.stop(dt+.5);
    }
  },
  foley(ctx,dest,p,t0){
    const steps=Math.floor(lerp(2,8,p.dense));
    const wood=p.bright>.5;
    for(let i=0;i<steps;i++){
      const dt=t0+i*lerp(.28,.55,p.dur)+rand(-.02,.02);
      const n=ctx.createBufferSource(); n.buffer=noiseBuffer(ctx,.15);
      const bp=ctx.createBiquadFilter(); bp.type='bandpass';
      bp.frequency.value=wood?rand(700,1000):rand(220,380); bp.Q.value=2.5;
      const g=ctx.createGain(); expEnv(g,dt,rand(.4,.7),rand(.08,.16));
      n.connect(bp).connect(g).connect(dest); n.start(dt); n.stop(dt+.2);
    }
  },
  drone(ctx,dest,p,t0){
    const dur=6, root=lerp(48,110,p.size);
    for(const det of [0, 4+p.bright*8]){
      const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=root+det;
      const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lerp(300,2400,p.bright);
      const lfo=ctx.createOscillator(), lg=ctx.createGain();
      lfo.frequency.value=lerp(.05,.5,p.dense); lg.gain.value=f.frequency.value*.4;
      lfo.connect(lg).connect(f.frequency);
      const g=ctx.createGain();
      g.gain.setValueAtTime(.0001,t0); g.gain.linearRampToValueAtTime(.22,t0+1.2);
      g.gain.setValueAtTime(.22,t0+dur-1); g.gain.linearRampToValueAtTime(.0001,t0+dur);
      o.connect(f).connect(g).connect(dest);
      o.start(t0); o.stop(t0+dur); lfo.start(t0); lfo.stop(t0+dur);
    }
  }
};

/* ---------------- taste profile (continual learning) ---------------- */
const TASTE_KEY='foleyforge_taste_v1';
let taste = loadTaste();
function loadTaste(){
  try{ const t=JSON.parse(localStorage.getItem(TASTE_KEY)); if(t&&t.params) return t; }catch(e){}
  return {params:{}, ratings:0, gens:0};
}
function saveTaste(){ try{ localStorage.setItem(TASTE_KEY, JSON.stringify(taste)); }catch(e){} }
function blendParams(base, type){
  // 60% taste mean (if any ratings for this type), 40% fresh parse, plus jitter
  const out={...base};
  const tm=taste.params[type];
  if(tm && tm.n>0){
    for(const k of ['size','bright','dur','dense'])
      out[k]=clamp(tm[k]*.6+base[k]*.4+rand(-.08,.08),0,1);
  } else {
    for(const k of ['size','bright','dur','dense']) out[k]=clamp(out[k]+rand(-.12,.12),0,1);
  }
  return out;
}
function learnFrom(variant, up){
  const rate = up? .18 : -.08;
  for(const l of variant.layers){
    const tm = taste.params[l.type] || (taste.params[l.type]={size:.5,bright:.5,dur:.5,dense:.5,n:0});
    for(const k of ['size','bright','dur','dense'])
      tm[k]=clamp(tm[k]+rate*(l.params[k]-tm[k])*(up?1:1),0,1);
    tm.n++;
  }
  taste.ratings++;
  saveTaste(); renderTaste();
}

/* ---------------- render variant -> AudioBuffer ---------------- */
async function renderVariant(layers){
  const dur = 7;
  const off = new OfflineAudioContext(2, 44100*dur, 44100);
  const master=off.createGain(); master.gain.value=.9;
  const comp=off.createDynamicsCompressor();
  master.connect(comp).connect(off.destination);
  for(const l of layers) GEN[l.type](off, master, l.params, .15);
  return off.startRendering();
}
function drawWave(canvas, buffer){
  const c=canvas.getContext('2d'), W=canvas.width=canvas.offsetWidth*2, H=canvas.height=128;
  c.fillStyle='#0d1117'; c.fillRect(0,0,W,H);
  const d=buffer.getChannelData(0), step=Math.floor(d.length/W);
  c.strokeStyle='#ffb224'; c.lineWidth=2; c.beginPath();
  for(let x=0;x<W;x++){
    let m=0; for(let i=0;i<step;i+=8){const v=Math.abs(d[x*step+i]||0); if(v>m)m=v;}
    const y=m*H*.95; c.moveTo(x,H/2-y); c.lineTo(x,H/2+y);
  }
  c.stroke();
}
function bufferToWav(buffer){
  const nCh=2, sr=buffer.sampleRate, len=buffer.length;
  const ab=new ArrayBuffer(44+len*nCh*2), v=new DataView(ab);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF'); v.setUint32(4,36+len*nCh*2,true); ws(8,'WAVEfmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,nCh,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*nCh*2,true);
  v.setUint16(32,nCh*2,true); v.setUint16(34,16,true); ws(36,'data');
  v.setUint32(40,len*nCh*2,true);
  const ch0=buffer.getChannelData(0), ch1=buffer.numberOfChannels>1?buffer.getChannelData(1):ch0;
  let o=44;
  for(let i=0;i<len;i++) for(const ch of [ch0,ch1]){
    const s=clamp(ch[i],-1,1); v.setInt16(o,s<0?s*0x8000:s*0x7FFF,true); o+=2;
  }
  return new Blob([ab],{type:'audio/wav'});
}

/* ---------------- UI ---------------- */
let actx=null, currentSrc=null;
function ensureCtx(){ if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume(); }
function stopAll(){ if(currentSrc){ try{currentSrc.stop();}catch(e){} currentSrc=null; } }

async function forge(prompt){
  const btn=$('#forgeBtn'); btn.disabled=true; btn.textContent='⚒ FORGING…';
  try{
    ensureCtx(); stopAll();
    const {layers,tags}=parsePrompt(prompt);
    $('#sceneTitle').textContent='“'+prompt+'”';
    $('#parsedTags').innerHTML=tags.map(t=>'<span class="tag">'+t+'</span>').join('');
    const grid=$('#variantGrid'); grid.innerHTML='';
    $('#results').classList.remove('hidden');
    $('#results').scrollIntoView({behavior:'smooth',block:'start'});
    const variants=[];
    for(let vi=0; vi<3; vi++){
      const vlayers=layers.map(l=>({type:l.type, params:blendParams(l.params,l.type)}));
      const card=document.createElement('div'); card.className='variant';
      card.innerHTML='<h3>Variant '+(vi+1)+'</h3><div class="layers">'+vlayers.map(l=>l.type).join(' + ')+'</div><canvas class="wave"></canvas><div class="vcontrols"><button class="vbtn play">▶ play</button><button class="vbtn dl">⬇ wav</button><div class="rate"><button class="up" title="sounds right">👍</button><button class="down" title="not it">👎</button></div></div>';
      grid.appendChild(card);
      const variant={layers:vlayers, card, buffer:null, rated:0};
      variants.push(variant);
      variant.buffer=await renderVariant(vlayers);
      drawWave(card.querySelector('.wave'), variant.buffer);
      const playBtn=card.querySelector('.play');
      playBtn.onclick=()=>{ ensureCtx(); stopAll(); const s=actx.createBufferSource(); s.buffer=variant.buffer; s.connect(actx.destination); s.start(); currentSrc=s; s.onended=()=>{if(currentSrc===s)currentSrc=null;}; };
      card.querySelector('.dl').onclick=()=>{ const blob=bufferToWav(variant.buffer); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='foleyforge-variant'+(vi+1)+'.wav'; a.click(); };
      card.querySelector('.up').onclick=e=>{ if(variant.rated)return; variant.rated=1; learnFrom(variant,true); card.classList.add('rated-up'); e.target.classList.add('active-up'); };
      card.querySelector('.down').onclick=e=>{ if(variant.rated)return; variant.rated=-1; learnFrom(variant,false); card.classList.add('rated-down'); e.target.classList.add('active-down'); };
    }
    taste.gens++; saveTaste(); renderTaste();
  } finally { btn.disabled=false; btn.textContent='⚒ FORGE'; }
}
function renderTaste(){
  $('#statGens').textContent=taste.gens;
  $('#statTaste').textContent=Math.min(100,taste.ratings*8)+'%';
  const cats=Object.keys(CAT_KEYWORDS);
  const el=$('#tasteBars'); el.innerHTML='';
  const total=Object.values(taste.params).reduce((s,t)=>s+t.n,0)||1;
  for(const c of cats){
    const n=(taste.params[c]&&taste.params[c].n)||0;
    const row=document.createElement('div'); row.className='taste-row';
    row.innerHTML='<span class="tname">'+c+'</span><div class="taste-track"><div class="taste-fill" style="width:'+Math.round(n/total*100)+'%"></div></div><span class="tval">'+n+'</span>';
    el.appendChild(row);
  }
}

$('#forgeBtn').onclick=()=>{ const p=$('#promptInput').value.trim(); if(p) forge(p); };
$('#promptInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const p=e.target.value.trim(); if(p) forge(p); }});
document.querySelectorAll('.seed').forEach(b=>b.onclick=()=>{ $('#promptInput').value=b.dataset.p; forge(b.dataset.p); });
$('#resetTaste').onclick=()=>{ taste={params:{},ratings:0,gens:taste.gens}; saveTaste(); renderTaste(); };
renderTaste();
