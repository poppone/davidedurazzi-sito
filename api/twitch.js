// Funzione serverless Vercel: ultima diretta salvata (VOD) del canale Twitch.
// Usa l'API ufficiale Helix con le chiavi gratuite di un'app Twitch
// (env TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET, da dev.twitch.tv/console).
// Senza chiavi risponde { video: null } e sul sito resta la locandina.
const ID = process.env.TWITCH_CLIENT_ID || "";
const SEGRETO = process.env.TWITCH_CLIENT_SECRET || "";
let gettone = null, scade = 0;

async function token() {
  if (gettone && Date.now() < scade) return gettone;
  const r = await fetch("https://id.twitch.tv/oauth2/token?client_id=" + encodeURIComponent(ID) +
    "&client_secret=" + encodeURIComponent(SEGRETO) + "&grant_type=client_credentials", { method: "POST" });
  if (!r.ok) throw new Error("token " + r.status);
  const j = await r.json();
  gettone = j.access_token;
  scade = Date.now() + Math.max(60, (j.expires_in || 3600) - 300) * 1000;
  return gettone;
}

async function helix(percorso) {
  const r = await fetch("https://api.twitch.tv/helix/" + percorso, {
    headers: { "Client-Id": ID, Authorization: "Bearer " + (await token()) }
  });
  if (!r.ok) throw new Error("helix " + r.status);
  return (await r.json()).data || [];
}

module.exports = async (req, res) => {
  const canale = String((req.query && req.query.canale) || "").toLowerCase();
  if (!/^[a-z0-9_]{3,25}$/.test(canale)) {
    res.status(400).json({ error: "Canale Twitch non valido" });
    return;
  }
  if (!ID || !SEGRETO) {
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).json({ video: null, motivo: "mancano TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET su Vercel" });
    return;
  }
  try {
    const [utente] = await helix("users?login=" + canale);
    if (!utente) throw new Error("canale non trovato");
    const [v] = await helix("videos?user_id=" + utente.id + "&type=archive&first=1");
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json(v ? { video: { id: v.id, titolo: v.title, data: v.created_at, durata: v.duration } }
      : { video: null, motivo: "nessuna diretta salvata: su Twitch attiva \"Archivia le trasmissioni precedenti\"" });
  } catch (e) {
    res.status(502).json({ error: "Twitch non raggiungibile" });
  }
};
