/* Menu del telefono: sotto i 760px le sezioni dell'header stanno in un pannello che si apre col tasto "Menu". */
(function () {
  var header = document.querySelector("header.top");
  var nav = header && header.querySelector("nav");
  if (!nav) return;
  if (!nav.id) nav.id = "menuSezioni";
  var tasto = document.createElement("button");
  tasto.type = "button";
  tasto.className = "tasto-menu";
  tasto.setAttribute("aria-controls", nav.id);
  tasto.setAttribute("aria-expanded", "false");
  tasto.innerHTML = '<span class="righe" aria-hidden="true"></span><span class="testo">Menu</span>';
  header.querySelector(".wrap").appendChild(tasto);
  header.classList.add("ha-menu");

  function chiudi() {
    header.classList.remove("menu-aperto");
    tasto.setAttribute("aria-expanded", "false");
    tasto.querySelector(".testo").textContent = "Menu";
  }
  tasto.addEventListener("click", function () {
    var aperto = header.classList.toggle("menu-aperto");
    tasto.setAttribute("aria-expanded", aperto ? "true" : "false");
    tasto.querySelector(".testo").textContent = aperto ? "Chiudi" : "Menu";
  });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) chiudi(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") chiudi(); });
  document.addEventListener("click", function (e) { if (!header.contains(e.target)) chiudi(); });
  matchMedia("(min-width:760px)").addEventListener("change", function (m) { if (m.matches) chiudi(); });

  // Segna la pagina in cui ci si trova
  var qui = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
  nav.querySelectorAll("a").forEach(function (a) {
    var dove = a.getAttribute("href").split("#")[0].replace(/\.html$/, "");
    if (dove && dove !== "/" && dove === qui) a.setAttribute("aria-current", "page");
  });
})();
