// POST /api/visite  {p: "/percorso"}  -> conta una visita (anonima, senza cookie)
// GET  /api/visite  (header x-admin-password) -> statistiche per l'admin
const crypto = require("crypto");
const { db, hashIp, leggiCorpo } = require("./_lib");

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor|curl|wget|python|node-fetch/i;
const giorno = (d) => d.toISOString().slice(0, 10);
const ultimi = (n) => Array.from({ length: n }, (_, i) => giorno(new Date(Date.now() - i * 86400000)));
const DUE_ANNI = String(400 * 86400);

function adminOk(req) {
  const atteso = process.env.ADMIN_PASSWORD || "";
  const dato = String(req.headers["x-admin-password"] || "");
  return atteso.length >= 8 && dato.length === atteso.length && crypto.timingSafeEqual(Buffer.from(dato), Buffer.from(atteso));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      const ua = String(req.headers["user-agent"] || "");
      if (!ua || BOT.test(ua)) return res.status(204).end();
      const b = await leggiCorpo(req);
      let p = String(b.p || "/").split("?")[0].split("#")[0].slice(0, 120);
      if (!/^\/[A-Za-z0-9\-_\/.]*$/.test(p)) p = "/";
      p = p.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";
      if (p.startsWith("/admin")) return res.status(204).end();
      const g = giorno(new Date());
      // Visitatore unico del giorno: hash anonimo di IP + browser, mai salvato in chiaro
      const ip = hashIp(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "");
      const id = crypto.createHash("sha256").update(ip + ua + g).digest("hex").slice(0, 16);
      await db(["INCR", "vis:" + g], ["PFADD", "vu:" + g, id], ["HINCRBY", "pag:" + g, p, "1"],
        ["EXPIRE", "vis:" + g, DUE_ANNI], ["EXPIRE", "vu:" + g, DUE_ANNI], ["EXPIRE", "pag:" + g, DUE_ANNI]);
      return res.status(204).end();
    }
    if (req.method === "GET") {
      if (!adminOk(req)) return res.status(401).json({ errore: "Password errata" });
      const giorni = ultimi(30);
      const r = await db(...giorni.map((g) => ["GET", "vis:" + g]), ...giorni.map((g) => ["PFCOUNT", "vu:" + g]), ...giorni.slice(0, 7).map((g) => ["HGETALL", "pag:" + g]));
      const vis = r.slice(0, 30).map((x) => +x || 0);
      const uni = r.slice(30, 60).map((x) => +x || 0);
      const pag = {};
      r.slice(60).forEach((h) => { if (Array.isArray(h)) for (let i = 0; i < h.length; i += 2) pag[h[i]] = (pag[h[i]] || 0) + (+h[i + 1] || 0); });
      const top = Object.entries(pag).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, n]) => ({ p, n }));
      return res.status(200).json({ giorni, visite: vis, unici: uni, top });
    }
    res.status(405).json({ errore: "Metodo non consentito" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ errore: "Statistiche non disponibili" });
  }
};
