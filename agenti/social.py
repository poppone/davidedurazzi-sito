"""Facebook (pagina) e LinkedIn (profilo personale): pubblica gli articoli approvati.

Uso: python agenti/social.py pubblica
Secret richiesti (se mancano, la rete corrispondente viene saltata):
  FB_PAGE_ID, FB_PAGE_TOKEN   -> pagina Facebook (token di pagina)
  LI_ACCESS_TOKEN             -> LinkedIn, scope openid + profile + w_member_social (dura 60 giorni)
"""
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from instagram import ARTICOLI, CARTELLA_IG, GIORNI_MAX, SEZIONI, SITO, _aspetta_online, _leggi  # noqa: E402

RADICE = Path(__file__).resolve().parent.parent
REGISTRO = RADICE / "social" / "social.json"
FB_ID = os.environ.get("FB_PAGE_ID", "")
FB_TOKEN = os.environ.get("FB_PAGE_TOKEN", "")
LI_TOKEN = os.environ.get("LI_ACCESS_TOKEN", "")
FB_API = "https://graph.facebook.com/" + os.environ.get("FB_API_VERSION", "v21.0")
# Versioni dell'API LinkedIn da provare in ordine (LinkedIn ritira le piu vecchie dopo circa un anno)
LI_VERSIONI = [v for v in [os.environ.get("LI_API_VERSION", "")] + ["202609", "202608", "202607", "202606", "202605"] if v]
_li_ok = [None]
HASHTAG = {
    "tecnologia": "#tecnologia #tech", "ai": "#intelligenzaartificiale #AI",
    "gaming": "#gaming #videogiochi", "cronaca": "#cronaca #attualità", "politica": "#politica #attualità",
}


def testo(a: dict, rete: str) -> str:
    link = f"{SITO}/articoli/{a['slug']}"
    parti = [a["titolo"], a.get("sommario", "")]
    if a.get("domanda"):
        parti.append(f"Il Contraddittorio: {a['domanda']}\nVota Sì o No e dì la tua nei commenti sul sito.")
    parti.append(f"Articolo completo, fonti e voto: {link}")
    if rete == "facebook":
        parti.append("Ne parliamo in diretta su Twitch: twitch.tv/davidedurazzi")
    parti.append(HASHTAG.get(a.get("sezione"), "#attualità") + " #davidedurazzi")
    return "\n\n".join(p for p in parti if p)[:2900]


def da_pubblicare(registro: dict) -> list[dict]:
    limite = (date.today() - timedelta(days=GIORNI_MAX)).isoformat()
    return [a for a in _leggi(ARTICOLI, []) if a.get("pubblicato") and a.get("data", "") >= limite]


def facebook(a: dict, immagine_url: str) -> str:
    r = requests.post(f"{FB_API}/{FB_ID}/photos", data={"url": immagine_url, "caption": testo(a, "facebook"), "access_token": FB_TOKEN}, timeout=90)
    if r.status_code >= 400:
        raise RuntimeError(f"Facebook HTTP {r.status_code} {r.text[:300]}")
    return r.json().get("post_id") or r.json().get("id", "")


def _li(metodo: str, url: str, **kw) -> requests.Response:
    versioni = [_li_ok[0]] if _li_ok[0] else LI_VERSIONI
    for v in versioni:
        h = {"Authorization": f"Bearer {LI_TOKEN}", "LinkedIn-Version": v, "X-Restli-Protocol-Version": "2.0.0"}
        r = requests.request(metodo, url, headers=h, timeout=90, **kw)
        if r.status_code == 426:  # versione non piu attiva: provo la successiva
            continue
        _li_ok[0] = v
        break
    if r.status_code >= 400:
        raise RuntimeError(f"LinkedIn {url.split('?')[0]} HTTP {r.status_code} {r.text[:300]}")
    return r


def linkedin(a: dict, immagine_url: str) -> str:
    persona = _li("GET", "https://api.linkedin.com/v2/userinfo").json()["sub"]
    owner = f"urn:li:person:{persona}"
    init = _li("POST", "https://api.linkedin.com/rest/images?action=initializeUpload", json={"initializeUploadRequest": {"owner": owner}}).json()["value"]
    img = requests.get(immagine_url, timeout=60)
    img.raise_for_status()
    requests.put(init["uploadUrl"], data=img.content, headers={"Authorization": f"Bearer {LI_TOKEN}"}, timeout=90).raise_for_status()
    corpo = {
        "author": owner, "commentary": testo(a, "linkedin"), "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "content": {"media": {"title": a["titolo"][:200], "id": init["image"]}},
        "lifecycleState": "PUBLISHED", "isReshareDisabledByAuthor": False,
    }
    r = _li("POST", "https://api.linkedin.com/rest/posts", json=corpo)
    return r.headers.get("x-restli-id", "")


def pubblica() -> None:
    reti = {"facebook": bool(FB_ID and FB_TOKEN), "linkedin": bool(LI_TOKEN)}
    for n, ok in reti.items():
        if not ok:
            print(f"[social] {n}: segreti mancanti, salto.")
    if not any(reti.values()):
        return
    registro = _leggi(REGISTRO, {})
    for a in da_pubblicare(registro):
        fatti = registro.get(a["slug"], {})
        mancanti = [n for n, ok in reti.items() if ok and n not in fatti]
        copertina = CARTELLA_IG / a["slug"] / "1.jpg"
        if not mancanti or not copertina.exists():
            continue
        img = f"{SITO}/ig/{a['slug']}/1.jpg"
        if not (_aspetta_online(img) and _aspetta_online(f"{SITO}/articoli/{a['slug']}")):
            print(f"[social] '{a['slug']}' non ancora online, riprovo al prossimo giro")
            continue
        for rete in mancanti:
            try:
                pid = facebook(a, img) if rete == "facebook" else linkedin(a, img)
            except Exception as e:  # una rete in errore non blocca le altre
                print(f"[social] errore {rete} su '{a['slug']}': {e}")
                continue
            fatti[rete] = {"id": pid, "data": date.today().isoformat()}
            registro[a["slug"]] = fatti
            REGISTRO.parent.mkdir(exist_ok=True)
            REGISTRO.write_text(json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[social] pubblicato su {rete}: '{a['titolo']}'")


if __name__ == "__main__":
    pubblica()
