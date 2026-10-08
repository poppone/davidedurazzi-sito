// Lettura/scrittura di file JSON del repo via GitHub Contents API (env GITHUB_TOKEN, GITHUB_REPO opzionale)
const REPO = process.env.GITHUB_REPO || "poppone/davidedurazzi-sito";
const RAMO = process.env.GITHUB_BRANCH || "main";

function intest(extra) {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("Manca GITHUB_TOKEN in Vercel: aggiungilo nelle variabili d'ambiente e rifai il deploy.");
  return Object.assign({ Authorization: "Bearer " + t, "User-Agent": "davidedurazzi-admin", "X-GitHub-Api-Version": "2022-11-28" }, extra || {});
}

async function leggiJson(percorso) {
  const url = `https://api.github.com/repos/${REPO}/contents/${percorso}?ref=${RAMO}`;
  const r = await fetch(url, { headers: intest({ Accept: "application/vnd.github+json" }), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`GitHub ${percorso}: HTTP ${r.status}`);
  const j = await r.json();
  let testo = j.content ? Buffer.from(j.content, "base64").toString("utf8") : "";
  if (!testo) {
    const raw = await fetch(url, { headers: intest({ Accept: "application/vnd.github.raw+json" }), signal: AbortSignal.timeout(15000) });
    testo = await raw.text();
  }
  return { dati: JSON.parse(testo || "[]"), sha: j.sha };
}

// modifica(dati) -> nuovi dati (o null per non scrivere). Riprova se qualcuno ha scritto nel frattempo (409/422).
async function aggiornaJson(percorso, messaggio, modifica) {
  for (let giro = 0; giro < 3; giro++) {
    const { dati, sha } = await leggiJson(percorso);
    const nuovi = modifica(dati);
    if (nuovi === null) return false;
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${percorso}`, {
      method: "PUT",
      headers: intest({ Accept: "application/vnd.github+json", "Content-Type": "application/json" }),
      body: JSON.stringify({
        message: messaggio,
        content: Buffer.from(JSON.stringify(nuovi, null, 2) + "\n", "utf8").toString("base64"),
        sha,
        branch: RAMO,
        committer: { name: "Davide Durazzi", email: "davide1988rm@gmail.com" }
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (r.ok) return true;
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub scrittura ${percorso}: HTTP ${r.status}`);
  }
  throw new Error("GitHub: conflitto di scrittura, riprova.");
}

module.exports = { leggiJson, aggiornaJson };
