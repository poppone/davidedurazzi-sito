(async function(){
"use strict";
async function leggi(u){try{const r=await fetch(u,{cache:"no-cache"});return r.ok?await r.json():null}catch(e){return null}}
const [AZ,UF]=await Promise.all([leggi("/content/azienda.json"),leggi("/content/ufficio.json")]);
if(!AZ){document.getElementById("scheda").textContent="Non riesco a caricare gli agenti. Riprova tra poco.";return}
const note=(UF&&UF.oggi)||{};
const STATI={"attivo":"attivo","in prova":"prova","fermo":"fermo"};
const RAGGRUPPA={"Distribuzione":"Social e community","Clienti e community":"Social e community"};
const reparti=[];
AZ.reparti.forEach(r=>{const nome=RAGGRUPPA[r.nome]||r.nome;let g=reparti.find(x=>x.nome===nome);if(!g){g={nome,agenti:[]};reparti.push(g)}
 r.agenti.forEach(a=>g.agenti.push([a.nome,a.ruolo,STATI[a.stato]||"attivo",a.turno||"",note[a.nome]||""]))});
const DATI={aggiornato:(UF&&UF.aggiornato)||"",
 davide:{nome:AZ.umano.nome,ruolo:AZ.umano.ruolo,compiti:AZ.umano.compiti,oggi:note["Davide"]||""},
 finch:{nome:"Finch",ruolo:"Il Direttore: coordina gli agenti, approva le bozze seguendo il Critico, tiene il diario",turno:"Ogni giorno alle 5:52, resoconto a Davide entro le 6",oggi:note["Finch"]||""},
 reparti:reparti.filter(r=>["Redazione","Video","Commerciale","Amministrazione","Social e community"].includes(r.nome)),
 diario:(UF&&UF.diario)||[],todo:[]};

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ridotto=matchMedia("(prefers-reduced-motion: reduce)").matches;
const COLORI={"Redazione":"#3b6cff","Video":"#ef3b52","Commerciale":"#f2711c","Amministrazione":"#14b8a6","Social e community":"#9b6bff","Direzione":"#f5b83d"};

/* ---------- testi fuori dalla scena ---------- */
function oraRoma(){const f=new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit",weekday:"long",day:"numeric",month:"long"});
 const p=Object.fromEntries(f.formatToParts(new Date()).map(x=>[x.type,x.value]));return{h:+p.hour,m:+p.minute,txt:p.hour+":"+p.minute,data:p.weekday+" "+p.day+" "+p.month}}
function orologio(){const o=oraRoma();$("#ora").textContent=o.txt;$("#data").textContent=o.data+" · Roma"}
orologio();setInterval(orologio,15000);
const diarioOrd=(DATI.diario.length?DATI.diario:[["—","Finch","Oggi non ci sono ancora note."]]).slice().sort((a,b)=>a[0].localeCompare(b[0]));
$("#diario").innerHTML=diarioOrd.map(([o,c,t])=>`<li><span class="ora">${esc(o)}</span><span><span class="chi">${esc(c)}</span> ${esc(t)}</span></li>`).join("");
const bt=$("#box-todo");if(bt)bt.hidden=true;
$("#agg").textContent="Agenti dalla pagina L'azienda. Note del giorno scritte da Finch"+(DATI.aggiornato?" il "+DATI.aggiornato:"")+". Il fringuello è Finch, il Direttore: un agente AI. Le consegne e le chiacchiere nella scena sono una messa in scena di come lavorano, non una ripresa in diretta.";
$("#legenda").innerHTML=Object.entries(COLORI).map(([n,c])=>`<span><i style="background:${c}"></i>${esc(n)}</span>`).join("")+`<span><i style="background:var(--ok)"></i>Schermo verde: attivo</span><span><i style="background:var(--prova)"></i>Schermo giallo: in prova</span>`;

const scheda=$("#scheda");const X='<button class="x" type="button" id="b-x" aria-label="Chiudi">×</button>';
function apri(){scheda.classList.add("aperta");scheda.setAttribute("aria-hidden","false");$("#sugg").classList.add("via");const x=$("#b-x");if(x)x.onclick=()=>vistaInsieme()}
function chiudi(){scheda.classList.remove("aperta");scheda.setAttribute("aria-hidden","true")}
const ETI={attivo:"Attivo",prova:"In prova"};
function schedaAgente(a){scheda.innerHTML=`<div class="reparto"><i style="background:${COLORI[a.reparto]}"></i>${esc(a.reparto)}</div><h2>${esc(a.nome)}</h2><div><span class="pill ${a.stato}">${ETI[a.stato]||a.stato}</span></div>
 <dl><div><dt>Cosa fa</dt><dd>${esc(a.ruolo)}</dd></div><div><dt>Turno</dt><dd>${esc(a.turno)}</dd></div>
 <div><dt>Oggi</dt><dd class="oggi">${a.oggi?esc(a.oggi):'<span class="vuoto">Nessuna nota nel diario di oggi.</span>'}</dd></div></dl>`+X;apri()}
function schedaFinch(){const f=DATI.finch;scheda.innerHTML=`<div class="reparto"><i style="background:${COLORI.Direzione}"></i>Direzione</div><h2>${esc(f.nome)}</h2><div><span class="pill capo">Il capo</span></div>
 <dl><div><dt>Cosa fa</dt><dd>${esc(f.ruolo)}</dd></div><div><dt>Turno</dt><dd>${esc(f.turno)}</dd></div><div><dt>Oggi</dt><dd class="oggi">${f.oggi?esc(f.oggi):'<span class="vuoto">Nessuna nota oggi.</span>'}</dd></div></dl>`+X;apri()}
function schedaDavide(){const d=DATI.davide,o=oraRoma(),qui=o.h>=4&&o.h<7;scheda.innerHTML=`<div class="reparto"><i style="background:${COLORI.Direzione}"></i>Direzione</div><h2>${esc(d.nome)}</h2><div><span class="pill umano">${qui?"In ufficio adesso":"Fuori ufficio"}</span></div>
 <dl><div><dt>Ruolo</dt><dd>${esc(d.ruolo)}</dd></div><div><dt>Come lavora</dt><dd>${esc(d.compiti)}</dd></div><div><dt>Oggi</dt><dd class="oggi">${d.oggi?esc(d.oggi):'<span class="vuoto">Nessuna nota oggi.</span>'}</dd></div></dl>`+X;apri()}
// didascalia "adesso": racconta cosa sta succedendo nella scena
const adesso=$("#adesso");let adessoChi=null;
function racconta(t,chi){if(!adesso)return;if(t&&chi==="giro"&&adessoChi&&adessoChi!=="giro")return;if(!t){if(chi&&adessoChi&&adessoChi!==chi)return;adessoChi=null;adesso.classList.remove("on");return}adessoChi=chi||null;adesso.querySelector("span").textContent=t;adesso.classList.add("on")}

/* ---------- 3D: uno studio di notte, neon e riflessi ---------- */
if(!window.THREE){document.querySelector(".scena").insertAdjacentHTML("beforeend",'<div class="errore">La scena 3D non si è caricata. Ricarica la pagina.</div>');return}
const canvas=$("#ufTela");const scenaEl=document.querySelector(".scena");
const POST=!!(THREE.EffectComposer&&THREE.RenderPass&&THREE.ShaderPass&&THREE.UnrealBloomPass)&&!ridotto;
const LITE=innerWidth<760||(navigator.hardwareConcurrency||4)<=4;
const renderer=new THREE.WebGLRenderer({canvas,antialias:!POST,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,LITE?1.5:2));
renderer.outputEncoding=POST?THREE.LinearEncoding:THREE.sRGBEncoding;
renderer.toneMapping=POST?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();let animCam=null;
const mondo=new THREE.Group();scene.add(mondo); // tutto ciò che si riflette nel pavimento
const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,200);camera.layers.enable(1);
const CAM0=new THREE.Vector3(26,26,26);camera.position.copy(CAM0);
const controls=new THREE.OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=true;controls.screenSpacePanning=true;
controls.minZoom=.7;controls.maxZoom=3.2;controls.maxPolarAngle=Math.PI*0.42;controls.minPolarAngle=Math.PI*0.12;
controls.target.set(0,0,0);controls.autoRotate=!ridotto;controls.autoRotateSpeed=.28;
canvas.addEventListener("pointerdown",()=>{controls.autoRotate=false},{passive:true});
let VIEW=17,ZOOM0=1;
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);const a=w/h;VIEW=a<1?26:a<1.4?21:17;const z0=a>=1.4?1.22:a>=1?1.1:1;if(!animCam&&!intro&&Math.abs(camera.zoom-ZOOM0)<1e-6)camera.zoom=z0;ZOOM0=z0;
 const sh=a>=1.4?.22:0;camera.left=-VIEW*a*(1-sh);camera.right=VIEW*a*(1+sh);camera.top=VIEW;camera.bottom=-VIEW;camera.updateProjectionMatrix();
 if(composer){const pr=renderer.getPixelRatio();composer.setSize(w*pr,h*pr);if(finale)finale.uniforms.risoluzione.value.set(w*pr,h*pr)}}
let intro=null,composer=null,finale=null,bloom=null;
new ResizeObserver(resize).observe(canvas);resize();

// tele disegnate (texture da canvas)
function tela(w,h,fn){const c=document.createElement("canvas");c.width=w;c.height=h;fn(c.getContext("2d"),c);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t}
// materiali: notte profonda, legni scuri, metalli freddi; i neon sono colori oltre l'1 (brillano nel bloom)
const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.7,metalness:0},o));
const lum=(hex,k)=>new THREE.Color(hex).multiplyScalar(k);
const neonMats=[];
function NEON(hex,k=1.8){const m=new THREE.MeshBasicMaterial({color:lum(hex,k),toneMapped:false});m.userData.base=m.color.clone();neonMats.push(m);return m}
const texPav=tela(256,256,g=>{g.fillStyle="#0f1630";g.fillRect(0,0,256,256);g.strokeStyle="rgba(140,170,255,.10)";g.lineWidth=2;for(let i=0;i<=256;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i,256);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(256,i);g.stroke()}
 for(let i=0;i<700;i++){g.fillStyle=`rgba(${Math.random()<.5?"255,255,255":"60,80,160"},${Math.random()*.05})`;g.fillRect(Math.random()*256,Math.random()*256,2,2)}});
texPav.wrapS=texPav.wrapT=THREE.RepeatWrapping;texPav.repeat.set(10.5,7);
const mat={pav:M("#ffffff",{roughness:.35,metalness:.25,map:texPav,transparent:true,opacity:LITE?1:.66}),muro:M("#1c2446",{roughness:.9}),legno:M("#2a3357",{roughness:.5,metalness:.1}),legno2:M("#323b63",{roughness:.5,metalness:.1}),legnoS:M("#1a2140"),metal:M("#0f1430",{roughness:.35,metalness:.7}),
 nero:M("#0b0f22",{roughness:.35}),vetro:new THREE.MeshPhysicalMaterial({color:"#9fb6ff",roughness:.05,transmission:0,transparent:true,opacity:.16,metalness:0}),
 sedia:M("#171d3a",{roughness:.5}),verde:M("#1f7a52"),verde2:M("#2fa06c"),vaso:M("#262c4e",{roughness:.4}),pelle:[M("#f1c9a5"),M("#d9a066"),M("#a8714a"),M("#7a4b2e"),M("#f7d7bd")],
 capelli:[M("#2b1b10"),M("#5a3a1d"),M("#c9a24a"),M("#8c2f1b"),M("#d8d8e8"),M("#1a1a2e")],occhio:M("#1b1b2b",{roughness:.3}),carta:new THREE.MeshBasicMaterial({color:"#dfe6ff",side:THREE.DoubleSide,toneMapped:false})};
function box(w,h,d,m,x,y,z,ombra=true){const g=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);g.position.set(x,y,z);g.castShadow=ombra;g.receiveShadow=true;return g}
function tondo(w,d,r,h,m){const s=new THREE.Shape(),x=-w/2,y=-d/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
 const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2,curveSegments:8});g.rotateX(-Math.PI/2);const mm=new THREE.Mesh(g,m);mm.receiveShadow=true;mm.castShadow=true;return mm}

// luci: una lampada fredda dall'alto, un controluce arancio, e un punto luce colorato per reparto
const emi=new THREE.HemisphereLight("#4a62b8","#0a0d1e",.55);scene.add(emi);
const sole=new THREE.DirectionalLight("#dfe8ff",.95);sole.position.set(18,30,12);sole.castShadow=true;
sole.shadow.mapSize.set(2048,2048);Object.assign(sole.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:90});sole.shadow.bias=-0.0005;sole.shadow.radius=4;scene.add(sole);
const contro=new THREE.DirectionalLight("#ff7a3d",.55);contro.position.set(-18,14,-10);scene.add(contro);
const amb=new THREE.AmbientLight("#30407a",.2);scene.add(amb);
const puntiLuce=[];

// pavimento (strato 1: non si riflette) e muri
const L=42,P=28;
const base=tondo(L,P,.8,.6,mat.pav);base.position.y=-.6;base.layers.set(1);scene.add(base);
mondo.add(box(L,5.2,.5,mat.muro,0,2.6,-P/2+.25));
mondo.add(box(.5,5.2,P,mat.muro,-L/2+.25,2.6,0));
// battiscopa al neon
mondo.add(box(L,.05,.06,NEON("#2F55E4",1.6),0,.08,-P/2+.53,false));mondo.add(box(.06,.05,P,NEON("#2F55E4",1.6),-L/2+.53,.08,0,false));
// finestre sulla città di notte
const texCitta=tela(2048,512,g=>{const gr=g.createLinearGradient(0,0,0,512);gr.addColorStop(0,"#05081a");gr.addColorStop(.45,"#121a4a");gr.addColorStop(.8,"#4a2a5a");gr.addColorStop(1,"#c2521f");g.fillStyle=gr;g.fillRect(0,0,2048,512);
 for(let i=0;i<260;i++){g.fillStyle=`rgba(255,255,255,${.3+Math.random()*.7})`;const r=Math.random()<.1?1.6:.9;g.beginPath();g.arc(Math.random()*2048,Math.random()*300,r,0,7);g.fill()}
 const glow=g.createRadialGradient(1024,520,10,1024,520,900);glow.addColorStop(0,"rgba(255,140,70,.55)");glow.addColorStop(1,"rgba(255,140,70,0)");g.fillStyle=glow;g.fillRect(0,0,2048,512);
 let x=0;while(x<2048){const w=30+Math.random()*90,h=90+Math.random()*260;g.fillStyle="#070a1c";g.fillRect(x,512-h,w,h);
  for(let yy=512-h+10;yy<500;yy+=16)for(let xx=x+6;xx<x+w-8;xx+=12){if(Math.random()<.45){g.fillStyle=Math.random()<.7?`rgba(255,214,150,${.5+Math.random()*.5})`:`rgba(150,200,255,${.4+Math.random()*.5})`;g.fillRect(xx,yy,6,8)}}
  x+=w+4+Math.random()*10}});
texCitta.wrapS=THREE.ClampToEdgeWrapping;const vetriCitta=[];
function finestra(w,h,x,y,z,rotY,u0,uw){const t=texCitta.clone();t.needsUpdate=true;t.repeat.set(uw,1);t.offset.set(u0,0);const f=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,toneMapped:false}));f.position.set(x,y,z);f.rotation.y=rotY;mondo.add(f);vetriCitta.push(f.material);
 const v=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat.vetro);v.position.copy(f.position);v.rotation.y=rotY;v.translateZ(.02);mondo.add(v)}
for(let i=0;i<6;i++){const x=-17+i*6.8;finestra(5.2,3,x,2.9,-P/2+.52,0,(x+L/2)/L*.8,5.2/L*.8);
 mondo.add(box(5.5,.14,.2,mat.metal,x,1.33,-P/2+.6));mondo.add(box(.1,3,.12,mat.metal,x,2.9,-P/2+.58))}
for(let i=0;i<3;i++){const z=-8+i*7;finestra(5,3,-L/2+.52,2.9,z,Math.PI/2,.8+(z+P/2)/P*.2,5/P*.2)}
// insegna al neon
(function(){const t=tela(1024,128,g=>{g.fillStyle="#ffffff";g.font="800 76px Archivo, sans-serif";g.textBaseline="middle";g.shadowColor="#9fb6ff";g.shadowBlur=18;g.fillText("davidedurazzi",8,64);const w=g.measureText("davidedurazzi").width;g.fillStyle="#ff7a3d";g.shadowColor="#ff7a3d";g.fillText(".it",8+w,64)});
 const m=new THREE.Mesh(new THREE.PlaneGeometry(8,1),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false,color:lum("#ffffff",1.6)}));m.position.set(-L/2+.53,4.6,3);m.rotation.y=Math.PI/2;mondo.add(m)})();
// orologio a muro (ora di Roma)
const orologioMuro=(function(){let ctx;const t=tela(256,256,g=>{ctx=g});const m=new THREE.Mesh(new THREE.CircleGeometry(.8,40),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false}));m.position.set(6.2,4.5,-P/2+.53);mondo.add(m);
 function disegna(){const o=oraRoma();const g=ctx;g.clearRect(0,0,256,256);g.fillStyle="#0f1430";g.beginPath();g.arc(128,128,120,0,Math.PI*2);g.fill();g.strokeStyle="#7f9cff";g.lineWidth=8;g.stroke();
  g.strokeStyle="#7f9cff";for(let i=0;i<12;i++){const a=i/12*Math.PI*2;g.beginPath();g.moveTo(128+Math.cos(a)*96,128+Math.sin(a)*96);g.lineTo(128+Math.cos(a)*108,128+Math.sin(a)*108);g.lineWidth=i%3?4:8;g.stroke()}
  const ah=((o.h%12)+o.m/60)/12*Math.PI*2-Math.PI/2,am=o.m/60*Math.PI*2-Math.PI/2;g.lineCap="round";g.strokeStyle="#eef1ff";g.lineWidth=12;g.beginPath();g.moveTo(128,128);g.lineTo(128+Math.cos(ah)*58,128+Math.sin(ah)*58);g.stroke();
  g.strokeStyle="#ff7a3d";g.lineWidth=8;g.beginPath();g.moveTo(128,128);g.lineTo(128+Math.cos(am)*88,128+Math.sin(am)*88);g.stroke();g.fillStyle="#ff7a3d";g.beginPath();g.arc(128,128,10,0,Math.PI*2);g.fill();t.needsUpdate=true}
 disegna();setInterval(disegna,30000);return m})();

// zone: tappeto scuro, bordo al neon del colore del reparto, un punto luce sopra
const ZONE={"Redazione":[-11.6,-7.4,17.5,11],"Direzione":[0,-7.4,6,11],"Video":[11.6,-7.4,17.5,11],
 "Commerciale":[-12.5,6.4,15.5,11],"Amministrazione":[0,6.4,8.6,11],"Social e community":[12.5,6.4,15.5,11]};
for(const [n,[x,z,w,d]] of Object.entries(ZONE)){const c=new THREE.Color(COLORI[n]);
 const r=tondo(w,d,.6,.03,M(c.clone().lerp(new THREE.Color("#0b1022"),.82),{roughness:.9,transparent:true,opacity:.55,depthWrite:false}));r.position.set(x,0,z);r.layers.set(1);r.castShadow=false;scene.add(r);
 const nm=NEON(COLORI[n],1.5);[[x,z-d/2+.25,w-.5,.04],[x,z+d/2-.25,w-.5,.04],[x-w/2+.25,z,.04,d-.5],[x+w/2-.25,z,.04,d-.5]].forEach(([bx,bz,bw,bd])=>mondo.add(box(bw,.04,bd,nm,bx,.06,bz,false)));
 const pl=new THREE.PointLight(COLORI[n],LITE?0:.9,14,2);pl.position.set(x,4.2,z);scene.add(pl);puntiLuce.push(pl)}
// vetrata della direzione
const [dx,dz,dw,dd]=ZONE.Direzione;
[[dx-dw/2,dz,.08,dd],[dx+dw/2,dz,.08,dd]].forEach(([x,z,w,d])=>{const v=box(w,2.6,d,mat.vetro,x,1.3,z,false);mondo.add(v);mondo.add(box(w+.06,.08,d,mat.metal,x,2.62,z,false))});
// coni di luce (direzione e angolo caffè)
function cono(x,z,col){const m=new THREE.Mesh(new THREE.ConeGeometry(2.6,7.5,32,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));m.position.set(x,3.75,z);m.rotation.x=Math.PI;scene.add(m)}

/* ---------- arredi ---------- */
function pianta(x,z,s=1){const g=new THREE.Group();const v=new THREE.Mesh(new THREE.CylinderGeometry(.32*s,.24*s,.6*s,20),mat.vaso);v.position.y=.3*s;v.castShadow=true;g.add(v);
 for(let i=0;i<5;i++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.34*s,0),i%2?mat.verde:mat.verde2);f.position.set(Math.cos(i*1.3)*.22*s,.85*s+i*.18*s,Math.sin(i*1.3)*.22*s);f.castShadow=true;g.add(f)}
 g.position.set(x,0,z);mondo.add(g);return g}
[[-20,-12.6],[-1.5,-12.4],[20,-12.6],[-20,12.8],[20,12.8],[4.6,12.6],[-4.6,12.6]].forEach(([x,z],i)=>pianta(x,z,i<3?1.3:1));
// angolo caffè
const CAFFE=new THREE.Vector3(0,0,0.2);
(function(){const g=new THREE.Group();g.add(box(3.4,1,1.1,mat.legno,0,.5,0));g.add(box(3.5,.08,1.2,M("#3a4470",{roughness:.3,metalness:.3}),0,1.04,0));g.add(box(3.4,.03,.04,NEON("#9fb6ff",1.4),0,.98,.58,false));
 const mc=box(.7,.8,.55,M("#1f2540",{metalness:.5,roughness:.3}),-.9,1.48,0);g.add(mc);const led=new THREE.Mesh(new THREE.BoxGeometry(.18,.06,.02),NEON("#34d399",2.2));led.position.set(-.9,1.62,.29);g.add(led);
 for(let i=0;i<3;i++){const t=new THREE.Mesh(new THREE.CylinderGeometry(.09,.07,.18,16),M("#e8ecff"));t.position.set(.2+i*.35,1.17,0);t.castShadow=true;g.add(t)}
 g.position.copy(CAFFE);mondo.add(g)})();
// lavagna della redazione con la scaletta di oggi
(function(){const t=tela(1024,640,g=>{g.fillStyle="#0e1430";g.fillRect(0,0,1024,640);g.strokeStyle="#3b6cff";g.lineWidth=10;g.strokeRect(5,5,1014,630);
 g.fillStyle="#ffffff";g.font="800 54px Archivo, sans-serif";g.fillText("Scaletta di oggi",52,92);g.fillStyle="#ff7a3d";g.fillRect(52,112,300,8);
 diarioOrd.slice(0,5).forEach(([o,c,tx],i)=>{const y=190+i*82;g.fillStyle="#7f9cff";g.font="700 34px IBM Plex Mono, monospace";g.fillText(o,52,y);g.fillStyle="#eef1ff";g.font="600 34px Archivo, sans-serif";const s=c+": "+tx;g.fillText(s.length>44?s.slice(0,43)+"…":s,170,y)});
 [["#fde68a",820,150,-6],["#bbf7d0",880,330,5],["#fbcfe8",800,470,-3]].forEach(([col,x,y,r])=>{g.save();g.translate(x,y);g.rotate(r*Math.PI/180);g.fillStyle="rgba(0,0,0,.35)";g.fillRect(6,8,130,130);g.fillStyle=col;g.fillRect(0,0,130,130);g.restore()})});
 const g=new THREE.Group();const pan=new THREE.Mesh(new THREE.PlaneGeometry(4,2.5),new THREE.MeshBasicMaterial({map:t,toneMapped:false}));pan.position.y=2.15;g.add(pan);
 const cornice=box(4.16,2.66,.08,mat.legnoS,0,2.15,-.05);g.add(cornice);[-1.7,1.7].forEach(x=>g.add(box(.08,2.9,.08,mat.metal,x,1.45,-.1)));
 g.position.set(-14,0,-12.35);mondo.add(g)})();

/* ---------- schermi animati ---------- */
const texSchermi={};
function schermo(rep,stato){const k=rep+"|"+stato;if(texSchermi[k])return texSchermi[k];
 const c=document.createElement("canvas");c.width=192;c.height=104;const g=c.getContext("2d");const fondo=stato==="prova"?"#5a4208":"#0f4a36",fondo2=stato==="prova"?"#8a6a12":"#1b7a58";const col=COLORI[rep]||"#fff";
 const righe=Array.from({length:7},()=>({w:40+Math.random()*120,t:Math.random()}));let cur=0,scroll=0;
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.minFilter=THREE.LinearFilter;
 function disegna(){const gr=g.createLinearGradient(0,0,0,104);gr.addColorStop(0,fondo2);gr.addColorStop(1,fondo);g.fillStyle=gr;g.fillRect(0,0,192,104);g.fillStyle=col;g.fillRect(0,0,192,10);g.fillStyle="#ffffff";g.fillRect(6,3,34,4);
  scroll+=1.4;if(scroll>=14){scroll=0;righe.shift();righe.push({w:40+Math.random()*120,t:Math.random()})}
  righe.forEach((r,i)=>{const y=20+i*14-scroll;if(y<14)return;g.fillStyle=r.t>.82?"#ffffff":"rgba(255,255,255,.72)";g.fillRect(10,y,r.w,5);if(r.t<.2){g.fillStyle="rgba(255,255,255,.35)";g.fillRect(14+r.w,y,20,5)}});
  cur=(cur+1)%6;if(cur<3){g.fillStyle="#ffffff";g.fillRect(10+righe[6].w,20+6*14-scroll,6,7)}
  g.fillStyle="rgba(255,255,255,.05)";g.fillRect(0,0,192,40);t.needsUpdate=true}
 disegna();if(!ridotto)setInterval(disegna,140+Math.random()*60);texSchermi[k]=t;return t}

/* ---------- ologrammi dei reparti ---------- */
const olo=[];
function ologramma(nome,x,z){const c=document.createElement("canvas");c.width=512;c.height=200;const g=c.getContext("2d");const col=COLORI[nome];
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.minFilter=THREE.LinearFilter;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1.72),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false,opacity:.95}));m.position.set(x,3.9,z);scene.add(m);
 const barre=Array.from({length:14},()=>Math.random());const o={m,nome,col,g,t,barre,fase:Math.random()*6,y:m.position.y};olo.push(o);return o}
function disegnaOlo(o,n,att){const g=o.g;g.clearRect(0,0,512,200);g.fillStyle="rgba(8,12,32,.72)";g.beginPath();g.moveTo(18,0);g.lineTo(494,0);g.quadraticCurveTo(512,0,512,18);g.lineTo(512,182);g.quadraticCurveTo(512,200,494,200);g.lineTo(18,200);g.quadraticCurveTo(0,200,0,182);g.lineTo(0,18);g.quadraticCurveTo(0,0,18,0);g.fill();
 g.strokeStyle=o.col;g.lineWidth=4;g.stroke();g.fillStyle=o.col;g.fillRect(0,0,8,200);
 g.fillStyle="#ffffff";g.font="800 52px Archivo, sans-serif";g.textBaseline="alphabetic";g.fillText(o.nome.toUpperCase(),34,70);
 g.fillStyle="rgba(238,241,255,.75)";g.font="500 30px IBM Plex Mono, monospace";g.fillText(n==null?"Finch + Davide":n+" agenti · "+att+" attivi",34,108);
 for(let i=0;i<o.barre.length;i++){o.barre[i]+=(Math.random()-.5)*.25;o.barre[i]=Math.max(.1,Math.min(1,o.barre[i]));const h=o.barre[i]*44;g.fillStyle=i%4===3?"#ffffff":o.col;g.globalAlpha=.85;g.fillRect(34+i*32,176-h,20,h)}
 g.globalAlpha=.12;g.fillStyle="#9fb6ff";for(let y=0;y<200;y+=4)g.fillRect(0,y,512,1);g.globalAlpha=1;o.t.needsUpdate=true}

/* ---------- agenti ---------- */
const clickabili=[];const etichetteDiv=$("#etichette");
function hashS(s){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function etichetta(testo,cls){const d=document.createElement("div");d.className="et "+(cls||"");d.innerHTML=testo;etichetteDiv.appendChild(d);return d}
const schermi=[];
function scrivania(x,z,rep,stato){const g=new THREE.Group();const leg=hashS(rep+x)%2?mat.legno:mat.legno2;
 g.add(box(2.3,.08,1.15,leg,0,.78,0));
 g.add(box(2.3,.02,.04,NEON(COLORI[rep],1.2),0,.82,.575,false));
 [[-1.05,-.48],[1.05,-.48],[-1.05,.48],[1.05,.48]].forEach(([a,b])=>g.add(box(.07,.76,.07,mat.metal,a,.38,b)));
 g.add(box(.08,.32,.06,mat.metal,0,.98,-.32));g.add(box(.36,.03,.24,mat.metal,0,.83,-.32));
 const mon=box(1.25,.72,.06,mat.nero,0,1.42,-.34);g.add(mon);
 const sm=new THREE.MeshStandardMaterial({color:"#000000",emissive:"#ffffff",emissiveMap:schermo(rep,stato),emissiveIntensity:1.4,roughness:.3,toneMapped:false});
 const scr=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.62),sm);scr.position.set(0,1.42,-.305);g.add(scr);schermi.push(sm);
 g.add(box(.7,.03,.22,M("#1a2140",{emissive:"#3b6cff",emissiveIntensity:.25}),0,.835,.12));
 const tz=new THREE.Mesh(new THREE.CylinderGeometry(.07,.06,.14,14),M("#e8ecff"));tz.position.set(.8,.89,.1);g.add(tz);
 // fogli appena consegnati (compaiono durante le consegne)
 const fogli=new THREE.Mesh(new THREE.PlaneGeometry(.46,.6),new THREE.MeshBasicMaterial({color:lum(COLORI[rep],1.3),transparent:true,opacity:0,toneMapped:false}));fogli.rotation.x=-Math.PI/2;fogli.rotation.z=.25;fogli.position.set(-.7,.825,.1);g.add(fogli);
 // anello d'impulso a terra quando arriva una consegna
 const anello=new THREE.Mesh(new THREE.RingGeometry(.9,1.05,48),new THREE.MeshBasicMaterial({color:lum(COLORI[rep],1.6),transparent:true,opacity:0,toneMapped:false,side:THREE.DoubleSide,depthWrite:false}));anello.rotation.x=-Math.PI/2;anello.position.set(0,.03,.6);g.add(anello);
 // sedia
 const s=new THREE.Group();s.add(box(.62,.1,.6,mat.sedia,0,.5,0));s.add(box(.6,.7,.1,mat.sedia,0,.95,.3));s.add(box(.06,.45,.06,mat.metal,0,.25,0));
 const pie=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.04,5),mat.metal);pie.position.y=.03;s.add(pie);s.position.set(0,0,.85);s.traverse(o=>{if(o.isMesh)o.castShadow=true});g.add(s);
 g.position.set(x,0,z);mondo.add(g);return {g,sm,sedia:s,fogli,anello}}
function capsula(r,h,m){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);g.add(c);[h/2,-h/2].forEach(y=>{const s=new THREE.Mesh(new THREE.SphereGeometry(r,20,12),m);s.position.y=y;g.add(s)});g.traverse(o=>{if(o.isMesh){o.castShadow=true}});return g}
const geoOcchio=new THREE.SphereGeometry(.038,10,8);
function persona(maglia,pelle,capelli,visiera){const g=new THREE.Group();
 const corpo=capsula(.3,.42,maglia);corpo.position.y=1.12;g.add(corpo);
 if(visiera){const led=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),visiera);led.position.set(0,.12,-.3);corpo.add(led)}
 const testa=new THREE.Group();const t=new THREE.Mesh(new THREE.SphereGeometry(.27,24,18),pelle);t.castShadow=true;testa.add(t);
 const cp=new THREE.Mesh(new THREE.SphereGeometry(.285,24,12,0,Math.PI*2,0,Math.PI*.55),capelli);cp.rotation.x=.35;cp.castShadow=true;testa.add(cp);
 let occhi;if(visiera){const v=new THREE.Mesh(new THREE.BoxGeometry(.34,.07,.05),visiera);v.position.set(0,.04,-.25);testa.add(v);occhi=[v,v]}
 else occhi=[-.09,.09].map(x=>{const o=new THREE.Mesh(geoOcchio,mat.occhio);o.position.set(x,.03,-.245);testa.add(o);return o});
 testa.position.y=1.78;g.add(testa);
 const bS=capsula(.08,.32,maglia),bD=capsula(.08,.32,maglia);bS.position.set(-.34,1.18,-.12);bD.position.set(.34,1.18,-.12);bS.rotation.x=bD.rotation.x=-1.1;g.add(bS);g.add(bD);
 // oggetti in mano (destra): fogli e tazzina
 const carta=new THREE.Mesh(new THREE.PlaneGeometry(.34,.44),mat.carta);carta.position.set(-.12,-.22,-.02);carta.rotation.y=.3;carta.visible=false;bD.add(carta);
 const tazza=new THREE.Mesh(new THREE.CylinderGeometry(.07,.06,.14,14),M("#e8ecff"));tazza.position.set(0,-.2,0);tazza.visible=false;bD.add(tazza);
 const gS=capsula(.1,.36,mat.sedia),gD=capsula(.1,.36,mat.sedia);gS.position.set(-.13,.62,-.22);gD.position.set(.13,.62,-.22);gS.rotation.x=gD.rotation.x=-1.45;g.add(gS);g.add(gD);
 return {g,testa,bS,bD,gS,gD,corpo,occhi,carta,tazza}}
const agenti=[];
const ICONE={"Redazione":"✎","Video":"▶","Commerciale":"€","Amministrazione":"✓","Social e community":"♥"};
// nuvolette: fumetto bianco con dentro un'icona disegnata
const texBolle={};
function bolla(tipo,colore){const k=tipo+"|"+colore;if(texBolle[k])return texBolle[k];
 const t=tela(256,256,g=>{g.fillStyle="#ffffff";g.beginPath();g.arc(128,110,86,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(96,186);g.lineTo(128,236);g.lineTo(150,180);g.closePath();g.fill();
  g.fillStyle=colore;g.strokeStyle=colore;g.textAlign="center";g.textBaseline="middle";g.lineCap="round";g.lineJoin="round";
  if(tipo==="foglio"){g.fillStyle="#f1f3ff";g.fillRect(84,56,88,112);g.strokeStyle="#10162B";g.lineWidth=5;g.strokeRect(84,56,88,112);g.strokeStyle=colore;g.lineWidth=8;[84,108,132].forEach((y,i)=>{g.beginPath();g.moveTo(100,y);g.lineTo(i===2?132:156,y);g.stroke()})}
  else if(tipo==="ok"){g.lineWidth=18;g.beginPath();g.moveTo(80,114);g.lineTo(114,148);g.lineTo(178,76);g.stroke()}
  else if(tipo.startsWith("punti")){const n=+tipo.slice(5);[88,128,168].forEach((x,i)=>{g.globalAlpha=i===n?1:.3;g.beginPath();g.arc(x,112,13,0,Math.PI*2);g.fill()});g.globalAlpha=1}
  else if(tipo==="tazza"){g.fillStyle="#ffffff";g.strokeStyle=colore;g.lineWidth=10;g.beginPath();g.rect(80,92,78,66);g.stroke();g.beginPath();g.arc(166,124,20,-Math.PI/2,Math.PI/2);g.stroke();g.lineWidth=6;[100,118,136].forEach(x=>{g.beginPath();g.moveTo(x,78);g.quadraticCurveTo(x+8,66,x,54);g.stroke()})}
  else{g.font="700 110px Archivo, system-ui, sans-serif";g.fillText(tipo,128,116)}});
 texBolle[k]=t;return t}
const texZ=tela(128,128,g=>{g.fillStyle="#cfd6ff";g.font="700 90px Archivo, sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText("z",64,70)});
function nuovoSprite(){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:texZ,transparent:true,depthWrite:false,toneMapped:false}));sp.scale.setScalar(0);scene.add(sp);return sp}
const SCURO=new THREE.Color("#0b1022");
DATI.reparti.forEach(rep=>{const z=ZONE[rep.nome];if(!z)return;const [zx,zz,zw,zd]=z;const n=rep.agenti.length;const cols=n>4?4:2,rows=Math.ceil(n/cols);
 const col=new THREE.Color(COLORI[rep.nome]);
 rep.agenti.forEach((a,i)=>{const c=i%cols,r=(i/cols)|0;const nr=r===rows-1?n-r*cols:cols;
  const x=zx+(c-(nr-1)/2)*(zw/cols),zP=zz+(r-(rows-1)/2)*(zd/rows)-.3;
  const d=scrivania(x,zP,rep.nome,a[2]);
  const h=hashS(a[0]);const maglia=M(col.clone().offsetHSL(((h%7)-3)*.015,0,((h>>4)%5-2)*.04).lerp(SCURO,.45),{roughness:.55,metalness:.15});
  const p=persona(maglia,mat.pelle[h%5],mat.capelli[(h>>3)%6],NEON(a[2]==="prova"?"#fbbf24":COLORI[rep.nome],2.4));const sede=new THREE.Vector3(x,0,zP+.85);p.g.position.copy(sede);p.g.rotation.y=0;mondo.add(p.g);
  const ag={nome:a[0],ruolo:a[1],stato:a[2],turno:a[3],oggi:a[4],reparto:rep.nome,p,d,sede,fase:(h%1000)/159,pos:sede.clone(),dest:null,faccia:null,guarda:null,giroSedia:0,rotY:0,testaX:.12,testaY:0,occupato:!!a[4],riga:r,colonna:c,impegnato:0,bolle:null,annuisce:0,palpebra:1500+(h%3000),impulso:0};
  ag.et=etichetta(esc(a[0])+(ag.occupato?"":'<span class="z">· in pausa</span>'));
  ag.sp=nuovoSprite();ag.prossima=1200+(h%4000);ag.icona=ICONE[rep.nome]||"…";
  p.g.traverse(o=>{if(o.isMesh)o.userData.ag=ag});d.g.traverse(o=>{if(o.isMesh)o.userData.ag=ag});clickabili.push(p.g,d.g);agenti.push(ag)})});
const perNome=Object.fromEntries(agenti.map(a=>[a.nome,a]));
// ologrammi sopra ogni reparto
Object.entries(ZONE).forEach(([n,[x,z,w,d]])=>{const o=ologramma(n,x,z-d/2+1.2);const r=DATI.reparti.find(r=>r.nome===n);o.n=r?r.agenti.length:null;o.att=r?r.agenti.filter(a=>a[4]).length:0;disegnaOlo(o,o.n,o.att)});
if(!ridotto)setInterval(()=>olo.forEach(o=>disegnaOlo(o,o.n,o.att)),170);

// Direzione: scrivania di Finch e di Davide
const dF=scrivania(dx,dz-2.6,"Direzione","attivo");
const dD=scrivania(dx,dz+2.2,"Direzione","attivo");
const davide=persona(M("#10162B",{roughness:.6}),mat.pelle[0],mat.capelli[0]);davide.g.position.set(dx,0,dz+3.05);mondo.add(davide.g);
const davEt=etichetta("Davide");
dD.g.traverse(o=>{if(o.isMesh)o.userData.ag="davide"});davide.g.traverse(o=>{if(o.isMesh)o.userData.ag="davide"});clickabili.push(dD.g,davide.g);
// posatoio
const pos=new THREE.Group();pos.add(box(.06,1.8,.06,mat.legnoS,0,.9,0));pos.add(box(.9,.06,.06,NEON("#f5b83d",1.3),0,1.8,0));const bas=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.05,20),mat.metal);bas.position.y=.03;pos.add(bas);pos.position.set(dx+1.9,0,dz-1.2);mondo.add(pos);
const PERCH=new THREE.Vector3(dx+1.9,1.92,dz-1.2);

// pulviscolo luminoso
const polvere=(function(){const n=LITE?90:200,pts=new Float32Array(n*3);for(let i=0;i<n;i++){pts[i*3]=-20+Math.random()*40;pts[i*3+1]=.4+Math.random()*4.6;pts[i*3+2]=-13+Math.random()*26}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(pts,3));const m=new THREE.PointsMaterial({color:lum("#9fb6ff",1.4),size:2.4,sizeAttenuation:false,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});const p=new THREE.Points(g,m);scene.add(p);return p})();

/* ---------- Finch, il fringuello ---------- */
const finch=new THREE.Group();
(function(){const arancio=M("#f26b1d",{roughness:.5,emissive:"#f26b1d",emissiveIntensity:.18}),petto=M("#ffb36b",{roughness:.6,emissive:"#ffb36b",emissiveIntensity:.12}),blu=M("#2F55E4",{roughness:.4,emissive:"#2F55E4",emissiveIntensity:.25}),giallo=M("#ffc531"),nero=M("#10162B");
 const corpo=new THREE.Mesh(new THREE.SphereGeometry(.38,28,20),arancio);corpo.scale.set(1,.9,1.25);finch.add(corpo);
 const pt=new THREE.Mesh(new THREE.SphereGeometry(.3,24,16),petto);pt.position.set(0,-.06,-.18);pt.scale.set(1,.9,.9);finch.add(pt);
 const te=new THREE.Mesh(new THREE.SphereGeometry(.26,24,18),blu);te.position.set(0,.32,-.3);finch.add(te);
 [-.11,.11].forEach(x=>{const o=new THREE.Mesh(new THREE.SphereGeometry(.05,12,8),nero);o.position.set(x,.38,-.52);finch.add(o);const l=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),NEON("#ffffff",1.6));l.position.set(x+.015,.4,-.565);finch.add(l)});
 const be=new THREE.Mesh(new THREE.ConeGeometry(.08,.2,12),giallo);be.rotation.x=-Math.PI/2;be.position.set(0,.3,-.6);finch.add(be);
 const coda=new THREE.Mesh(new THREE.BoxGeometry(.26,.04,.4),nero);coda.position.set(0,.05,.5);coda.rotation.x=-.3;finch.add(coda);
 const aS=new THREE.Group(),aD=new THREE.Group();[aS,aD].forEach((a,i)=>{const w=new THREE.Mesh(new THREE.BoxGeometry(.5,.05,.42),M("#c2410c"));w.position.x=(i?1:-1)*.25;a.add(w);a.position.set((i?1:-1)*.28,.08,0);finch.add(a)});
 finch.userData.ali=[aS,aD];
 [-.1,.1].forEach(x=>{const z=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.2,6),giallo);z.position.set(x,-.38,0);finch.add(z)});
 finch.traverse(o=>{if(o.isMesh){o.castShadow=true;o.userData.ag="finch"}})})();
finch.scale.setScalar(1.15);finch.position.copy(PERCH);mondo.add(finch);clickabili.push(finch);
const finchEt=etichetta("Finch","on");
const finchSp=nuovoSprite();let finchBolla=null;
function finchDice(tipo,ms){finchBolla={tex:bolla(tipo,"#E85A16"),t0:performance.now(),dur:ms||900}}
// scia luminosa dietro Finch in volo
const texScia=tela(64,64,g=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,"rgba(255,255,255,1)");r.addColorStop(.4,"rgba(255,200,150,.6)");r.addColorStop(1,"rgba(255,160,90,0)");g.fillStyle=r;g.fillRect(0,0,64,64)});
const scia=Array.from({length:LITE?14:28},()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:texScia,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:lum("#ffffff",1.5),toneMapped:false}));sp.scale.setScalar(0);sp.userData.t0=-1;scene.add(sp);return sp});
let sciaUlt=0,sciaI=0;

/* ---------- fumetti degli agenti ---------- */
function dice(a,tipo,ms,colore){a.bolle={tipo,tex:tipo==="punti"?null:bolla(tipo,colore||COLORI[a.reparto]),t0:performance.now(),dur:ms||1000,colore:colore||COLORI[a.reparto]};a.mostra=0}

/* ---------- volo ---------- */
let volo=null,coda=[],sosta=0;
function sopra(ag){return new THREE.Vector3(ag.d.g.position.x,1.98,ag.d.g.position.z-.34)}
function vola(dest,poi){const da=finch.position.clone();const mid=da.clone().lerp(dest,.5);mid.y=Math.max(da.y,dest.y)+3.2;
 volo={curva:new THREE.QuadraticBezierCurve3(da,mid,dest),t:0,durata:Math.max(.9,da.distanceTo(dest)/9),poi}}
function visita(ag){ag.ping=performance.now();ag.guardaFinch=performance.now()+1500;finchDice("!",700);setTimeout(()=>{if(ag.guardaFinch)dice(ag,"ok",700,"#15803d")},650)}
function prossimo(){const ag=coda.shift();if(!ag){racconta("","giro");vola(PERCH);return}racconta("Finch passa da "+ag.nome+" per il giro del mattino","giro");vola(sopra(ag),()=>{sosta=performance.now()+1300;visita(ag)})}
function giro(){coda=agenti.filter(a=>a.occupato);prossimo()}

/* ---------- interazioni fra gli agenti ---------- */
// piccole sequenze a passi: ogni passo fa qualcosa e aspetta un tempo o una condizione
const sequenze=[];
function sequenza(passi,fine){sequenze.push({passi,i:-1,t0:0,fine,avvia:true})}
function arrivato(a){return ()=>a.pos.distanceTo(a.dest||a.sede)<.06}
function accanto(a,da){const lato=(da.pos.x<a.sede.x?-1:1);const x=a.sede.x+lato*1.2;return new THREE.Vector3(x,0,a.sede.z+.15)}
function verso(a,p){const dxx=p.x-a.pos.x,dzz=p.z-a.pos.z;return Math.atan2(-dxx,-dzz)}
const FLUSSI=[
 ["Scout","Fact-checker","Scout passa al Fact-checker una notizia da verificare"],
 ["Fact-checker","Redattore","Il Fact-checker consegna al Redattore le fonti controllate"],
 ["Redattore","Critico","Il Redattore porta una bozza al Critico"],
 ["Critico","Grafico","Il Critico promuove la bozza: il Grafico prepara il carosello"],
 ["Grafico","Social","Il Grafico consegna il carosello a Social"],
 ["Critico","Il Contraddittorio","Il Critico indica al Contraddittorio il tema più divisivo del giorno"],
 ["Samaritan · Gaming","Social","Samaritan Gaming consegna a Social lo Short del giorno"],
 ["Samaritan · Motori","Social","Samaritan Motori consegna a Social il video motori"],
 ["Clip dalle live","Social","Clip dalle live porta a Social la clip di ieri sera"],
 ["Videomaker","Samaritan · Motori","Il Videomaker porta a Samaritan Motori le riprese dal Drive"],
 ["Procacciatore sponsor","Trattative","Il Procacciatore passa a Trattative un brand che ha risposto"],
 ["Affiliazioni","Social","Affiliazioni passa a Social un link da mettere nei video"],
 ["Vendite","Trattative","Vendite porta a Trattative una richiesta arrivata dal sito"],
 ["Rinnovo token","Guardiano delle chiavi","Rinnovo token mostra al Guardiano le chiavi rinnovate"],
 ["Analista","Social","L'Analista porta a Social i numeri della settimana"],
 ["Messaggi privati","Redazione AI commenti","Messaggi privati si confronta con la Redazione commenti su una risposta"],
 ["Chat delle dirette","Clip dalle live","Chat delle dirette segnala a Clip dalle live il momento migliore della diretta"]
].map(([a,b,t])=>[perNome[a],perNome[b],t]).filter(([a,b])=>a&&b);
function consegna(da,a,testo,poi,tent){if(da.impegnato||a.impegnato||da.dest||a.dest){if((tent||0)<8)setTimeout(()=>consegna(da,a,testo,poi,(tent||0)+1),1500);else if(poi)poi();return}da.impegnato=a.impegnato=1;const io={};
 sequenza([
  {fai(){racconta(testo,io);dice(da,da.icona,800)},attendi:700},
  {fai(){da.dest=accanto(a,da);da.p.carta.visible=true},attendi:arrivato(da),max:9000},
  {fai(){da.faccia=a.sede;a.guarda=da;a.giroSedia=(da.pos.x<a.sede.x?-1:1)*.75;dice(da,"foglio",1000,COLORI[da.reparto])},attendi:950},
  {fai(){da.p.carta.visible=false;a.d.fogli.material.opacity=1;a.fogliDa=performance.now();a.impulso=performance.now();dice(a,"ok",800,"#15803d");a.annuisce=performance.now()},attendi:1000},
  {fai(){da.dest=null;da.faccia=null;a.guarda=null;a.giroSedia=0},attendi:arrivato(da),max:9000}
 ],()=>{da.impegnato=a.impegnato=0;racconta("",io);if(poi)poi()})}
function vicini(a){return agenti.filter(b=>b!==a&&b.reparto===a.reparto&&b.riga===a.riga&&Math.abs(b.colonna-a.colonna)===1)}
function chiacchiera(a,b,poi){if(a.impegnato||b.impegnato||a.dest||b.dest){if(poi)poi();return}a.impegnato=b.impegnato=1;const s=a.sede.x<b.sede.x?1:-1;const io={};
 const passi=[{fai(){racconta(a.nome+" e "+b.nome+" si confrontano un attimo",io);a.giroSedia=s*.8;b.giroSedia=-s*.8;a.guarda=b;b.guarda=a},attendi:500}];
 for(let i=0;i<4;i++){const chi=i%2?b:a,altro=i%2?a:b;passi.push({fai(){dice(chi,"punti",1200);altro.annuisce=performance.now()+500},attendi:1250})}
 passi.push({fai(){a.giroSedia=b.giroSedia=0;a.guarda=b.guarda=null;dice(b,"ok",600,"#15803d")},attendi:600});
 sequenza(passi,()=>{a.impegnato=b.impegnato=0;racconta("",io);if(poi)poi()})}
let prossimaInterazione=performance.now()+4500;
let catenaAttiva=false;
function interazioneCasuale(){if(sequenze.length>=2||caffe||catenaAttiva)return;
 if(Math.random()<.62&&FLUSSI.length){const [da,a,t]=FLUSSI[(Math.random()*FLUSSI.length)|0];consegna(da,a,t)}
 else{const a=agenti[(Math.random()*agenti.length)|0];const v=vicini(a);if(v.length)chiacchiera(a,v[(Math.random()*v.length)|0])}}
// il passaggio di consegne della redazione, a comando
function catena(){if(catenaAttiva)return;catenaAttiva=true;controls.autoRotate=false;const ordine=["Scout","Fact-checker","Redattore","Critico","Grafico","Social"].map(n=>perNome[n]).filter(Boolean);let i=0;
 (function passo(){if(i>=ordine.length-1){catenaAttiva=false;vaiCamera(new THREE.Vector3(0,0,0),ZOOM0);return}const da=ordine[i],a=ordine[i+1];const f=FLUSSI.find(x=>x[0]===da&&x[1]===a);i++;
  vaiCamera(new THREE.Vector3((da.sede.x+a.sede.x)/2,1,(da.sede.z+a.sede.z)/2),1.5);consegna(da,a,f?f[2]:da.nome+" passa il lavoro a "+a.nome,passo)})()}

/* ---------- selezione e camera ---------- */
let sel=null,hover=null;
const anello=new THREE.Mesh(new THREE.TorusGeometry(1.25,.06,10,64),NEON("#E85A16",1.5));anello.rotation.x=-Math.PI/2;anello.position.y=.06;anello.visible=false;scene.add(anello);
function vaiCamera(target,zoom){animCam={t0:performance.now(),da:controls.target.clone(),a:target.clone(),z0:camera.zoom,z1:zoom}}
function seleziona(ag){sel=ag;controls.autoRotate=false;anello.visible=true;anello.position.set(ag.d.g.position.x,.06,ag.d.g.position.z+.4);schedaAgente(ag);vaiCamera(new THREE.Vector3(ag.d.g.position.x,1,ag.d.g.position.z),2.1);coda=[];vola(sopra(ag),()=>visita(ag))}
function vistaInsieme(){sel=null;anello.visible=false;chiudi();vaiCamera(new THREE.Vector3(0,0,0),ZOOM0)}
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();ray.layers.set(0);let giu=null;
function colpisci(e){const r=canvas.getBoundingClientRect();mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);const h=ray.intersectObjects(clickabili,true)[0];return h?h.object.userData.ag:null}
canvas.addEventListener("pointerdown",e=>{giu={x:e.clientX,y:e.clientY}});
canvas.addEventListener("pointerup",e=>{if(!giu)return;const m=Math.hypot(e.clientX-giu.x,e.clientY-giu.y);giu=null;if(m>6)return;const a=colpisci(e);
 if(a==="finch"){schedaFinch();sel=null;anello.visible=false;salto=performance.now();finchDice("♥",900);vaiCamera(finch.position.clone().setY(1),2.2)}
 else if(a==="davide"){sel=null;anello.visible=true;anello.position.set(dx,.06,dz+2.6);schedaDavide();vaiCamera(new THREE.Vector3(dx,1,dz+2.2),2.1)}
 else if(a)seleziona(a)});
canvas.addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;const a=colpisci(e);hover=a;canvas.style.cursor=a?"pointer":"grab"});
canvas.addEventListener("pointerleave",()=>hover=null);
let salto=0;

/* ---------- comandi ---------- */
let caffe=0,giorno=false;
$("#b-giro").onclick=()=>{if(caffe)return;vistaInsieme();giro()};
const bCons=$("#b-consegne");if(bCons)bCons.onclick=()=>{chiudi();sel=null;anello.visible=false;catena()};
addEventListener("keydown",e=>{if(e.key==="Escape")vistaInsieme()});
$("#b-caffe").onclick=()=>{if(caffe)return;caffe=performance.now();controls.autoRotate=false;coda=[];sosta=0;racconta("","giro");racconta("Pausa caffè: due chiacchiere in piedi","caffe");
 const liberi=agenti.filter(a=>!a.impegnato).sort(()=>Math.random()-.5);const gruppi=[];for(let i=0;i<liberi.length;i+=3)gruppi.push(liberi.slice(i,i+3));
 if(gruppi.length>1&&gruppi[gruppi.length-1].length===1){gruppi[gruppi.length-2].push(gruppi.pop()[0])}
 gruppi.forEach((g,gi)=>{const ang=gi/gruppi.length*Math.PI*2+.4;const centro=CAFFE.clone().add(new THREE.Vector3(Math.cos(ang)*5.2,0,Math.sin(ang)*3.9));
  g.forEach((a,i)=>{const b=i/g.length*Math.PI*2+gi;a.dest=centro.clone().add(new THREE.Vector3(Math.cos(b)*1.0,0,Math.sin(b)*1.0));a.faccia=centro;a.gruppo=g;a.impegnato=1;a.prossimaChiacchiera=performance.now()+2500+Math.random()*2000})});
 chiudi();sel=null;anello.visible=false;vaiCamera(CAFFE.clone().setY(1),1.6);vola(CAFFE.clone().setY(1.75))};
const bNotte=$("#b-notte");bNotte.textContent="Modalità giorno";
bNotte.onclick=e=>{giorno=!giorno;e.currentTarget.setAttribute("aria-pressed",String(giorno));applicaLuce()};
$("#b-vista").onclick=vistaInsieme;

/* ---------- luce: di notte (predefinita) o di giorno ---------- */
let sera=true;
function applicaLuce(){sera=!giorno;
 scene.background=new THREE.Color(sera?"#070b18":"#c3cdef");
 sole.intensity=sera?.95:1.05;sole.color.set(sera?"#dfe8ff":"#fff1dc");
 emi.intensity=sera?.55:.6;emi.color.set(sera?"#4a62b8":"#dfe7ff");emi.groundColor.set(sera?"#0a0d1e":"#6a6a88");
 amb.intensity=sera?.2:.15;contro.intensity=sera?.55:.25;vetriCitta.forEach(m=>m.color.setScalar(sera?1:2.4));
 puntiLuce.forEach(p=>p.intensity=LITE?0:(sera?.9:.15));
 polvere.material.opacity=sera?.5:.25;
 if(bloom)bloom.strength=sera?.75:.22;
 mat.pav.opacity=LITE?1:(sera?.66:.92);mat.pav.color.setScalar(sera?1:3.2);mat.muro.color.set(sera?"#1c2446":"#b8bedc");
 neonMats.forEach(m=>m.color.copy(m.userData.base).multiplyScalar(sera?1:.7));
 if(finale)finale.uniforms.esposizione.value=sera?1.15:.72;
 renderer.toneMappingExposure=sera?1.1:.85}

/* ---------- post-produzione: riflessi, bloom, grana ---------- */
if(POST){let rt=null;try{rt=new THREE.WebGLRenderTarget(canvas.clientWidth,canvas.clientHeight,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat})}catch(e){rt=null}
 composer=rt?new THREE.EffectComposer(renderer,rt):new THREE.EffectComposer(renderer);
 // passata della scena: prima il mondo specchiato sotto il pavimento, poi quello dritto
 class PassaScena extends THREE.Pass{constructor(){super();this.needsSwap=false}
  render(renderer,writeBuffer,readBuffer){const auto=renderer.autoClear;renderer.autoClear=false;renderer.setRenderTarget(this.renderToScreen?null:readBuffer);renderer.clear();
   if(!LITE&&sera){mondo.scale.y=-1;mondo.updateMatrixWorld(true);camera.layers.set(0);renderer.render(scene,camera);mondo.scale.y=1;mondo.updateMatrixWorld(true);camera.layers.enable(1)}
   renderer.render(scene,camera);renderer.autoClear=auto}}
 composer.addPass(new PassaScena());
 const w=canvas.clientWidth,h=canvas.clientHeight;
 bloom=new THREE.UnrealBloomPass(new THREE.Vector2(LITE?w/2:w,LITE?h/2:h),.75,.55,rt?1.0:.92);composer.addPass(bloom);
 finale=new THREE.ShaderPass({uniforms:{tDiffuse:{value:null},esposizione:{value:1.15},risoluzione:{value:new THREE.Vector2(w,h)}},
  vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader:`uniform sampler2D tDiffuse;uniform float esposizione;uniform vec2 risoluzione;varying vec2 vUv;
   vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
   float rumore(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
   void main(){vec4 t=texture2D(tDiffuse,vUv);vec3 c=aces(t.rgb*esposizione);c=pow(c,vec3(1.0/2.2));
    vec2 q=vUv-0.5;c*=1.0-dot(q,q)*0.55;c+=(rumore(vUv*risoluzione*0.5)-0.5)*0.018;gl_FragColor=vec4(c,1.0);}`});
 composer.addPass(finale);resize()}
applicaLuce();

/* ---------- ciclo ---------- */
const v=new THREE.Vector3(),v2=new THREE.Vector3();const clock=new THREE.Clock();
function proietta(el,pos,dy){v.copy(pos);v.project(camera);const r=canvas.getBoundingClientRect();const x=(v.x*.5+.5)*r.width,y=(-v.y*.5+.5)*r.height-(dy||0);el.style.left=x+"px";el.style.top=y+"px";return v.z<1}
function angoloVerso(a,b){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d}
function testaDi(a){return v2.set(a.p.g.position.x,1.85,a.p.g.position.z)}
function mostraSprite(sp,tex,k,sc){sp.material.map=tex;const s=sc*(k<.15?k/.15:k>.85?(1-k)/.15:1);sp.scale.set(s,s,1);sp.material.opacity=1}
// intro cinematografica: dall'alto, lentamente dentro l'ufficio
intro={t0:performance.now(),dur:ridotto?1:2600};camera.zoom=ZOOM0*.55;controls.target.set(0,5,0);camera.updateProjectionMatrix();scenaEl.classList.add("intro");
function loop(){
 const now=performance.now(),t=now/1000,dt=Math.min(clock.getDelta(),.05);
 // camera
 if(intro){const k=Math.min(1,(now-intro.t0)/intro.dur),e=1-Math.pow(1-k,3);camera.zoom=ZOOM0*(.55+.45*e);controls.target.set(0,5*(1-e),0);camera.updateProjectionMatrix();if(k>=1){intro=null;camera.zoom=ZOOM0;scenaEl.classList.remove("intro");scenaEl.classList.add("pronta")}}
 else if(animCam){const k=Math.min(1,(now-animCam.t0)/900),e=1-Math.pow(1-k,3);controls.target.lerpVectors(animCam.da,animCam.a,e);camera.zoom=animCam.z0+(animCam.z1-animCam.z0)*e;camera.updateProjectionMatrix();if(k>=1)animCam=null}
 controls.update();
 // sequenze
 for(let i=sequenze.length-1;i>=0;i--){const s=sequenze[i];let avanti=s.avvia;s.avvia=false;
  if(!avanti&&s.i>=0){const p=s.passi[s.i];avanti=typeof p.attendi==="function"?(p.attendi()||now-s.t0>(p.max||6000)):now-s.t0>=p.attendi}
  if(avanti){s.i++;s.t0=now;if(s.i>=s.passi.length){sequenze.splice(i,1);if(s.fine)s.fine()}else s.passi[s.i].fai()}}
 if(!ridotto&&now>prossimaInterazione){prossimaInterazione=now+7000+Math.random()*7000;interazioneCasuale()}
 // pausa caffè: gruppi che chiacchierano, poi tutti a posto
 const pausa=caffe&&now-caffe<13000;
 if(caffe&&!pausa){caffe=0;agenti.forEach(a=>{a.dest=null;a.faccia=null;a.gruppo=null;a.impegnato=0;a.p.tazza.visible=false});racconta("","caffe");vaiCamera(new THREE.Vector3(0,0,0),ZOOM0);vola(PERCH)}
 const finchVola=!!volo;
 agenti.forEach(a=>{const p=a.p;const meta=a.dest||a.sede;const dist=a.pos.distanceTo(meta);const inPiedi=dist>.05||!!a.dest;
  let rotDest=a.rotY;
  if(dist>.05){const passo=Math.min(dist,dt*3.2);v.subVectors(meta,a.pos).normalize();a.pos.addScaledVector(v,passo);rotDest=Math.atan2(-v.x,-v.z);p.g.position.copy(a.pos);p.g.position.y=Math.abs(Math.sin(t*10+a.fase))*.08;
   const porta=p.carta.visible;p.bS.rotation.x=Math.sin(t*10)*.6;p.bD.rotation.x=porta?-1.35:-Math.sin(t*10)*.6;p.bS.position.y=p.bD.position.y=1.18;p.gS.rotation.x=-.2+Math.sin(t*10)*.5;p.gD.rotation.x=-.2-Math.sin(t*10)*.5;p.gS.position.y=p.gD.position.y=.5;p.corpo.position.y=1.2;p.corpo.rotation.x=0;p.testa.position.y=1.86;a.testaX+=(0-a.testaX)*.1;a.testaY+=(0-a.testaY)*.1}
  else{ p.g.position.copy(meta);
   if(!a.dest){rotDest=a.giroSedia;p.gS.rotation.x=p.gD.rotation.x=-1.45;p.gS.position.y=p.gD.position.y=.62;p.corpo.position.y=1.12;p.testa.position.y=1.78;
    if(a.occupato&&!ridotto&&!a.giroSedia){const batt=Math.sin(t*16+a.fase),batt2=Math.sin(t*16+a.fase+2.1);
     p.bS.rotation.x=-1.15+batt*.22;p.bD.rotation.x=-1.15+batt2*.22;p.bS.position.y=1.18+Math.max(0,batt)*.05;p.bD.position.y=1.18+Math.max(0,batt2)*.05;
     const pensa=Math.sin(t*.45+a.fase)>.75;a.testaX+=((pensa?-.25:.12+Math.sin(t*1.6+a.fase)*.06)-a.testaX)*.08;a.testaY+=((pensa?Math.sin(t*.8)*.4:Math.sin(t*1.1+a.fase)*.12)-a.testaY)*.08;p.corpo.rotation.x=.12;
     p.corpo.position.y=1.12+Math.sin(t*2.2+a.fase)*.015}
    else if(a.giroSedia){p.bS.rotation.x=p.bD.rotation.x=-.5;p.bS.position.y=p.bD.position.y=1.18;p.corpo.rotation.x=0}
    else{p.bS.rotation.x=p.bD.rotation.x=-.2;p.bS.position.y=p.bD.position.y=1.18;p.corpo.rotation.x=0;a.testaX+=((.35+Math.sin(t*1.2+a.fase)*.04)-a.testaX)*.08;a.testaY+=(0-a.testaY)*.08}}
   else{// in piedi vicino a qualcuno
    if(a.faccia)rotDest=verso(a,a.faccia);p.gS.rotation.x=p.gD.rotation.x=0;p.gS.position.y=p.gD.position.y=.5;p.corpo.position.y=1.2;p.corpo.rotation.x=0;p.testa.position.y=1.86;p.g.position.y=Math.sin(t*1.5+a.fase)*.01;
    const beve=a.p.tazza.visible&&Math.sin(t*.7+a.fase)>.8;p.bD.rotation.x=p.carta.visible?-1.35:beve?-2.3:a.p.tazza.visible?-1.5:-.15;p.bS.rotation.x=-.15;p.bS.position.y=p.bD.position.y=1.18;
    if(!a.guarda){a.testaX+=((beve?.3:Math.sin(t*1.3+a.fase)*.06)-a.testaX)*.08;a.testaY+=(0-a.testaY)*.08}}}
  // rotazione del corpo morbida
  a.rotY+=angoloVerso(a.rotY,rotDest)*Math.min(1,dt*7);p.g.rotation.y=a.rotY;
  // sguardo: verso un collega, verso Finch quando è vicino, altrimenti al monitor
  let mira=null;if(a.guarda)mira=testaDi(a.guarda);else if(a.guardaFinch&&now<a.guardaFinch)mira=finch.position;else if(finchVola&&finch.position.distanceTo(p.g.position)<5)mira=finch.position;else if(a.guardaFinch)a.guardaFinch=0;
  if(mira){const ddx=mira.x-p.g.position.x,ddz=mira.z-p.g.position.z,dy=mira.y-1.85;let yaw=angoloVerso(a.rotY,Math.atan2(-ddx,-ddz));yaw=Math.max(-1.1,Math.min(1.1,yaw));const pitch=Math.max(-.4,Math.min(.7,Math.atan2(dy,Math.hypot(ddx,ddz))));
   a.testaY+=(yaw-a.testaY)*Math.min(1,dt*8);a.testaX+=(pitch-a.testaX)*Math.min(1,dt*8)}
  p.testa.rotation.x=a.testaX;p.testa.rotation.y=a.testaY;
  if(a.annuisce&&now>a.annuisce&&now-a.annuisce<700){const k=(now-a.annuisce)/700;p.testa.rotation.x+=Math.sin(k*Math.PI*2)*.22}
  if(a.ping&&now-a.ping<1100){const k=(now-a.ping)/1100;p.testa.position.y+=Math.sin(k*Math.PI)*.25}
  // palpebre (la visiera si assottiglia un istante)
  a.palpebra-=dt*1000;if(a.palpebra<=0){a.palpebra=2500+Math.random()*4000;a.battito=now}
  const ch=a.battito&&now-a.battito<140?.15:1;p.occhi[0].scale.y=p.occhi[1].scale.y=ch;
  // pausa caffè: chi parla nel gruppo
  if(a.gruppo&&!a.dest)a.gruppo=null;
  if(a.gruppo&&a.p.tazza&&dist<.1){a.p.tazza.visible=true;if(now>a.prossimaChiacchiera){a.prossimaChiacchiera=now+2600+Math.random()*2500;dice(a,Math.random()<.7?"punti":"tazza",1400,COLORI[a.reparto]);a.gruppo.forEach(b=>{if(b!==a){b.guarda=a;b.annuisce=now+400+Math.random()*500}});setTimeout(()=>a.gruppo&&a.gruppo.forEach(b=>{if(b.guarda===a)b.guarda=null}),1500)}}
  // fogli consegnati sulla scrivania: restano un po' e poi spariscono
  if(a.fogliDa){const k=(now-a.fogliDa)/9000;a.d.fogli.material.opacity=k>=1?0:k>.8?(1-k)/.2:1;if(k>=1)a.fogliDa=0}
  // impulso luminoso a terra all'arrivo di una consegna
  if(a.impulso){const k=(now-a.impulso)/900;if(k>=1){a.impulso=0;a.d.anello.material.opacity=0}else{a.d.anello.material.opacity=(1-k)*.9;const s=.4+k*1.6;a.d.anello.scale.set(s,s,1)}}
  // fumetti: eventi espliciti, altrimenti chi lavora la mostra ogni tanto, chi dorme fa le z
  if(a.bolle){const b=a.bolle,k=(now-b.t0)/b.dur;if(k>=1){a.bolle=null;a.sp.scale.setScalar(0)}
   else{const tex=b.tipo==="punti"?bolla("punti"+(((now-b.t0)/260|0)%3),b.colore):b.tex;mostraSprite(a.sp,tex,k,1);a.sp.position.set(p.g.position.x+.45,p.g.position.y+(inPiedi?2.85:2.75),p.g.position.z)}}
  else if(!ridotto&&!a.dest&&!a.impegnato){a.prossima-=dt*1000;
   if(a.prossima<=0){a.mostra=now;a.prossima=a.occupato?3000+Math.random()*5000:4000+Math.random()*3000}
   if(a.mostra){const k=(now-a.mostra)/(a.occupato?1600:2200);if(k>=1){a.mostra=0;a.sp.scale.setScalar(0)}
    else{a.sp.material.map=a.occupato?bolla(a.icona,COLORI[a.reparto]):texZ;const sc=a.occupato?(k<.15?k/.15:k>.85?(1-k)/.15:1):1-k*.6;const s=.9*(a.occupato?1:.6)*Math.max(0,sc);a.sp.scale.set(s,s,1);
     a.sp.position.set(p.g.position.x+.45,2.75+(a.occupato?Math.sin(now/300)*.04:k*.9),p.g.position.z);a.sp.material.opacity=a.occupato?1:1-k}}}
  else a.sp.scale.setScalar(0);
  // schermo
  a.d.sm.emissiveIntensity=(sera?1.4:1.1)+(a.occupato?Math.sin(t*3+a.fase)*.12:-.45);
  const vis=hover===a||sel===a||(a.ping&&now-a.ping<1600)||(a.impegnato&&!caffe);a.et.classList.toggle("on",vis);a.et.classList.toggle("sel",sel===a);
  if(vis)proietta(a.et,v.set(a.p.g.position.x,2.55+(inPiedi?.1:0),a.p.g.position.z),0)});
 // Davide: presente solo dalle 4 alle 7
 const h=oraRoma().h;davide.g.visible=h>=4&&h<7;davide.bS.rotation.x=-1.1+Math.sin(t*12)*.1;davide.bD.rotation.x=-1.1+Math.sin(t*12+2)*.1;
 davEt.classList.toggle("on",hover==="davide");if(hover==="davide")proietta(davEt,v.set(dx,2.6,dz+2.6));
 // Finch
 const [aS,aD]=finch.userData.ali;
 if(volo){volo.t+=dt/volo.durata;const k=Math.min(1,volo.t),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;const p=volo.curva.getPoint(e),q=volo.curva.getPoint(Math.min(1,e+.02));finch.position.copy(p);
  if(q.distanceToSquared(p)>1e-6){finch.lookAt(q.x,finch.position.y,q.z);finch.rotateY(Math.PI)}
  const f=Math.sin(t*28)*.9;aS.rotation.z=f;aD.rotation.z=-f;
  if(!ridotto&&now-sciaUlt>45){sciaUlt=now;const sp=scia[sciaI=(sciaI+1)%scia.length];sp.position.copy(finch.position);sp.position.y-=.1;sp.userData.t0=now}
  if(k>=1){const cb=volo.poi;volo=null;if(cb)cb();}}
 else{aS.rotation.z=aD.rotation.z=Math.sin(t*2)*.05;finch.position.y+=Math.sin(t*3)*.002;
  if(sosta&&now>sosta){sosta=0;prossimo()}}
 scia.forEach(sp=>{if(sp.userData.t0<0)return;const k=(now-sp.userData.t0)/750;if(k>=1){sp.userData.t0=-1;sp.scale.setScalar(0)}else{const s=.55*(1-k)+.1;sp.scale.set(s,s,1);sp.material.opacity=1-k}});
 if(salto&&now-salto<900){const k=(now-salto)/900;finch.rotation.y+=dt*14;finch.position.y=(volo?finch.position.y:PERCH.y)+Math.sin(k*Math.PI)*.8}
 if(finchBolla){const k=(now-finchBolla.t0)/finchBolla.dur;if(k>=1){finchBolla=null;finchSp.scale.setScalar(0)}else{mostraSprite(finchSp,finchBolla.tex,k,.9);finchSp.position.set(finch.position.x+.5,finch.position.y+.9,finch.position.z)}}
 proietta(finchEt,v.set(finch.position.x,finch.position.y+1,finch.position.z));
 // ologrammi: sempre rivolti alla camera, con un leggero galleggiamento
 olo.forEach(o=>{o.m.quaternion.copy(camera.quaternion);o.m.position.y=o.y+Math.sin(t*1.1+o.fase)*.06});
 anello.scale.setScalar(1+Math.sin(t*4)*.05);
 // pulviscolo che fluttua
 if(!ridotto){const arr=polvere.geometry.attributes.position.array;for(let i=0;i<arr.length;i+=3){arr[i]+=Math.sin(t*.3+i)*.002;arr[i+1]+=Math.cos(t*.2+i*.7)*.0015}polvere.geometry.attributes.position.needsUpdate=true}
 if(composer)composer.render();else renderer.render(scene,camera);requestAnimationFrame(loop)}
loop();
setTimeout(giro,ridotto?1200:3200);
})();
