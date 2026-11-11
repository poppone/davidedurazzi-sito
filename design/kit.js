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
})();
