// GET /api/mediakit -> numeri aggregati e pubblici per la pagina /media-kit
// Solo totali: nessun dato personale (niente email, niente pagine per visitatore).
const { db } = require("./_lib");

const giorno = (d) => d.toISOString().slice(0, 10);
const ultimi = (n) => Array.from({ length: n }, (_, i) => giorno(new Date(Date.now() - (i + 1) * 86400000)));

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ errore: "Metodo non consentito" });
  // I numeri cambiano lentamente: una copia in cache per un'ora basta
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  try {
    const giorni = ultimi(30); // 30 giorni completi, oggi escluso
    const r = await db(
      ...giorni.map((g) => ["GET", "vis:" + g]),
      ...giorni.map((g) => ["PFCOUNT", "vu:" + g]),
      ["SCARD", "iscritti"],
      ["SCARD", "utenti"]
    );
    const visite = r.slice(0, 30).reduce((s, x) => s + (+x || 0), 0);
    const unici = r.slice(30, 60).map((x) => +x || 0);
    const giorniConDati = unici.filter((x) => x > 0).length;
    const mediaUnici = giorniConDati ? Math.round(unici.reduce((s, x) => s + x, 0) / giorniConDati) : 0;
    return res.status(200).json({
      periodo: { da: giorni[29], a: giorni[0], giorniConDati },
      visite30: visite,
      unici_media_giorno: mediaUnici,
      newsletter: +r[60] || 0,
      piazza: +r[61] || 0
    });
  } catch (e) {
    console.error(e);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ errore: "Statistiche non disponibili" });
  }
};
