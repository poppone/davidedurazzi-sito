// GET /api/voto?slug=...  -> {si,no}   |   POST {slug,scelta:"si"|"no"} -> conta un voto per persona (IP anonimizzato)
const { db, hashIp, leggiCorpo } = require("./_lib");

const SLUG = /^[a-z0-9-]{1,140}$/;
function conta(h) {
  const o = {};
  if (Array.isArray(h)) for (let i = 0; i < h.length; i += 2) o[h[i]] = h[i + 1];
  else Object.assign(o, h || {});
  return { si: parseInt(o.si || 0, 10) || 0, no: parseInt(o.no || 0, 10) || 0 };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const slug = String(req.query.slug || "");
      if (!SLUG.test(slug)) return res.status(400).json({ errore: "Slug non valido" });
      const [h] = await db(["HGETALL", "voti:" + slug]);
      return res.status(200).json(conta(h));
    }
    if (req.method !== "POST") return res.status(405).json({ errore: "Metodo non consentito" });
    const b = await leggiCorpo(req);
    const slug = String(b.slug || ""), scelta = b.scelta;
    if (!SLUG.test(slug) || (scelta !== "si" && scelta !== "no")) return res.status(400).json({ errore: "Voto non valido" });
    const ip = hashIp(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "");
    const [nuovo] = await db(["SADD", "votanti:" + slug, ip]);
    if (nuovo) await db(["HINCRBY", "voti:" + slug, scelta, "1"]);
    const [h] = await db(["HGETALL", "voti:" + slug]);
    return res.status(200).json(Object.assign(conta(h), { giaVotato: !nuovo }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ errore: "Servizio voti non disponibile" });
  }
};
