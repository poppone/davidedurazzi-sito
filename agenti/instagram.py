"""Instagram: crea i caroselli degli articoli approvati e li pubblica via API.

Uso:
  python agenti/instagram.py genera    -> crea le immagini in ig/<slug>/ (da committare)
  python agenti/instagram.py pubblica  -> pubblica i caroselli già online sul sito
"""
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from slides import crea_carosello  # noqa: E402

RADICE = Path(__file__).resolve().parent.parent
ARTICOLI = RADICE / "content" / "articoli.json"
REGISTRO = RADICE / "social" / "instagram.json"
CARTELLA_IG = RADICE / "ig"

SITO = "https://www.davidedurazzi.it"  # con www: Instagram non segue i redirect
TWITCH = "popponetv"
GIORNI_MAX = 3  # non pubblica articoli più vecchi di così
API = "https://graph.instagram.com/" + os.environ.get("IG_API_VERSION", "v25.0")
TOKEN = os.environ.get("IG_ACCESS_TOKEN", "")
SEZIONI = {
    "cronaca": "Cronaca", "politica": "Politica ed elezioni", "quotidiano": "Vita quotidiana",
    "economia": "Economia e soldi", "tecnologia": "Tecnologia e AI", "sport": "Sport",
    "spettacolo": "Spettacolo e social", "gaming": "Gaming", "motori": "Motori",
}
HASHTAG = {
    "cronaca": "#cronaca #notizie #italia",
    "politica": "#politica #elezioni #italia",
    "quotidiano": "#vitaquotidiana #attualità #italia",
    "economia": "#economia #soldi #risparmio",
    "tecnologia": "#tecnologia #intelligenzaartificiale #tech",
    "sport": "#sport #calcio #italia",
    "spettacolo": "#spettacolo #tv #social",
    "gaming": "#gaming #videogiochi #gamer",
    "motori": "#motori #auto #moto",
}


def _leggi(p: Path, vuoto):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else vuoto


def _da_pubblicare() -> list[dict]:
    registro = _leggi(REGISTRO, {})
    limite = (date.today() - timedelta(days=GIORNI_MAX)).isoformat()
    return [
        a for a in _leggi(ARTICOLI, [])
        if a.get("pubblicato") and a["slug"] not in registro and a.get("data", "") >= limite
    ]


def didascalia(a: dict) -> str:
    parti = [a["titolo"], a.get("sommario", "")]
    if a.get("domanda"):
        parti.append(f"Il Contraddittorio: {a['domanda']}\nTu da che parte stai? Scrivilo nei commenti.")
    else:
        parti.append("Tu cosa ne pensi? Scrivilo nei commenti.")
    parti.append(f"Ne parliamo in diretta su Twitch: twitch.tv/{TWITCH}\nArticolo completo e fonti su davidedurazzi.it (link in bio)")
    testate = sorted({f["nome"].split(":")[0] for f in a.get("fonti", [])})
    if testate:
        parti.append("Fonti: " + ", ".join(testate))
    parti.append(HASHTAG.get(a.get("sezione"), "#attualità") + " #davidedurazzi")
    return "\n\n".join(p for p in parti if p)[:2200]


def genera() -> None:
    for a in _da_pubblicare():
        cartella = CARTELLA_IG / a["slug"]
        if cartella.exists():
            continue
        file = crea_carosello(a, SEZIONI.get(a.get("sezione"), ""), TWITCH, cartella)
        print(f"[ig] {len(file)} slide per '{a['titolo']}'")


def _api(metodo: str, percorso: str, **params) -> dict:
    params["access_token"] = TOKEN
    r = requests.request(metodo, f"{API}/{percorso}", params=params, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"Instagram {percorso}: HTTP {r.status_code} {r.text[:300]}")
    return r.json()


def _aspetta_online(url: str, minuti: int = 8) -> bool:
    fine = time.time() + minuti * 60
    while time.time() < fine:
        try:
            if requests.head(url, timeout=15, allow_redirects=False).status_code == 200:
                return True
        except requests.RequestException:
            pass
        time.sleep(20)
    return False


def _aspetta_container(cid: str) -> None:
    for _ in range(30):
        stato = _api("GET", cid, fields="status_code").get("status_code")
        if stato == "FINISHED":
            return
        if stato in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Container {cid} in stato {stato}")
        time.sleep(5)
    raise RuntimeError(f"Container {cid} non pronto in tempo")


def pubblica() -> None:
    if not TOKEN:
        print("[ig] Manca IG_ACCESS_TOKEN: salto la pubblicazione.")
        return
    io = _api("GET", "me", fields="user_id,username")
    utente = io.get("user_id") or io["id"]
    registro = _leggi(REGISTRO, {})

    for a in _da_pubblicare():
        cartella = CARTELLA_IG / a["slug"]
        immagini = sorted(cartella.glob("*.jpg"), key=lambda p: int(p.stem))
        if len(immagini) < 2:
            continue
        urls = [f"{SITO}/ig/{a['slug']}/{p.name}" for p in immagini]
        if not all(_aspetta_online(u) for u in urls):
            print(f"[ig] immagini non ancora online per '{a['slug']}', riprovo al prossimo giro")
            continue
        try:
            figli = [_api("POST", f"{utente}/media", image_url=u, is_carousel_item="true")["id"] for u in urls]
            for f in figli:
                _aspetta_container(f)
            carosello = _api("POST", f"{utente}/media", media_type="CAROUSEL",
                             children=",".join(figli), caption=didascalia(a))["id"]
            _aspetta_container(carosello)
            post = _api("POST", f"{utente}/media_publish", creation_id=carosello)["id"]
        except RuntimeError as e:
            print(f"[ig] errore su '{a['slug']}': {e}")
            continue
        registro[a["slug"]] = {"id": post, "data": date.today().isoformat()}
        REGISTRO.parent.mkdir(exist_ok=True)
        REGISTRO.write_text(json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[ig] pubblicato '{a['titolo']}' (id {post}) su @{io.get('username')}")


if __name__ == "__main__":
    {"genera": genera, "pubblica": pubblica}[sys.argv[1] if len(sys.argv) > 1 else "genera"]()
