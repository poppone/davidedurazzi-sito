// Community con account. Un solo endpoint: /api/community?a=<azione>
// Pubblico: registrati, entra, esci, io, posts, scrivi, temi, proponi, vota, segnala, elimina-account
// Admin (header x-admin-password): admin-elenco, admin-nascondi, admin-contatti
const crypto = require("crypto");
const { db, nuovoId, hashIp, leggiCorpo } = require("./_lib");

const SESSIONE = 30 * 86400;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const NOME = /^[A-Za-z0-9À-ÿ_.\- ]{3,24}$/;

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
const emailKey = (e) => crypto.createHash("sha256").update(e.toLowerCase()).digest("hex").slice(0, 32);
const ipDi = (req) => hashIp(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "");

function scrypt(pw, salt) {
  return new Promise((ok, ko) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? ko(e) : ok(k.toString("hex")))));
}
function cookie(req, nome) {
  const m = String(req.headers.cookie || "").match(new RegExp("(?:^|; )" + nome + "=([^;]+)"));
  return m ? m[1] : "";
}
function setCookie(res, token, durata) {
  res.setHeader("Set-Cookie", "dd_sess=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + durata);
}
async function utente(req) {
  const t = cookie(req, "dd_sess");
  if (!/^[a-f0-9]{48}$/.test(t)) return null;
  const [uid] = await db(["GET", "s:" + t]);
  if (!uid) return null;
  const [u] = await db(["GET", "u:" + uid]);
  return u ? JSON.parse(u) : null;
}
function adminOk(req) {
  const atteso = process.env.ADMIN_PASSWORD || "";
  const dato = String(req.headers["x-admin-password"] || "");
  return atteso.length >= 8 && dato.length === atteso.length && crypto.timingSafeEqual(Buffer.from(dato), Buffer.from(atteso));
}
// Limite semplice: max n azioni ogni sec secondi per chiave
async function limite(chiave, n, sec) {
  const [c] = await db(["INCR", "rl:" + chiave], ["EXPIRE", "rl:" + chiave, String(sec), "NX"]);
  return c <= n;
}
const pubU = (u) => ({ nome: u.nome, news: !!u.news, creato: u.creato });
const err = (res, code, msg) => res.status(code).json({ errore: msg });

async function carica(prefisso, lista, max) {
  const [ids] = await db(["LRANGE", lista, "0", String(max - 1)]);
  if (!ids || !ids.length) return [];
  const v = await db(...ids.map((id) => ["GET", prefisso + id]));
  return v.filter(Boolean).map((x) => JSON.parse(x));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const a = String((req.query && req.query.a) || "");
    const b = req.method === "POST" ? await leggiCorpo(req) : {};
    const ip = ipDi(req);

    // ---------- ADMIN ----------
    if (a.startsWith("admin-")) {
      if (!adminOk(req)) return err(res, 401, "Password errata");
      if (a === "admin-elenco") {
        const [posts, temi] = await Promise.all([carica("p:", "piazza", 100), carica("t:", "temi", 100)]);
        const [n, mod] = await db(["SCARD", "utenti"], ["GET", "cfg:mod"]);
        return res.json({ utenti: n, posts, temi, moderazione: mod === "1" });
      }
      if (a === "admin-nascondi") {
        const k = b.tipo === "tema" ? "t:" : "p:";
        const [v] = await db(["GET", k + b.id]);
        if (!v) return err(res, 404, "Non trovato");
        const o = JSON.parse(v); o.nascosto = !!b.nascondi;
        await db(["SET", k + b.id, JSON.stringify(o)]);
        return res.json({ ok: true });
      }
      if (a === "admin-pubblica") {
        const k = b.tipo === "tema" ? "t:" : "p:";
        const [v] = await db(["GET", k + b.id]);
        if (!v) return err(res, 404, "Non trovato");
        const o = JSON.parse(v); o.nascosto = false; o.attesa = false; o.segn = 0;
        await db(["SET", k + b.id, JSON.stringify(o)], ["DEL", "sg:" + b.id]);
        return res.json({ ok: true });
      }
      if (a === "admin-elimina") {
        const tema = b.tipo === "tema";
        await db(["DEL", (tema ? "t:" : "p:") + b.id], ["LREM", tema ? "temi" : "piazza", "0", String(b.id)], ["DEL", "tv:" + b.id], ["DEL", "sg:" + b.id]);
        return res.json({ ok: true });
      }
      if (a === "admin-moderazione") {
        await db(b.attiva ? ["SET", "cfg:mod", "1"] : ["DEL", "cfg:mod"]);
        return res.json({ ok: true, moderazione: !!b.attiva });
      }
      if (a === "admin-contatti") {
        const [ids] = await db(["SMEMBERS", "utenti"]);
        const v = ids.length ? await db(...ids.map((i) => ["GET", "u:" + i])) : [];
        const lista = v.filter(Boolean).map((x) => JSON.parse(x)).filter((u) => u.news).map((u) => ({ nome: u.nome, email: u.email, data: u.creato }));
        return res.json({ contatti: lista });
      }
      return err(res, 400, "Azione sconosciuta");
    }

    // ---------- LETTURA ----------
    if (a === "io") {
      const u = await utente(req);
      return res.json({ utente: u ? pubU(u) : null });
    }
    if (a === "posts") {
      const v = (await carica("p:", "piazza", 150)).filter((p) => !p.nascosto);
      return res.json({ posts: v.map((p) => ({ id: p.id, nome: p.nome, testo: p.testo, data: p.data, rif: p.rif || null })) });
    }
    if (a === "temi") {
      const u = await utente(req);
      const v = (await carica("t:", "temi", 100)).filter((t) => !t.nascosto);
      const mio = u ? await db(...v.map((t) => ["SISMEMBER", "tv:" + t.id, u.id])) : [];
      const out = v.map((t, i) => ({ id: t.id, titolo: t.titolo, nome: t.nome, data: t.data, voti: t.voti, votato: !!mio[i] }));
      out.sort((x, y) => y.voti - x.voti);
      return res.json({ temi: out });
    }

    if (req.method !== "POST") return err(res, 405, "Metodo non consentito");

    // ---------- ACCOUNT ----------
    if (a === "registrati") {
      if (b.sito) return res.json({ ok: true }); // honeypot
      if (!(await limite("reg:" + ip, 5, 3600))) return err(res, 429, "Troppi tentativi, riprova più tardi");
      const email = norm(b.email).toLowerCase(), nome = norm(b.nome), pw = String(b.password || "");
      if (!EMAIL.test(email)) return err(res, 400, "Email non valida");
      if (!NOME.test(nome)) return err(res, 400, "Nome: 3-24 caratteri (lettere, numeri, . _ -)");
      if (pw.length < 8 || pw.length > 100) return err(res, 400, "La password deve avere almeno 8 caratteri");
      if (!b.privacy) return err(res, 400, "Devi accettare l'informativa privacy");
      const [okMail] = await db(["SET", "ue:" + emailKey(email), "pending", "NX"]);
      if (okMail === null) return err(res, 409, "Esiste già un account con questa email");
      const [okNome] = await db(["SET", "un:" + nome.toLowerCase(), "pending", "NX"]);
      if (okNome === null) { await db(["DEL", "ue:" + emailKey(email)]); return err(res, 409, "Nome già in uso"); }
      const id = nuovoId(), salt = crypto.randomBytes(16).toString("hex");
      const u = { id, email, nome, salt, hash: await scrypt(pw, salt), news: !!b.news, creato: new Date().toISOString() };
      await db(["SET", "u:" + id, JSON.stringify(u)], ["SET", "ue:" + emailKey(email), id], ["SET", "un:" + nome.toLowerCase(), id], ["SADD", "utenti", id]);
      const t = crypto.randomBytes(24).toString("hex");
      await db(["SET", "s:" + t, id, "EX", String(SESSIONE)]);
      setCookie(res, t, SESSIONE);
      return res.json({ ok: true, utente: pubU(u) });
    }
    if (a === "entra") {
      if (!(await limite("log:" + ip, 10, 600))) return err(res, 429, "Troppi tentativi, riprova tra qualche minuto");
      const email = norm(b.email).toLowerCase(), pw = String(b.password || "");
      const [id] = await db(["GET", "ue:" + emailKey(email)]);
      const [v] = id && id !== "pending" ? await db(["GET", "u:" + id]) : [null];
      const u = v ? JSON.parse(v) : null;
      const h = await scrypt(pw, u ? u.salt : "0".repeat(32)); // tempo costante
      if (!u || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.hash))) return err(res, 401, "Email o password errate");
      const t = crypto.randomBytes(24).toString("hex");
      await db(["SET", "s:" + t, u.id, "EX", String(SESSIONE)]);
      setCookie(res, t, SESSIONE);
      return res.json({ ok: true, utente: pubU(u) });
    }
    if (a === "esci") {
      const t = cookie(req, "dd_sess");
      if (t) await db(["DEL", "s:" + t]);
      setCookie(res, "", 0);
      return res.json({ ok: true });
    }

    const u = await utente(req);
    if (!u) return err(res, 401, "Devi accedere per farlo");

    if (a === "elimina-account") {
      await db(["DEL", "u:" + u.id], ["DEL", "ue:" + emailKey(u.email)], ["DEL", "un:" + u.nome.toLowerCase()], ["SREM", "utenti", u.id], ["DEL", "s:" + cookie(req, "dd_sess")]);
      setCookie(res, "", 0);
      return res.json({ ok: true });
    }

    // ---------- PIAZZA ----------
    if (a === "scrivi") {
      const testo = norm(b.testo);
      if (testo.length < 3 || testo.length > 1000) return err(res, 400, "Il messaggio deve avere tra 3 e 1000 caratteri");
      if ((testo.match(/https?:\/\//g) || []).length > 1) return err(res, 400, "Massimo un link per messaggio");
      if (!(await limite("w:" + u.id, 6, 600))) return err(res, 429, "Vai piano: riprova tra qualche minuto");
      const p = { id: nuovoId(), uid: u.id, nome: u.nome, testo, rif: /^[a-z0-9]{6,20}$/.test(b.rif || "") ? b.rif : null, data: new Date().toISOString(), segn: 0 };
      const [mod] = await db(["GET", "cfg:mod"]);
      if (mod === "1") { p.nascosto = true; p.attesa = true; }
      await db(["SET", "p:" + p.id, JSON.stringify(p)], ["LPUSH", "piazza", p.id]);
      return res.json({ ok: true, id: p.id, messaggio: p.attesa ? "Grazie! Il messaggio sarà visibile dopo l'approvazione." : "" });
    }
    if (a === "segnala") {
      const [v] = await db(["GET", "p:" + b.id]);
      if (!v) return err(res, 404, "Non trovato");
      const p = JSON.parse(v);
      const [nuovo] = await db(["SADD", "sg:" + p.id, u.id]);
      if (nuovo) { p.segn = (p.segn || 0) + 1; if (p.segn >= 3) p.nascosto = true; await db(["SET", "p:" + p.id, JSON.stringify(p)]); }
      return res.json({ ok: true });
    }

    // ---------- TEMI ----------
    if (a === "proponi") {
      const titolo = norm(b.titolo);
      if (titolo.length < 8 || titolo.length > 140) return err(res, 400, "Il tema deve avere tra 8 e 140 caratteri");
      if (!(await limite("pt:" + u.id, 3, 86400))) return err(res, 429, "Massimo 3 proposte al giorno");
      const t = { id: nuovoId(), uid: u.id, nome: u.nome, titolo, data: new Date().toISOString(), voti: 1 };
      const [mod] = await db(["GET", "cfg:mod"]);
      if (mod === "1") { t.nascosto = true; t.attesa = true; }
      await db(["SET", "t:" + t.id, JSON.stringify(t)], ["LPUSH", "temi", t.id], ["SADD", "tv:" + t.id, u.id]);
      return res.json({ ok: true, messaggio: t.attesa ? "Grazie! Il tema sarà visibile dopo l'approvazione." : "" });
    }
    if (a === "vota") {
      const [v] = await db(["GET", "t:" + b.id]);
      if (!v) return err(res, 404, "Tema non trovato");
      const t = JSON.parse(v);
      const [nuovo] = await db(["SADD", "tv:" + t.id, u.id]);
      if (nuovo) { t.voti += 1; await db(["SET", "t:" + t.id, JSON.stringify(t)]); }
      return res.json({ ok: true, voti: t.voti });
    }
    return err(res, 400, "Azione sconosciuta");
  } catch (e) {
    console.error(e);
    return err(res, 500, "Servizio community momentaneamente non disponibile");
  }
};
