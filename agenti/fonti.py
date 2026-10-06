"""Scout tecnico: scarica le notizie recenti dai feed RSS."""
import calendar
import html
import re
import time

import feedparser
import requests

import config


def _pulisci(t: str) -> str:
    t = re.sub(r"<[^>]+>", " ", t or "")
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def raccogli() -> list[dict]:
    limite = time.time() - config.ORE_NOTIZIE * 3600
    notizie, visti = [], set()
    for feed in config.FEED:
        try:
            r = requests.get(feed["url"], timeout=20, headers={"User-Agent": "Mozilla/5.0 (redazione davidedurazzi.it)"})
            r.raise_for_status()
            voci = feedparser.parse(r.content).entries
        except Exception as e:  # un feed rotto non deve fermare tutto
            print(f"[fonti] salto {feed['url']}: {e}")
            continue
        for v in voci:
            data = v.get("published_parsed") or v.get("updated_parsed")
            if data and calendar.timegm(data) < limite:
                continue
            titolo = _pulisci(v.get("title", ""))
            chiave = titolo.lower()[:80]
            if not titolo or chiave in visti or not v.get("link"):
                continue
            visti.add(chiave)
            notizie.append({
                "id": f"n{len(notizie) + 1}",
                "testata": feed["testata"],
                "titolo": titolo,
                "sommario": _pulisci(v.get("summary", ""))[:300],
                "url": v["link"],
            })
    # Bilancia: massimo 25 notizie per testata, alternate, così lo Scout le vede tutte
    per_testata: dict[str, list[dict]] = {}
    for n in notizie:
        per_testata.setdefault(n["testata"], []).append(n)
    bilanciate = []
    for i in range(25):
        for lista in per_testata.values():
            if i < len(lista):
                bilanciate.append(lista[i])
    for i, n in enumerate(bilanciate, 1):
        n["id"] = f"n{i}"
    conteggio = ", ".join(f"{t}: {len(l)}" for t, l in per_testata.items())
    print(f"[fonti] {len(notizie)} notizie raccolte ({conteggio}), {len(bilanciate)} passate allo Scout")
    return bilanciate
