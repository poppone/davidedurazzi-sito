"""Benzina nella zona di Davide: la scheda della settimana per il video del lunedì.

Legge i dati aperti del Ministero (MIMIT, Osservaprezzi carburanti: anagrafica
dei distributori e prezzi comunicati, aggiornati ogni mattina alle 8), tiene i
distributori entro RAGGIO_KM dal centro del CAP 00156 e scrive:
  stanza/benzina/AAAA-MM-GG.md  la scheda (numeri, distributori, testo da dire)
  stanza/benzina/storico.json   le medie di ogni settimana, per il confronto
Prezzi self service; un prezzo comunicato da più di 7 giorni non si usa.
Niente stime: se i dati non arrivano, la scheda lo dice.
"""

import csv
import datetime
import io
import json
import math
import sys
import urllib.request
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
CARTELLA = RADICE / "stanza" / "benzina"
STORICO = CARTELLA / "storico.json"

ZONA = "Roma 00156 (San Basilio, Casal Monastero, Tor Cervara)"
CENTRO = (41.9365, 12.5920)
RAGGIO_KM = 3.0
URL_IMPIANTI = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
URL_PREZZI = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv"
# Dalle macchine di GitHub il sito del Ministero va in timeout: si passa dalla
# funzione del sito (api/_benzina.js, servita da api/youtube.js), che restituisce le stesse
# righe già filtrate sulla zona.
URL_SITO = "https://www.davidedurazzi.it/api/youtube?fonte=benzina"
CARBURANTI = {"benzina": "Benzina", "diesel": "Gasolio"}


def scarica(url):
    req = urllib.request.Request(url, headers={"User-Agent": "davidedurazzi.it redazione"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode("utf-8", errors="replace")


def righe(testo):
    """I CSV del MIMIT hanno una riga 'Estrazione del ...' prima dell'intestazione."""
    linee = testo.splitlines()
    if linee and linee[0].lower().startswith("estrazione"):
        linee = linee[1:]
    sep = "|" if linee and linee[0].count("|") > linee[0].count(";") else ";"
    return list(csv.DictReader(io.StringIO("\n".join(linee)), delimiter=sep))


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def numero(x):
    try:
        return float(str(x).replace(",", "."))
    except ValueError:
        return None


def data_prezzo(x):
    for formato in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.datetime.strptime(str(x).strip(), formato)
        except ValueError:
            pass
    return None


def distributori_in_zona(impianti):
    zona = {}
    for r in impianti:
        lat, lon = numero(r.get("Latitudine")), numero(r.get("Longitudine"))
        if lat is None or lon is None:
            continue
        d = km(CENTRO, (lat, lon))
        if d <= RAGGIO_KM:
            zona[str(r.get("idImpianto", "")).strip()] = {
                "nome": (r.get("Bandiera") or r.get("Nome Impianto") or "").strip(),
                "indirizzo": (r.get("Indirizzo") or "").strip().title().replace(" Di ", " di ").replace(" Del ", " del ").replace(" Della ", " della "),
                "km": round(d, 1),
            }
    return zona


def prezzi_in_zona(prezzi, zona, oggi):
    """{carburante: [(prezzo, id)]} solo self, solo prezzi degli ultimi 7 giorni."""
    out = {k: [] for k in CARBURANTI}
    for r in prezzi:
        idi = str(r.get("idImpianto", "")).strip()
        if idi not in zona or str(r.get("isSelf", "")).strip() != "1":
            continue
        quando = data_prezzo(r.get("dtComu"))
        if quando is None or (oggi - quando.date()).days > 7:
            continue
        p = numero(r.get("prezzo"))
        if p is None or not 0.5 < p < 4:
            continue
        for chiave, desc in CARBURANTI.items():
            if str(r.get("descCarburante", "")).strip().lower() == desc.lower():
                out[chiave].append((p, idi))
    for chiave in out:  # un distributore conta una volta: il prezzo più basso che comunica
        migliori = {}
        for p, idi in out[chiave]:
            migliori[idi] = min(p, migliori.get(idi, p))
        out[chiave] = sorted((p, idi) for idi, p in migliori.items())
    return out


def euro(p):
    return f"{p:.3f}".replace(".", ",") + " €/l"


def variazione(ora, prima):
    if prima is None:
        return "prima settimana, nessun confronto"
    diff = round((ora - prima) * 100, 1)
    if abs(diff) < 0.1:
        return "uguale alla settimana scorsa"
    verso = "su" if diff > 0 else "giù"
    return f"{verso} di {abs(diff):.1f} centesimi rispetto alla settimana scorsa".replace(".", ",")


def scheda(oggi, zona, prezzi, storico):
    prec = storico[-1] if storico else {}
    medie = {k: round(sum(p for p, _ in v) / len(v), 3) for k, v in prezzi.items() if v}
    t = [f"# Benzina nella tua zona, settimana del {oggi.strftime('%d/%m/%Y')}", "",
         f"Zona: {ZONA}, distributori entro {RAGGIO_KM:g} km. Prezzi self service comunicati al Ministero "
         "(MIMIT, Osservaprezzi carburanti), dati delle 8 di stamattina.", ""]
    if not medie:
        t += ["**Dati non disponibili:** il file del Ministero non aveva prezzi recenti per questa zona. "
              "Niente video con numeri questa settimana, oppure leggi i prezzi sui cartelli."]
        return "\n".join(t) + "\n", medie
    t += ["## I numeri", "", "| | Media zona | Distributori | Rispetto a 7 giorni fa |", "|---|---|---|---|"]
    for k, nome in (("benzina", "Benzina"), ("diesel", "Diesel")):
        if k in medie:
            t.append(f"| {nome} | {euro(medie[k])} | {len(prezzi[k])} | {variazione(medie[k], prec.get(k))} |")
    if prezzi["benzina"]:
        b = prezzi["benzina"]
        t += ["", "## Benzina: i 3 più economici e il più caro", ""]
        for i, (p, idi) in enumerate(b[:3], 1):
            z = zona[idi]
            t.append(f"{i}. {euro(p)}, {z['nome']}, {z['indirizzo']} ({str(z['km']).replace('.', ',')} km)")
        p, idi = b[-1]
        z = zona[idi]
        t.append(f"- Il più caro: {euro(p)}, {z['nome']}, {z['indirizzo']} ({str(z['km']).replace('.', ',')} km)")
        risparmio = round((b[-1][0] - b[0][0]) * 50, 2)
        cifra = f"{risparmio:.2f}".replace(".", ",")
        t += ["", f"Su un pieno da 50 litri, tra il più caro e il più economico ballano {cifra} €."]
    t += ["", "## Il testo da dire (circa 25 secondi)", ""]
    frase = [f"\"Benzina a San Basilio e dintorni, settimana del {oggi.strftime('%d/%m')}.",
             f"La benzina self sta in media a {euro(medie['benzina']).replace(' €/l', '')}, {variazione(medie['benzina'], prec.get('benzina'))}." if "benzina" in medie else "",
             f"Il diesel a {euro(medie['diesel']).replace(' €/l', '')}." if "diesel" in medie else ""]
    if prezzi["benzina"]:
        p, idi = prezzi["benzina"][0]
        frase.append(f"Il più economico è {zona[idi]['nome']} in {zona[idi]['indirizzo']}: {euro(p).replace(' €/l', '')}.")
        frase.append(f"Il più caro ti fa spendere {cifra} euro in più a pieno.")
    frase.append("Voi dove fate benzina? Scrivetelo qui, e seguitemi per il prezzo di lunedì prossimo.\"")
    t += [" ".join(x for x in frase if x), "",
          "**Scritta in sovrimpressione:** \"Benzina oggi a San Basilio ⛽ dove costa meno\"", "",
          "**Descrizione:** \"Prezzi self della settimana nella mia zona, dati del Ministero (MIMIT). "
          "Voi quanto la pagate? 👇 #benzina #prezzibenzina #roma #sanbasilio #carburante\"", "",
          "Controlla il cartello del distributore dove giri: se il prezzo è cambiato, di' quello che vedi."]
    return "\n".join(t) + "\n", medie


def main():
    oggi = datetime.date.today()
    CARTELLA.mkdir(parents=True, exist_ok=True)
    storico = json.loads(STORICO.read_text(encoding="utf-8")) if STORICO.exists() else []
    zona, prezzi = {}, {k: [] for k in CARBURANTI}
    for fonte in ("sito", "ministero"):
        try:
            if fonte == "sito":
                dati = json.loads(scarica(URL_SITO))
                imp, prz = dati["impianti"], dati["prezzi"]
            else:
                imp, prz = scarica(URL_IMPIANTI), scarica(URL_PREZZI)
            zona = distributori_in_zona(righe(imp))
            prezzi = prezzi_in_zona(righe(prz), zona, oggi)
            break
        except Exception as e:  # rete o formato cambiato: la scheda lo dice, non inventa
            print(f"[Benzina] dati MIMIT non letti ({fonte}): {e}", file=sys.stderr)
    testo, medie = scheda(oggi, zona, prezzi, storico)
    (CARTELLA / f"{oggi.isoformat()}.md").write_text(testo, encoding="utf-8")
    if medie:
        storico = [s for s in storico if s.get("data") != oggi.isoformat()]
        storico.append({"data": oggi.isoformat(), **medie,
                        "distributori": {k: len(v) for k, v in prezzi.items()}})
        STORICO.write_text(json.dumps(storico, ensure_ascii=False, indent=2), encoding="utf-8")
    print(testo)


if __name__ == "__main__":
    main()
