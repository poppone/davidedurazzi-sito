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
 finch:{nome:"Finch",ruolo:"Il Direttore: coordina gli agenti, approva le bozze seguendo il Critico, tiene il diario",turno:"Ogni giorno alle 7:52",oggi:note["Finch"]||""},
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
$("#diario").innerHTML=(DATI.diario.length?DATI.diario:[["—","Finch","Oggi non ci sono ancora note."]]).slice().sort((a,b)=>a[0].localeCompare(b[0])).map(([o,c,t])=>`<li><span class="ora">${esc(o)}</span><span><span class="chi">${esc(c)}</span> ${esc(t)}</span></li>`).join("");
const bt=$("#box-todo");if(bt)bt.hidden=true;
$("#agg").textContent="Agenti dalla pagina L'azienda. Note del giorno scritte da Finch"+(DATI.aggiornato?" il "+DATI.aggiornato:"")+". Il fringuello è Finch, il Direttore: un agente AI.";
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

/* ---------- 3D ---------- */
if(!window.THREE){document.querySelector(".scena").insertAdjacentHTML("beforeend",'<div class="errore">La scena 3D non si è caricata. Ricarica la pagina.</div>');return}
const canvas=$("#ufTela");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,200);
const CAM0=new THREE.Vector3(26,26,26);camera.position.copy(CAM0);
const controls=new THREE.OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=true;controls.screenSpacePanning=true;
controls.minZoom=.7;controls.maxZoom=3.2;controls.maxPolarAngle=Math.PI*0.42;controls.minPolarAngle=Math.PI*0.12;
controls.target.set(0,0,0);
let VIEW=17;
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);const a=w/h;VIEW=a<1?26:a<1.4?21:17;
 const sh=a>=1.4?.22:0;camera.left=-VIEW*a*(1-sh);camera.right=VIEW*a*(1+sh);camera.top=VIEW;camera.bottom=-VIEW;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(canvas);resize();

// materiali
const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.7,metalness:0},o));
const mat={pav:M("#d3d7ee",{roughness:.95}),muro:M("#d9dcef",{roughness:.9}),legno:M("#c99a6b",{roughness:.6}),legnoS:M("#8f6440"),metal:M("#2b3150",{roughness:.4,metalness:.6}),
 nero:M("#141826",{roughness:.4}),vetro:new THREE.MeshPhysicalMaterial({color:"#bcd3ff",roughness:.05,transmission:0,transparent:true,opacity:.22,metalness:0}),
 sedia:M("#262c46",{roughness:.5}),verde:M("#2f9e6b"),verde2:M("#4cc38a"),vaso:M("#f2f2f7",{roughness:.4}),pelle:[M("#f1c9a5"),M("#d9a066"),M("#a8714a"),M("#7a4b2e"),M("#f7d7bd")],
 capelli:[M("#2b1b10"),M("#5a3a1d"),M("#c9a24a"),M("#8c2f1b"),M("#d8d8e8"),M("#1a1a2e")]};
function box(w,h,d,m,x,y,z,ombra=true){const g=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);g.position.set(x,y,z);g.castShadow=ombra;g.receiveShadow=true;return g}
function tondo(w,d,r,h,m){const s=new THREE.Shape(),x=-w/2,y=-d/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
 const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2,curveSegments:8});g.rotateX(-Math.PI/2);const mm=new THREE.Mesh(g,m);mm.receiveShadow=true;mm.castShadow=true;return mm}

// luci
const emi=new THREE.HemisphereLight("#dfe7ff","#3a2f4a",.75);scene.add(emi);
const sole=new THREE.DirectionalLight("#fff1dc",1.35);sole.position.set(18,30,12);sole.castShadow=true;
sole.shadow.mapSize.set(2048,2048);Object.assign(sole.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:90});sole.shadow.bias=-0.0005;sole.shadow.radius=4;scene.add(sole);
const amb=new THREE.AmbientLight("#8090c0",.15);scene.add(amb);

// pavimento e muri
const L=42,P=28;
const base=tondo(L,P,.8,.6,mat.pav);base.position.y=-.6;scene.add(base);
scene.add(box(L,5.2,.5,mat.muro,0,2.6,-P/2+.25));
scene.add(box(.5,5.2,P,mat.muro,-L/2+.25,2.6,0));
// finestre con cielo
const cieloMat=new THREE.MeshBasicMaterial({color:"#9cc4ff"});
const finestre=[];for(let i=0;i<6;i++){const x=-17+i*6.8;const f=new THREE.Mesh(new THREE.PlaneGeometry(5.2,3),cieloMat);f.position.set(x,2.9,-P/2+.52);scene.add(f);finestre.push(f);
 scene.add(box(5.5,.14,.2,mat.metal,x,1.33,-P/2+.6));scene.add(box(.1,3,.12,mat.metal,x,2.9,-P/2+.58))}
for(let i=0;i<3;i++){const z=-8+i*7;const f=new THREE.Mesh(new THREE.PlaneGeometry(5,3),cieloMat);f.rotation.y=Math.PI/2;f.position.set(-L/2+.52,2.9,z);scene.add(f)}
// scritta sul muro
(function(){const c=document.createElement("canvas");c.width=1024;c.height=128;const g=c.getContext("2d");g.fillStyle="#10162B";g.font="800 76px Archivo, sans-serif";g.textBaseline="middle";g.fillText("davidedurazzi",8,64);const w=g.measureText("davidedurazzi").width;g.fillStyle="#E85A16";g.fillText(".it",8+w,64);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;const m=new THREE.Mesh(new THREE.PlaneGeometry(8,1),new THREE.MeshBasicMaterial({map:t,transparent:true}));m.position.set(-L/2+.53,4.6,3);m.rotation.y=Math.PI/2;scene.add(m)})();

// zone
const ZONE={"Redazione":[-11.6,-7.4,17.5,11],"Direzione":[0,-7.4,6,11],"Video":[11.6,-7.4,17.5,11],
 "Commerciale":[-12.5,6.4,15.5,11],"Amministrazione":[0,6.4,8.6,11],"Social e community":[12.5,6.4,15.5,11]};
for(const [n,[x,z,w,d]] of Object.entries(ZONE)){const c=new THREE.Color(COLORI[n]);const r=tondo(w,d,.6,.04,M(c.clone().lerp(new THREE.Color("#ffffff"),.72),{roughness:.95}));r.position.set(x,0,z);scene.add(r)}
// vetrata della direzione
const [dx,dz,dw,dd]=ZONE.Direzione;
[[dx-dw/2,dz,.08,dd],[dx+dw/2,dz,.08,dd]].forEach(([x,z,w,d])=>{const v=box(w,2.6,d,mat.vetro,x,1.3,z,false);scene.add(v);scene.add(box(w+.06,.08,d,mat.metal,x,2.62,z,false))});

/* ---------- arredi ---------- */
function pianta(x,z,s=1){const g=new THREE.Group();const v=new THREE.Mesh(new THREE.CylinderGeometry(.32*s,.24*s,.6*s,20),mat.vaso);v.position.y=.3*s;v.castShadow=true;g.add(v);
 for(let i=0;i<5;i++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.34*s,0),i%2?mat.verde:mat.verde2);f.position.set(Math.cos(i*1.3)*.22*s,.85*s+i*.18*s,Math.sin(i*1.3)*.22*s);f.castShadow=true;g.add(f)}
 g.position.set(x,0,z);scene.add(g);return g}
[[-20,-12.6],[-1.5,-12.4],[20,-12.6],[-20,12.8],[20,12.8],[4.6,12.6],[-4.6,12.6]].forEach(([x,z],i)=>pianta(x,z,i<3?1.3:1));
// angolo caffè
const CAFFE=new THREE.Vector3(0,0,0.2);
(function(){const g=new THREE.Group();g.add(box(3.4,1,1.1,mat.legno,0,.5,0));g.add(box(3.5,.08,1.2,M("#f4f4f8"),0,1.04,0));
 const mc=box(.7,.8,.55,M("#1f2540",{metalness:.5,roughness:.3}),-.9,1.48,0);g.add(mc);const led=new THREE.Mesh(new THREE.BoxGeometry(.18,.06,.02),new THREE.MeshBasicMaterial({color:"#34d399"}));led.position.set(-.9,1.62,.29);g.add(led);
 for(let i=0;i<3;i++){const t=new THREE.Mesh(new THREE.CylinderGeometry(.09,.07,.18,16),M("#ffffff"));t.position.set(.2+i*.35,1.17,0);t.castShadow=true;g.add(t)}
 g.position.copy(CAFFE);scene.add(g)})();

/* ---------- agenti ---------- */
const clickabili=[];const etichetteDiv=$("#etichette");
function hashS(s){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function etichetta(testo,cls){const d=document.createElement("div");d.className="et "+(cls||"");d.innerHTML=testo;etichetteDiv.appendChild(d);return d}
const schermi=[];
function scrivania(x,z,colSchermo){const g=new THREE.Group();
 g.add(box(2.3,.08,1.15,mat.legno,0,.78,0));
 [[-1.05,-.48],[1.05,-.48],[-1.05,.48],[1.05,.48]].forEach(([a,b])=>g.add(box(.07,.76,.07,mat.metal,a,.38,b)));
 g.add(box(.08,.32,.06,mat.metal,0,.98,-.32));g.add(box(.36,.03,.24,mat.metal,0,.83,-.32));
 const mon=box(1.25,.72,.06,mat.nero,0,1.42,-.34);g.add(mon);
 const sm=new THREE.MeshStandardMaterial({color:"#0b1022",emissive:new THREE.Color(colSchermo),emissiveIntensity:.9,roughness:.3});
 const scr=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.62),sm);scr.position.set(0,1.42,-.305);g.add(scr);schermi.push(sm);
 g.add(box(.7,.03,.22,M("#e8e8f0"),0,.835,.12));
 const tz=new THREE.Mesh(new THREE.CylinderGeometry(.07,.06,.14,14),M("#ffffff"));tz.position.set(.8,.89,.1);g.add(tz);
 // sedia
 const s=new THREE.Group();s.add(box(.62,.1,.6,mat.sedia,0,.5,0));s.add(box(.6,.7,.1,mat.sedia,0,.95,.3));s.add(box(.06,.45,.06,mat.metal,0,.25,0));
 const pie=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.04,5),mat.metal);pie.position.y=.03;s.add(pie);s.position.set(0,0,.85);s.traverse(o=>{if(o.isMesh)o.castShadow=true});g.add(s);
 g.position.set(x,0,z);scene.add(g);return {g,sm,sedia:s}}
function capsula(r,h,m){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);g.add(c);[h/2,-h/2].forEach(y=>{const s=new THREE.Mesh(new THREE.SphereGeometry(r,20,12),m);s.position.y=y;g.add(s)});g.traverse(o=>{if(o.isMesh){o.castShadow=true}});return g}
function persona(maglia,pelle,capelli){const g=new THREE.Group();
 const corpo=capsula(.3,.42,maglia);corpo.position.y=1.12;g.add(corpo);
 const testa=new THREE.Group();const t=new THREE.Mesh(new THREE.SphereGeometry(.27,24,18),pelle);t.castShadow=true;testa.add(t);
 const cp=new THREE.Mesh(new THREE.SphereGeometry(.285,24,12,0,Math.PI*2,0,Math.PI*.55),capelli);cp.rotation.x=.35;cp.castShadow=true;testa.add(cp);
 testa.position.y=1.78;g.add(testa);
 const bS=capsula(.08,.32,maglia),bD=capsula(.08,.32,maglia);bS.position.set(-.34,1.18,-.12);bD.position.set(.34,1.18,-.12);bS.rotation.x=bD.rotation.x=-1.1;g.add(bS);g.add(bD);
 const gS=capsula(.1,.36,mat.sedia),gD=capsula(.1,.36,mat.sedia);gS.position.set(-.13,.62,-.22);gD.position.set(.13,.62,-.22);gS.rotation.x=gD.rotation.x=-1.45;g.add(gS);g.add(gD);
 return {g,testa,bS,bD,gS,gD,corpo}}
const agenti=[];
const ICONE={"Redazione":"✎","Video":"▶","Commerciale":"€","Amministrazione":"✓","Social e community":"♥"};
const texNuvola={};
function nuvola(rep){if(texNuvola[rep])return texNuvola[rep];const c=document.createElement("canvas");c.width=256;c.height=256;const g=c.getContext("2d");
 g.fillStyle="#ffffff";g.beginPath();g.arc(128,110,86,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(96,186);g.lineTo(128,236);g.lineTo(150,180);g.closePath();g.fill();
 g.fillStyle=COLORI[rep];g.font="700 110px Archivo, system-ui, sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText(ICONE[rep]||"…",128,116);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;texNuvola[rep]=t;return t}
const texZ=(function(){const c=document.createElement("canvas");c.width=128;c.height=128;const g=c.getContext("2d");g.fillStyle="#cfd6ff";g.font="700 90px Archivo, sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText("z",64,70);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t})();
DATI.reparti.forEach(rep=>{const z=ZONE[rep.nome];if(!z)return;const [zx,zz,zw,zd]=z;const n=rep.agenti.length;const cols=n>4?4:2,rows=Math.ceil(n/cols);
 const col=new THREE.Color(COLORI[rep.nome]);
 rep.agenti.forEach((a,i)=>{const c=i%cols,r=(i/cols)|0;const nr=r===rows-1?n-r*cols:cols;
  const x=zx+(c-(nr-1)/2)*(zw/cols),zP=zz+(r-(rows-1)/2)*(zd/rows)-.3;
  const colSch=a[2]==="prova"?"#fbbf24":"#34d399";const d=scrivania(x,zP,colSch);
  const h=hashS(a[0]);const maglia=M(col.clone().offsetHSL(((h%7)-3)*.015,0,((h>>4)%5-2)*.04),{roughness:.65});
  const p=persona(maglia,mat.pelle[h%5],mat.capelli[(h>>3)%6]);const sede=new THREE.Vector3(x,0,zP+.85);p.g.position.copy(sede);p.g.rotation.y=0;scene.add(p.g);
  const ag={nome:a[0],ruolo:a[1],stato:a[2],turno:a[3],oggi:a[4],reparto:rep.nome,p,d,sede,fase:(h%1000)/159,pos:sede.clone(),dest:null,occupato:!!a[4]};
  ag.et=etichetta(esc(a[0])+(ag.occupato?"":'<span class="z">· in pausa</span>'));
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:ag.occupato?nuvola(rep.nome):texZ,transparent:true,depthWrite:false}));sp.scale.setScalar(0);sp.position.set(x+.45,2.75,zP+.85);scene.add(sp);ag.sp=sp;ag.prossima=1200+(h%4000);
  p.g.traverse(o=>{if(o.isMesh)o.userData.ag=ag});d.g.traverse(o=>{if(o.isMesh)o.userData.ag=ag});clickabili.push(p.g,d.g);agenti.push(ag)})});
// etichette dei reparti
const etRep=Object.entries(ZONE).map(([n,[x,z,w,d]])=>({el:etichetta(esc(n),"rep on"),v:new THREE.Vector3(x,2.9,z-d/2+.4)}));

// Direzione: scrivania di Finch e di Davide
const dF=scrivania(dx,dz-2.6,"#E85A16");
const dD=scrivania(dx,dz+2.2,"#3b6cff");
const davide=persona(M("#10162B"),mat.pelle[0],mat.capelli[0]);davide.g.position.set(dx,0,dz+3.05);scene.add(davide.g);
const davEt=etichetta("Davide");
dD.g.traverse(o=>{if(o.isMesh)o.userData.ag="davide"});davide.g.traverse(o=>{if(o.isMesh)o.userData.ag="davide"});clickabili.push(dD.g,davide.g);
// posatoio
const pos=new THREE.Group();pos.add(box(.06,1.8,.06,mat.legnoS,0,.9,0));pos.add(box(.9,.06,.06,mat.legnoS,0,1.8,0));const bas=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.05,20),mat.metal);bas.position.y=.03;pos.add(bas);pos.position.set(dx+1.9,0,dz-1.2);scene.add(pos);
const PERCH=new THREE.Vector3(dx+1.9,1.92,dz-1.2);

/* ---------- Finch, il fringuello ---------- */
const finch=new THREE.Group();
(function(){const arancio=M("#f26b1d",{roughness:.5}),petto=M("#ffb36b",{roughness:.6}),blu=M("#2F55E4",{roughness:.4}),giallo=M("#ffc531"),nero=M("#10162B");
 const corpo=new THREE.Mesh(new THREE.SphereGeometry(.38,28,20),arancio);corpo.scale.set(1,.9,1.25);finch.add(corpo);
 const pt=new THREE.Mesh(new THREE.SphereGeometry(.3,24,16),petto);pt.position.set(0,-.06,-.18);pt.scale.set(1,.9,.9);finch.add(pt);
 const te=new THREE.Mesh(new THREE.SphereGeometry(.26,24,18),blu);te.position.set(0,.32,-.3);finch.add(te);
 [-.11,.11].forEach(x=>{const o=new THREE.Mesh(new THREE.SphereGeometry(.05,12,8),nero);o.position.set(x,.38,-.52);finch.add(o);const l=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),M("#ffffff"));l.position.set(x+.015,.4,-.565);finch.add(l)});
 const be=new THREE.Mesh(new THREE.ConeGeometry(.08,.2,12),giallo);be.rotation.x=-Math.PI/2;be.position.set(0,.3,-.6);finch.add(be);
 const coda=new THREE.Mesh(new THREE.BoxGeometry(.26,.04,.4),nero);coda.position.set(0,.05,.5);coda.rotation.x=-.3;finch.add(coda);
 const aS=new THREE.Group(),aD=new THREE.Group();[aS,aD].forEach((a,i)=>{const w=new THREE.Mesh(new THREE.BoxGeometry(.5,.05,.42),M("#c2410c"));w.position.x=(i?1:-1)*.25;a.add(w);a.position.set((i?1:-1)*.28,.08,0);finch.add(a)});
 finch.userData.ali=[aS,aD];
 [-.1,.1].forEach(x=>{const z=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.2,6),giallo);z.position.set(x,-.38,0);finch.add(z)});
 finch.traverse(o=>{if(o.isMesh){o.castShadow=true;o.userData.ag="finch"}})})();
finch.scale.setScalar(1.15);finch.position.copy(PERCH);scene.add(finch);clickabili.push(finch);
const finchEt=etichetta("Finch","on");

/* ---------- volo ---------- */
let volo=null,coda=[],sosta=0;
function sopra(ag){return new THREE.Vector3(ag.d.g.position.x,1.98,ag.d.g.position.z-.34)}
function vola(dest,poi){const da=finch.position.clone();const mid=da.clone().lerp(dest,.5);mid.y=Math.max(da.y,dest.y)+3.2;
 volo={curva:new THREE.QuadraticBezierCurve3(da,mid,dest),t:0,durata:Math.max(.9,da.distanceTo(dest)/9),poi}}
function prossimo(){const ag=coda.shift();if(!ag){vola(PERCH);return}vola(sopra(ag),()=>{sosta=performance.now()+1100;ag.ping=performance.now()})}
function giro(){coda=agenti.filter(a=>a.occupato);prossimo()}

/* ---------- selezione e camera ---------- */
let sel=null,hover=null;
const anello=new THREE.Mesh(new THREE.TorusGeometry(1.25,.06,10,64),new THREE.MeshBasicMaterial({color:"#E85A16"}));anello.rotation.x=-Math.PI/2;anello.position.y=.06;anello.visible=false;scene.add(anello);
let animCam=null;
function vaiCamera(target,zoom){animCam={t0:performance.now(),da:controls.target.clone(),a:target.clone(),z0:camera.zoom,z1:zoom}}
function seleziona(ag){sel=ag;anello.visible=true;anello.position.set(ag.d.g.position.x,.06,ag.d.g.position.z+.4);schedaAgente(ag);vaiCamera(new THREE.Vector3(ag.d.g.position.x,1,ag.d.g.position.z),2.1);coda=[];vola(sopra(ag),()=>{ag.ping=performance.now()})}
function vistaInsieme(){sel=null;anello.visible=false;chiudi();vaiCamera(new THREE.Vector3(0,0,0),1)}
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let giu=null;
function colpisci(e){const r=canvas.getBoundingClientRect();mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);const h=ray.intersectObjects(clickabili,true)[0];return h?h.object.userData.ag:null}
canvas.addEventListener("pointerdown",e=>{giu={x:e.clientX,y:e.clientY}});
canvas.addEventListener("pointerup",e=>{if(!giu)return;const m=Math.hypot(e.clientX-giu.x,e.clientY-giu.y);giu=null;if(m>6)return;const a=colpisci(e);
 if(a==="finch"){schedaFinch();sel=null;anello.visible=false;salto=performance.now();vaiCamera(finch.position.clone().setY(1),2.2)}
 else if(a==="davide"){sel=null;anello.visible=true;anello.position.set(dx,.06,dz+2.6);schedaDavide();vaiCamera(new THREE.Vector3(dx,1,dz+2.2),2.1)}
 else if(a)seleziona(a)});
canvas.addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;const a=colpisci(e);hover=a;canvas.style.cursor=a?"pointer":"grab"});
canvas.addEventListener("pointerleave",()=>hover=null);
let salto=0;

/* ---------- comandi ---------- */
let caffe=0,notte=false;
$("#b-giro").onclick=()=>{vistaInsieme();giro()};
addEventListener("keydown",e=>{if(e.key==="Escape")vistaInsieme()});
$("#b-caffe").onclick=()=>{caffe=performance.now();agenti.forEach((a,i)=>{const ang=i/agenti.length*Math.PI*2;a.dest=CAFFE.clone().add(new THREE.Vector3(Math.cos(ang)*(2.4+(i%3)*.7),0,Math.sin(ang)*(1.9+(i%3)*.6)))});vola(CAFFE.clone().setY(1.6))};
$("#b-notte").onclick=e=>{notte=!notte;e.currentTarget.setAttribute("aria-pressed",String(notte));applicaLuce()};
$("#b-vista").onclick=vistaInsieme;

/* ---------- luce in base all'ora di Roma ---------- */
function applicaLuce(){const h=oraRoma().h;const sera=notte||h>=19||h<6,tram=!notte&&((h>=17&&h<19)||(h>=6&&h<8));
 scene.background=new THREE.Color(sera?"#0b1230":tram?"#2a2350":"#cfd8f6");
 cieloMat.color.set(sera?"#1a2560":tram?"#ff9b5e":"#9cc4ff");
 sole.intensity=sera?.25:tram?1.0:1.35;sole.color.set(tram?"#ffc38a":"#fff1dc");
 emi.intensity=sera?.32:.75;amb.intensity=sera?.12:.15;
 renderer.toneMappingExposure=sera?1.25:1.05;
 schermi.forEach(m=>m.emissiveIntensity=sera?1.6:.9)}
applicaLuce();setInterval(applicaLuce,60000);

/* ---------- ciclo ---------- */
const v=new THREE.Vector3();const clock=new THREE.Clock();
function proietta(el,pos,dy){v.copy(pos);v.project(camera);const r=canvas.getBoundingClientRect();const x=(v.x*.5+.5)*r.width,y=(-v.y*.5+.5)*r.height-(dy||0);el.style.left=x+"px";el.style.top=y+"px";return v.z<1}
function loop(){
 const now=performance.now(),t=now/1000,dt=Math.min(clock.getDelta(),.05);
 // camera
 if(animCam){const k=Math.min(1,(now-animCam.t0)/900),e=1-Math.pow(1-k,3);controls.target.lerpVectors(animCam.da,animCam.a,e);camera.zoom=animCam.z0+(animCam.z1-animCam.z0)*e;camera.updateProjectionMatrix();if(k>=1)animCam=null}
 controls.update();
 // agenti
 const pausa=caffe&&now-caffe<9000;if(caffe&&!pausa){caffe=0;agenti.forEach(a=>a.dest=null);vola(PERCH)}
 agenti.forEach(a=>{const p=a.p;const meta=a.dest||a.sede;const dist=a.pos.distanceTo(meta);
  if(dist>.05){const passo=Math.min(dist,dt*3.2);v.subVectors(meta,a.pos).normalize();a.pos.addScaledVector(v,passo);p.g.rotation.y=Math.atan2(-v.x,-v.z)+Math.PI;p.g.position.copy(a.pos);p.g.position.y=Math.abs(Math.sin(t*10+a.fase))*.08;
   p.bS.rotation.x=Math.sin(t*10)*.6;p.bD.rotation.x=-Math.sin(t*10)*.6;p.gS.rotation.x=-.2+Math.sin(t*10)*.5;p.gD.rotation.x=-.2-Math.sin(t*10)*.5;p.gS.position.y=p.gD.position.y=.5;p.corpo.position.y=1.2;p.testa.position.y=1.86}
  else{ p.g.position.copy(meta);
   if(!a.dest){p.g.rotation.y=0;p.gS.rotation.x=p.gD.rotation.x=-1.45;p.gS.position.y=p.gD.position.y=.62;p.corpo.position.y=1.12;p.testa.position.y=1.78;
    if(a.occupato&&!ridotto){const batt=Math.sin(t*16+a.fase),batt2=Math.sin(t*16+a.fase+2.1);
     p.bS.rotation.x=-1.15+batt*.22;p.bD.rotation.x=-1.15+batt2*.22;p.bS.position.y=1.18+Math.max(0,batt)*.05;p.bD.position.y=1.18+Math.max(0,batt2)*.05;
     const pensa=Math.sin(t*.45+a.fase)>.75;p.testa.rotation.x=pensa?-.25:.12+Math.sin(t*1.6+a.fase)*.06;p.testa.rotation.y=pensa?Math.sin(t*.8)*.4:Math.sin(t*1.1+a.fase)*.12;p.corpo.rotation.x=.12;
     p.corpo.position.y=1.12+Math.sin(t*2.2+a.fase)*.015}
    else{p.bS.rotation.x=p.bD.rotation.x=-.2;p.bS.position.y=p.bD.position.y=1.18;p.corpo.rotation.x=0;p.testa.rotation.x=.35+Math.sin(t*1.2+a.fase)*.04;p.testa.rotation.y=0}}
   else{p.g.lookAt(CAFFE.x,0,CAFFE.z);p.bS.rotation.x=p.bD.rotation.x=0;p.gS.rotation.x=p.gD.rotation.x=0;p.testa.rotation.x=Math.sin(t*2+a.fase)*.08}}
  if(a.ping&&now-a.ping<1100){const k=(now-a.ping)/1100;p.testa.position.y+=Math.sin(k*Math.PI)*.25}
  // nuvoletta: chi lavora la mostra ogni tanto, chi dorme fa le z
  if(!ridotto&&!a.dest){a.prossima-=dt*1000;
   if(a.prossima<=0){a.mostra=now;a.prossima=a.occupato?2600+Math.random()*4500:4000+Math.random()*3000}
   if(a.mostra){const k=(now-a.mostra)/(a.occupato?1600:2200);if(k>=1){a.mostra=0;a.sp.scale.setScalar(0)}
    else{const sc=a.occupato?(k<.15?k/.15:k>.85?(1-k)/.15:1):1-k*.6;const s=.9*(a.occupato?1:.6)*Math.max(0,sc);a.sp.scale.set(s,s,1);
     a.sp.position.set(p.g.position.x+.45,2.75+(a.occupato?Math.sin(now/300)*.04:k*.9),p.g.position.z);a.sp.material.opacity=a.occupato?1:1-k}}}
  else a.sp.scale.setScalar(0);
  // schermo che scorre
  a.d.sm.emissiveIntensity=(notte||oraRoma().h>=19?1.5:.85)+(a.occupato?Math.sin(t*3+a.fase)*.15:-.3);
  const vis=hover===a||sel===a||(a.ping&&now-a.ping<1600);a.et.classList.toggle("on",vis);a.et.classList.toggle("sel",sel===a);
  if(vis)proietta(a.et,v.set(a.p.g.position.x,2.55,a.p.g.position.z),0)});
 // Davide: presente solo dalle 4 alle 7
 const h=oraRoma().h;davide.g.visible=h>=4&&h<7;davide.bS.rotation.x=-1.1+Math.sin(t*12)*.1;
 davEt.classList.toggle("on",hover==="davide");if(hover==="davide")proietta(davEt,v.set(dx,2.6,dz+2.6));
 // Finch
 const [aS,aD]=finch.userData.ali;
 if(volo){volo.t+=dt/volo.durata;const k=Math.min(1,volo.t),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;const p=volo.curva.getPoint(e),q=volo.curva.getPoint(Math.min(1,e+.02));finch.position.copy(p);
  if(q.distanceToSquared(p)>1e-6){finch.lookAt(q.x,finch.position.y,q.z);finch.rotateY(Math.PI)}
  const f=Math.sin(t*28)*.9;aS.rotation.z=f;aD.rotation.z=-f;
  if(k>=1){const cb=volo.poi;volo=null;if(cb)cb();}}
 else{aS.rotation.z=aD.rotation.z=Math.sin(t*2)*.05;finch.position.y+=Math.sin(t*3)*.002;
  if(sosta&&now>sosta){sosta=0;prossimo()}}
 if(salto&&now-salto<900){const k=(now-salto)/900;finch.rotation.y+=dt*14;finch.position.y=(volo?finch.position.y:PERCH.y)+Math.sin(k*Math.PI)*.8}
 proietta(finchEt,v.set(finch.position.x,finch.position.y+1,finch.position.z));
 etRep.forEach(r=>proietta(r.el,r.v));
 anello.scale.setScalar(1+Math.sin(t*4)*.05);
 renderer.render(scene,camera);requestAnimationFrame(loop)}
loop();
setTimeout(giro,1200);
})();
