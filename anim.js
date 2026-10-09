// Animazioni livello medio: ticker notizie, contatori voto, scontro Sì/No, titolo che si compone.
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var home = document.body.dataset.page === "home";

  // Titolo che si compone (clip-path a gradini: non rompe gradiente e contorno)
  var h = document.getElementById("nome");
  if (h && !reduce) {
    [].forEach.call(h.children, function (s, i) {
      var n = s.textContent.length;
      s.style.setProperty("--n", n); s.style.setProperty("--d", (i * .55) + "s");
      s.classList.add("compone");
    });
  }

  // Ticker con le ultime notizie
  if (home) {
    fetch("/content/articoli.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (a) {
      a = a.filter(function (x) { return x.pubblicato === true; })
        .sort(function (x, y) { return (y.data || "").localeCompare(x.data || ""); }).slice(0, 8);
      if (!a.length) return;
      var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
      var voci = a.map(function (x) { return '<a href="/articoli/' + encodeURIComponent(x.slug) + '">' + esc(x.titolo) + "</a>"; }).join("");
      var t = document.createElement("div");
      t.className = "ticker"; t.setAttribute("aria-label", "Ultime notizie");
      t.innerHTML = '<span class="ticker-tag">Ultime</span><div class="ticker-vp"><div class="ticker-tr"><div>' + voci + "</div><div aria-hidden=\"true\">" + voci + "</div></div></div>";
      var top = document.querySelector("header.top");
      if (top) top.after(t);
      var dur = Math.max(30, a.length * 9);
      t.style.setProperty("--dur", dur + "s");
    }).catch(function () {});
  }

  // Contatori dei voti: i numeri salgono da 0
  window.ddConta = function (box) {
    if (reduce) return;
    [].forEach.call(box.querySelectorAll(".esv span"), function (sp) {
      var m = sp.textContent.match(/^(Sì |No )(\d+)%$/);
      if (!m) return;
      var fine = +m[2], t0 = null;
      (function passo(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3);
        sp.textContent = m[1] + Math.round(fine * e) + "%";
        if (p < 1) requestAnimationFrame(passo);
      })(performance.now());
    });
  };

  // Scontro Sì / No quando il duello entra nello schermo
  function arma(d) {
    if (d.dataset.arm) return; d.dataset.arm = "1";
    if (reduce || !("IntersectionObserver" in window)) return;
    d.classList.add("pre");
    var o = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { d.classList.remove("pre"); d.classList.add("scontro"); o.disconnect(); }
    }, { threshold: .25 });
    o.observe(d);
  }
  [].forEach.call(document.querySelectorAll(".duello"), arma);
  new MutationObserver(function (m) {
    m.forEach(function (x) {
      [].forEach.call(x.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        if (n.classList.contains("duello")) arma(n);
        else [].forEach.call(n.querySelectorAll ? n.querySelectorAll(".duello") : [], arma);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  // Alone che segue il mouse nell'hero
  var st = document.getElementById("stage");
  if (st && !reduce && matchMedia("(hover:hover)").matches) {
    st.addEventListener("pointermove", function (e) {
      var r = st.getBoundingClientRect();
      st.style.setProperty("--gx", (e.clientX - r.left) + "px"); st.style.setProperty("--gy", (e.clientY - r.top) + "px");
    });
  }
})();
