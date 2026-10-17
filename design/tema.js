// Interruttore tra il sito di giorno (design/sito.css) e quello di notte
// (style.css da solo). L'attributo lo mette gia' uno script in testa alla
// pagina, prima del disegno, cosi' non si vede il lampo; qui c'e' solo il
// bottone. La scelta resta nel browser di chi visita (se il browser lo
// permette): nessun dato arriva al sito.
(function () {
  "use strict";
  var html = document.documentElement;
  var barra = document.querySelector(".top .wrap");
  if (!barra) return;
  var SOLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  var LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>';
  var b = document.createElement("button");
  b.type = "button";
  b.className = "tema-btn";
  function aggiorna() {
    var chiaro = html.getAttribute("data-tema") === "chiaro";
    b.innerHTML = chiaro ? LUNA : SOLE;
    b.setAttribute("aria-label", chiaro ? "Passa al tema scuro" : "Passa al tema chiaro");
    b.title = b.getAttribute("aria-label");
  }
  b.addEventListener("click", function () {
    var nuovo = html.getAttribute("data-tema") === "chiaro" ? "scuro" : "chiaro";
    if (nuovo === "chiaro") html.setAttribute("data-tema", "chiaro");
    else html.removeAttribute("data-tema");
    try { localStorage.setItem("tema", nuovo); } catch (e) { /* browser senza memoria: vale solo per questa visita */ }
    aggiorna();
  });
  aggiorna();
  barra.appendChild(b);
})();
