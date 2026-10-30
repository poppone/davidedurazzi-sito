"""Coda social: pubblica direttamente Reel (Instagram), video (Facebook), post (Bluesky) e Pin (Pinterest).

Serve finché Metricool è al limite gratuito (20 pubblicazioni al mese).
Finch aggiunge le voci in social/coda.json, solo per cose già approvate da Davide
o coperte dal permesso fisso (regola 6e di stanza/direttore.md). Questo script
pubblica le voci "da pubblicare" e scrive l'esito nella stessa voce.

Voce Reel:
  {"id": "...", "rete": "instagram_reel", "stato": "da pubblicare",
   "video_url": "https://...mp4", "didascalia": "..."}
Voce video Facebook (stessi campi del Reel):
  {"id": "...", "rete": "facebook_video", "stato": "da pubblicare",
   "video_url": "https://...mp4", "didascalia": "..."}
Voce Bluesky (testo max 300 caratteri, max 4 immagini):
  {"id": "...", "rete": "bluesky", "stato": "da pubblicare",
   "testo": "...", "immagini": ["https://...jpg"], "alt": "..."}
Voce Pin:
  {"id": "...", "rete": "pinterest", "stato": "da pubblicare",
   "image_url": "https://...jpg", "titolo": "...", "didascalia": "...",
   "link": "https://...", "board_id": "..."}

Uso: python agenti/coda_social.py pubblica
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests

RADICE = Path(__file__).resolve().parent.parent
CODA = RADICE / "social" / "coda.json"

IG_API = "https://graph.instagram.com/" + os.environ.get("IG_API_VERSION", "v25.0")
PIN_API = "https://api.pinterest.com/v5"
BSKY_API = "https://bsky.social/xrpc"
FB_API = "https://graph.facebook.com/" + os.environ.get("FB_API_VERSION", "v21.0")
SITO = "https://www.davidedurazzi.it"
NOTA_AI = "Video realizzato con l'AI: voce sintetica e montaggio automatico."
TENTATIVI_MAX = 3


def _leggi() -> list[dict]:
    return json.loads(CODA.read_text(encoding="utf-8")) if CODA.exists() else []


def _scrivi(coda: list[dict]) -> None:
    CODA.parent.mkdir(exist_ok=True)
    CODA.write_text(json.dumps(coda, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _ora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def utm(url: str, rete: str, medium: str = "social", campagna: str = "") -> str:
    """Aggiunge i parametri UTM ai link del sito (solo davidedurazzi.it, mai a quelli esterni)
    e toglie il .html finale, così il link è quello canonico. I parametri già presenti restano."""
    parti = urlsplit(url)
    if parti.netloc.lower() not in ("davidedurazzi.it", "www.davidedurazzi.it"):
        return url
    percorso = re.sub(r"\.html$", "", parti.path)
    params = dict(parse_qsl(parti.query))
    if not any(k.startswith("utm_") for k in params):
        params.update(utm_source=rete, utm_medium=medium,
                      utm_campaign=campagna or percorso.rstrip("/").rsplit("/", 1)[-1] or "sito")
    return urlunsplit(("https", "www.davidedurazzi.it", percorso, urlencode(params), parti.fragment))


def link_utm(slug: str, rete: str, medium: str = "social") -> str:
    """Link all'articolo per i social: URL canonico (senza .html) + UTM, campagna = slug."""
    return utm(f"{SITO}/articoli/{slug}", rete, medium, slug)


def facet_link(testo: str, rete: str = "bluesky") -> list[dict]:
    """Bluesky non rende cliccabili i link scritti nel testo: servono i "facet" con le posizioni
    in byte (UTF-8). Il testo mostra il link pulito, il facet porta quello con le UTM."""
    facet = []
    for m in re.finditer(r"https?://[^\s<>\"]+[^\s<>\".,;:!?)]", testo):
        inizio = len(testo[:m.start()].encode("utf-8"))
        facet.append({"index": {"byteStart": inizio, "byteEnd": inizio + len(m.group().encode("utf-8"))},
                      "features": [{"$type": "app.bsky.richtext.facet#link", "uri": utm(m.group(), rete)}]})
    return facet


def didascalia_reel(testo: str) -> str:
    """La didascalia dichiara sempre che il video è fatto con l'AI."""
    testo = (testo or "").replace("\\n", "\n").strip()
    if "AI" not in testo:
        testo = f"{testo}\n\n{NOTA_AI}".strip()
    return testo[:2200]


def _ig(metodo: str, percorso: str, token: str, **params) -> dict:
    params["access_token"] = token
    r = requests.request(metodo, f"{IG_API}/{percorso}", params=params, timeout=120)
    if r.status_code >= 400:
        raise RuntimeError(f"Instagram {percorso}: HTTP {r.status_code} {r.text[:300]}")
    return r.json()


def pubblica_reel(voce: dict, token: str, attesa: float = 10, giri: int = 60) -> dict:
    utente = _ig("GET", "me", token, fields="user_id,username")
    uid = utente.get("user_id") or utente["id"]
    cid = _ig("POST", f"{uid}/media", token, media_type="REELS", video_url=voce["video_url"],
              caption=didascalia_reel(voce.get("didascalia", "")), share_to_feed="true")["id"]
    for _ in range(giri):
        stato = _ig("GET", cid, token, fields="status_code").get("status_code")
        if stato == "FINISHED":
            break
        if stato in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram ha rifiutato il video (stato {stato})")
        time.sleep(attesa)
    else:
        raise RuntimeError("Instagram non ha finito di elaborare il video in tempo")
    post = _ig("POST", f"{uid}/media_publish", token, creation_id=cid)["id"]
    return {"post_id": post, "account": utente.get("username")}


def pubblica_video_facebook(voce: dict, token: str, pagina: str) -> dict:
    r = requests.post(f"{FB_API}/{pagina}/videos", timeout=300, data={
        "file_url": voce["video_url"], "description": didascalia_reel(voce.get("didascalia", "")),
        "access_token": token})
    if r.status_code >= 400:
        raise RuntimeError(f"Facebook: HTTP {r.status_code} {r.text[:300]}")
    return {"post_id": r.json()["id"]}


def pubblica_bluesky(voce: dict, password: str, handle: str) -> dict:
    s = requests.post(f"{BSKY_API}/com.atproto.server.createSession", timeout=30,
                      json={"identifier": handle, "password": password})
    if s.status_code >= 400:
        raise RuntimeError(f"Bluesky login: HTTP {s.status_code} {s.text[:200]}")
    sessione = s.json()
    auth = {"Authorization": f"Bearer {sessione['accessJwt']}"}
    immagini = []
    for url in (voce.get("immagini") or [])[:4]:
        img = requests.get(url, timeout=60)
        img.raise_for_status()
        b = requests.post(f"{BSKY_API}/com.atproto.repo.uploadBlob", data=img.content, timeout=60,
                          headers={**auth, "Content-Type": img.headers.get("Content-Type", "image/jpeg")})
        if b.status_code >= 400:
            raise RuntimeError(f"Bluesky immagine: HTTP {b.status_code} {b.text[:200]}")
        immagini.append({"alt": (voce.get("alt") or "")[:300], "image": b.json()["blob"]})
    testo = (voce.get("testo") or "")[:300]
    record = {"$type": "app.bsky.feed.post", "text": testo,
              "createdAt": _ora().replace("+00:00", "Z"), "langs": ["it"]}
    facet = facet_link(testo)
    if facet:
        record["facets"] = facet
    if immagini:
        record["embed"] = {"$type": "app.bsky.embed.images", "images": immagini}
    r = requests.post(f"{BSKY_API}/com.atproto.repo.createRecord", headers=auth, timeout=30,
                      json={"repo": sessione["did"], "collection": "app.bsky.feed.post", "record": record})
    if r.status_code >= 400:
        raise RuntimeError(f"Bluesky: HTTP {r.status_code} {r.text[:300]}")
    uri = r.json()["uri"]
    return {"post_id": uri, "url": f"https://bsky.app/profile/{handle}/post/{uri.rsplit('/', 1)[-1]}"}


def pubblica_pin(voce: dict, token: str) -> dict:
    corpo = {
        "board_id": voce["board_id"],
        "title": (voce.get("titolo") or "")[:100],
        "description": (voce.get("didascalia") or "").replace("\\n", "\n")[:500],
        "link": utm(voce["link"], "pinterest", "pin") if voce.get("link") else voce.get("link"),
        "media_source": {"source_type": "image_url", "url": voce["image_url"]},
    }
    r = requests.post(f"{PIN_API}/pins", json=corpo, timeout=60,
                      headers={"Authorization": f"Bearer {token}"})
    if r.status_code >= 400:
        raise RuntimeError(f"Pinterest: HTTP {r.status_code} {r.text[:300]}")
    pin = r.json()["id"]
    return {"post_id": pin, "url": f"https://www.pinterest.com/pin/{pin}/"}


def pubblica(coda: list[dict] | None = None, env=os.environ, **kw) -> list[dict]:
    salva = coda is None
    coda = _leggi() if coda is None else coda
    pagina = env.get("FB_PAGE_ID", "")
    reti = {
        "instagram_reel": (lambda v, t: pubblica_reel(v, t, **kw), env.get("IG_ACCESS_TOKEN", "")),
        "facebook_video": (lambda v, t: pubblica_video_facebook(v, t, pagina),
                           env.get("FB_PAGE_TOKEN", "") if pagina else ""),
        "bluesky": (lambda v, t: pubblica_bluesky(v, t, env.get("BLUESKY_HANDLE", "davidedurazzi.bsky.social")),
                    env.get("BLUESKY_APP_PASSWORD", "")),
        "pinterest": (pubblica_pin, env.get("PINTEREST_TOKEN", "")),
    }
    for voce in coda:
        if voce.get("stato") != "da pubblicare" or voce.get("rete") not in reti:
            continue
        funzione, token = reti[voce["rete"]]
        if not token:
            print(f"[coda] manca il token per {voce['rete']}: la voce {voce.get('id')} aspetta")
            continue
        try:
            esito = funzione(voce, token)
        except (RuntimeError, requests.RequestException, KeyError) as e:
            voce["tentativi"] = voce.get("tentativi", 0) + 1
            voce["errore"] = str(e)[:300]
            if voce["tentativi"] >= TENTATIVI_MAX:
                voce["stato"] = "errore"
            print(f"[coda] errore su {voce.get('id')}: {e}")
            continue
        voce.update(esito, stato="pubblicato", pubblicato_il=_ora())
        voce.pop("errore", None)
        print(f"[coda] pubblicato {voce.get('id')} su {voce['rete']}")
    if salva:
        _scrivi(coda)
    return coda


if __name__ == "__main__":
    if (sys.argv[1] if len(sys.argv) > 1 else "pubblica") != "pubblica":
        sys.exit("Uso: python agenti/coda_social.py pubblica")
    pubblica()
