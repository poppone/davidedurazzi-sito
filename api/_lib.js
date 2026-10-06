// Funzioni condivise (i file che iniziano con _ non diventano endpoint su Vercel)
const crypto = require("crypto");

const DB_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const DB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// Esegue comandi Redis via REST (Upstash). Accetta più comandi in un colpo solo.
async function db(...comandi) {
  if (!DB_URL || !DB_TOKEN) throw new Error("Database non configurato");
  const r = await fetch(DB_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + DB_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(comandi)
  });
  if (!r.ok) throw new Error("Database: HTTP " + r.status);
  const out = await r.json();
  return out.map((x) => x.result);
}

async function leggiCommento(id) {
  const [v] = await db(["GET", "c:" + id]);
  return v ? JSON.parse(v) : null;
}
async function salvaCommento(c) {
  await db(["SET", "c:" + c.id, JSON.stringify(c)]);
}

function nuovoId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
}
function hashIp(ip) {
  return crypto.createHash("sha256").update(String(ip) + (process.env.ADMIN_PASSWORD || "")).digest("hex").slice(0, 16);
}

// Versione pubblica di un commento: solo i campi che i lettori possono vedere
function pubblico(c) {
  return {
    id: c.id, nome: c.nome, testo: c.testo, data: c.data,
    risposta: c.risposta ? { testo: c.risposta.testo, autore: c.risposta.autore, ai: !!c.risposta.ai, data: c.risposta.data } : null
  };
}

// Gemini: risposta JSON, con modelli di riserva se il primo è occupato
async function gemini(sistema, richiesta) {
  const chiave = process.env.GEMINI_API_KEY;
  if (!chiave) throw new Error("Manca GEMINI_API_KEY");
  const modelli = [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"];
  let errore = "";
  const scadenza = Date.now() + 40000; // tempo totale massimo per l'agente
  for (const m of modelli) {
    const resto = scadenza - Date.now();
    if (resto < 4000) { errore += " | tempo esaurito"; break; }
    let r;
    try {
      r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
      signal: AbortSignal.timeout(Math.min(18000, resto)),
      method: "POST",
      headers: { "x-goog-api-key": chiave, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: richiesta }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.5 }
      })
    });
    } catch (e) { errore = m + ": " + (e.name === "TimeoutError" ? "nessuna risposta in tempo" : e.message); continue; }
    if (!r.ok) { errore = m + ": HTTP " + r.status; continue; }
    const j = await r.json();
    const parti = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const testo = parti.filter((p) => !p.thought).map((p) => p.text || "").join("").trim()
      .replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    try { return JSON.parse(testo); } catch (e) { errore = m + ": JSON non valido"; }
  }
  throw new Error("Gemini non disponibile (" + errore + ")");
}

async function leggiCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

module.exports = { db, leggiCommento, salvaCommento, nuovoId, hashIp, pubblico, gemini, leggiCorpo };
