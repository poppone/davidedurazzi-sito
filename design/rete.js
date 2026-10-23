/* La rete viva dell'apertura (home).
 *
 * Disegna in 3D la squadra vera: il cervello al centro, i reparti intorno,
 * gli agenti di ogni reparto, Finch in orbita, i lavori ancora da costruire
 * tratteggiati. I dati arrivano da content/azienda.json e content/mappa.json,
 * gli stessi della mappa in /azienda. Lungo i fili corrono i pacchetti di
 * lavoro. La rete gira piano, segue il mouse, al tocco si trascina; passando
 * su un punto si legge chi è, con un clic si apre la mappa completa.
 * Intorno gira l'anello dei social (design/social.js): icone vere e
 * cliccabili, collegate al cervello, dove escono i pacchetti pubblicati.
 * Con "riduci movimento" resta ferma. Niente librerie.
 */
(function () {
  "use strict";
  var sez = document.getElementById("plancia");
  var tela = document.getElementById("rete");
  var info = document.getElementById("reteInfo");
  if (!sez || !tela || !tela.getContext) return;
  var ctx = tela.getContext("2d");
  var FERMO = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COLORE = { "attivo": "79,211,154", "in prova": "255,138,76", "fermo": "110,122,158", "da costruire": "163,174,203", "reparto": "123,151,255", "cervello": "255,138,76", "direttore": "238,241,248" };
  var STATO = { "attivo": "Attivo", "in prova": "In prova", "fermo": "Fermo", "da costruire": "Da costruire" };

  var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, unita = 1;
  var nodi = [], fili = [], polvere = [], pacchetti = [];
  var yaw = 0.5, pitch = -0.32, yawMouse = 0, pitchMouse = 0, yawObj = 0, pitchObj = 0;
  var trascina = null, sopra = null, nascondi = 0, inizio = performance.now(), visibile = true, raf = 0;
  var social = [], scarto = { x: 0, y: 0 };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------- l'anello dei social: link veri che girano con la rete ---------- */
  (function () {
    if (!window.DD_SOCIAL) return;
    var voci = window.DD_SOCIAL();
    if (!voci.length) return;
    var anello = document.createElement("nav");
    anello.className = "pl-orbita"; anello.setAttribute("aria-label", "I miei canali");
    voci.forEach(function (v, i) {
      var a = document.createElement("a");
      a.className = "pl-soc pl-soc-" + v[0]; a.href = v[2]; a.target = "_blank"; a.rel = "noopener";
      a.setAttribute("aria-label", v[1]);
      a.innerHTML = window.DD_ICONA(v[0]) + "<span>" + esc(v[1]) + "</span>";
      anello.appendChild(a);
      social.push({ el: a, fase: i / voci.length * Math.PI * 2, x: 0, y: 0, z: 0 });
    });
    sez.appendChild(anello);
  })();

  /* ---------- costruzione della rete ---------- */
  function nodo(o) { o.x = o.x || 0; o.y = o.y || 0; o.z = o.z || 0; nodi.push(o); return o; }

  function costruisci(az, mp) {
    nodi = []; fili = [];
    var cervello = nodo({ tipo: "cervello", nome: (mp.cervello && mp.cervello.nome) || "Il cervello", cosa: mp.cervello && mp.cervello.cosa, r: 9 });
    var reparti = (az.reparti || []).slice();
    var extra = {};
    (mp.da_costruire || []).forEach(function (d) {
      (extra[d.reparto] = extra[d.reparto] || []).push(d);
      if (!reparti.some(function (r) { return r.nome === d.reparto; })) reparti.push({ nome: d.reparto, agenti: [], nuovo: true });
    });
    var n = reparti.length;
    reparti.forEach(function (rep, i) {
      var a = i / n * Math.PI * 2, R = 1.05;
      var px = Math.cos(a) * R, pz = Math.sin(a) * R, py = (i % 2 ? .28 : -.22);
      var agenti = (rep.agenti || []).map(function (x) { return { nome: x.nome, stato: x.stato, cosa: x.ruolo }; })
        .concat((extra[rep.nome] || []).map(function (d) { return { nome: d.nome, stato: "da costruire", cosa: d.cosa }; }));
      var nr = nodo({ tipo: "reparto", nome: rep.nome, cosa: agenti.length + (agenti.length === 1 ? " lavoro" : " lavori"), stato: rep.nuovo ? "da costruire" : "reparto", bx: px, by: py, bz: pz, r: 5.5 });
      fili.push({ a: cervello, b: nr, forte: true });
      // gli agenti fanno un anello attorno al reparto, spinto verso l'esterno
      var ux = -Math.sin(a), uz = Math.cos(a), m = agenti.length;
      agenti.forEach(function (ag, j) {
        var t = j / Math.max(1, m) * Math.PI * 2 + i, rr = .34 + m * .012;
        var na = nodo({
          tipo: "agente", nome: ag.nome, reparto: rep.nome, stato: ag.stato, cosa: ag.cosa, r: ag.stato === "da costruire" ? 3.2 : 3.6,
          bx: px * 1.55 + ux * Math.cos(t) * rr, by: py * 1.4 + Math.sin(t) * rr, bz: pz * 1.55 + uz * Math.cos(t) * rr
        });
        fili.push({ a: nr, b: na, stato: ag.stato });
      });
    });
    var d = mp.direttore || {};
    nodo({ tipo: "direttore", nome: d.nome || "Finch, il Direttore", cosa: d.cosa, stato: "direttore", orbita: true, r: 5 });
    cervello.bx = cervello.by = cervello.bz = 0;
    nodi.forEach(function (o) { o.x = 0; o.y = 0; o.z = 0; });
  }

  function costruisciPolvere() {
    polvere = [];
    for (var i = 0; i < 150; i++) {
      var u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 2.2, s = Math.sqrt(1 - u * u);
      polvere.push({ x: Math.cos(t) * s * r, y: u * r * .7, z: Math.sin(t) * s * r, a: Math.random() < .3 });
    }
  }

  /* ---------- proiezione ---------- */
  function proietta(p, cyaw, syaw, cpit, spit) {
    var x = p.x * cyaw - p.z * syaw, z = p.x * syaw + p.z * cyaw;
    var y = p.y * cpit - z * spit; z = p.y * spit + z * cpit;
    var s = 3.6 / (4.6 - z);
    return { sx: cx + x * s * unita, sy: cy + y * s * unita, s: s, z: z };
  }

  function misura() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = tela.getBoundingClientRect();
    W = r.width; H = r.height;
    tela.width = Math.round(W * dpr); tela.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var largo = W >= 980;
    cx = largo ? W * .72 : W * .5;
    cy = largo ? H * .48 : H * .5;
    unita = Math.min(largo ? W * .17 : W * .25, H * (largo ? .28 : .3));
    var s = sez.getBoundingClientRect();
    scarto.x = r.left - s.left; scarto.y = r.top - s.top;
    // con il player in apertura la rete gli gira intorno: centro sul player, rete piu' grande
    var pl = largo && sez.querySelector(".pl-player");
    if (pl) {
      var q = pl.getBoundingClientRect();
      cx = q.left - r.left + q.width / 2; cy = q.top - r.top + q.height / 2;
      unita *= 1.22;
    }
  }

  /* ---------- disegno ---------- */
  function rgba(c, a) { return "rgba(" + c + "," + a.toFixed(3) + ")"; }
  var ease = function (t) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); };

  function disegna(adesso) {
    var t = (adesso - inizio) / 1000;
    if (!FERMO && !trascina) yaw += .0016;
    yawMouse += (yawObj - yawMouse) * .05; pitchMouse += (pitchObj - pitchMouse) * .05;
    var Y = yaw + yawMouse, P = pitch + pitchMouse;
    var cyaw = Math.cos(Y), syaw = Math.sin(Y), cpit = Math.cos(P), spit = Math.sin(P);

    // apertura: la rete esce dal cervello una volta sola
    var k = FERMO ? 1 : ease((t - .15) / 1.8);
    nodi.forEach(function (o, i) {
      if (o.orbita) {
        var a = FERMO ? 2.2 : t * .22 + 2.2;
        o.x = Math.cos(a) * 1.95 * k; o.z = Math.sin(a) * 1.95 * k; o.y = Math.sin(a * 1.3) * .55 * k;
      } else if (o.tipo !== "cervello") {
        var ki = FERMO ? 1 : ease((t - .1 - (o.tipo === "agente" ? .35 : 0) - i * .012) / 1.6);
        var resp = FERMO ? 0 : Math.sin(t * .9 + i) * .012;
        o.x = o.bx * ki + resp; o.y = o.by * ki + resp; o.z = o.bz * ki;
      }
      o.p = proietta(o, cyaw, syaw, cpit, spit);
    });
    // anello dei social: inclinato rispetto all'orbita di Finch, gira al contrario
    social.forEach(function (so) {
      var a = so.fase - (FERMO ? 0 : t * .16);
      so.x = Math.cos(a) * 1.62 * k; so.z = Math.sin(a) * 1.62 * k; so.y = (Math.sin(a) * .78 - .12) * k;
      so.p = proietta(so, cyaw, syaw, cpit, spit);
      var prof = Math.max(0, Math.min(1, (so.p.z + 1.8) / 3));
      so.el.style.transform = "translate(" + (so.p.sx + scarto.x).toFixed(1) + "px," + (so.p.sy + scarto.y).toFixed(1) + "px) translate(-50%,-50%) scale(" + (.62 + so.p.s * .42).toFixed(3) + ")";
      so.el.style.opacity = (k < .6 ? 0 : .38 + prof * .62).toFixed(3);
      so.el.style.zIndex = so.p.z > -.2 ? 2 : 0;
    });

    ctx.clearRect(0, 0, W, H);

    // polvere di stelle per la profondita'
    polvere.forEach(function (d) {
      var q = proietta(d, cyaw, syaw, cpit, spit);
      var al = Math.max(0, Math.min(.55, (q.z + 3) / 8));
      ctx.fillStyle = rgba(d.a ? "255,138,76" : "150,170,255", al);
      ctx.fillRect(q.sx, q.sy, 1.2 * q.s, 1.2 * q.s);
    });

    // orbita di Finch
    ctx.beginPath();
    for (var g = 0; g <= 64; g++) {
      var aa = g / 64 * Math.PI * 2, qo = proietta({ x: Math.cos(aa) * 1.95 * k, y: Math.sin(aa * 1.3) * .55 * k, z: Math.sin(aa) * 1.95 * k }, cyaw, syaw, cpit, spit);
      if (g) ctx.lineTo(qo.sx, qo.sy); else ctx.moveTo(qo.sx, qo.sy);
    }
    ctx.strokeStyle = "rgba(150,170,255,.10)"; ctx.setLineDash([2, 7]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);

    // anello dei social e i fili che li legano al cervello
    if (social.length) {
      ctx.beginPath();
      for (var gs = 0; gs <= 72; gs++) {
        var as = gs / 72 * Math.PI * 2, qs = proietta({ x: Math.cos(as) * 1.62 * k, y: (Math.sin(as) * .78 - .12) * k, z: Math.sin(as) * 1.62 * k }, cyaw, syaw, cpit, spit);
        if (gs) ctx.lineTo(qs.sx, qs.sy); else ctx.moveTo(qs.sx, qs.sy);
      }
      ctx.strokeStyle = "rgba(255,138,76,.16)"; ctx.lineWidth = 1; ctx.stroke();
      social.forEach(function (so) {
        var c0 = nodi[0].p, al = Math.max(.04, Math.min(.22, (so.p.z + 2) / 9));
        ctx.strokeStyle = "rgba(255,138,76," + al.toFixed(3) + ")"; ctx.setLineDash([1, 5]);
        ctx.beginPath(); ctx.moveTo(c0.sx, c0.sy); ctx.lineTo(so.p.sx, so.p.sy); ctx.stroke(); ctx.setLineDash([]);
      });
    }

    // fili
    fili.forEach(function (f) {
      var a = f.a.p, b = f.b.p, prof = Math.max(.15, Math.min(1, ((a.z + b.z) / 2 + 2) / 3.2));
      var acceso = sopra && (sopra === f.a || sopra === f.b);
      var col = f.forte ? "255,138,76" : f.stato === "fermo" || f.stato === "da costruire" ? "163,174,203" : "123,151,255";
      ctx.strokeStyle = rgba(col, (acceso ? .85 : f.forte ? .4 : .26) * prof);
      ctx.lineWidth = acceso ? 1.6 : f.forte ? 1.3 : 1;
      if (f.stato === "da costruire") ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      ctx.setLineDash([]);
    });

    // pacchetti di lavoro che corrono lungo i fili
    if (!FERMO && k > .95) {
      if (pacchetti.length < 34 && Math.random() < .2) nuovoPacchetto();
      pacchetti = pacchetti.filter(function (pk) {
        pk.t += pk.v;
        if (pk.t >= 1) { pk.i++; pk.t = 0; if (pk.i >= pk.via.length - 1) return false; }
        var a = pk.via[pk.i].p, b = pk.via[pk.i + 1].p;
        var x = a.sx + (b.sx - a.sx) * pk.t, y = a.sy + (b.sy - a.sy) * pk.t;
        var tx = a.sx + (b.sx - a.sx) * Math.max(0, pk.t - .18), ty = a.sy + (b.sy - a.sy) * Math.max(0, pk.t - .18);
        var gr = ctx.createLinearGradient(tx, ty, x, y);
        gr.addColorStop(0, rgba(pk.c, 0)); gr.addColorStop(1, rgba(pk.c, .95));
        ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = rgba(pk.c, 1); ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.283); ctx.fill();
        return true;
      });
    }

    // nodi, dal piu' lontano al piu' vicino
    var ordine = nodi.slice().sort(function (a, b) { return a.p.z - b.p.z; }), nomi = [];
    ctx.font = "600 12px Archivo, system-ui, sans-serif";
    ordine.forEach(function (o) {
      var p = o.p, col = COLORE[o.tipo === "agente" ? o.stato : o.tipo === "reparto" && o.stato === "da costruire" ? "da costruire" : o.tipo] || COLORE.attivo;
      var prof = Math.max(.25, Math.min(1, (p.z + 2.2) / 3.2));
      var r = o.r * p.s * (sopra === o ? 1.5 : 1);
      if (o.tipo === "cervello") {
        var pulsa = FERMO ? 1 : 1 + Math.sin(t * 2) * .08;
        var gl = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 7 * pulsa);
        gl.addColorStop(0, "rgba(255,170,120,.55)"); gl.addColorStop(.35, "rgba(255,138,76,.18)"); gl.addColorStop(1, "rgba(255,138,76,0)");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 7 * pulsa, 0, 6.283); ctx.fill();
        ctx.strokeStyle = "rgba(255,170,120,.5)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 2.4, FERMO ? 0 : t, (FERMO ? 0 : t) + 4.4); ctx.stroke();
      } else if (o.stato !== "da costruire") {
        var alone = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 4);
        alone.addColorStop(0, rgba(col, .45 * prof)); alone.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = alone; ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 4, 0, 6.283); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(1.5, r), 0, 6.283);
      if (o.stato === "da costruire") {
        ctx.fillStyle = "rgba(4,6,13,.9)"; ctx.fill(); ctx.setLineDash([2, 2]);
        ctx.strokeStyle = rgba(col, .8 * prof); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.fillStyle = rgba(o.tipo === "cervello" ? "255,214,190" : col, prof); ctx.fill();
      }
      if (o.tipo === "direttore") { ctx.strokeStyle = "rgba(123,151,255,.9)"; ctx.lineWidth = 2; ctx.stroke(); }
      // nomi di reparti, Finch e agenti quando guardano verso di noi
      if (k > .9 && sopra !== o) {
        if ((o.tipo === "reparto" || o.tipo === "direttore") && p.z > -.5) {
          nomi.push([o.tipo === "direttore" ? "Finch" : o.nome, p.sx, p.sy, r, Math.min(1, (p.z + .5) * 1.4) * .95, "700 12px", "238,241,248", p.z + 9]);
        } else if (o.tipo === "agente" && p.z > -.1) {
          nomi.push([o.nome, p.sx, p.sy, r, Math.min(1, (p.z + .1) * 1.6) * .85, "500 10.5px", o.stato === "da costruire" ? "163,174,203" : "205,214,240", p.z]);
        }
      }
    });
    // prima i nomi piu' vicini (reparti e Finch davanti a tutti); chi si sovrappone resta nascosto
    if (sopra && sopra.p && k > .9) nomi.push([sopra.nome, sopra.p.sx, sopra.p.sy, sopra.r * sopra.p.s * 1.5, 1, "700 12px", "255,255,255", 99]);
    var posti = [];
    nomi.sort(function (a, b) { return b[7] - a[7]; }).forEach(function (n) { etichetta(n[0], n[1], n[2], n[3], n[4], n[5], n[6], posti); });

    aggiornaInfo();
  }

  // Nome accanto al punto, su una pastiglia scura per leggerlo sopra i fili;
  // se esce dal bordo destro va a sinistra del punto.
  function etichetta(testo, x, y, r, al, font, col, posti) {
    if (al <= .05) return;
    ctx.font = font + " Archivo, system-ui, sans-serif";
    var w = ctx.measureText(testo).width, h = parseFloat(font.split(" ")[1]) + 6;
    var lx = x + r + 7;
    if (lx + w + 4 > W - 4) lx = x - r - 7 - w;
    lx = Math.max(4, lx);
    var box = { x: lx - 4, y: y - h / 2, w: w + 8, h: h };
    if (posti.some(function (b) { return box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h; })) return;
    posti.push(box);
    ctx.fillStyle = "rgba(4,6,13," + (.62 * al).toFixed(3) + ")";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx - 4, y - h / 2, w + 8, h, 4); else ctx.rect(lx - 4, y - h / 2, w + 8, h);
    ctx.fill();
    ctx.fillStyle = rgba(col, al);
    ctx.fillText(testo, lx, y + h / 2 - 5);
  }

  function nuovoPacchetto() {
    var agenti = nodi.filter(function (o) { return o.tipo === "agente" && (o.stato === "attivo" || o.stato === "in prova"); });
    if (!agenti.length) return;
    var ag = agenti[Math.floor(Math.random() * agenti.length)];
    var rep = nodi.filter(function (o) { return o.tipo === "reparto" && o.nome === ag.reparto; })[0];
    var cer = nodi[0];
    var andata = Math.random() < .55;
    pacchetti.push({ via: andata ? [cer, rep, ag] : [ag, rep, cer], i: 0, t: 0, v: .014 + Math.random() * .014, c: andata ? "170,190,255" : "255,170,120" });
    // ogni tanto un lavoro finito esce dal cervello verso un canale social
    if (social.length && Math.random() < .3) pacchetti.push({ via: [cer, social[Math.floor(Math.random() * social.length)]], i: 0, t: 0, v: .012 + Math.random() * .01, c: "255,138,76" });
  }

  /* ---------- scheda al passaggio ---------- */
  function vicino(px, py, raggio) {
    var meglio = null, d0 = raggio;
    nodi.forEach(function (o) {
      if (!o.p) return;
      var d = Math.hypot(o.p.sx - px, o.p.sy - py) - o.r * o.p.s;
      if (d < d0 && o.p.z > -1.6) { d0 = d; meglio = o; }
    });
    return meglio;
  }
  var ultimo = null;
  function aggiornaInfo() {
    if (!info) return;
    if (!sopra || !sopra.p) { info.classList.remove("on"); ultimo = null; return; }
    if (ultimo !== sopra) {
      ultimo = sopra;
      var tipo = sopra.tipo === "agente" ? "Agente, " + sopra.reparto : sopra.tipo === "reparto" ? "Reparto" : sopra.tipo === "direttore" ? "Il Direttore" : "Al centro della rete";
      var st = STATO[sopra.stato];
      info.innerHTML = "<strong>" + esc(sopra.nome) + "</strong><em>" + esc(tipo) + "</em>" + (sopra.cosa ? "<p>" + esc(sopra.cosa) + "</p>" : "") +
        (st ? '<span class="st" style="color:rgb(' + COLORE[sopra.stato] + ')">' + st + "</span>" : "");
    }
    var r = tela.getBoundingClientRect(), s = sez.getBoundingClientRect();
    var x = sopra.p.sx + (r.left - s.left) + 18, y = sopra.p.sy + (r.top - s.top) - 12;
    var lw = info.offsetWidth, lh = info.offsetHeight;
    if (x + lw > s.width - 12) x = sopra.p.sx + (r.left - s.left) - lw - 18;
    y = Math.max(8, Math.min(s.height - lh - 8, y));
    info.style.left = x + "px"; info.style.top = y + "px";
    info.classList.add("on");
  }

  /* ---------- interazione ---------- */
  function locale(e) { var r = tela.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; }
  sez.addEventListener("pointermove", function (e) {
    var p = locale(e);
    if (trascina) {
      yaw = trascina.yaw + (p.x - trascina.x) * .008;
      return;
    }
    if (e.pointerType === "mouse") {
      yawObj = (p.x / p.w - .5) * .7; pitchObj = (p.y / p.h - .5) * .35;
      var era = sopra;
      sopra = e.target.closest("a,button") ? null : vicino(p.x, p.y, 16);
      sez.style.cursor = sopra ? "pointer" : "";
      if (FERMO && era !== sopra) requestAnimationFrame(disegna);
    }
  });
  sez.addEventListener("pointerleave", function () { yawObj = pitchObj = 0; sopra = null; sez.style.cursor = ""; if (FERMO) requestAnimationFrame(disegna); });
  sez.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" || e.target.closest("a,button")) return;
    var p = locale(e);
    trascina = { x: p.x, y: p.y, yaw: yaw, mosso: false };
  });
  addEventListener("pointerup", function (e) {
    if (!trascina) return;
    var p = locale(e), fermo = Math.abs(p.x - trascina.x) < 8 && Math.abs(p.y - trascina.y) < 8;
    trascina = null;
    if (fermo) {
      sopra = vicino(p.x, p.y, 26);
      clearTimeout(nascondi); nascondi = setTimeout(function () { sopra = null; if (FERMO) requestAnimationFrame(disegna); }, 3500);
      if (FERMO) requestAnimationFrame(disegna);
    }
  });
  sez.addEventListener("click", function (e) {
    if (e.target.closest("a,button") || !sopra || matchMedia("(hover:none)").matches) return;
    location.href = "/azienda#mappa";
  });

  /* ---------- ciclo ---------- */
  function ciclo(adesso) {
    disegna(adesso);
    if (visibile && !FERMO) raf = requestAnimationFrame(ciclo);
  }
  function riparti() { cancelAnimationFrame(raf); if (FERMO) requestAnimationFrame(disegna); else raf = requestAnimationFrame(ciclo); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visibile = en[0].isIntersecting && !document.hidden; if (visibile) riparti(); }).observe(sez);
  }
  document.addEventListener("visibilitychange", function () { visibile = !document.hidden; if (visibile) riparti(); });
  var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { misura(); if (FERMO) requestAnimationFrame(disegna); }, 150); });

  /* ---------- letture della plancia ---------- */
  function conta(el, fine) {
    if (!el) return;
    if (FERMO) { el.textContent = fine; return; }
    var t0 = null;
    (function passo(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / 1400);
      el.textContent = Math.round(fine * ease(p));
      if (p < 1) requestAnimationFrame(passo);
    })(performance.now());
  }

  var leggi = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }); };
  misura(); costruisciPolvere();
  costruisci({}, {});
  riparti();
  Promise.all([leggi("/content/azienda.json"), leggi("/content/mappa.json").catch(function () { return {}; })]).then(function (d) {
    costruisci(d[0], d[1]);
    inizio = performance.now();
    var tutti = [], attivi = 0;
    (d[0].reparti || []).forEach(function (r) { (r.agenti || []).forEach(function (a) { tutti.push(a); if (a.stato === "attivo") attivi++; }); });
    conta(document.getElementById("hudAgenti"), tutti.length);
    conta(document.getElementById("hudAttivi"), attivi);
    riparti();
  }).catch(function () { /* resta la costellazione con il solo cervello */ });
  leggi("/content/articoli.json").then(function (a) {
    conta(document.getElementById("hudArticoli"), a.filter(function (x) { return x.pubblicato === true; }).length);
  }).catch(function () {});
})();
