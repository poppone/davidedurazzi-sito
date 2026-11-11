// Animazioni in stile media kit (11/11/2026): forme che vagano sullo sfondo,
// fascia dei temi sotto l'apertura della home, comparsa dal basso delle sezioni.
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Forme geometriche: posizioni fisse, così la pagina è sempre uguale
  var FORME = [
    ["tri", "blu", 8, 14, 22, "a", 28], ["qua", "ara", 86, 22, 14, "b", 24], ["cer", "ara", 30, 6, 10, "c", 30],
    ["rom", "ara", 14, 48, 12, "a", 22], ["tri", "ara", 90, 64, 20, "c", 34], ["qua", "blu", 62, 40, 12, "a", 26],
    ["cer", "blu", 78, 86, 14, "b", 32], ["rom", "blu", 44, 76, 10, "c", 20], ["qua", "ara", 4, 88, 16, "b", 29],
    ["tri", "blu", 54, 96, 16, "a", 36]
  ];
  var box = document.createElement("div");
  box.className = "kit-forme"; box.setAttribute("aria-hidden", "true");
  FORME.forEach(function (f, i) {
    var el = document.createElement("i");
    el.className = f[0] + " " + f[1];
    el.style.left = f[2] + "%"; el.style.top = f[3] + "%";
    el.style.setProperty("--s", f[4] + "px");
    el.style.setProperty("--a", "kit-vaga-" + f[5]);
    el.style.setProperty("--t", f[6] + "s");
    el.style.setProperty("--r", (-i * 3.7) + "s");
    box.appendChild(el);
  });
  document.body.insertBefore(box, document.body.firstChild);

  // Fascia dei temi, solo in home sotto l'apertura
  var apertura = document.getElementById("plancia");
  if (apertura) {
    var temi = ["Tecnologia", "Intelligenza artificiale", "Gaming", "Motori", "Prove reali", "Dirette ogni martedì", "Notizie con le fonti"];
    var ul = "<ul>" + temi.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
    var f = document.createElement("div");
    f.className = "kit-fascia"; f.setAttribute("aria-label", "I temi del canale");
    f.innerHTML = '<div class="kit-fascia-tr">' + ul + ul.replace("<ul>", '<ul aria-hidden="true">') + "</div>";
    apertura.after(f);
  }

  // Comparsa dal basso
  if (reduce || !("IntersectionObserver" in window)) return;
  var sel = "main section.blocco > *, .lista > li, .video, .pl-hud li, .card, .scheda, article .corpo > *";
  var tutti = [].slice.call(document.querySelectorAll(sel));
  var alto = window.innerHeight;
  var oss = new IntersectionObserver(function (voci) {
    voci.forEach(function (v) {
      if (v.isIntersecting) { v.target.classList.add("kit-dentro"); oss.unobserve(v.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  tutti.forEach(function (el) {
    // Quello già in vista all'apertura non si nasconde
    if (el.getBoundingClientRect().top < alto * 0.9) return;
    var fratelli = el.parentElement ? [].indexOf.call(el.parentElement.children, el) : 0;
    el.style.setProperty("--rit", Math.min(fratelli, 5) * 0.07 + "s");
    el.classList.add("kit-entra");
    oss.observe(el);
  });

  // Titoli delle sezioni che salgono da sotto una tendina
  [].forEach.call(document.querySelectorAll(".testa h2, .mk-apertura h1, .art h1"), function (h) {
    if (h.getBoundingClientRect().top < alto * 0.9) return;
    h.classList.add("kit-tendina");
    var o = new IntersectionObserver(function (v) {
      if (v[0].isIntersecting) { h.classList.add("kit-su"); o.disconnect(); }
    }, { threshold: 0.3 });
    o.observe(h);
  });

  // Numeri che contano da 0 quando arrivano nello schermo.
  // Prende i numeri grandi (es. 12.249, 402,5K, 91%, 80%+) anche se arrivano dopo, scritti da app.js.
  var NUM = /^([^\d]{0,2})(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?\s?(K|M|mila|%\+?|\+)?$/;
  var fatti = new WeakSet();
  var ossN = new IntersectionObserver(function (voci) {
    voci.forEach(function (v) {
      if (!v.isIntersecting) return;
      ossN.unobserve(v.target); conta(v.target);
    });
  }, { threshold: 0.4 });
  function conta(el) {
    var testo = el.textContent.trim(), m = testo.match(NUM);
    if (!m) return;
    var intero = +m[2].replace(/\./g, ""), dec = m[3] ? m[3].length : 0;
    var fine = intero + (dec ? +m[3] / Math.pow(10, dec) : 0);
    if (fine < 2 || (/^(19|20)\d\d$/.test(testo))) return; // gli anni restano fermi
    var fmt = new Intl.NumberFormat("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: m[2].indexOf(".") > -1 });
    var t0 = null, dur = 1400;
    el.style.minWidth = el.getBoundingClientRect().width + "px";
    (function passo(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = p < 1 ? m[1] + fmt.format(fine * e) + (m[4] || "") : testo;
      if (p < 1) requestAnimationFrame(passo); else el.style.minWidth = "";
    })(performance.now());
  }
  function cercaNumeri(radice) {
    [].forEach.call((radice || document).querySelectorAll(".mk-v, [data-conta], main strong, main b, main .num, main .numero, main .valore"), function (el) {
      if (fatti.has(el) || el.children.length) return;
      if (!NUM.test(el.textContent.trim())) return;
      if (parseFloat(getComputedStyle(el).fontSize) < 26 && !el.hasAttribute("data-conta") && !el.classList.contains("mk-v")) return;
      if (el.closest(".pl-hud")) return; // la rete li fa già contare
      fatti.add(el); ossN.observe(el);
    });
  }
  cercaNumeri();
  var attesa = 0;
  new MutationObserver(function () {
    if (attesa) return;
    attesa = setTimeout(function () { attesa = 0; cercaNumeri(); }, 200);
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });

  // Luce che segue il mouse sulle schede (solo con mouse)
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("pointermove", function (ev) {
      var c = ev.target.closest && ev.target.closest(".mk-num:not(.mk-tot), .duello, .gioco, .app, .nl, .offerte-box, .kit-luce-ok");
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.classList.add("kit-luce");
      c.style.setProperty("--mx", ((ev.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      c.style.setProperty("--my", ((ev.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });
  }
})();
