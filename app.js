(function () {
  "use strict";
  var S = window.SITE || {};
  var $ = function (id) { return document.getElementById(id); };
  var page = document.body.dataset.page;
  // Contatore visite anonimo (nessun cookie): vedi /api/visite
  try {
    if (!/^(localhost|127\.)/.test(location.hostname) && navigator.sendBeacon) {
      navigator.sendBeacon("/api/visite", new Blob([JSON.stringify({ p: location.pathname })], { type: "application/json" }));
    }
  } catch (e) {}

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; }
  function data(d) {
    if (!d) return "";
    var x = new Date(d.length === 10 ? d + "T12:00:00" : d);
    return isNaN(x) ? d : x.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  }
  function nomeSezione(id) {
    var s = (S.sezioni || []).filter(function (x) { return x.id === id; })[0];
    return s ? s.nome : String(id || "").charAt(0).toUpperCase() + String(id || "").slice(1);
  }
  function caricaArticoli() {
    return fetch("/content/articoli.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (a) {
        return a.filter(function (x) { return x.pubblicato === true; })
          .sort(function (x, y) { return (y.data || "").localeCompare(x.data || ""); });
      });
  }
  function duello(a, conLink) {
    var lato = function (cls, l) {
      return '<div class="lato ' + cls + '"><h4>' + esc(l.titolo) + "</h4><ul>" +
        (l.punti || []).map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul></div>";
    };
    return '<div class="duello"><div class="domanda"><p class="meta">' + esc(nomeSezione(a.sezione)) + ", " + esc(data(a.data)) +
      "</p><h3>" + esc(a.domanda || a.titolo) + '</h3></div><div class="lati">' +
      lato("si", a.tesi) + lato("no", a.antitesi) + "</div>" +
      (conLink ? '<div class="piede"><a class="btn" href="/articoli/' + encodeURIComponent(a.slug) + '">Leggi l\u2019analisi completa</a></div>' : "") +
      "</div>";
  }

  // ---- Voto del Contraddittorio ----
  function iniziaVoti(box, slug) {
    if (!box || !slug || box.querySelector(".voto")) return;
    var d = document.createElement("div"); d.className = "voto";
    d.innerHTML = '<p class="q">Tu da che parte stai?</p><div class="vbtn"><button type="button" class="vsi" data-v="si">S\u00ec</button><button type="button" class="vno" data-v="no">No</button></div>' +
      '<div class="barra" aria-hidden="true"><span class="b si" style="width:50%"></span><span class="b no" style="width:50%"></span></div><p class="esv" role="status"></p>';
    var lati = box.querySelector(".lati"); if (lati) lati.after(d); else box.appendChild(d);
    var chiave = "voto:" + slug, mio = "";
    try { mio = localStorage.getItem(chiave) || ""; } catch (e) {}
    function mostra(j) {
      var t = j.si + j.no, ps = t ? Math.round(j.si / t * 100) : 50;
      d.querySelector(".b.si").style.width = ps + "%"; d.querySelector(".b.no").style.width = (100 - ps) + "%";
      d.querySelector(".esv").innerHTML = t ? "<span>S\u00ec " + ps + "%</span><span>" + t + (t === 1 ? " voto" : " voti") + "</span><span>No " + (100 - ps) + "%</span>" : "Sii il primo a votare.";
      if (t && window.ddConta) window.ddConta(d);
    }
    function blocca(v) {
      [].forEach.call(d.querySelectorAll("button"), function (b) { b.disabled = true; if (b.dataset.v === v) b.classList.add("mia"); });
    }
    if (mio) blocca(mio);
    fetch("/api/voto?slug=" + encodeURIComponent(slug)).then(function (r) { return r.json(); }).then(mostra).catch(function () {
      d.querySelector(".esv").textContent = "";
    });
    d.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-v]"); if (!b || b.disabled) return;
      var v = b.dataset.v; blocca(v);
      fetch("/api/voto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: slug, scelta: v }) })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (j) { try { localStorage.setItem(chiave, v); } catch (e) {} mostra(j); })
        .catch(function () { [].forEach.call(d.querySelectorAll("button"), function (x) { x.disabled = false; x.classList.remove("mia"); }); d.querySelector(".esv").textContent = "Voto non riuscito, riprova."; });
    });
  }

  // ---- Effetti: comparsa allo scroll e inclinazione 3D delle card ----
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (en) {
    en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } });
  }, { threshold: .08 }) : null;
  function rivela(el) { if (!io) return; el.classList.add("rv"); io.observe(el); }
  function inclina(cont) {
    if (!matchMedia("(hover:hover)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cont.addEventListener("pointermove", function (e) {
      var a = e.target.closest("a"); if (!a || !cont.contains(a)) return;
      var r = a.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      a.style.setProperty("--ry", ((x - .5) * 8).toFixed(2) + "deg"); a.style.setProperty("--rx", ((.5 - y) * 8).toFixed(2) + "deg");
      a.style.setProperty("--mx", (x * 100) + "%"); a.style.setProperty("--my", (y * 100) + "%");
    });
    cont.addEventListener("pointerout", function (e) {
      var a = e.target.closest("a"); if (!a) return;
      a.style.setProperty("--rx", "0deg"); a.style.setProperty("--ry", "0deg");
    });
  }

  // ---- Barra social fissa su mobile ----
  (function () {
    var l = [];
    if (S.twitch) l.push('<a class="tw" href="https://www.twitch.tv/' + esc(S.twitch) + '" target="_blank" rel="noopener">Twitch</a>');
    if (safeUrl(S.youtubeUrl)) l.push('<a href="' + esc(S.youtubeUrl) + '" target="_blank" rel="noopener">YouTube</a>');
    if (S.instagram) l.push('<a href="https://www.instagram.com/' + esc(S.instagram) + '/" target="_blank" rel="noopener">Instagram</a>');
    if (S.x) l.push('<a href="https://x.com/' + esc(S.x) + '" target="_blank" rel="noopener">X</a>');
    if (!l.length) return;
    var n = document.createElement("nav"); n.className = "barra-mobile"; n.setAttribute("aria-label", "Seguimi"); n.innerHTML = l.join("");
    document.body.appendChild(n);
  })();

  // Social nel footer
  var social = [];
  if (S.twitch) social.push(["Twitch", "https://www.twitch.tv/" + S.twitch]);
  if (safeUrl(S.youtubeUrl)) social.push(["YouTube", S.youtubeUrl]);
  if (S.instagram) social.push(["Instagram", "https://www.instagram.com/" + S.instagram + "/"]);
  if (S.x) social.push(["X", "https://x.com/" + S.x]);
  if (S.linkedin) social.push(["LinkedIn", "https://www.linkedin.com/in/" + S.linkedin + "/"]);
  if (S.email) social.push(["Scrivimi", "mailto:" + S.email]);
  $("social").innerHTML = social.map(function (s) {
    return '<a href="' + esc(s[1]) + '"' + (s[1].indexOf("mailto:") ? ' target="_blank" rel="noopener"' : "") + ">" + s[0] + "</a>";
  }).join("");

  var an = document.createElement("script"); an.src = "/anim.js"; an.defer = true; document.body.appendChild(an);
  if (page === "home") home();
  if (page === "articolo") articolo();

  function home() {
    $("claim").textContent = S.sottotitolo || "";
    $("intro").textContent = S.presentazione || "";
    $("orari").textContent = S.orariLive || "";
    if (safeUrl(S.youtubeUrl)) { $("ytBtn").href = S.youtubeUrl; $("ytBtn").target = "_blank"; $("ytBtn").rel = "noopener"; }


    // Stato in alto: live / countdown alla prossima diretta (default martedì 21:30, ora italiana)
    function prossima() {
      var gg = S.giornoLive == null ? 2 : S.giornoLive, hm = String(S.oraLive || "21:30").split(":");
      var adesso = new Date(), parti = {};
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(adesso).forEach(function (p) { parti[p.type] = p.value; });
      var romaAdesso = Date.UTC(+parti.year, +parti.month - 1, +parti.day, +parti.hour % 24, +parti.minute);
      var dow = new Date(Date.UTC(+parti.year, +parti.month - 1, +parti.day)).getUTCDay();
      var add = (gg - dow + 7) % 7;
      var t = Date.UTC(+parti.year, +parti.month - 1, +parti.day + add, +hm[0], +hm[1] || 0);
      if (t <= romaAdesso) t += 7 * 864e5;
      return t - romaAdesso; // millisecondi mancanti
    }
    var stato = $("stato"), st = $("statoTesto");
    function aggStato() {
      if (stato.classList.contains("live")) return;
      var m = Math.floor(prossima() / 6e4), g = Math.floor(m / 1440), o = Math.floor(m % 1440 / 60), mi = m % 60;
      st.textContent = "Prossima diretta tra " + (g ? g + (g === 1 ? " giorno " : " giorni ") : "") + (g || o ? o + " h " : "") + mi + " min";
    }
    aggStato(); setInterval(aggStato, 30000);
    var pt = $("twitchPlayer");
    if (pt && "MutationObserver" in window) new MutationObserver(function () {
      var on = pt.classList.contains("online");
      stato.classList.toggle("live", on);
      if (on) st.textContent = "IN DIRETTA ORA"; else aggStato();
    }).observe(pt, { attributes: true, attributeFilter: ["class"] });

    // Newsletter
    var fnl = $("formNl"), nlInizio = Date.now();
    if (fnl) fnl.addEventListener("submit", function (e) {
      e.preventDefault();
      var es = $("esitoNl"), bt = fnl.querySelector("button"), em = fnl.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { es.textContent = "Controlla l\u2019email."; return; }
      bt.disabled = true; es.textContent = "Un attimo.";
      fetch("/api/iscrizione", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: em, sito: fnl.sito.value, t: nlInizio }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.errore); return j; }); })
        .then(function (j) { fnl.reset(); es.textContent = j.messaggio || "Fatto!"; })
        .catch(function (err) { es.textContent = err.message || "Iscrizione non riuscita."; })
        .then(function () { bt.disabled = false; });
    });

    // Twitch: il parametro parent deve coincidere col dominio che ospita il sito.
    // Finché il canale è offline si vede una locandina con il prossimo orario;
    // il player prende il posto della locandina appena parte la diretta.
    if (S.twitch) {
      var host = location.hostname;
      var canale = encodeURIComponent(S.twitch);
      var locandina = $("locandina");
      var tw = document.createElement("a");
      tw.className = "btn pieno"; tw.href = "https://www.twitch.tv/" + canale; tw.target = "_blank"; tw.rel = "noopener";
      tw.textContent = "Apri il canale su Twitch";
      if (locandina) locandina.querySelector(".acts").appendChild(tw);
      $("twitchChat").innerHTML = '<iframe title="Chat Twitch" src="https://www.twitch.tv/embed/' +
        canale + "/chat?parent=" + encodeURIComponent(host) +
        "&darkpopout" + '"></iframe>';
      // Rileva online/offline con l'API ufficiale del player
      var sc = document.createElement("script");
      sc.src = "https://player.twitch.tv/js/embed/v1.js";
      sc.onload = function () {
        try {
          var pl = new Twitch.Player("twitchPlayerApi", { channel: S.twitch, parent: [host], width: "100%", height: "100%", autoplay: false, muted: true });
          pl.addEventListener(Twitch.Player.ONLINE, function () { $("twitchPlayer").classList.add("online"); });
          pl.addEventListener(Twitch.Player.OFFLINE, function () { $("twitchPlayer").classList.remove("online"); });
        } catch (e) { /* resta la locandina */ }
      };
      sc.onerror = function () { /* resta la locandina con il link al canale */ };
      document.body.appendChild(sc);
    }

    // Articoli + Contraddittorio
    var tutti = [], filtro = "tutte";
    function disegnaLista() {
      var lista = tutti.filter(function (a) { return filtro === "tutte" || a.sezione === filtro; });
      $("lista").innerHTML = lista.length ? lista.map(function (a) {
        return '<li><a href="/articoli/' + encodeURIComponent(a.slug) + '"><span class="sez">' +
          esc(nomeSezione(a.sezione)) + "<br>" + esc(data(a.data)) + "</span><span><h3>" + esc(a.titolo) +
          "</h3>" + (a.sommario ? "<p>" + esc(a.sommario) + "</p>" : "") + "</span></a></li>";
      }).join("") : '<li class="vuoto">Ancora nessun articolo in questa sezione.</li>';
      [].forEach.call($("lista").children, rivela);
    }
    inclina($("lista"));
    [].forEach.call($("lista").children, rivela);
    var sez = [{ id: "tutte", nome: "Tutte" }].concat(S.sezioni || []);
    $("filtri").innerHTML = sez.map(function (s) {
      return '<button type="button" data-sez="' + esc(s.id) + '" aria-pressed="' + (s.id === filtro) + '">' + esc(s.nome) + "</button>";
    }).join("");
    $("filtri").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      filtro = b.dataset.sez;
      [].forEach.call($("filtri").children, function (x) { x.setAttribute("aria-pressed", x === b); });
      disegnaLista();
    });
    caricaArticoli().then(function (a) {
      tutti = a; disegnaLista();
      var c = a.filter(function (x) { return x.rubrica === "contraddittorio" && x.tesi && x.antitesi; })[0];
      $("duello").innerHTML = c ? duello(c, true) : '<p class="vuoto">Il primo Contraddittorio arriva a breve.</p>';
      if (c) iniziaVoti($("duello").querySelector(".duello"), c.slug);
    }).catch(function () {
      $("lista").innerHTML = '<li class="vuoto">Gli articoli non si sono caricati. Ricarica la pagina.</li>';
      $("duello").innerHTML = "";
    });

    // YouTube: ultimi video dal feed, il player si carica solo al clic
    if (/^UC[\w-]{22}$/.test(S.youtubeChannelId || "")) {
      fetch("/api/youtube?channel=" + S.youtubeChannelId).then(function (r) { return r.json(); }).then(function (j) {
        var v = (j.videos || []).slice(0, 6);
        $("griglia").innerHTML = v.length ? v.map(function (x) {
          return '<button class="video" type="button" data-id="' + esc(x.id) + '"><div class="thumb"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' +
            esc(x.id) + '/hqdefault.jpg"><span class="play">Guarda</span></div><h3>' + esc(x.titolo) + '</h3><p class="meta">' + esc(data(x.data)) + "</p></button>";
        }).join("") : '<p class="vuoto">Nessun video ancora pubblicato.</p>';
      }).catch(function () { $("griglia").innerHTML = '<p class="vuoto">I video arrivano presto. Intanto seguimi su YouTube.</p>'; });
      $("griglia").addEventListener("click", function (e) {
        var b = e.target.closest(".video"); if (!b || b.dataset.on) return;
        b.dataset.on = "1";
        b.querySelector(".thumb").innerHTML = '<iframe title="Video YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen src="https://www.youtube-nocookie.com/embed/' +
          encodeURIComponent(b.dataset.id) + '?autoplay=1&rel=0"></iframe>';
      });
    } else {
      $("griglia").innerHTML = '<p class="vuoto">I video arrivano presto. Intanto seguimi su YouTube.</p>';
    }

    // Instagram: embed ufficiali dei post scelti
    var post = (S.instagramPost || []).filter(safeUrl);
    if (post.length) {
      $("instagram").hidden = false;
      $("ig").innerHTML = post.map(function (u) {
        return '<blockquote class="instagram-media" data-instgrm-permalink="' + esc(u) + '" data-instgrm-version="14"><a href="' + esc(u) + '">Vedi il post su Instagram</a></blockquote>';
      }).join("");
      var s = document.createElement("script"); s.async = true; s.src = "https://www.instagram.com/embed.js";
      document.body.appendChild(s);
    }

    // Piazza Aperta: il pulsante porta a /piazza (community con account)
  }

  function commenti(slug) {
    var lista = $("listaCommenti"), form = $("formCommento"), inizio = Date.now();
    fetch("/api/commenti?slug=" + encodeURIComponent(slug)).then(function (r) { return r.json(); }).then(function (j) {
      var c = j.commenti || [];
      lista.innerHTML = c.length ? c.map(function (x) {
        var r = x.risposta;
        return '<div class="commento"><div class="autore">' + esc(x.nome) + ' <span class="quando">' + esc(data(x.data)) + '</span></div><p>' + esc(x.testo) + '</p>' +
          (r ? '<div class="risposta' + (r.ai ? ' ai' : '') + '"><div class="autore">' + esc(r.autore) +
            (r.ai ? ' <span class="etichetta">risposta automatica</span>' : '') + '</div><p>' + esc(r.testo) + '</p></div>' : '') + '</div>';
      }).join("") : '<p class="meta">Ancora nessun commento. Inizia tu.</p>';
    }).catch(function () { lista.innerHTML = '<p class="meta">I commenti non si sono caricati.</p>'; });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var esito = form.querySelector(".esito-commento"), bottone = form.querySelector("button");
      bottone.disabled = true; esito.textContent = "Invio in corso.";
      fetch("/api/commenti", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug, nome: form.nome.value, testo: form.testo.value, sito: form.sito.value, t: inizio })
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.errore); return j; }); })
        .then(function (j) { form.reset(); esito.textContent = j.messaggio || "Grazie!"; })
        .catch(function (err) { esito.textContent = err.message || "Invio non riuscito. Riprova."; })
        .then(function () { bottone.disabled = false; });
    });
  }

  function articolo() {
    var slug = document.body.dataset.slug || new URLSearchParams(location.search).get("slug");
    var pb = document.createElement("div"); pb.className = "progress"; document.body.appendChild(pb);
    addEventListener("scroll", function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      pb.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + "%";
    }, { passive: true });
    // Pagina già generata (articoli/<slug>.html): resta solo da caricare i commenti
    if ($("art").dataset.statico) { iniziaVoti($("art").querySelector(".duello"), slug); commenti(slug); return; }
    caricaArticoli().then(function (tutti) {
      var a = tutti.filter(function (x) { return x.slug === slug; })[0];
      if (!a) {
        $("art").innerHTML = '<a class="back" href="/#articoli">Torna agli articoli</a><h1>Articolo non trovato</h1><p class="som">Il link potrebbe essere sbagliato o l\u2019articolo non è più online.</p>';
        return;
      }
      document.title = a.titolo + " — " + (S.nome || "");
      var fonti = (a.fonti || []).filter(function (f) { return safeUrl(f.url); });
      $("art").innerHTML = '<a class="back" href="/#articoli">Torna agli articoli</a>' +
        '<p class="meta">' + esc(nomeSezione(a.sezione)) + ", " + esc(data(a.data)) + "</p>" +
        "<h1>" + esc(a.titolo) + "</h1>" + (a.sommario ? '<p class="som">' + esc(a.sommario) + "</p>" : "") +
        (a.tesi && a.antitesi ? duello(a, false) : "") +
        '<div class="corpo">' + (a.testo || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>" +
        (fonti.length ? '<div class="fonti"><h2>Fonti</h2><ul>' + fonti.map(function (f) {
          return '<li><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.nome || f.url) + "</a></li>";
        }).join("") + "</ul></div>" : "") +
        '<div class="acts" style="margin-top:2rem"><a class="btn pieno" href="/#diretta"><span class="dot" aria-hidden="true"></span>Ne parliamo in diretta</a></div>' +
        '<section class="commenti" id="commenti"><h2>Commenti</h2><div id="listaCommenti"><p class="meta">Caricamento dei commenti.</p></div>' +
        '<form class="form-commento" id="formCommento"><h3>Dì la tua</h3>' +
        '<label>Nome<input name="nome" maxlength="40" autocomplete="nickname" required></label>' +
        '<label>Commento<textarea name="testo" maxlength="1500" required></textarea></label>' +
        '<label class="trappola" aria-hidden="true">Sito<input name="sito" tabindex="-1" autocomplete="off"></label>' +
        '<p class="nota">I commenti vengono letti prima della pubblicazione. Alle domande pratiche può rispondere la Redazione AI, ed è sempre indicato.</p>' +
        '<button class="btn pieno" type="submit">Invia commento</button><p class="esito-commento" role="status"></p></form></section>';
      iniziaVoti($("art").querySelector(".duello"), a.slug);
      commenti(a.slug);
    }).catch(function () {
      $("art").innerHTML = '<p class="som">L\u2019articolo non si è caricato. Ricarica la pagina.</p>';
    });
  }
})();
