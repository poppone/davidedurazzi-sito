(function () {
  "use strict";
  try {
    if (!/^(localhost|127\.)/.test(location.hostname) && navigator.sendBeacon) {
      navigator.sendBeacon("/api/visite", new Blob([JSON.stringify({ p: location.pathname })], { type: "application/json" }));
    }
  } catch (e) {}

  var $ = function (s) { return document.querySelector(s); };
  var io = null, prof = null, bloccato = false, meta = null, filtro = "tutti";
  var ID_NOMI = { psn: "PSN", xbox: "Xbox", epic: "Epic", ea: "EA ID", steam: "Steam", nintendo: "Nintendo" };
  try { filtro = localStorage.getItem("sq-filtro") || "tutti"; } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function chiama(url, corpo) {
    var o = corpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) } : {};
    return fetch(url, o).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.errore || "Errore"); return j; }); });
  }
  var sq = function (a, corpo) { return chiama("/api/squadre?a=" + a, corpo); };
  var cm = function (a, corpo) { return chiama("/api/community?a=" + a, corpo); };

  var GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  function quando(ms) {
    var d = new Date(ms), ora = new Date(), hh = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    if (Date.now() >= ms && Date.now() < ms + 2 * 3600000) return "In corso · " + hh;
    var g0 = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate()).getTime();
    var gd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var diff = Math.round((gd - g0) / 86400000);
    if (diff === 0) return "Oggi " + hh;
    if (diff === 1) return "Domani " + hh;
    if (diff === -1) return "Ieri " + hh;
    return GIORNI[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1) + " " + hh;
  }
  function affHtml(a) {
    if (!a || !a.tot) return '<span class="sq-aff nuovo">Nuovo</span>';
    return '<span class="sq-aff' + (a.badge ? " ok" : "") + '" title="Presente ' + a.pres + " volte su " + a.tot + '">' +
      (a.badge ? "✓ Affidabile · " : "") + a.perc + "% · " + a.pres + "/" + a.tot + "</span>";
  }
  function richiediAccesso() { $("#accesso").hidden = false; $("#accesso").scrollIntoView({ behavior: "smooth", block: "center" }); }
  function richiediProfilo() { $("#profilo").hidden = false; $("#profilo").scrollIntoView({ behavior: "smooth", block: "center" }); }

  // ---------- Account (stesso della Piazza Aperta) ----------
  function barra() {
    $("#barra").innerHTML = io
      ? '<span>Ciao <strong>' + esc(io.nome) + '</strong>' + (prof ? " · " + affHtml(prof.aff) : "") + '</span><span><button class="btn" id="bProf" type="button">Profilo giocatore</button> <button class="btn" id="bEsci" type="button">Esci</button></span>'
      : '<button class="btn pieno" id="bAcc" type="button">Entra o crea account</button>';
    var e = $("#bEsci"); if (e) e.onclick = function () { cm("esci", {}).then(function () { io = null; prof = null; tutto(); }); };
    var p = $("#bProf"); if (p) p.onclick = function () { $("#profilo").hidden = !$("#profilo").hidden; if (!$("#profilo").hidden) richiediProfilo(); };
    var b = $("#bAcc"); if (b) b.onclick = richiediAccesso;
    if (io) $("#accesso").hidden = true;
    $("#nuovo").hidden = !(io && prof && !bloccato);
    $("#mie").hidden = !io;
    if (io && !prof) $("#profilo").hidden = false;
    if (!io) $("#profilo").hidden = true;
    riempiProfilo();
  }
  document.querySelectorAll(".pz-tabs button").forEach(function (b) {
    b.onclick = function () {
      var reg = b.dataset.t === "reg";
      $("#fEntra").hidden = reg; $("#fReg").hidden = !reg;
      document.querySelectorAll(".pz-tabs button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    };
  });
  function datiForm(form) {
    var o = {};
    new FormData(form).forEach(function (v, k) { o[k] = v; });
    form.querySelectorAll("input[type=checkbox]").forEach(function (c) { o[c.name] = c.checked; });
    return o;
  }
  function invia(form, esito, fn) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var btn = form.querySelector("button[type=submit]"); btn.disabled = true; $(esito).textContent = "";
      fn(datiForm(form)).catch(function (e) { $(esito).textContent = e.message; }).then(function () { btn.disabled = false; });
    });
  }
  invia($("#fEntra"), "#esitoAcc", function (o) { return cm("entra", o).then(tutto); });
  invia($("#fReg"), "#esitoAcc", function (o) { return cm("registrati", o).then(tutto); });

  // ---------- Profilo giocatore ----------
  function riempiProfilo() {
    var f = $("#fProfilo"), ids = (prof && prof.ids) || {};
    Object.keys(ID_NOMI).forEach(function (k) { if (document.activeElement !== f[k]) f[k].value = ids[k] || ""; });
    f.eta.checked = !!(prof && prof.eta);
    $("#bDelProf").hidden = !prof;
  }
  invia($("#fProfilo"), "#esitoProf", function (o) {
    var ids = {}; Object.keys(ID_NOMI).forEach(function (k) { ids[k] = o[k]; });
    return sq("profilo", { ids: ids, eta: o.eta }).then(function (j) {
      prof = j.profilo; $("#esitoProf").textContent = "Profilo salvato."; $("#profilo").hidden = true; barra(); annunci();
    });
  });
  $("#bDelProf").onclick = function () {
    if (!confirm("Eliminare il profilo giocatore? Perdi ID salvati e affidabilità. L'account della community resta.")) return;
    sq("elimina-profilo", {}).then(function () { prof = null; barra(); annunci(); });
  };

  // ---------- Crea annuncio ----------
  function opzioni(sel, obj, scelto) {
    sel.innerHTML = Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === scelto ? " selected" : "") + ">" + esc(obj[k].nome || obj[k]) + "</option>"; }).join("");
  }
  function locale(d) { var p = function (n) { return String(n).padStart(2, "0"); }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); }
  function preparaCrea() {
    if (!meta || $("#selGioco").options.length) return;
    opzioni($("#selGioco"), meta.giochi, filtro !== "tutti" ? filtro : "fc");
    opzioni($("#selPiatt"), meta.piattaforme, "ps");
    opzioni($("#selLiv"), meta.livelli, "medio");
    var d = new Date(Date.now() + 30 * 60000); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    $("#inQuando").value = locale(d);
    $("#inQuando").min = locale(new Date());
    $("#inQuando").max = locale(new Date(Date.now() + 7 * 86400000));
    var maxPosti = function () { var m = meta.giochi[$("#selGioco").value].max; $("#inPosti").max = m; if (+$("#inPosti").value > m) $("#inPosti").value = m; };
    $("#selGioco").onchange = maxPosti; maxPosti();
  }
  invia($("#fCrea"), "#esitoCrea", function (o) {
    o.inizio = new Date(o.inizio).toISOString();
    return sq("crea", o).then(function () { $("#esitoCrea").textContent = "Annuncio pubblicato."; $("#fCrea").note.value = ""; annunci(); mie(); });
  });

  // ---------- Card ----------
  function squadraHtml(a) {
    if (!a.squadra) return "";
    return '<div class="sq-squadra"><b>La squadra · aggiungetevi in gioco</b><ul>' + a.squadra.map(function (m) {
      var ids = Object.keys(m.ids || {}).map(function (k) { return '<span class="sq-id"><small>' + ID_NOMI[k] + "</small> " + esc(m.ids[k]) + "</span>"; }).join("");
      return "<li><strong>" + esc(m.nome) + (m.org ? " (organizza)" : "") + (m.uid === "io" ? " · tu" : "") + "</strong>" + (ids || '<span class="small">nessun ID</span>') + "</li>";
    }).join("") + "</ul></div>";
  }
  function card(a, inMie) {
    var g = meta.giochi[a.gioco] || { nome: a.gioco }, h = "";
    var completo = a.liberi <= 0;
    h += '<li class="sq-card g-' + esc(a.gioco) + (a.dentro ? " dentro" : "") + '" data-id="' + a.id + '">';
    h += '<div class="sq-riga1"><span class="sq-gioco">' + esc(g.nome) + '</span><span class="sq-ora">' + quando(a.inizio) + "</span></div>";
    h += '<div class="sq-info">' + esc(meta.piattaforme[a.piatt]) + " · " + esc(meta.livelli[a.livello]) + " · " +
      (a.stato === "chiuso" ? "Chiusa" : completo ? "<b>Completa</b>" : "<b>" + a.liberi + (a.liberi === 1 ? " posto libero" : " posti liberi") + "</b>") + "</div>";
    if (a.note) h += '<p class="sq-note">' + esc(a.note) + "</p>";
    h += '<div class="sq-chi"><span>Organizza <strong>' + esc(a.org.nome) + "</strong> " + affHtml(a.org.aff) + "</span>";
    if (a.iscritti.length) h += '<span class="small">Dentro: ' + a.iscritti.map(function (i) { return esc(i.nome); }).join(", ") + "</span>";
    h += "</div>";
    h += squadraHtml(a);
    // Conferme dopo la partita
    if (inMie && a.stato === "chiuso") {
      h += '<p class="sq-esito">' + (a.mioEsito === true ? "✓ Presenza registrata" : a.mioEsito === false ? "Assenza registrata" : "Questa partita non ha cambiato la tua affidabilità") + "</p>";
    } else if (a.puoiConfermare && !a.confermato) {
      h += '<form class="sq-conferma"><b>Chi si è presentato?</b>' + a.squadra.filter(function (m) { return m.uid !== "io"; }).map(function (m) {
        return '<label class="pz-chk"><input type="checkbox" value="' + esc(m.uid) + '" checked> ' + esc(m.nome) + "</label>";
      }).join("") + '<button class="btn pieno" type="submit">Conferma presenze</button></form>';
    } else if (a.confermato && a.stato !== "chiuso") {
      h += '<p class="sq-esito">Conferme inviate. Si chiude quando confermano tutti o dopo 48 ore.</p>';
    }
    // Azioni
    var acts = [];
    var futura = Date.now() < a.inizio;
    if (a.stato === "aperto") {
      if (a.mio && futura) acts.push('<button class="btn" data-az="annulla" type="button">Annulla</button>');
      else if (a.dentro && !a.mio && futura) acts.push('<button class="btn" data-az="lascia" type="button">Lascia</button>');
      else if (!a.dentro && !completo && Date.now() < a.inizio + 15 * 60000) acts.push('<button class="btn pieno" data-az="unisciti" type="button">Unisciti</button>');
      if (!a.mio && !a.dentro && !inMie) acts.push('<button class="sq-segnala" data-az="segnala" type="button">Segnala</button>');
    }
    if (acts.length) h += '<div class="acts">' + acts.join("") + "</div>";
    return h + "</li>";
  }
  function collega(lista) {
    lista.querySelectorAll("[data-az]").forEach(function (b) {
      b.onclick = function () {
        var az = b.dataset.az, id = b.closest(".sq-card").dataset.id;
        if (!io) return richiediAccesso();
        if (az !== "segnala" && !prof) return richiediProfilo();
        var conf = { annulla: "Annullare l'annuncio? Se manca meno di un'ora e qualcuno si è unito, conta come assenza.", lascia: "Lasciare la squadra? Se manca meno di un'ora conta come assenza.", segnala: "Segnalare questo annuncio come inappropriato?" }[az];
        if (conf && !confirm(conf)) return;
        b.disabled = true;
        sq(az, { id: id }).then(function (j) {
          if (j.penalita) alert("Fatto. Era tardi: conta come assenza nella tua affidabilità.");
          if (az === "segnala") { b.textContent = "Segnalato"; return; }
          annunci(); mie(); if (j.penalita) aggiornaIo();
        }).catch(function (e) { alert(e.message); b.disabled = false; });
      };
    });
    lista.querySelectorAll(".sq-conferma").forEach(function (f) {
      f.onsubmit = function (ev) {
        ev.preventDefault();
        var id = f.closest(".sq-card").dataset.id, presenti = [];
        f.querySelectorAll("input:checked").forEach(function (c) { presenti.push(c.value); });
        f.querySelector("button").disabled = true;
        sq("conferma", { id: id, presenti: presenti }).then(function () { mie(); aggiornaIo(); }).catch(function (e) { alert(e.message); f.querySelector("button").disabled = false; });
      };
    });
  }

  // ---------- Liste ----------
  function filtri() {
    var voci = [["tutti", "Tutti"]].concat(Object.keys(meta.giochi).map(function (k) { return [k, meta.giochi[k].nome]; }));
    $("#filtri").innerHTML = voci.map(function (v) { return '<button type="button" data-f="' + v[0] + '" aria-pressed="' + (filtro === v[0]) + '">' + esc(v[1]) + "</button>"; }).join("");
    $("#filtri").querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { filtro = b.dataset.f; try { localStorage.setItem("sq-filtro", filtro); } catch (e) {} annunci(); };
    });
  }
  function annunci() {
    return sq("annunci").then(function (j) {
      meta = { giochi: j.giochi, piattaforme: j.piattaforme, livelli: j.livelli };
      filtri(); preparaCrea();
      var v = j.annunci.filter(function (a) { return filtro === "tutti" || a.gioco === filtro; });
      $("#annunci").innerHTML = v.length ? v.map(function (a) { return card(a, false); }).join("")
        : '<li class="vuoto">Nessun annuncio' + (filtro !== "tutti" ? " per questo gioco" : "") + " al momento. " + (io ? "Pubblica il primo qui sopra." : "Entra e pubblica il primo.") + "</li>";
      collega($("#annunci"));
    }).catch(function () { $("#annunci").innerHTML = '<li class="vuoto">Cerca squadra non è ancora attivo. Riprova tra poco.</li>'; });
  }
  function mie() {
    if (!io || !meta) return Promise.resolve();
    return sq("mie").then(function (j) {
      $("#listaMie").innerHTML = j.partite.length ? j.partite.map(function (a) { return card(a, true); }).join("") : '<li class="vuoto">Non sei in nessuna squadra. Unisciti a un annuncio o pubblicane uno.</li>';
      collega($("#listaMie"));
    }).catch(function () {});
  }
  function classifica() {
    sq("classifica").then(function (j) {
      $("#classifica").innerHTML = j.classifica.length ? j.classifica.map(function (c) {
        return '<li><span class="n">' + esc(c.nome) + "</span>" + affHtml(c) + "</li>";
      }).join("") : '<li class="vuoto">Ancora nessuno: la classifica si riempie con le prime partite confermate.</li>';
    }).catch(function () {});
  }
  function aggiornaIo() {
    return sq("io").then(function (j) { io = j.utente; prof = j.profilo; bloccato = j.bloccato; }).catch(function () { io = null; }).then(barra);
  }
  function tutto() { return aggiornaIo().then(annunci).then(mie).then(classifica); }
  tutto();
  setInterval(function () { if (!document.hidden && !document.activeElement.closest("form")) { annunci(); mie(); } }, 60000);

  // ---------- Installabile come app ----------
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-squadre.js", { scope: "/squadre" }).catch(function () {});
  var prompt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); prompt = e; $("#installa").hidden = false; });
  $("#bInstalla").onclick = function () { if (prompt) { prompt.prompt(); prompt = null; $("#installa").hidden = true; } };
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!standalone && /iphone|ipad/i.test(navigator.userAgent)) $("#iosHint").hidden = false;
})();
