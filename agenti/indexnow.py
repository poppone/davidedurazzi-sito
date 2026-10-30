"""IndexNow: segnala a Bing, Yandex e agli altri motori gli URL nuovi appena pubblicati.

Legge indexnow-nuovi.txt (lo scrive prerender.py) e la chiave dal file <chiave>.txt
nella radice del sito. Aspetta che il primo URL risponda 200 (deploy Vercel finito,
al massimo ~3 minuti), poi fa un solo POST a api.indexnow.org.
Non fa mai fallire il workflow: in caso di problemi scrive il motivo ed esce con 0.

Uso: python agenti/indexnow.py
"""
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
LISTA = RADICE / "indexnow-nuovi.txt"
SITO = "https://www.davidedurazzi.it"
ATTESA_MAX = 180  # secondi


def chiave() -> str:
    for f in RADICE.glob("*.txt"):
        if re.fullmatch(r"[0-9a-f]{32}", f.stem) and f.read_text(encoding="utf-8").strip() == f.stem:
            return f.stem
    return ""


def online(url: str) -> bool:
    fine = time.time() + ATTESA_MAX
    while time.time() < fine:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=15) as r:
                if r.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, ValueError):
            pass
        time.sleep(15)
    return False


def main() -> None:
    url = [u.strip() for u in LISTA.read_text(encoding="utf-8").splitlines() if u.strip()] if LISTA.exists() else []
    k = chiave()
    if not url:
        print("[indexnow] nessun URL nuovo")
        return
    if not k:
        print("[indexnow] file chiave mancante nella radice, salto")
        return
    if not online(url[0]):
        print(f"[indexnow] {url[0]} non risponde 200 dopo {ATTESA_MAX} s, salto")
        return
    corpo = {"host": "www.davidedurazzi.it", "key": k, "keyLocation": f"{SITO}/{k}.txt", "urlList": url[:10000]}
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=json.dumps(corpo).encode("utf-8"),
                                 headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"[indexnow] HTTP {r.status}: segnalati {len(url)} URL")
    except urllib.error.HTTPError as e:
        print(f"[indexnow] HTTP {e.code}: {e.read()[:200]!r}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # IndexNow è un di più: non deve mai bloccare la pubblicazione
        print("[indexnow] errore:", e)
