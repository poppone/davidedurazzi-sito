"""Coda social: pubblica direttamente i Reel su Instagram e i Pin su Pinterest.

Serve finché Metricool è al limite gratuito (20 pubblicazioni al mese).
Finch aggiunge le voci in social/coda.json, solo per cose già approvate da Davide
o coperte dal permesso fisso (regola 6e di stanza/direttore.md). Questo script
pubblica le voci "da pubblicare" e scrive l'esito nella stessa voce.

Voce Reel:
  {"id": "...", "rete": "instagram_reel", "stato": "da pubblicare",
   "video_url": "https://...mp4", "didascalia": "..."}
Voce Pin:
  {"id": "...", "rete": "pinterest", "stato": "da pubblicare",
   "image_url": "https://...jpg", "titolo": "...", "didascalia": "...",
   "link": "https://...", "board_id": "..."}

Uso: python agenti/coda_social.py pubblica
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

RADICE = Path(__file__).resolve().parent.parent
CODA = RADICE / "social" / "coda.json"

IG_API = "https://graph.instagram.com/" + os.environ.get("IG_API_VERSION", "v25.0")
PIN_API = "https://api.pinterest.com/v5"
NOTA_AI = "Video realizzato con l'AI: voce sintetica e montaggio automatico."
TENTATIVI_MAX = 3


def _leggi() -> list[dict]:
    return json.loads(CODA.read_text(encoding="utf-8")) if CODA.exists() else []


def _scrivi(coda: list[dict]) -> None:
    CODA.parent.mkdir(exist_ok=True)
    CODA.write_text(json.dumps(coda, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _ora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


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


def pubblica_pin(voce: dict, token: str) -> dict:
    corpo = {
        "board_id": voce["board_id"],
        "title": (voce.get("titolo") or "")[:100],
        "description": (voce.get("didascalia") or "").replace("\\n", "\n")[:500],
        "link": voce.get("link"),
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
    reti = {
        "instagram_reel": (pubblica_reel, env.get("IG_ACCESS_TOKEN", "")),
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
            esito = funzione(voce, token, **kw) if voce["rete"] == "instagram_reel" else funzione(voce, token)
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
