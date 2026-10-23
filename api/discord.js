// Comando /finch su Discord. Discord chiama questo indirizzo (Interactions Endpoint URL):
// verifichiamo la firma con DISCORD_PUBLIC_KEY, rispondiamo "sto pensando" e poi
// completiamo la risposta. Le risposte sono sempre dichiarate AI.
const crypto = require("crypto");
const { gemini } = require("./_lib");
const FAQ = require("../agenti/chat_faq.json");
const FINCH = require("../agenti/finch_discord.json");

const DER_ED25519 = Buffer.from("302a300506032b6570032100", "hex");
// Chiave PUBBLICA dell'app Discord "Finch" (non è un segreto: serve solo a verificare le firme)
const CHIAVE_PUBBLICA = process.env.DISCORD_PUBLIC_KEY || "c0d6b672b587fe204ab86a1f4ae0bf0e2a8e7f8ae5467ac46f7ab035814932ac";

async function corpoGrezzo(req) {
  const pezzi = [];
  for await (const p of req) pezzi.push(typeof p === "string" ? Buffer.from(p) : p);
  return Buffer.concat(pezzi).toString("utf8");
}

function firmaValida(req, corpo) {
  const chiave = CHIAVE_PUBBLICA;
  const firma = req.headers["x-signature-ed25519"];
  const ora = req.headers["x-signature-timestamp"];
  if (!chiave || !firma || !ora) return false;
  try {
    const k = crypto.createPublicKey({
      key: Buffer.concat([DER_ED25519, Buffer.from(chiave.trim(), "hex")]), format: "der", type: "spki"
    });
    return crypto.verify(null, Buffer.from(ora + corpo), k, Buffer.from(firma, "hex"));
  } catch (e) { return false; }
}

function normalizza(t) {
  return t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

function rispostaFaq(domanda) {
  const t = normalizza(domanda);
  const voce = FAQ.voci.find((v) => v.chiavi.some((k) => t.includes(normalizza(k))));
  return voce ? voce.risposta.replace("qui su Twitch", "su twitch.tv/DavideDurazzi") : null;
}

async function rispondi(domanda) {
  const fatti = FAQ.voci.map((v) => "- " + v.risposta).concat(FINCH.fatti.map((f) => "- " + f)).join("\n");
  let testo = null;
  try {
    const r = await gemini(FINCH.sistema + "\n\nFATTI:\n" + fatti, "MESSAGGIO: " + domanda);
    if (r && r.risposta) testo = String(r.risposta).slice(0, 1500);
  } catch (e) { /* si ripiega sulle risposte pronte */ }
  testo = testo || rispostaFaq(domanda) || FINCH.non_so;
  return "> " + domanda.replace(/\s+/g, " ") + "\n" + FINCH.prefisso + testo;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const corpo = await corpoGrezzo(req);
  if (!firmaValida(req, corpo)) return res.status(401).send("firma non valida");
  const i = JSON.parse(corpo);

  if (i.type === 1) return res.json({ type: 1 }); // controllo di Discord

  if (i.type === 2 && i.data && i.data.name === "finch") {
    const domanda = String(((i.data.options || [])[0] || {}).value || "").slice(0, 500);
    const url = "https://discord.com/api/v10/webhooks/" + i.application_id + "/" + i.token + "/messages/@original";
    const lavoro = rispondi(domanda)
      .then((content) => fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
      }))
      .catch(() => {});
    const contesto = globalThis[Symbol.for("@vercel/request-context")];
    const waitUntil = contesto && contesto.get && contesto.get().waitUntil;
    res.json({ type: 5 }); // "Finch sta pensando..."
    if (waitUntil) waitUntil(lavoro); else await lavoro;
    return;
  }

  res.json({ type: 4, data: { content: "Comando non riconosciuto.", flags: 64 } });
};
