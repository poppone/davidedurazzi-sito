"""Redazione del mattino: notizie -> temi -> articoli -> Contraddittorio -> bozze da approvare."""
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent))
import agenti  # noqa: E402
import config  # noqa: E402
from fonti import raccogli  # noqa: E402

RADICE = Path(__file__).resolve().parent.parent
BOZZE = RADICE / "bozze" / "bozze.json"
OGGI = datetime.now(ZoneInfo("Europe/Rome"))


def slug(t: str) -> str:
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:70] + "-" + OGGI.strftime("%Y%m%d")


def leggi(p: Path) -> list:
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def main() -> None:
    notizie = raccogli()
    if len(notizie) < 5:
        print("Troppe poche notizie, mi fermo.")
        return
    per_id = {n["id"]: n for n in notizie}

    # Palinsesto del giorno: 1 tema di attualità + 2 aree fisse
    aree_oggi = ["attualita"] + config.PALINSESTO[OGGI.weekday()]
    print(f"[palinsesto] oggi: {aree_oggi}")
    temi, scelti = [], []
    for area in aree_oggi:
        if area == "libero":
            pool, sezioni = notizie, config.SEZIONI
        elif area == "attualita":
            pool, sezioni = [n for n in notizie if n["area"] == "attualita"], ["cronaca", "politica"]
        elif area == "quotidiano":
            pool, sezioni = [n for n in notizie if n["area"] in ("attualita", "economia")], ["quotidiano"]
        else:
            pool, sezioni = [n for n in notizie if n["area"] == area], [area]
        tema = agenti.scout(pool, area, sezioni, scelti)
        if not tema:
            print(f"[scout] nessun tema valido per '{area}'")
            continue
        if tema.get("sezione") not in sezioni:
            tema["sezione"] = sezioni[0]
        temi.append(tema)
        scelti.append(tema.get("titolo_lavoro", ""))

    # Il Contraddittorio va al tema più divisivo del giorno
    dibattito = max(temi, key=lambda t: t.get("divisivo", 0), default=None)

    nuove, scaletta = [], []
    for tema in temi:
        fonti = agenti.fact_check(tema, per_id)
        if not fonti:
            if tema is dibattito:
                dibattito = None
            continue
        art = agenti.redattore(tema, fonti)
        verifica = agenti.critico(art, fonti)
        if not verifica.get("ok", False) and verifica.get("problemi"):
            print(f"[critico] riscrivo '{art.get('titolo')}'")
            art = agenti.redattore(tema, fonti, verifica["problemi"])
            verifica = agenti.critico(art, fonti)

        bozza = {
            "approvato": False,
            "scartare": False,
            "slug": slug(art.get("titolo", tema["titolo_lavoro"])),
            "titolo": art.get("titolo", tema["titolo_lavoro"]),
            "sezione": tema["sezione"],
            "rubrica": "",
            "data": OGGI.strftime("%Y-%m-%d"),
            "sommario": art.get("sommario", ""),
            "testo": art.get("testo", []),
            "fonti": [{"nome": f"{f['testata']}: {f['titolo']}", "url": f["url"]} for f in fonti],
            "nota_critico": verifica.get("problemi", []),
            "domande_live": art.get("domande_live", []),
        }
        if tema is dibattito:
            c = agenti.contraddittorio(tema, fonti)
            bozza.update(rubrica="contraddittorio", domanda=c["domanda"], tesi=c["tesi"], antitesi=c["antitesi"])
        nuove.append(bozza)
        scaletta.append(bozza)

    if not nuove:
        print("Nessun tema ha superato il fact-check oggi.")
        return

    esistenti = leggi(BOZZE)
    slugs = {b["slug"] for b in esistenti}
    esistenti = [b for b in nuove if b["slug"] not in slugs] + esistenti
    BOZZE.parent.mkdir(exist_ok=True)
    BOZZE.write_text(json.dumps(esistenti, ensure_ascii=False, indent=2), encoding="utf-8")

    righe = [f"# Scaletta del {OGGI.strftime('%d/%m/%Y')}\n"]
    for i, b in enumerate(scaletta, 1):
        righe.append(f"## {i}. {b['titolo']}\n\n{b['sommario']}\n")
        if b.get("domanda"):
            righe.append(f"**Il Contraddittorio:** {b['domanda']}\n")
        righe += [f"- {d}" for d in b["domande_live"]]
        if b["nota_critico"]:
            righe.append("\n> Da verificare: " + "; ".join(b["nota_critico"]))
        righe.append("\nFonti: " + ", ".join(f"[{f['nome'].split(':')[0]}]({f['url']})" for f in b["fonti"]) + "\n")
    (RADICE / "bozze" / f"scaletta-{OGGI.strftime('%Y-%m-%d')}.md").write_text("\n".join(righe), encoding="utf-8")
    print(f"Fatto: {len(nuove)} bozze pronte da approvare.")


if __name__ == "__main__":
    main()
