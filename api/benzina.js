// Funzione serverless Vercel: legge i dati aperti dei carburanti del MIMIT
// (anagrafica dei distributori e prezzi delle 8) e restituisce solo le righe
// della zona di Davide, nello stesso formato CSV. Serve perché
// dalle macchine di GitHub il sito del Ministero non risponde.
// La scheda la costruisce agenti/benzina.py.
const CENTRO = [41.9365, 12.592];
const RAGGIO_KM = 3;
const BASE = "https://www.mimit.gov.it/images/exportCSV/";

const km = (a, b) => {
  const r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

const scarica = async (nome) => {
  const r = await fetch(BASE + nome, { headers: { "User-Agent": "davidedurazzi.it redazione" } });
  if (!r.ok) throw new Error(nome + " " + r.status);
  return (await r.text()).split(/\r?\n/);
};

// Le prime righe ("Estrazione del ...") e l'intestazione restano com'erano.
const intestazione = (linee) => (linee[0].toLowerCase().startsWith("estrazione") ? 2 : 1);

module.exports = async (req, res) => {
  try {
    const [imp, prz] = await Promise.all([scarica("anagrafica_impianti_attivi.csv"), scarica("prezzo_alle_8.csv")]);
    const ti = intestazione(imp), tp = intestazione(prz);
    const sep = imp[ti - 1].split("|").length > imp[ti - 1].split(";").length ? "|" : ";";
    const col = imp[ti - 1].split(sep);
    const iLat = col.indexOf("Latitudine"), iLon = col.indexOf("Longitudine");
    const ids = new Set();
    const zona = imp.slice(ti).filter((l) => {
      const c = l.split(sep), lat = parseFloat(c[iLat]), lon = parseFloat(c[iLon]);
      if (!(lat && lon) || km(CENTRO, [lat, lon]) > RAGGIO_KM) return false;
      ids.add(c[0]);
      return true;
    });
    const sepP = prz[tp - 1].includes("|") ? "|" : ";";
    const prezzi = prz.slice(tp).filter((l) => ids.has(l.split(sepP)[0]));
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).json({
      impianti: imp.slice(0, ti).concat(zona).join("\n"),
      prezzi: prz.slice(0, tp).concat(prezzi).join("\n")
    });
  } catch (e) {
    res.status(502).json({ error: "Dati MIMIT non raggiungibili" });
  }
};
