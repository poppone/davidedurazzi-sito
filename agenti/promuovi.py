"""Sposta le bozze approvate nel sito e rimuove quelle da scartare."""
import json
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
BOZZE = RADICE / "bozze" / "bozze.json"
ARTICOLI = RADICE / "content" / "articoli.json"
INTERNI = {"approvato", "scartare", "nota_critico", "domande_live"}


def main() -> None:
    bozze = json.loads(BOZZE.read_text(encoding="utf-8")) if BOZZE.exists() else []
    articoli = json.loads(ARTICOLI.read_text(encoding="utf-8"))
    approvate = [b for b in bozze if b.get("approvato") is True]
    restanti = [b for b in bozze if not b.get("approvato") and not b.get("scartare")]
    if len(restanti) == len(bozze):
        print("Niente da fare.")
        return
    slugs = {a["slug"] for a in articoli}
    for b in approvate:
        pulito = {k: v for k, v in b.items() if k not in INTERNI}
        pulito["pubblicato"] = True
        if pulito.get("sezione") == "novita":  # vecchia sezione, ora Tecnologia e AI
            pulito["sezione"] = "tecnologia"
        if pulito["slug"] not in slugs:
            articoli.insert(0, pulito)
    ARTICOLI.write_text(json.dumps(articoli, ensure_ascii=False, indent=2), encoding="utf-8")
    BOZZE.write_text(json.dumps(restanti, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Pubblicate {len(approvate)}, scartate {len(bozze) - len(restanti) - len(approvate)}.")


if __name__ == "__main__":
    main()
