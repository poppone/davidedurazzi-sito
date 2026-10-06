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
                "area": feed.get("area", "attualita"),
                "titolo": titolo,
                "sommario": _pulisci(v.get("summary", ""))[:300],
                "url": v["link"],
            })
    # Bilancia: massimo 15 notizie per testata in ogni area, così ogni Scout le vede tutte
    gruppi: dict[tuple, list[dict]] = {}
    for n in notizie:
        gruppi.setdefault((n["area"], n["testata"]), []).append(n)
    bilanciate = [n for lista in gruppi.values() for n in lista[:15]]
    for i, n in enumerate(bilanciate, 1):
        n["id"] = f"n{i}"
    per_area: dict[str, int] = {}
    for n in bilanciate:
        per_area[n["area"]] = per_area.get(n["area"], 0) + 1
    print(f"[fonti] {len(notizie)} notizie raccolte, per area: {per_area}")
    return bilanciate
