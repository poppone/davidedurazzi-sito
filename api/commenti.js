// GET  /api/commenti?slug=...  -> commenti approvati dell'articolo
// POST /api/commenti           -> nuovo commento (va in moderazione)
const { db, salvaCommento, nuovoId, hashIp, pubblico, leggiCorpo } = require("./_lib");

const SLUG = /^[a-z0-9-]{3,100}$/;

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const slug = String((req.query && req.query.slug) || "");
      if (!SLUG.test(slug)) return res.status(400).json({ errore: "Articolo non valido" });
      const [ids] = await db(["LRANGE", "art:" + slug, "0", "199"]);
      if (!ids || !ids.length) return res.status(200).json({ commenti: [] });
      const valori = await db(...ids.map((id) => ["GET", "c:" + id]));
      const commenti = valori.filter(Boolean).map((v) => pubblico(JSON.parse(v)));
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
      return res.status(200).json({ commenti });
    }

    if (req.method === "POST") {
      const b = await leggiCorpo(req);
      // Trappola per bot: campo nascosto che un umano non compila, e invio troppo rapido
      if (b.sito || (Number(b.t) && Date.now() - Number(b.t) < 4000)) return res.status(200).json({ ok: true });
      const slug = String(b.slug || "");
      const nome = String(b.nome || "").trim().replace(/\s+/g, " ");
      const testo = String(b.testo || "").trim();
      if (!SLUG.test(slug)) return res.status(400).json({ errore: "Articolo non valido" });
      if (nome.length < 2 || nome.length > 40) return res.status(400).json({ errore: "Il nome deve avere tra 2 e 40 caratteri" });
      if (testo.length < 3 || testo.length > 1500) return res.status(400).json({ errore: "Il commento deve avere tra 3 e 1500 caratteri" });
      if ((testo.match(/https?:\/\//g) || []).length > 2) return res.status(400).json({ errore: "Troppi link nel commento" });

      // Limite: 1 commento ogni 30 secondi e 15 al giorno per persona (IP anonimizzato)
      const ip = hashIp(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "");
      const [recente, giorno] = await db(["SET", "rl:" + ip, "1", "EX", "30", "NX"], ["INCR", "rd:" + ip], ["EXPIRE", "rd:" + ip, "86400"]);
      if (recente === null) return res.status(429).json({ errore: "Aspetta qualche secondo prima di commentare di nuovo" });
      if (giorno > 15) return res.status(429).json({ errore: "Hai raggiunto il limite di commenti per oggi" });

      const c = { id: nuovoId(), slug, nome, testo, data: new Date().toISOString(), stato: "attesa" };
      await salvaCommento(c);
      await db(["LPUSH", "attesa", c.id]);
      return res.status(200).json({ ok: true, messaggio: "Grazie! Il commento sarà visibile dopo l'approvazione." });
    }

    res.status(405).json({ errore: "Metodo non consentito" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ errore: "Servizio commenti momentaneamente non disponibile" });
  }
};
