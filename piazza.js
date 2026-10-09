(function () {
  var $ = function (s) { return document.querySelector(s); };
  var io = null, caricato = Date.now();
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function api(a, corpo) {
    var o = corpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) } : {};
    return fetch("/api/community?a=" + a, o).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.errore || "Errore"); return j; }); });
  }
  function quando(iso) { var m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? "ora" : m < 60 ? m + " min fa" : m < 1440 ? Math.round(m / 60) + " h fa" : Math.round(m / 1440) + " g fa"; }

  function stato() {
    var u = io;
    $("#barra").innerHTML = u
      ? '<span>Ciao <strong>' + esc(u.nome) + '</strong></span><span><button class="btn" id="bEsci" type="button">Esci</button> <button class="btn" id="bDel" type="button">Elimina account</button></span>'
      : '<button class="btn pieno" id="bAcc" type="button">Entra o crea account</button>';
    $("#fTema").hidden = !u; $("#fPost").hidden = !u;
    if (u) $("#accesso").hidden = true;
    var e = $("#bEsci"); if (e) e.onclick = function () { api("esci", {}).then(function () { io = null; stato(); temi(); }); };
    var d = $("#bDel"); if (d) d.onclick = function () {
      if (confirm("Eliminare definitivamente il tuo account? I tuoi messaggi restano ma non saranno più collegati a te.")) api("elimina-account", {}).then(function () { io = null; stato(); temi(); });
    };
    var b = $("#bAcc"); if (b) b.onclick = function () { $("#accesso").hidden = false; $("#accesso").scrollIntoView({ behavior: "smooth", block: "center" }); };
  }
  function richiediAccesso() { $("#accesso").hidden = false; $("#accesso").scrollIntoView({ behavior: "smooth", block: "center" }); }

  document.querySelectorAll(".pz-tabs button").forEach(function (b) {
    b.onclick = function () {
      var reg = b.dataset.t === "reg";
      $("#fEntra").hidden = reg; $("#fReg").hidden = !reg;
      document.querySelectorAll(".pz-tabs button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    };
  });
  function invia(form, azione, ok) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = new FormData(form), o = {};
      f.forEach(function (v, k) { o[k] = v; });
      form.querySelectorAll("input[type=checkbox]").forEach(function (c) { o[c.name] = c.checked; });
      var btn = form.querySelector("button[type=submit]"); btn.disabled = true;
      api(azione, o).then(function (j) { ok(j, form); }).catch(function (e) { $("#esitoAcc").textContent = e.message; $("#esitoPost").textContent = e.message; })
        .then(function () { btn.disabled = false; });
    });
  }
  function entrato(j) { io = j.utente; $("#esitoAcc").textContent = ""; stato(); temi(); }
  invia($("#fEntra"), "entra", entrato);
  invia($("#fReg"), "registrati", entrato);

  invia($("#fTema"), "proponi", function (j, f) { f.reset(); temi(); });
  invia($("#fPost"), "scrivi", function (j, f) { f.reset(); f.rif.value = ""; $("#rispA").textContent = ""; $("#esitoPost").textContent = ""; posts(); });

  function temi() {
    api("temi").then(function (j) {
      $("#temi").innerHTML = j.temi.length ? j.temi.map(function (t) {
        return '<li><button class="pz-voto" data-id="' + t.id + '" aria-pressed="' + t.votato + '" aria-label="Vota questo tema">▲ ' + t.voti + '</button><div class="tit">' + esc(t.titolo) + '<small>di ' + esc(t.nome) + ' · ' + quando(t.data) + '</small></div></li>';
      }).join("") : '<li class="vuoto">Nessun tema ancora: proponi il primo.</li>';
      document.querySelectorAll(".pz-voto").forEach(function (b) {
        b.onclick = function () { if (!io) return richiediAccesso(); api("vota", { id: b.dataset.id }).then(temi).catch(function (e) { alert(e.message); }); };
      });
    }).catch(function () { $("#temi").innerHTML = '<li class="vuoto">Community non ancora attiva.</li>'; });
  }
  function posts() {
    api("posts").then(function (j) {
      var per = {}; j.posts.forEach(function (p) { per[p.id] = p; });
      var radici = j.posts.filter(function (p) { return !p.rif || !per[p.rif]; });
      function riga(p, ris) {
        return '<li class="' + (ris ? "ris" : "") + '"><span class="n">' + esc(p.nome) + '</span><span class="d">' + quando(p.data) + '</span><p>' + esc(p.testo) + '</p>' +
          (ris ? "" : '<button data-r="' + p.id + '" data-n="' + esc(p.nome) + '">Rispondi</button>') + '<button data-s="' + p.id + '">Segnala</button></li>';
      }
      var h = "";
      radici.forEach(function (p) {
        h += riga(p, false);
        j.posts.filter(function (x) { return x.rif === p.id; }).reverse().forEach(function (x) { h += riga(x, true); });
      });
      $("#posts").innerHTML = h || '<li class="vuoto">Nessun messaggio: scrivi il primo.</li>';
      document.querySelectorAll("[data-r]").forEach(function (b) { b.onclick = function () {
        if (!io) return richiediAccesso();
        $("#fPost").rif.value = b.dataset.r; $("#rispA").textContent = "Risposta a " + b.dataset.n; $("#tPost").focus();
      }; });
      document.querySelectorAll("[data-s]").forEach(function (b) { b.onclick = function () {
        if (!io) return richiediAccesso();
        api("segnala", { id: b.dataset.s }).then(function () { b.textContent = "Segnalato"; b.disabled = true; });
      }; });
    }).catch(function () { $("#posts").innerHTML = '<li class="vuoto">Community non ancora attiva.</li>'; });
  }
  api("io").then(function (j) { io = j.utente; }).catch(function () {}).then(function () { stato(); temi(); posts(); });
})();
