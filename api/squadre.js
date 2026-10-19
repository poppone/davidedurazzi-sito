// Cerca squadra: annunci per trovare compagni di gioco + affidabilità basata sulle presenze.
// Un solo endpoint: /api/squadre?a=<azione>. Usa lo stesso account della community (cookie dd_sess).
// Pubblico (GET): annunci, classifica, overlay, io, mie
// Con account (POST): profilo, crea, unisciti, lascia, annulla, conferma, segnala, elimina-profilo
// Admin (header x-admin-password): admin-elenco, admin-nascondi, admin-blocca
const { db, nuovoId, leggiCorpo } = require("./_lib");
const { utente, adminOk, limite } = require("./_sessione");

const GIOCHI = {
  fc: { nome: "EA FC (FIFA)", max: 10 },
  fortnite: { nome: "Fortnite", max: 3 },
  rocket: { nome: "Rocket League", max: 5 }
};
const PIATT = { ps: "PlayStation", xbox: "Xbox", pc: "PC", switch: "Switch", cross: "Crossplay" };
const LIVELLI = { tranquillo: "Tranquillo", medio: "Medio", competitivo: "Competitivo" };
const ID_TIPI = ["psn", "xbox", "epic", "ea", "steam", "nintendo"];
const ID_OK = /^[\p{L}\p{N} _.#\-]{2,32}$/u;

const MIN = 60000, ORA = 60 * MIN, GIORNO = 24 * ORA;
const VISIBILE_DOPO = 2 * ORA;      // l'annuncio resta in bacheca fino a 2 ore dopo l'inizio
const FINESTRA_CONFERMA = 48 * ORA; // dopo l'inizio, 48 ore per confermare chi c'era
const PREAVVISO = 60 * MIN;         // annullare o lasciare con meno di 1 ora di preavviso conta come assenza
const TTL = String(10 * 86400);

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
const err = (res, code, msg) => res.status(code).json({ errore: msg });

async function leggi(id) {
  if (!/^[a-z0-9]{8,24}$/.test(String(id || ""))) return null;
  const [v] = await db(["GET", "sq:a:" + id]);
  return v ? JSON.parse(v) : null;
}
const salva = (a) => db(["SET", "sq:a:" + a.id, JSON.stringify(a), "EX", TTL]);
const membri = (a) => [a.uid].concat(a.iscritti.map((i) => i.uid));

async function profili(uids) {
  const unici = [...new Set(uids)];
  if (!unici.length) return {};
  const v = await db(...unici.map((u) => ["GET", "sq:p:" + u]));
  const out = {};
  unici.forEach((u, i) => { out[u] = v[i] ? JSON.parse(v[i]) : null; });
  return out;
}
function aff(p) {
  const t = (p && p.tot) || 0, pr = (p && p.pres) || 0;
  const perc = t ? Math.round((pr / t) * 100) : null;
  return { pres: pr, tot: t, perc, badge: t >= 5 && perc >= 90 };
}
// Aggiorna le presenze di più persone in un colpo: esiti = { uid: true (c'era) | false (assente) }
async function registra(esiti) {
  const uids = Object.keys(esiti);
  if (!uids.length) return;
  const ps = await profili(uids);
  const cmd = [];
  uids.forEach((u) => {
    const p = ps[u];
    if (!p) return;
    p.tot = (p.tot || 0) + 1;
    if (esiti[u]) p.pres = (p.pres || 0) + 1;
    cmd.push(["SET", "sq:p:" + u, JSON.stringify(p)], ["SADD", "sq:valutati", u]);
  });
  if (cmd.length) await db(...cmd);
}

// Chiude una partita: per ogni giocatore conta la maggioranza delle conferme degli ALTRI,
// più un voto a proprio favore se ha confermato anche lui (chi non si presenta di solito non conferma).
// Parità o nessuna conferma: la partita non conta per quel giocatore (così un singolo non può punire nessuno).
async function chiudi(a) {
  if (a.stato !== "aperto") return;
  a.stato = "chiuso";
  const m = membri(a), rep = a.report || {}, esiti = {};
  if (m.length >= 2) {
    m.forEach((x) => {
      let si = rep[x] ? 1 : 0, no = 0;
      Object.keys(rep).forEach((r) => {
        if (r === x) return;
        if (rep[r].includes(x)) si++; else no++;
      });
      if (si > no) esiti[x] = true; else if (no > si) esiti[x] = false;
    });
  }
  a.esiti = esiti;
  await salva(a);
  await db(["ZREM", "sq:dafinire", a.id], ["ZREM", "sq:attivi", a.id]);
  await registra(esiti);
}
// Chiude in automatico le partite scadute (ne processa poche per richiesta)
async function chiudiScadute() {
  const [ids] = await db(["ZRANGEBYSCORE", "sq:dafinire", "-inf", String(Date.now()), "LIMIT", "0", "5"]);
  for (const id of ids || []) {
    const a = await leggi(id);
    if (a) await chiudi(a); else await db(["ZREM", "sq:dafinire", id]);
  }
}

function vistaPubblica(a, ps, uid) {
  const dentro = !!uid && membri(a).includes(uid);
  const v = {
    id: a.id, gioco: a.gioco, piatt: a.piatt, livello: a.livello, note: a.note, inizio: a.inizio,
    posti: a.posti, liberi: a.posti - a.iscritti.length, stato: a.stato,
    org: { nome: a.nome, aff: aff(ps[a.uid]) },
    iscritti: a.iscritti.map((i) => ({ nome: i.nome, aff: aff(ps[i.uid]) })),
    mio: uid === a.uid, dentro
  };
  // Gli ID di gioco li vede solo chi è nella squadra
  if (dentro) {
    v.squadra = membri(a).map((u) => ({
      uid: u === uid ? "io" : u,
      nome: u === a.uid ? a.nome : a.iscritti.find((i) => i.uid === u).nome,
      org: u === a.uid,
      ids: (ps[u] && ps[u].ids) || {}
    }));
    const ora = Date.now();
    v.puoiConfermare = a.stato === "aperto" && ora >= a.inizio && ora <= a.inizio + FINESTRA_CONFERMA && membri(a).length >= 2;
    v.confermato = !!(a.report && a.report[uid]);
  }
  if (a.esiti && uid && uid in a.esiti) v.mioEsito = a.esiti[uid];
  return v;
}

async function annunciAperti() {
  const ora = Date.now();
  await db(["ZREMRANGEBYSCORE", "sq:attivi", "-inf", String(ora - VISIBILE_DOPO)]);
  const [ids] = await db(["ZRANGEBYSCORE", "sq:attivi", String(ora - VISIBILE_DOPO), "+inf", "LIMIT", "0", "80"]);
  if (!ids || !ids.length) return [];
  const v = await db(...ids.map((id) => ["GET", "sq:a:" + id]));
  return v.filter(Boolean).map((x) => JSON.parse(x)).filter((a) => a.stato === "aperto");
}

async function classifica(n) {
  const [ids] = await db(["SMEMBERS", "sq:valutati"]);
  const ps = await profili(ids || []);
  return Object.values(ps).filter((p) => p && p.tot >= 3)
    .map((p) => ({ nome: p.nome, ...aff(p) }))
    .sort((x, y) => y.perc - x.perc || y.tot - x.tot)
    .slice(0, n);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const az = String((req.query && req.query.a) || "");
    const b = req.method === "POST" ? await leggiCorpo(req) : {};
    await chiudiScadute();

    // ---------- ADMIN ----------
    if (az.startsWith("admin-")) {
      if (!adminOk(req)) return err(res, 401, "Password errata");
      if (az === "admin-elenco") {
        const [ids] = await db(["ZRANGE", "sq:attivi", "0", "-1"]);
        const v = ids && ids.length ? await db(...ids.map((id) => ["GET", "sq:a:" + id])) : [];
        const annunci = v.filter(Boolean).map((x) => JSON.parse(x)).map((a) => ({
          id: a.id, uid: a.uid, nome: a.nome, gioco: GIOCHI[a.gioco].nome, piatt: PIATT[a.piatt], inizio: a.inizio,
          note: a.note, iscritti: a.iscritti.length, posti: a.posti, segn: a.segn || 0, nascosto: !!a.nascosto, stato: a.stato
        }));
        const [nGiocatori, nValutati, bloccati] = await db(["SCARD", "sq:giocatori"], ["SCARD", "sq:valutati"], ["SMEMBERS", "sq:bloccati"]);
        return res.json({ annunci, giocatori: nGiocatori, valutati: nValutati, bloccati: bloccati || [], classifica: await classifica(20) });
      }
      if (az === "admin-nascondi") {
        const a = await leggi(b.id);
        if (!a) return err(res, 404, "Annuncio non trovato");
        a.nascosto = !!b.nascondi;
        if (!a.nascosto) { a.segn = 0; await db(["DEL", "sq:sg:" + a.id]); }
        await salva(a);
        return res.json({ ok: true });
      }
      if (az === "admin-blocca") {
        const uid = String(b.uid || "");
        if (!/^[a-z0-9]{8,24}$/.test(uid)) return err(res, 400, "Utente non valido");
        await db(b.blocca ? ["SADD", "sq:bloccati", uid] : ["SREM", "sq:bloccati", uid]);
        return res.json({ ok: true });
      }
      return err(res, 400, "Azione sconosciuta");
    }

    // ---------- LETTURA PUBBLICA ----------
    if (az === "overlay") {
      res.setHeader("Cache-Control", "public, s-maxage=30");
      const ora = Date.now();
      const lista = (await annunciAperti()).filter((a) => !a.nascosto && a.inizio >= ora - 30 * MIN && a.inizio <= ora + 6 * ORA && a.iscritti.length < a.posti)
        .sort((x, y) => x.inizio - y.inizio).slice(0, 6)
        .map((a) => ({ gioco: GIOCHI[a.gioco].nome, piatt: PIATT[a.piatt], livello: LIVELLI[a.livello], inizio: a.inizio, liberi: a.posti - a.iscritti.length, nome: a.nome }));
      return res.json({ annunci: lista, classifica: await classifica(5) });
    }
    if (az === "classifica") return res.json({ classifica: await classifica(20) });

    const u = await utente(req);
    const uid = u ? u.id : null;

    if (az === "annunci") {
      const lista = (await annunciAperti()).filter((a) => !a.nascosto || a.uid === uid);
      const ps = await profili(lista.flatMap(membri));
      lista.sort((x, y) => x.inizio - y.inizio);
      return res.json({ annunci: lista.map((a) => vistaPubblica(a, ps, uid)), giochi: GIOCHI, piattaforme: PIATT, livelli: LIVELLI });
    }
    if (az === "io") {
      if (!u) return res.json({ utente: null });
      const [[p], [bl]] = await Promise.all([db(["GET", "sq:p:" + uid]), db(["SISMEMBER", "sq:bloccati", uid])]);
      const pr = p ? JSON.parse(p) : null;
      return res.json({ utente: { nome: u.nome }, profilo: pr ? { ids: pr.ids, eta: !!pr.eta, aff: aff(pr) } : null, bloccato: !!bl });
    }
    if (az === "mie") {
      if (!u) return err(res, 401, "Devi accedere per farlo");
      const ora = Date.now();
      await db(["ZREMRANGEBYSCORE", "sq:mie:" + uid, "-inf", String(ora - FINESTRA_CONFERMA - GIORNO)]);
      const [ids] = await db(["ZRANGEBYSCORE", "sq:mie:" + uid, String(ora - FINESTRA_CONFERMA - GIORNO), "+inf"]);
      const v = ids && ids.length ? await db(...ids.map((id) => ["GET", "sq:a:" + id])) : [];
      const lista = v.filter(Boolean).map((x) => JSON.parse(x)).filter((a) => a.stato !== "annullato" && membri(a).includes(uid));
      const ps = await profili(lista.flatMap(membri));
      lista.sort((x, y) => x.inizio - y.inizio);
      return res.json({ partite: lista.map((a) => vistaPubblica(a, ps, uid)) });
    }

    if (req.method !== "POST") return err(res, 405, "Metodo non consentito");
    if (!u) return err(res, 401, "Devi accedere per farlo");

    const [[pRaw], [bloccato]] = await Promise.all([db(["GET", "sq:p:" + uid]), db(["SISMEMBER", "sq:bloccati", uid])]);
    const prof = pRaw ? JSON.parse(pRaw) : null;

    // ---------- PROFILO GIOCATORE ----------
    if (az === "profilo") {
      if (!b.eta) return err(res, 400, "Per usare Cerca squadra devi avere almeno 16 anni");
      const ids = {};
      for (const t of ID_TIPI) {
        const v = norm((b.ids || {})[t]);
        if (!v) continue;
        if (!ID_OK.test(v)) return err(res, 400, "ID non valido: " + t.toUpperCase() + " (2-32 caratteri, senza simboli strani)");
        ids[t] = v;
      }
      if (!Object.keys(ids).length) return err(res, 400, "Inserisci almeno un ID di gioco");
      const p = prof || { pres: 0, tot: 0, creato: new Date().toISOString() };
      p.nome = u.nome; p.ids = ids; p.eta = true;
      await db(["SET", "sq:p:" + uid, JSON.stringify(p)], ["SADD", "sq:giocatori", uid]);
      return res.json({ ok: true, profilo: { ids, eta: true, aff: aff(p) } });
    }
    if (az === "elimina-profilo") {
      await db(["DEL", "sq:p:" + uid], ["SREM", "sq:giocatori", uid], ["SREM", "sq:valutati", uid], ["DEL", "sq:mie:" + uid]);
      return res.json({ ok: true });
    }

    if (bloccato) return err(res, 403, "Il tuo accesso a Cerca squadra è sospeso. Scrivi a info@davidedurazzi.it");
    const pronto = prof && prof.eta && prof.ids && Object.keys(prof.ids).length;

    // ---------- ANNUNCI ----------
    if (az === "crea") {
      if (!pronto) return err(res, 400, "Prima completa il tuo profilo giocatore");
      const gioco = String(b.gioco || ""), piatt = String(b.piatt || ""), livello = String(b.livello || "medio");
      if (!GIOCHI[gioco]) return err(res, 400, "Gioco non disponibile");
      if (!PIATT[piatt]) return err(res, 400, "Piattaforma non valida");
      if (!LIVELLI[livello]) return err(res, 400, "Livello non valido");
      const posti = parseInt(b.posti, 10);
      if (!(posti >= 1 && posti <= GIOCHI[gioco].max)) return err(res, 400, "Posti per " + GIOCHI[gioco].nome + ": da 1 a " + GIOCHI[gioco].max);
      const inizio = Date.parse(b.inizio), ora = Date.now();
      if (!inizio || inizio < ora - 5 * MIN || inizio > ora + 7 * GIORNO) return err(res, 400, "Scegli un orario tra adesso e i prossimi 7 giorni");
      const note = norm(b.note).slice(0, 140);
      if (/https?:\/\/|www\./i.test(note)) return err(res, 400, "Niente link nelle note");
      const miei = (await annunciAperti()).filter((a) => a.uid === uid && a.inizio > ora);
      if (miei.length >= 2) return err(res, 429, "Hai già 2 annunci aperti: aspetta che finiscano o annullane uno");
      if (!(await limite("sqc:" + uid, 5, 86400))) return err(res, 429, "Massimo 5 annunci al giorno");
      const a = { id: nuovoId(), uid, nome: u.nome, gioco, piatt, livello, posti, note, inizio, creato: new Date().toISOString(), iscritti: [], stato: "aperto", report: {}, segn: 0 };
      await salva(a);
      await db(["ZADD", "sq:attivi", String(inizio), a.id], ["ZADD", "sq:dafinire", String(inizio + FINESTRA_CONFERMA), a.id], ["ZADD", "sq:mie:" + uid, String(inizio), a.id]);
      return res.json({ ok: true, id: a.id });
    }

    const a = await leggi(b.id);
    if (!a) return err(res, 404, "Annuncio non trovato o scaduto");
    const ora = Date.now();

    if (az === "unisciti") {
      if (!pronto) return err(res, 400, "Prima completa il tuo profilo giocatore");
      if (a.stato !== "aperto" || a.nascosto) return err(res, 400, "Questo annuncio non è più disponibile");
      if (ora > a.inizio + 15 * MIN) return err(res, 400, "La partita è già iniziata");
      if (membri(a).includes(uid)) return err(res, 400, "Sei già in questa squadra");
      if (a.iscritti.length >= a.posti) return err(res, 400, "Squadra al completo");
      if (!(await limite("sqj:" + uid, 20, 3600))) return err(res, 429, "Troppe iscrizioni, riprova più tardi");
      a.iscritti.push({ uid, nome: u.nome });
      await salva(a);
      await db(["ZADD", "sq:mie:" + uid, String(a.inizio), a.id]);
      return res.json({ ok: true });
    }
    if (az === "lascia") {
      const i = a.iscritti.findIndex((x) => x.uid === uid);
      if (i < 0) return err(res, 400, "Non sei in questa squadra");
      if (a.stato !== "aperto" || ora >= a.inizio) return err(res, 400, "La partita è già iniziata: non puoi più lasciarla");
      a.iscritti.splice(i, 1);
      await salva(a);
      await db(["ZREM", "sq:mie:" + uid, a.id]);
      const tardi = a.inizio - ora < PREAVVISO;
      if (tardi) await registra({ [uid]: false });
      return res.json({ ok: true, penalita: tardi });
    }
    if (az === "annulla") {
      if (a.uid !== uid) return err(res, 403, "Solo chi ha creato l'annuncio può annullarlo");
      if (a.stato !== "aperto") return err(res, 400, "Annuncio già chiuso");
      if (ora >= a.inizio) return err(res, 400, "La partita è già iniziata: conferma chi c'era invece di annullare");
      const tardi = a.iscritti.length > 0 && a.inizio - ora < PREAVVISO;
      a.stato = "annullato";
      await salva(a);
      await db(["ZREM", "sq:attivi", a.id], ["ZREM", "sq:dafinire", a.id]);
      if (tardi) await registra({ [uid]: false });
      return res.json({ ok: true, penalita: tardi });
    }
    if (az === "conferma") {
      const m = membri(a);
      if (!m.includes(uid)) return err(res, 403, "Non eri in questa squadra");
      if (a.stato !== "aperto") return err(res, 400, "Le conferme per questa partita sono chiuse");
      if (ora < a.inizio) return err(res, 400, "Potrai confermare dopo l'orario di inizio");
      if (m.length < 2) return err(res, 400, "Non si è iscritto nessuno");
      const presenti = (Array.isArray(b.presenti) ? b.presenti : []).map(String).filter((x) => m.includes(x) && x !== uid);
      a.report = a.report || {};
      a.report[uid] = [...new Set(presenti)];
      await salva(a);
      if (m.every((x) => a.report[x])) await chiudi(a);
      return res.json({ ok: true });
    }
    if (az === "segnala") {
      const [nuovo] = await db(["SADD", "sq:sg:" + a.id, uid], ["EXPIRE", "sq:sg:" + a.id, TTL]);
      if (nuovo) { a.segn = (a.segn || 0) + 1; if (a.segn >= 3) a.nascosto = true; await salva(a); }
      return res.json({ ok: true });
    }
    return err(res, 400, "Azione sconosciuta");
  } catch (e) {
    console.error(e);
    return err(res, 500, "Cerca squadra momentaneamente non disponibile");
  }
};
