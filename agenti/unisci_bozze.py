"""Aggiunge le bozze nuove a bozze/bozze.json SENZA toccare quelle esistenti
(approvazioni comprese) e saltando quelle già pubblicate. Usato dal workflow dopo aver
riallineato il repository all'ultima versione, così non si perde nulla."""
import json
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent


def leggi(p: Path) -> list:
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def main(file_nuove: str) -> None:
    nuove = leggi(Path(file_nuove))
    bozze_p = RADICE / "bozze" / "bozze.json"
    bozze = leggi(bozze_p)
    pubblicati = {a.get("slug") for a in leggi(RADICE / "content" / "articoli.json")}
    presenti = {b.get("slug") for b in bozze} | pubblicati
    da_aggiungere = [b for b in nuove if b.get("slug") not in presenti]
    bozze_p.parent.mkdir(exist_ok=True)
    bozze_p.write_text(json.dumps(da_aggiungere + bozze, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Aggiunte {len(da_aggiungere)} bozze nuove")


if __name__ == "__main__":
    main(sys.argv[1])
