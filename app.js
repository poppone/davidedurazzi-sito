(function () {
  "use strict";
  var S = window.SITE || {};
  var $ = function (id) { return document.getElementById(id); };
  var page = document.body.dataset.page;

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
    return s ? s.nome : "";
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
      (conLink ? '<div class="piede"><a class="btn" href="/articolo?slug=' + encodeURIComponent(a.slug) + '">Leggi l\u2019analisi completa</a></div>' : "") +
      "</div>";
  }

  // Social nel footer
  var social = [];
  if (S.twitch) social.push(["Twitch", "https://www.twitch.tv/" + S.twitch]);
  if (safeUrl(S.youtubeUrl)) social.push(["YouTube", S.youtubeUrl]);
  if (S.instagram) social.push(["Instagram", "https://www.instagram.com/" + S.instagram + "/"]);
  if (S.email) social.push(["Scrivimi", "mailto:" + S.email]);
  $("social").innerHTML = social.map(function (s) {
    return '<a href="' + esc(s[1]) + '"' + (s[1].indexOf("mailto:") ? ' target="_blank" rel="noopener"' : "") + ">" + s[0] + "</a>";
  }).join("");

  if (page === "home") home();
  if (page === "articolo") articolo();

  function home() {
    $("claim").textContent = S.sottotitolo || "";
    $("intro").textContent = S.presentazione || "";
    $("orari").textContent = S.orariLive || "";
    if (safeUrl(S.youtubeUrl)) { $("ytBtn").href = S.youtubeUrl; $("ytBtn").target = "_blank"; $("ytBtn").rel = "noopener"; }

    // Twitch: il parametro parent deve coincidere col dominio che ospita il sito
    if (S.twitch) {
      var host = location.hostname;
      $("twitchPlayer").innerHTML = '<iframe title="Diretta Twitch" allowfullscreen src="https://player.twitch.tv/?channel=' +
        encodeURIComponent(S.twitch) + "&parent=" + encodeURIComponent(host) + '&muted=true&autoplay=false"></iframe>';
      $("twitchChat").innerHTML = '<iframe title="Chat Twitch" src="https://www.twitch.tv/embed/' +
        encodeURIComponent(S.twitch) + "/chat?parent=" + encodeURIComponent(host) +
        (matchMedia("(prefers-color-scheme: dark)").matches ? "&darkpopout" : "") + '"></iframe>';
    }

    // Articoli + Contraddittorio
    var tutti = [], filtro = "tutte";
    function disegnaLista() {
      var lista = tutti.filter(function (a) { return filtro === "tutte" || a.sezione === filtro; });
      $("lista").innerHTML = lista.length ? lista.map(function (a) {
        return '<li><a href="/articolo?slug=' + encodeURIComponent(a.slug) + '"><span class="sez">' +
          esc(nomeSezione(a.sezione)) + "<br>" + esc(data(a.data)) + "</span><span><h3>" + esc(a.titolo) +
          "</h3>" + (a.sommario ? "<p>" + esc(a.sommario) + "</p>" : "") + "</span></a></li>";
      }).join("") : '<li class="vuoto">Ancora nessun articolo in questa sezione.</li>';
    }
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
      }).catch(function () { $("griglia").innerHTML = '<p class="vuoto">I video non si sono caricati.</p>'; });
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

    // Piazza Aperta
    var p = $("proponi");
    if (safeUrl(S.modulTemi)) { p.href = S.modulTemi; p.target = "_blank"; p.rel = "noopener"; }
    else if (S.email) { p.href = "mailto:" + S.email + "?subject=" + encodeURIComponent("Proposta per Piazza Aperta"); }
    else { p.hidden = true; }
  }

  function articolo() {
    var slug = new URLSearchParams(location.search).get("slug");
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
        '<div class="acts" style="margin-top:2rem"><a class="btn pieno" href="/#diretta"><span class="dot" aria-hidden="true"></span>Ne parliamo in diretta</a></div>';
    }).catch(function () {
      $("art").innerHTML = '<p class="som">L\u2019articolo non si è caricato. Ricarica la pagina.</p>';
    });
  }
})();
