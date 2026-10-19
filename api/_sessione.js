// Sessione e utilità condivise con l'account della community (stesso cookie dd_sess di /api/community)
const crypto = require("crypto");
const { db, hashIp } = require("./_lib");

function cookie(req, nome) {
  const m = String(req.headers.cookie || "").match(new RegExp("(?:^|; )" + nome + "=([^;]+)"));
  return m ? m[1] : "";
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
// Max n azioni ogni sec secondi per chiave
async function limite(chiave, n, sec) {
  const [c] = await db(["INCR", "rl:" + chiave], ["EXPIRE", "rl:" + chiave, String(sec), "NX"]);
  return c <= n;
}
const ipDi = (req) => hashIp(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "");

module.exports = { cookie, utente, adminOk, limite, ipDi };
