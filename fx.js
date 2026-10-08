// Sfondo animato dell'hero: rete di punti blu/arancio che reagisce al mouse e al tocco.
(function () {
  "use strict";
  var c = document.getElementById("fx");
  if (!c || !c.getContext) return;
  var ctx = c.getContext("2d"), box = document.getElementById("stage");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, dpr = 1, pts = [], mouse = { x: -999, y: -999 }, run = true, raf = 0;
  var BLU = "123,151,255", ARA = "255,138,76";

  function init() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = box.getBoundingClientRect();
    W = r.width; H = r.height;
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(110, Math.max(36, (W * H) / 14000)));
    pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, a: Math.random() < .5 });
    }
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    var D = Math.min(150, W / 5), i, j, p, q, dx, dy, d, m;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      if (!reduce) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        dx = p.x - mouse.x; dy = p.y - mouse.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120 && d > 0) { p.x += dx / d * 1.4; p.y += dy / d * 1.4; }
      }
      for (j = i + 1; j < pts.length; j++) {
        q = pts[j]; dx = p.x - q.x; dy = p.y - q.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < D) {
          ctx.strokeStyle = "rgba(" + (p.a === q.a ? (p.a ? ARA : BLU) : "190,170,200") + "," + (1 - d / D) * .38 + ")";
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
      ctx.fillStyle = "rgba(" + (p.a ? ARA : BLU) + ",.9)";
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.283); ctx.fill();
    }
    if (run && !reduce) raf = requestAnimationFrame(frame);
  }
  function move(e) {
    var t = e.touches ? e.touches[0] : e, r = box.getBoundingClientRect();
    mouse.x = t.clientX - r.left; mouse.y = t.clientY - r.top;
  }
  box.addEventListener("pointermove", move);
  box.addEventListener("pointerleave", function () { mouse.x = mouse.y = -999; });
  var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(init, 200); });
  // Si ferma quando l'hero non è visibile (batteria)
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      var v = en[0].isIntersecting;
      if (v && !run) { run = true; frame(); }
      run = v; if (!v) cancelAnimationFrame(raf);
    }).observe(box);
  }
  init(); frame();
})();
