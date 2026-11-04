/* Musichetta di sottofondo dell'ufficio: generata al volo con Web Audio, nessun file e nessun diritto d'autore.
   Giro allegro in Do maggiore (Do, Sol, La minore, Fa), basso, accordi in levare, arpeggio e una batteria leggera. */
(function(){
"use strict";
const BPM=118,BEAT=60/BPM,OTTAVO=BEAT/2;
let ctx=null,master=null,prossima=0,passo=0,timer=null,on=false;
const ACCORDI=[[0,4,7],[7,11,14],[9,12,16],[5,9,12]];           // Do, Sol, Lam, Fa (gradi rispetto a Do)
const PENTA=[0,2,4,7,9,12,14,16];                                 // pentatonica di Do per la melodia
const hz=n=>261.63*Math.pow(2,n/12);
function nota(t,f,dur,tipo,vol,filtro){const o=ctx.createOscillator(),g=ctx.createGain();o.type=tipo;o.frequency.value=f;
 let dest=g;if(filtro){const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=filtro;o.connect(lp);lp.connect(g)}else o.connect(g);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);g.connect(master);o.start(t);o.stop(t+dur+.02)}
let rumore=null;
function rumoreBuf(){if(rumore)return rumore;const b=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;rumore=b;return b}
function colpo(t,tipo){if(tipo==="cassa"){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+.11);g.gain.setValueAtTime(.55,t);g.gain.exponentialRampToValueAtTime(.0001,t+.2);o.connect(g);g.connect(master);o.start(t);o.stop(t+.22);return}
 const s=ctx.createBufferSource();s.buffer=rumoreBuf();const f=ctx.createBiquadFilter(),g=ctx.createGain();
 if(tipo==="hat"){f.type="highpass";f.frequency.value=7000;g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.0001,t+.05)}
 else{f.type="bandpass";f.frequency.value=1800;f.Q.value=.7;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.0001,t+.14)}
 s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.2)}
let melodia=[],ultimaNota=4;
function programma(t,i){ // i = indice dell'ottavo nel giro (32 ottavi = 4 battute)
 const batt=(i>>3)%4,ott=i&7,acc=ACCORDI[batt];
 // batteria
 if(ott===0||ott===4)colpo(t,"cassa");if(ott===4||(ott===7&&batt===3))colpo(t,"rull");if(ott%2)colpo(t,"hat");else if(ott===2||ott===6)colpo(t,"hat");
 // basso: tonica sul battere, quinta e ottava a saltellare
 const b=[acc[0]-24,null,acc[2]-24,acc[0]-12,acc[0]-24,null,acc[2]-24,acc[0]-24][ott];if(b!=null)nota(t,hz(b),OTTAVO*.9,"triangle",.5,900);
 // accordi in levare (come una chitarrina)
 if(ott%2)acc.forEach((n,k)=>nota(t+k*.008,hz(n),OTTAVO*.55,"square",.07,2200));
 // melodia: una frase nuova ogni giro, per gradi vicini sulla pentatonica
 if(i%32===0){melodia=[];for(let k=0;k<32;k++){if(k%2===0||Math.random()<.35){ultimaNota=Math.max(0,Math.min(PENTA.length-1,ultimaNota+[-2,-1,-1,0,1,1,2][(Math.random()*7)|0]));melodia.push(PENTA[ultimaNota]+12)}else melodia.push(null)}melodia[0]=acc[0]+12}
 const m=melodia[i%32];if(m!=null){nota(t,hz(m),OTTAVO*1.1,"triangle",.22,3200);nota(t,hz(m)*2,OTTAVO*.6,"sine",.05)}}
function ciclo(){while(prossima<ctx.currentTime+.18){programma(prossima,passo);passo++;prossima+=OTTAVO}}
function avvia(){if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;ctx=new AC();master=ctx.createGain();master.gain.value=0;const comp=ctx.createDynamicsCompressor();master.connect(comp);comp.connect(ctx.destination)}
 ctx.resume();prossima=ctx.currentTime+.05;passo=0;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setValueAtTime(master.gain.value,ctx.currentTime);master.gain.linearRampToValueAtTime(.32,ctx.currentTime+1.2);
 clearInterval(timer);timer=setInterval(ciclo,60);ciclo();on=true;return true}
function ferma(){if(!ctx)return;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setValueAtTime(master.gain.value,ctx.currentTime);master.gain.linearRampToValueAtTime(0,ctx.currentTime+.6);clearInterval(timer);timer=null;on=false;setTimeout(()=>{if(!on&&ctx)ctx.suspend()},700)}
window.ufMusica={get attiva(){return on},accendi:avvia,spegni:ferma,toggle(){return on?(ferma(),false):avvia()}};
})();
