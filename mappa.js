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

  /* ---------- social: icone cliccabili sopra la mappa ---------- */
  // Tracciati delle icone da Simple Icons (CC0), viewBox 24x24
  var ICONE = {
      "twitch": "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z",
      "youtube": "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
      "instagram": "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
      "tiktok": "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
      "discord": "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z",
      "x": "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
  };
  (function () {
    var S = window.SITE || {}, tela = document.getElementById("mpTela");
    if (!tela) return;
    var voci = [];
    if (S.twitch) voci.push(["twitch", "Twitch", "https://www.twitch.tv/" + S.twitch]);
    if (S.youtubeUrl) voci.push(["youtube", "YouTube", S.youtubeUrl]);
    if (S.instagram) voci.push(["instagram", "Instagram", "https://www.instagram.com/" + S.instagram + "/"]);
    if (S.tiktok) voci.push(["tiktok", "TikTok", "https://www.tiktok.com/@" + S.tiktok]);
    if (S.discord) voci.push(["discord", "Discord", S.discord]);
    if (S.x) voci.push(["x", "X", "https://x.com/" + S.x]);
    voci = voci.filter(function (v) { return /^https:\/\//.test(v[2]); });
    if (!voci.length) return;
    var nav = document.createElement("nav");
    nav.className = "mp-social";
    nav.setAttribute("aria-label", "Seguici sui social");
    nav.innerHTML = voci.map(function (v) {
      return '<a class="mp-soc mp-soc-' + v[0] + '" href="' + esc(v[2]) + '" target="_blank" rel="noopener" title="' + v[1] +
        '" aria-label="' + v[1] + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONE[v[0]] + '"/></svg></a>';
    }).join("");
    tela.appendChild(nav);
  })();

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
            catena: s.catena || 99, nota: s.nota, codice: s.codice, voto: s.voto && mp.voti ? mp.voti[s.voto] : null
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

  // Solo link a GitHub: il codice degli agenti e' pubblico, le chiavi no.
  function linkCodice(url) {
    if (!/^https:\/\/github\.com\/poppone\//.test(url || "")) return "";
    return '<a class="mp-codice" href="' + esc(url) + '" target="_blank" rel="noopener">Guarda il codice su GitHub →</a>';
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
        blocco("I revisori che votano per lui", "<p>" + esc((d.revisori || []).join(" · ")) + "</p>") +
        linkCodice(d.codice);
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
      html += linkCodice(d.codice);
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
