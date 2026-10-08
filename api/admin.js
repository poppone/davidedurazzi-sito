// POST /api/admin  (header x-admin-password) — moderazione commenti e risposte
const crypto = require("crypto");
const { db, leggiCommento, salvaCommento, gemini, leggiCorpo } = require("./_lib");
const { leggiJson, aggiornaJson } = require("./_github");

function autorizzato(req) {
  const atteso = process.env.ADMIN_PASSWORD || "";
  const dato = String(req.headers["x-admin-password"] || "");
  if (atteso.length < 8 || dato.length !== atteso.length) return false;
  return crypto.timingSafeEqual(Buffer.from(dato), Buffer.from(atteso));
}

async function contesto(req, slug) {
  const base = "https://" + req.headers.host;
  const [articoli, cfg] = await Promise.all([
    fetch(base + "/content/articoli.json", { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => []),
    fetch(base + "/config.js", { signal: AbortSignal.timeout(5000) }).then((r) => r.text()).catch(() => "")
  ]);
  const a = articoli.find((x) => x.slug === slug) || {};
  const campo = (k) => ((cfg.match(new RegExp(k + ':\\s*"([^"]*)"')) || [])[1] || "");
  return {
    articolo: a,
    orari: campo("orariLive"),
    twitch: campo("twitch"),
    youtube: campo("youtubeUrl"),
    modulo: campo("modulTemi"),
    email: campo("email")
  };
}

const SISTEMA = `Lavori per il sito davidedurazzi.it di Davide Durazzi (attualità, dirette su Twitch, Il Contraddittorio).
Ricevi un commento di un lettore e devi classificarlo e preparare una risposta. Rispondi SOLO con JSON:
{"tipo":"pratica"|"discussione"|"ignora","risposta":"..."}

- "pratica": domanda di servizio a cui si risponde SOLO con le informazioni fornite (fonti dell'articolo, orari e canali delle dirette, come proporre un tema, cosa dice l'articolo).
  Scrivi una risposta breve (1-3 frasi), cortese e precisa. Sarà pubblicata automaticamente e firmata "Redazione AI":
  non fingere di essere Davide, non esprimere opinioni, non inventare nulla. Se l'informazione non c'è, il tipo è "discussione".
- "discussione": opinioni, critiche, dibattito, esperienze personali, domande su cosa pensa Davide, tutto il resto.
  Scrivi una BOZZA che Davide leggerà e correggerà prima di pubblicarla col suo nome: prima persona, italiano diretto e informale ma rispettoso,
  2-4 frasi, riconosci il punto del lettore, puoi rilanciare con una domanda o invitarlo in diretta. Mai fatti inventati,
  mai schierarti con partiti o candidati, mai attacchi personali.
- "ignora": insulti, spam, messaggi senza contenuto. "risposta" vuota.`;

async function agente(req, c) {
  const ctx = await contesto(req, c.slug);
  const a = ctx.articolo;
  const info = [
    "ARTICOLO: " + (a.titolo || "sconosciuto"),
    a.sommario ? "SOMMARIO: " + a.sommario : "",
    a.domanda ? "DOMANDA DEL CONTRADDITTORIO: " + a.domanda : "",
    (a.fonti || []).length ? "FONTI: " + a.fonti.map((f) => f.nome + " (" + f.url + ")").join("; ") : "",
    ctx.orari ? "DIRETTE: " + ctx.orari + " su twitch.tv/" + ctx.twitch : "",
    ctx.youtube ? "YOUTUBE: " + ctx.youtube : "",
    "PROPORRE UN TEMA: " + (ctx.modulo || (ctx.email ? "scrivere a " + ctx.email : "sezione Piazza Aperta del sito"))
  ].filter(Boolean).join("\n");
  return gemini(SISTEMA, info + "\n\nCOMMENTO DI " + c.nome + ":\n" + c.testo);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ errore: "Metodo non consentito" });
  if (!autorizzato(req)) return res.status(401).json({ errore: "Password errata" });
  try {
    const b = await leggiCorpo(req);
    const id = String(b.id || "");

    if (b.azione === "elenco") {
      const [attesa, bozze] = await db(["LRANGE", "attesa", "0", "99"], ["LRANGE", "bozze", "0", "99"]);
      // Commenti pubblicati: cerco tutte le liste art:* (sito piccolo, poche chiavi)
      let cursore = "0", chiavi = [];
      for (let giro = 0; giro < 10; giro++) {
        const [res] = await db(["SCAN", cursore, "MATCH", "art:*", "COUNT", "200"]);
        cursore = String(res[0]); chiavi = chiavi.concat(res[1]);
        if (cursore === "0") break;
      }
      const liste = chiavi.length ? await db(...chiavi.map((k) => ["LRANGE", k, "-30", "-1"])) : [];
      const pubblicati = liste.flat();
      const tutti = [...new Set([...(attesa || []), ...(bozze || []), ...pubblicati])];
      const valori = tutti.length ? await db(...tutti.map((x) => ["GET", "c:" + x])) : [];
      const commenti = valori.filter(Boolean).map((v) => JSON.parse(v));
      return res.status(200).json({
        attesa: commenti.filter((c) => c.stato === "attesa"),
        bozze: commenti.filter((c) => c.stato === "approvato" && c.bozza),
        pubblicati: commenti.filter((c) => c.stato === "approvato" && !c.bozza)
          .sort((x, y) => (y.data || "").localeCompare(x.data || "")).slice(0, 40)
      });
    }

    if (b.azione === "iscritti") {
      const [lista] = await db(["SMEMBERS", "iscritti"]);
      return res.status(200).json({ iscritti: (lista || []).sort() });
    }

    // ---- Articoli e bozze (via GitHub: ogni modifica fa partire i workflow del sito) ----
    const slug = String(b.slug || "");
    const riassunto = (a) => ({ slug: a.slug, titolo: a.titolo, sezione: a.sezione, data: a.data, sommario: a.sommario, pubblicato: !!a.pubblicato });

    if (b.azione === "contenuti") {
      const [art, boz] = await Promise.all([leggiJson("content/articoli.json"), leggiJson("bozze/bozze.json")]);
      return res.status(200).json({
        articoli: art.dati.map(riassunto).sort((x, y) => (y.data || "").localeCompare(x.data || "")),
        bozze: boz.dati.filter((x) => !x.scartare && !x.approvato).map((x) => Object.assign(riassunto(x), { nota: x.nota_critico || "", domanda: x.domanda || "" })),
        inCoda: boz.dati.filter((x) => x.approvato).map((x) => x.titolo)
      });
    }

    if (b.azione === "togli_articolo" || b.azione === "ripubblica_articolo") {
      const su = b.azione === "ripubblica_articolo";
      let trovato = false;
      await aggiornaJson("content/articoli.json", (su ? "Ripubblica" : "Togli dal sito") + ": " + slug, (lista) => {
        const a = lista.find((x) => x.slug === slug);
        if (!a) return null;
        trovato = true;
        if (!!a.pubblicato === su) return null;
        a.pubblicato = su;
        return lista;
      });
      if (!trovato) return res.status(404).json({ errore: "Articolo non trovato" });
      return res.status(200).json({ ok: true, esito: su ? "ripubblicato (online tra un minuto)" : "tolto dal sito (sparisce tra un minuto)" });
    }

    if (b.azione === "approva_bozza" || b.azione === "scarta_bozza_articolo") {
      const approva = b.azione === "approva_bozza";
      let trovato = false;
      await aggiornaJson("bozze/bozze.json", (approva ? "Approva bozza: " : "Scarta bozza: ") + slug, (lista) => {
        const x = lista.find((y) => y.slug === slug);
        if (!x) return null;
        trovato = true;
        if (approva) x.approvato = true; else x.scartare = true;
        return lista;
      });
      if (!trovato) return res.status(404).json({ errore: "Bozza non trovata" });
      return res.status(200).json({ ok: true, esito: approva ? "approvata: sito e Instagram partono in automatico (qualche minuto)" : "bozza scartata" });
    }

    const c = await leggiCommento(id);
    if (!c) return res.status(404).json({ errore: "Commento non trovato" });

    if (b.azione === "approva") {
      c.stato = "approvato";
      await salvaCommento(c);
      await db(["LREM", "attesa", "0", id], ["RPUSH", "art:" + c.slug, id]);
      const miaRisposta = String(b.testo || "").trim();
      if (miaRisposta) {
        // Davide risponde di persona: niente agente
        c.risposta = { testo: miaRisposta.slice(0, 2000), autore: "Davide Durazzi", ai: false, data: new Date().toISOString() };
        await salvaCommento(c);
        return res.status(200).json({ ok: true, esito: "approvato con la tua risposta" });
      }
      let esito = "approvato";
      try {
        const r = await agente(req, c);
        if (r.tipo === "pratica" && r.risposta) {
          c.risposta = { testo: r.risposta, autore: "Redazione AI", ai: true, data: new Date().toISOString() };
          esito = "risposta automatica pubblicata";
        } else if (r.tipo === "discussione" && r.risposta) {
          c.bozza = r.risposta;
          await db(["LPUSH", "bozze", id]);
          esito = "bozza di risposta pronta";
        }
        await salvaCommento(c);
      } catch (e) {
        console.error(e);
        esito = "approvato, ma l'agente non ha risposto (" + e.message + ")";
      }
      return res.status(200).json({ ok: true, esito });
    }

    if (b.azione === "rispondi") {
      const testo = String(b.testo || "").trim();
      if (testo.length < 2 || testo.length > 2000) return res.status(400).json({ errore: "Risposta non valida" });
      c.risposta = { testo, autore: "Davide Durazzi", ai: false, data: new Date().toISOString() };
      delete c.bozza;
      await salvaCommento(c);
      await db(["LREM", "bozze", "0", id]);
      return res.status(200).json({ ok: true, esito: "risposta pubblicata" });
    }

    if (b.azione === "togli_risposta") {
      delete c.risposta;
      await salvaCommento(c);
      return res.status(200).json({ ok: true, esito: "risposta tolta" });
    }

    if (b.azione === "scarta_bozza") {
      delete c.bozza;
      await salvaCommento(c);
      await db(["LREM", "bozze", "0", id]);
      return res.status(200).json({ ok: true, esito: "bozza scartata" });
    }

    if (b.azione === "elimina") {
      await db(["LREM", "attesa", "0", id], ["LREM", "bozze", "0", id], ["LREM", "art:" + c.slug, "0", id], ["DEL", "c:" + id]);
      return res.status(200).json({ ok: true, esito: "eliminato" });
    }

    res.status(400).json({ errore: "Azione sconosciuta" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ errore: "Errore del server: " + e.message });
  }
};
