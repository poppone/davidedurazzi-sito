// POST /api/iscrizione {email, sito(honeypot), t} -> salva l'email nella newsletter
// Salva su Redis (set "iscritti"); se c'è BUTTONDOWN_API_KEY inoltra anche a Buttondown.
const { db, hashIp, leggiCorpo } = require("./_lib");

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ errore: "Metodo non consentito" });
  try {
    const b = await leggiCorpo(req);
    if (b.sito) return res.status(200).json({ messaggio: "Grazie!" }); // honeypot: finge di riuscire
    const email = String(b.email || "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) return res.status(400).json({ errore: "Email non valida" });
    if (Date.now() - Number(b.t || 0) < 1500) return res.status(429).json({ errore: "Troppo veloce, riprova." });
    const ip = hashIp(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "");
    const [primo, giorno] = await db(["SET", "rli:" + ip, "1", "EX", "10", "NX"], ["INCR", "rdi:" + ip], ["EXPIRE", "rdi:" + ip, "86400"]);
    if (!primo || giorno > 10) return res.status(429).json({ errore: "Troppi tentativi, riprova più tardi." });

    const [nuovo] = await db(["SADD", "iscritti", email]);
    if (nuovo) await db(["HSET", "iscritto:" + email, "data", new Date().toISOString()]);
    if (nuovo && process.env.BUTTONDOWN_API_KEY) {
      try {
        await fetch("https://api.buttondown.com/v1/subscribers", {
          method: "POST",
          headers: { Authorization: "Token " + process.env.BUTTONDOWN_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email_address: email }),
          signal: AbortSignal.timeout(8000)
        });
      } catch (e) { console.error("Buttondown", e.message); }
    }
    res.status(200).json({ messaggio: "Iscrizione fatta. Ti scrivo solo quando c'è qualcosa da dire." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ errore: "Iscrizione non riuscita. Riprova tra poco." });
  }
};
