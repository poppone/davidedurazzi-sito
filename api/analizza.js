// POST /api/analizza  {testo}  -> Il Contraddittorio per tutti
// Prende una notizia, un post o un messaggio e restituisce le due posizioni più forti.
// Il testo NON viene salvato: si tengono solo contatori anonimi per i limiti d'uso.
const { db, hashIp, gemini, leggiCorpo } = require("./_lib");

const MAX_CARATTERI = 4000;
const LIMITE_PERSONA = 8;    // analisi al giorno per visitatore
const LIMITE_TOTALE = 300;   // analisi al giorno in tutto, per restare nel piano gratuito

const SISTEMA = `Sei il motore del "Contraddittorio" di davidedurazzi.it. Ricevi un testo (una notizia, un post, un messaggio, una legge) e aiuti chi legge a ragionare con la propria testa.
Regole:
- Individua la questione su cui le persone possono essere in disaccordo e scrivila come una domanda secca, a cui si risponde Sì o No.
- Costruisci la posizione del Sì e quella del No nella loro versione più forte e onesta, senza caricature. Stesso spazio e stessa cura a tutte e due.
- Non inventare fatti, cifre, nomi o fonti. Usa solo quello che c'è nel testo o conoscenze generali e stabili. Non citare articoli o link.
- Elenca le affermazioni del testo che andrebbero verificate prima di farsi un'opinione, e dove si potrebbe controllarle (per esempio: "il sito dell'ente citato", "una testata nazionale").
- Se il testo sembra una truffa, una catena o un falso evidente, dillo nel campo "attenzione".
- Se il testo non contiene una questione discutibile (per esempio è una ricetta o un saluto), metti "valido": false e spiega perché in "attenzione".
- Se il testo incita all'odio o alla violenza contro qualcuno, non costruire la posizione a favore: metti "valido": false.
- Scrivi in italiano semplice, frasi brevi, niente gergo.
Rispondi SOLO con JSON:
{"valido":true,"domanda":"...?","tesi":{"titolo":"Sì, perché...","punti":["...","...","..."]},"antitesi":{"titolo":"No, perché...","punti":["...","...","..."]},"da_verificare":["..."],"attenzione":""}`;

const giorno = () => new Date().toISOString().slice(0, 10);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ errore: "Metodo non consentito" });
  try {
    const b = await leggiCorpo(req);
    if (b.sito) return res.status(200).json({ valido: false, attenzione: "" }); // trappola anti-bot
    const testo = String(b.testo || "").trim();
    if (testo.length < 40) return res.status(400).json({ errore: "Incolla un testo un po' più lungo: almeno un paio di frasi." });
    if (testo.length > MAX_CARATTERI) return res.status(400).json({ errore: "Il testo è troppo lungo: al massimo " + MAX_CARATTERI + " caratteri." });

    const g = giorno();
    const chi = hashIp(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "");
    const [persona, totale] = await db(
      ["INCR", "an:" + g + ":" + chi], ["INCR", "an:" + g],
      ["EXPIRE", "an:" + g + ":" + chi, "90000"], ["EXPIRE", "an:" + g, "90000"]
    );
    if (+persona > LIMITE_PERSONA) return res.status(429).json({ errore: "Hai usato tutte le analisi di oggi. Torna domani." });
    if (+totale > LIMITE_TOTALE) return res.status(429).json({ errore: "Oggi il Contraddittorio ha lavorato tantissimo e si è fermato. Riprova domani." });

    const r = await gemini(SISTEMA, "TESTO DA ANALIZZARE:\n" + testo);
    const lista = (x) => (Array.isArray(x) ? x.map((s) => String(s).slice(0, 400)).filter(Boolean).slice(0, 5) : []);
    const lato = (x) => ({ titolo: String((x && x.titolo) || "").slice(0, 160), punti: lista(x && x.punti) });
    return res.status(200).json({
      valido: r.valido !== false,
      domanda: String(r.domanda || "").slice(0, 240),
      tesi: lato(r.tesi),
      antitesi: lato(r.antitesi),
      da_verificare: lista(r.da_verificare),
      attenzione: String(r.attenzione || "").slice(0, 400)
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ errore: "Il Contraddittorio non risponde in questo momento. Riprova tra qualche minuto." });
  }
};
