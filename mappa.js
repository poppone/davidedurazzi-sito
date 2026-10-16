/* La mappa viva dell'azienda (/azienda).
 *
 * Legge content/azienda.json (reparti, agenti, stati: li aggiorna Davide) e
 * content/mappa.json (schede, cervello, Direttore, lavori da costruire, voti
 * medi del Direttore). Disegna in SVG: il cervello al centro, i reparti
 * intorno, gli agenti a ventaglio, Finch in orbita. Un clic su un reparto
 * zooma, un clic su un nodo apre la sua scheda. Niente librerie.
 */
(function () {
  "use strict";
  var box = document.getElementById("mpMappa");
  var scheda = document.getElementById("mpScheda");
  if (!box || !scheda) return;

  var NS = "http://www.w3.org/2000/svg";
  var LATO = 1000, C = 500;
  var R_REPARTO = 215, R_AGENTE = 395;
  var FERMO = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STATI = { "attivo": "Attivo", "in prova": "In prova", "fermo": "Fermo", "da costruire": "Da costruire", "in costruzione": "In costruzione" };
  var AUTONOMIA = [
    ["guidato", "Guidato", "Lo faccio io, l'agente mi aiuta"],
    ["assistito", "Assistito", "L'agente prepara, io approvo"],
    ["autonomo", "Autonomo", "Fa da solo, il Direttore controlla dopo"]
  ];

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var el = function (nome, attr, padre) {
    var n = document.createElementNS(NS, nome);
    for (var k in attr) n.setAttribute(k, attr[k]);
    if (padre) padre.appendChild(n);
    return n;
  };
  var polare = function (r, gradi) {
    var a = gradi * Math.PI / 180;
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  };
  var classeStato = function (s) { return "mp-" + String(s || "").replace(/\s+/g, "-"); };
  var pill = function (s) {
    return '<span class="az-stato az-' + esc(String(s).replace(/\s+/g, "-")) + '">' + esc(STATI[s] || s) + "</span>";
  };

  /* ---------- dati ---------- */

  function unisci(az, mp) {
    var schede = mp.schede || {};
    var reparti = (az.reparti || []).map(function (r) {
      return {
        nome: r.nome,
        agenti: (r.agenti || []).map(function (a) {
          var s = schede[a.nome] || {};
          return {
            tipo: "agente", nome: a.nome, reparto: r.nome, stato: a.stato, cosa: a.ruolo,
            turno: a.turno, sostituisce: s.sostituisce, autonomia: s.autonomia,
            catena: s.catena || 99, nota: s.nota, voto: s.voto && mp.voti ? mp.voti[s.voto] : null
          };
        })
      };
    });
    (mp.da_costruire || []).forEach(function (d) {
      var rep = reparti.filter(function (r) { return r.nome === d.reparto; })[0];
      if (!rep) { rep = { nome: d.reparto, agenti: [] }; reparti.push(rep); }
      rep.agenti.push({
        tipo: "agente", nome: d.nome, reparto: d.reparto, stato: "da costruire", cosa: d.cosa,
        sostituisce: d.sostituisce, ordine: d.ordine, catena: 100 + (d.ordine || 0)
      });
    });
    reparti.forEach(function (r) { r.agenti.sort(function (a, b) { return a.catena - b.catena; }); });
    return reparti;
  }

  /* ---------- disegno ---------- */

  var svg, nodi = [], repartoAttivo = null, vista = [0, 0, LATO, LATO], animazione = null;

  function disegna(reparti, mp) {
    box.innerHTML = "";
    svg = el("svg", { viewBox: "0 0 " + LATO + " " + LATO, role: "group", "aria-label": "Mappa dell'azienda: il cervello al centro, i reparti intorno, gli agenti di ogni reparto" }, box);
    var defs = el("defs", {}, svg);
    var g1 = el("radialGradient", { id: "mpNucleo" }, defs);
    el("stop", { offset: "0%", "stop-color": "#FFD2B5", "stop-opacity": "1" }, g1);
    el("stop", { offset: "35%", "stop-color": "#FF8A4C", "stop-opacity": ".85" }, g1);
    el("stop", { offset: "100%", "stop-color": "#FF8A4C", "stop-opacity": "0" }, g1);
    var g2 = el("radialGradient", { id: "mpAlone" }, defs);
    el("stop", { offset: "0%", "stop-color": "#7B97FF", "stop-opacity": ".22" }, g2);
    el("stop", { offset: "100%", "stop-color": "#7B97FF", "stop-opacity": "0" }, g2);

    var linee = el("g", { "class": "mp-linee" }, svg);
    var livelloNodi = el("g", {}, svg);

    // l'orbita del Direttore
    el("circle", { cx: C, cy: C, r: 472, "class": "mp-orbita" }, linee);

    // il cervello
    var cervello = el("g", { "class": "mp-nodo mp-cervello", tabindex: "0", role: "button", "aria-label": "Il cervello: apri la scheda" }, livelloNodi);
    el("circle", { cx: C, cy: C, r: 120, fill: "url(#mpNucleo)", "class": "mp-respiro" }, cervello);
    el("circle", { cx: C, cy: C, r: 74, "class": "mp-anello" }, cervello);
    el("circle", { cx: C, cy: C, r: 92, "class": "mp-anello mp-gira" }, cervello);
    var tc = el("text", { x: C, y: C + 5, "class": "mp-etichetta-cervello" }, cervello);
    tc.textContent = "IL CERVELLO";
    (mp.cervello && mp.cervello.fonti || []).forEach(function (f, i, tutte) {
      var p = polare(58, -90 + i * 360 / tutte.length);
      el("circle", { cx: p.x, cy: p.y, r: 6, "class": "mp-fonte mp-fonte-" + f.stato }, cervello);
    });
    collega(cervello, { tipo: "cervello", dati: mp.cervello }, null);

    // i reparti
    var passo = 360 / reparti.length;
    reparti.forEach(function (rep, i) {
      var angolo = -90 + passo / 2 + i * passo;
      rep.angolo = angolo;
      var h = polare(R_REPARTO, angolo);
      rep.x = h.x; rep.y = h.y;
      var vivi = rep.agenti.filter(function (a) { return a.stato === "attivo"; }).length;
      el("line", { x1: C, y1: C, x2: h.x, y2: h.y, "class": "mp-asse" + (vivi ? " mp-flusso" : "") }, linee);

      var ampiezza = Math.min(passo * 0.92, Math.max(18, rep.agenti.length * 10));
      rep.agenti.forEach(function (a, j) {
        var n = rep.agenti.length;
        var t = n === 1 ? 0 : j / (n - 1) - 0.5;
        // Dove il ventaglio scende o sale quasi in verticale i punti finiscono
        // fianco a fianco e i nomi si accavallano: li si sfalsa in profondita'.
        var ga = angolo + t * ampiezza;
        var verticale = Math.abs(Math.cos(ga * Math.PI / 180)) < 0.6;
        var p = polare(R_AGENTE + (verticale && j % 2 ? 62 : 0), ga);
        a.x = p.x; a.y = p.y;
        el("line", { x1: h.x, y1: h.y, x2: p.x, y2: p.y, "class": "mp-ramo " + classeStato(a.stato) + (a.stato === "attivo" ? " mp-flusso" : ""), "data-reparto": rep.nome }, linee);
        var g = el("g", { "class": "mp-nodo mp-agente " + classeStato(a.stato), tabindex: "0", role: "button", "data-reparto": rep.nome, "aria-label": a.nome + ", " + (STATI[a.stato] || a.stato) + ": apri la scheda" }, livelloNodi);
        el("circle", { cx: p.x, cy: p.y, r: 22, "class": "mp-presa" }, g);
        el("circle", { cx: p.x, cy: p.y, r: a.stato === "da costruire" ? 9 : 10, "class": "mp-punto" }, g);
        var fuori = Math.cos(angolo * Math.PI / 180) >= 0;
        var tx = el("text", { x: p.x + (fuori ? 16 : -16), y: p.y + 4, "class": "mp-etichetta-agente", "text-anchor": fuori ? "start" : "end" }, g);
        tx.textContent = a.nome;
        collega(g, { tipo: "agente", dati: a, reparto: rep }, rep);
      });

      var gr = el("g", { "class": "mp-nodo mp-reparto", tabindex: "0", role: "button", "data-reparto": rep.nome, "aria-label": "Reparto " + rep.nome + ", " + rep.agenti.length + " lavori: avvicina" }, livelloNodi);
      el("circle", { cx: h.x, cy: h.y, r: 46, fill: "url(#mpAlone)" }, gr);
      el("circle", { cx: h.x, cy: h.y, r: 15, "class": "mp-punto" }, gr);
      // L'etichetta sta dal lato del cervello, dove non ci sono agenti:
      // sopra il nodo per i reparti a destra e a sinistra, sotto per quelli
      // in alto, sopra per quelli in basso; un po' spostata verso l'esterno
      // cosi' due reparti vicini non si toccano.
      var cos = Math.cos(angolo * Math.PI / 180), sin = Math.sin(angolo * Math.PI / 180);
      var verso = cos > 0 ? 1 : -1;
      var orizzontale = Math.abs(cos) > 0.9;
      var tr = el("text", {
        x: h.x + (orizzontale ? 0 : verso * 48), y: h.y + (orizzontale ? -30 : 46),
        "class": "mp-etichetta-reparto", "text-anchor": "middle"
      }, gr);
      // i nomi lunghi vanno su due righe, cosi' non escono dal bordo
      var parole = rep.nome.toUpperCase().split(" ");
      var righe = rep.nome.length > 12 && parole.length > 1
        ? [parole.slice(0, Math.ceil(parole.length / 2)).join(" "), parole.slice(Math.ceil(parole.length / 2)).join(" ")]
        : [rep.nome.toUpperCase()];
      righe.push(rep.agenti.length + (rep.agenti.length === 1 ? " lavoro" : " lavori"));
      rep.righe = righe;
      righe.forEach(function (riga, k) {
        var ts = el("tspan", { x: tr.getAttribute("x") }, tr);
        if (k) ts.setAttribute("dy", "1.15em");
        else if (orizzontale) ts.setAttribute("dy", (-1.15 * (righe.length - 1)) + "em");
        if (k === righe.length - 1) ts.setAttribute("class", "mp-conto");
        ts.textContent = riga;
      });
      collega(gr, { tipo: "reparto", dati: rep }, rep);
    });

    // il Direttore, in orbita sopra tutto
    var d = polare(472, -90);
    var gd = el("g", { "class": "mp-nodo mp-direttore", tabindex: "0", role: "button", "aria-label": "Finch, il Direttore: apri la scheda" }, livelloNodi);
    el("circle", { cx: d.x, cy: d.y, r: 26, "class": "mp-presa" }, gd);
    el("circle", { cx: d.x, cy: d.y, r: 13, "class": "mp-punto" }, gd);
    var td = el("text", { x: d.x + 24, y: d.y + 6, "class": "mp-etichetta-direttore" }, gd);
    td.textContent = "FINCH · DIRETTORE";
    collega(gd, { tipo: "direttore", dati: mp.direttore }, null);
  }

  function collega(nodo, cosa, rep) {
    nodo._cosa = cosa;
    nodi.push(nodo);
    var apri = function () {
      if (cosa.tipo === "reparto") {
        avvicina(repartoAttivo === rep ? null : rep);
        mostraReparto(rep);
      } else {
        if (cosa.tipo === "agente" && repartoAttivo !== rep) avvicina(rep);
        if (cosa.tipo !== "agente" && repartoAttivo) avvicina(null);
        mostra(cosa);
      }
      nodi.forEach(function (n) { n.classList.toggle("mp-scelto", n === nodo); });
    };
    nodo.addEventListener("click", apri);
    nodo.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apri(); }
    });
  }

  /* ---------- zoom ---------- */

  function avvicina(rep) {
    repartoAttivo = rep;
    box.classList.toggle("mp-zoom", !!rep);
    nodi.forEach(function (n) {
      var r = n.getAttribute("data-reparto");
      // da vicino il Direttore si spegne: sta in alto e coprirebbe gli agenti
      n.classList.toggle("mp-spento", !!rep && (r !== null ? r !== rep.nome : n.classList.contains("mp-direttore")));
    });
    svg.querySelectorAll(".mp-ramo").forEach(function (l) {
      l.classList.toggle("mp-spento", !!rep && l.getAttribute("data-reparto") !== rep.nome);
    });
    var meta;
    if (!rep) meta = [0, 0, LATO, LATO];
    else {
      // Nell'inquadratura devono entrare anche i nomi degli agenti, che
      // stanno a lato dei punti e restano della stessa misura a schermo:
      // la loro larghezza dipende dallo zoom, quindi si stima in tre giri.
      var testo = parseFloat(getComputedStyle(svg).getPropertyValue("--mp-testo")) || 1;
      var lato = 600, cx = rep.x, cy = rep.y;
      for (var giro = 0; giro < 3; giro++) {
        var scala = lato / LATO;
        // l'etichetta del reparto (vedi disegna): dove sta e quanto e' larga
        var fonte = 26 * scala * (1 + (testo - 1) * 0.35);
        var lungo = Math.max.apply(null, rep.righe.map(function (r) { return r.length; }));
        var ex = rep.x + (Math.abs(Math.cos(rep.angolo * Math.PI / 180)) > 0.9 ? 0 : (Math.cos(rep.angolo * Math.PI / 180) > 0 ? 48 : -48));
        var mezza = lungo * 0.72 * fonte / 2;
        var alta = rep.righe.length * 1.15 * fonte;
        var sopra = Math.abs(Math.cos(rep.angolo * Math.PI / 180)) > 0.9;
        var x0 = Math.min(rep.x - 40 * scala, ex - mezza), x1 = Math.max(rep.x + 40 * scala, ex + mezza);
        var y0 = rep.y - (sopra ? 30 * scala + alta : 40 * scala), y1 = rep.y + (sopra ? 40 * scala : 46 + alta);
        rep.agenti.forEach(function (a) {
          var largo = 16 * scala * testo + a.nome.length * 0.56 * 19 * scala * testo;
          var destra = Math.cos(rep.angolo * Math.PI / 180) >= 0;   // come in disegna()
          x0 = Math.min(x0, a.x - (destra ? 20 : largo));
          x1 = Math.max(x1, a.x + (destra ? largo : 20));
          y0 = Math.min(y0, a.y - 30 * scala * testo);
          y1 = Math.max(y1, a.y + 30 * scala * testo);
        });
        var margine = 40 * scala;
        lato = Math.min(LATO, Math.max(420, Math.max(x1 - x0, y1 - y0) + 2 * margine));
        cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
      }
      meta = [cx - lato / 2, cy - lato / 2, lato, lato];
    }
    document.getElementById("mpTutta").hidden = !rep;
    document.querySelectorAll(".mp-chip").forEach(function (b) {
      b.classList.toggle("mp-chip-on", !!rep && b.textContent.indexOf(rep.nome) === 0);
    });
    vai(meta);
  }

  function vai(meta) {
    if (animazione) cancelAnimationFrame(animazione);
    var da = vista.slice(), t0 = null, durata = FERMO ? 1 : 650;
    var passo = function (t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / durata);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      vista = da.map(function (v, i) { return v + (meta[i] - v) * e; });
      svg.setAttribute("viewBox", vista.join(" "));
      // le scritte restano della stessa misura a schermo
      svg.style.setProperty("--mp-scala", (vista[2] / LATO).toFixed(3));
      if (k < 1) animazione = requestAnimationFrame(passo);
    };
    animazione = requestAnimationFrame(passo);
  }

  /* ---------- schede ---------- */

  function blocco(titolo, html) {
    return '<div class="mp-blocco"><h4>' + esc(titolo) + "</h4>" + html + "</div>";
  }

  function scalaAutonomia(livello) {
    return '<ol class="mp-scala">' + AUTONOMIA.map(function (a, i) {
      return '<li class="' + (a[0] === livello ? "mp-qui" : "") + '"><span>' + (i + 1) + "</span><div><strong>" + esc(a[1]) + "</strong><small>" + esc(a[2]) + "</small></div></li>";
    }).join("") + "</ol>";
  }

  function mostra(cosa) {
    var d = cosa.dati || {}, html = "";
    if (cosa.tipo === "cervello") {
      html = '<p class="mp-tipo">Al centro della mappa</p><h3>' + esc(d.nome) + "</h3>" + pill(d.stato) +
        "<p>" + esc(d.cosa) + "</p>" +
        blocco("Da dove legge", '<ul class="mp-fonti">' + (d.fonti || []).map(function (f) {
          return '<li><span class="mp-pallino mp-fonte-' + esc(f.stato) + '"></span><div><strong>' + esc(f.nome) + "</strong><small>" + esc(f.dove) + "</small></div><em>" + (f.stato === "pronto" ? "pronto" : "da riunire") + "</em></li>";
        }).join("") + "</ul>");
    } else if (cosa.tipo === "direttore") {
      html = '<p class="mp-tipo">Sopra tutti i reparti</p><h3>' + esc(d.nome) + "</h3>" + pill("attivo") +
        "<p>" + esc(d.cosa) + "</p>" +
        blocco("Cosa sostituisce", "<p>" + esc(d.sostituisce) + "</p>") +
        blocco("Autonomia", scalaAutonomia(d.autonomia)) +
        blocco("I revisori che votano per lui", "<p>" + esc((d.revisori || []).join(" · ")) + "</p>");
    } else {
      var rep = cosa.reparto;
      html = '<p class="mp-tipo">Reparto ' + esc(d.reparto) + "</p><h3>" + esc(d.nome) + "</h3>" + pill(d.stato) +
        "<p>" + esc(d.cosa) + "</p>";
      if (d.sostituisce) html += blocco("Cosa sostituisce", "<p>" + esc(d.sostituisce) + "</p>");
      if (d.stato === "da costruire") {
        html += blocco("Quando", "<p>Priorità " + esc(d.ordine) + " tra i lavori ancora da costruire.</p>");
      } else {
        if (d.autonomia) html += blocco("Autonomia", scalaAutonomia(d.autonomia));
        html += blocco("Voto del Direttore", d.voto
          ? '<div class="mp-voto"><strong>' + String(d.voto.media).replace(".", ",") + '</strong><span>su 5 · ' + d.voto.controlli + (d.voto.controlli === 1 ? " controllo" : " controlli") + '</span></div><div class="mp-barra"><i style="width:' + (d.voto.media / 5 * 100) + '%"></i></div>'
          : '<p class="meta">Non ancora votato: i controlli sono partiti il 13 ottobre.</p>');
      }
      if (rep) html += blocco("In che ordine lavora il reparto", '<ol class="mp-catena">' + rep.agenti.map(function (a) {
        return '<li class="' + (a === d ? "mp-qui " : "") + classeStato(a.stato) + '">' + esc(a.nome) + "</li>";
      }).join("") + "</ol>");
      if (d.turno) html += '<p class="meta">Turno: ' + esc(d.turno) + "</p>";
      if (d.nota) html += '<p class="meta">' + esc(d.nota) + "</p>";
    }
    scheda.innerHTML = html;
    if (window.innerWidth < 900) scheda.scrollIntoView({ behavior: FERMO ? "auto" : "smooth", block: "nearest" });
  }

  function mostraReparto(rep) {
    var c = conta(rep.agenti);
    scheda.innerHTML = '<p class="mp-tipo">Reparto</p><h3>' + esc(rep.nome) + "</h3>" +
      "<p>" + rep.agenti.length + " lavori: " + c + ".</p>" +
      blocco("In che ordine lavora", '<ol class="mp-catena">' + rep.agenti.map(function (a) {
        return '<li class="' + classeStato(a.stato) + '">' + esc(a.nome) + "</li>";
      }).join("") + "</ol>") +
      '<p class="meta">Tocca un punto per aprire la scheda del suo lavoro.</p>';
  }

  function conta(agenti) {
    var n = {};
    agenti.forEach(function (a) { n[a.stato] = (n[a.stato] || 0) + 1; });
    return ["attivo", "in prova", "fermo", "da costruire"].filter(function (s) { return n[s]; }).map(function (s) {
      return n[s] + " " + (STATI[s] || s).toLowerCase();
    }).join(", ");
  }

  /* ---------- avvio ---------- */

  Promise.all([
    fetch("/content/azienda.json").then(function (r) { return r.json(); }),
    fetch("/content/mappa.json").then(function (r) { return r.json(); })
  ]).then(function (j) {
    var reparti = unisci(j[0], j[1]);
    disegna(reparti, j[1]);
    var tutti = [];
    reparti.forEach(function (r) { tutti = tutti.concat(r.agenti); });
    var lavorano = tutti.filter(function (a) { return a.stato !== "da costruire"; }).length;
    var mancano = tutti.length - lavorano;
    document.getElementById("mpConta").innerHTML = "<strong>" + lavorano + "</strong> agenti · <strong>" + reparti.length +
      "</strong> reparti · <strong>" + mancano + "</strong> lavori ancora da costruire · <strong>1</strong> umano";
    var chip = document.getElementById("mpReparti");
    if (chip) {
      chip.innerHTML = reparti.map(function (r, i) {
        return '<button type="button" class="mp-chip" data-i="' + i + '">' + esc(r.nome) + " <span>" + r.agenti.length + "</span></button>";
      }).join("");
      chip.addEventListener("click", function (e) {
        var b = e.target.closest(".mp-chip");
        if (!b) return;
        var rep = reparti[+b.getAttribute("data-i")];
        avvicina(rep);
        mostraReparto(rep);
        nodi.forEach(function (n) { n.classList.toggle("mp-scelto", n._cosa.tipo === "reparto" && n._cosa.dati === rep); });
      });
    }
    mostra({ tipo: "cervello", dati: j[1].cervello });
    document.getElementById("mpTutta").addEventListener("click", function () {
      avvicina(null);
      nodi.forEach(function (n) { n.classList.remove("mp-scelto"); });
      mostra({ tipo: "cervello", dati: j[1].cervello });
    });
  }).catch(function () {
    box.innerHTML = '<p class="meta">La mappa non si è caricata. Ricarica la pagina.</p>';
  });
})();
