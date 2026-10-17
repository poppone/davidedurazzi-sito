"""Aurora Riva: coda dei post Instagram della modella IA.

Le regole sono quelle decise da Finch il 17/10/2026 (stanza/direttore.md, 6v):
- le immagini finali (solo JPG) stanno in aurora/ del sito; LoRA, prompt e
  scarti restano sul PC di Davide;
- ogni post esce con l'etichetta "Info IA" di Instagram (is_ai_generated);
- "Il conto": la foto è generata, i capi sono veri, quindi accanto ai prezzi
  c'è sempre la riga "Look ricreato con IA, capi reali." e i prezzi devono
  essere stati controllati (prezzi_verificati);
- post sponsorizzato: "#adv" in testa alla didascalia;
- fino a `doppia_approvazione_fino_al` un post esce solo se l'hanno approvato
  sia Davide sia Finch; dopo basta Finch.

Coda: social/aurora.json. Ciclo di un post:
  "bozza" -> Finch lo fa votare (Grafico sulla foto, Critico sulla didascalia,
  conta il voto più basso) -> "da approvare" -> "approvato" (con approvato_da)
  -> questo script lo pubblica all'ora di `quando` (ora italiana) ->
  "pubblicato" con post_id, oppure "errore" con il motivo.

Uso:
  python agenti/aurora.py controlla   elenca i problemi di ogni post in coda
  python agenti/aurora.py pubblica    pubblica i post approvati e in orario
Segreto: IG_AURORA_TOKEN (Instagram API with Instagram Login, account di Aurora).
"""
import json
import os
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

RADICE = Path(__file__).resolve().parent.parent
CODA = RADICE / "social" / "aurora.json"
CARTELLA_IMMAGINI = RADICE / "aurora"
API = "https://graph.instagram.com/" + os.environ.get("IG_API_VERSION", "v25.0")
ROMA = ZoneInfo("Europe/Rome")
TENTATIVI_MAX = 3
T = 120

RIGA_IA_CONTO = "Look ricreato con IA, capi reali."
MAX_DIDASCALIA = 2200
MAX_IMMAGINI = 10


def leggi() -> dict:
    return json.loads(CODA.read_text(encoding="utf-8"))


def scrivi(dati: dict) -> None:
    CODA.write_text(json.dumps(dati, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ora_di(post: dict) -> datetime:
    """`quando` è scritto in ora italiana, senza fuso."""
    return datetime.fromisoformat(post["quando"]).replace(tzinfo=ROMA)


# ---------- didascalia ----------
def didascalia(post: dict, imp: dict) -> str:
    righe = (post.get("caption") or "").replace("\\n", "\n").strip().split("\n")
    if post.get("rubrica") == "Il conto" and RIGA_IA_CONTO not in "\n".join(righe):
        # vicino ai prezzi: subito dopo la riga del totale, o in fondo all'elenco
        dove = next((i for i, r in enumerate(righe) if r.lower().startswith("totale")), None)
        righe.insert(dove + 1 if dove is not None else len(righe), RIGA_IA_CONTO)
    parti = []
    if post.get("sponsor"):
        parti.append(f"#adv Collaborazione con {post['sponsor']}")
    parti.append("\n".join(righe))
    if post.get("link_in_bio"):
        parti.append(imp.get("riga_link_in_bio", "I capi li trovi nel link in bio."))
    if imp.get("hashtag_fissi"):
        parti.append(imp["hashtag_fissi"])
    return "\n\n".join(p for p in parti if p.strip())


# ---------- controlli ----------
def problemi(post: dict, imp: dict) -> list[str]:
    """I problemi che impediscono la pubblicazione. Lista vuota = pronto."""
    p = []
    immagini = post.get("immagini") or []
    if not immagini:
        p.append("nessuna immagine")
    if len(immagini) > MAX_IMMAGINI:
        p.append(f"più di {MAX_IMMAGINI} immagini")
    for nome in immagini:
        if Path(nome).suffix.lower() not in (".jpg", ".jpeg"):
            p.append(f"{nome}: solo JPG")
        elif not (CARTELLA_IMMAGINI / nome).is_file():
            p.append(f"{nome}: manca in aurora/")
    if not (post.get("caption") or "").strip():
        p.append("didascalia vuota")
    elif len(didascalia(post, imp)) > MAX_DIDASCALIA:
        p.append("didascalia troppo lunga")
    if post.get("rubrica") == "Il conto":
        if "€" not in post.get("caption", ""):
            p.append("Il conto senza prezzi")
        if not post.get("prezzi_verificati"):
            p.append("prezzi non ancora verificati")
    try:
        ora_di(post)
    except (KeyError, ValueError):
        p.append("data `quando` mancante o non valida")
    return p


def approvazioni_mancanti(post: dict, imp: dict) -> list[str]:
    chi = set(post.get("approvato_da") or [])
    limite = date.fromisoformat(imp.get("doppia_approvazione_fino_al", "2000-01-01"))
    servono = {"davide", "finch"} if ora_di(post).date() <= limite else {"finch"}
    return sorted(servono - chi)


# ---------- Instagram ----------
def ig(metodo: str, percorso: str, token: str, **params) -> dict:
    params["access_token"] = token
    r = requests.request(metodo, f"{API}/{percorso}", params=params, timeout=T)
    if r.status_code >= 400:
        raise RuntimeError(f"Instagram {percorso}: HTTP {r.status_code} {r.text[:300]}")
    return r.json()


def attendi(cid: str, token: str, attesa: float = 5, giri: int = 36) -> None:
    for _ in range(giri):
        stato = ig("GET", cid, token, fields="status_code").get("status_code")
        if stato == "FINISHED":
            return
        if stato in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram ha rifiutato l'immagine (stato {stato})")
        time.sleep(attesa)
    raise RuntimeError("Instagram non ha finito di elaborare le immagini in tempo")


def pubblica_post(post: dict, imp: dict, token: str, **kw) -> dict:
    base = imp["base_url_immagini"].rstrip("/")
    urls = [f"{base}/{nome}" for nome in post["immagini"]]
    utente = ig("GET", "me", token, fields="user_id,username")
    uid = utente.get("user_id") or utente["id"]
    testo = didascalia(post, imp)
    if len(urls) == 1:
        cid = ig("POST", f"{uid}/media", token, image_url=urls[0], caption=testo,
                 is_ai_generated="true")["id"]
    else:
        figli = [ig("POST", f"{uid}/media", token, image_url=u, is_carousel_item="true")["id"] for u in urls]
        for f in figli:
            attendi(f, token, **kw)
        # Nei caroselli l'etichetta IA va solo sul contenitore
        cid = ig("POST", f"{uid}/media", token, media_type="CAROUSEL", children=",".join(figli),
                 caption=testo, is_ai_generated="true")["id"]
    attendi(cid, token, **kw)
    post_id = ig("POST", f"{uid}/media_publish", token, creation_id=cid)["id"]
    return {"post_id": post_id, "account": utente.get("username")}


# ---------- comandi ----------
def controlla(dati: dict) -> int:
    imp = dati.get("impostazioni", {})
    pronti = 0
    for post in dati.get("post", []):
        if post.get("stato") in ("pubblicato", "scartato"):
            continue
        p = problemi(post, imp)
        mancano = approvazioni_mancanti(post, imp) if not p else []
        if not p:
            pronti += 1
        stato = "pronto" if not p else "; ".join(p)
        firma = f" (manca l'ok di: {', '.join(mancano)})" if mancano else ""
        print(f"[aurora] {post['id']} [{post.get('stato')}] {stato}{firma}")
    print(f"[aurora] post completi in coda: {pronti}")
    return pronti


def pubblica(dati: dict, token: str, adesso: datetime | None = None, **kw) -> dict:
    imp = dati.get("impostazioni", {})
    adesso = adesso or datetime.now(timezone.utc)
    for post in dati.get("post", []):
        if post.get("stato") != "approvato":
            continue
        if ora_di(post) > adesso:
            continue
        p = problemi(post, imp)
        mancano = approvazioni_mancanti(post, imp)
        if p or mancano:
            motivo = "; ".join(p + ([f"manca l'ok di {', '.join(mancano)}"] if mancano else []))
            if post.get("errore") != motivo:
                print(f"[aurora] {post['id']} non parte: {motivo}")
            post["errore"] = motivo
            continue
        try:
            esito = pubblica_post(post, imp, token, **kw)
        except (RuntimeError, requests.RequestException, KeyError) as e:
            post["tentativi"] = post.get("tentativi", 0) + 1
            post["errore"] = str(e)[:300]
            if post["tentativi"] >= TENTATIVI_MAX:
                post["stato"] = "errore"
            print(f"[aurora] errore su {post['id']}: {e}")
            continue
        post.update(esito, stato="pubblicato",
                    pubblicato_il=datetime.now(timezone.utc).isoformat(timespec="seconds"))
        post.pop("errore", None)
        print(f"[aurora] pubblicato {post['id']} ({esito['post_id']})")
    return dati


if __name__ == "__main__":
    comando = sys.argv[1] if len(sys.argv) > 1 else ""
    dati = leggi()
    if comando == "controlla":
        controlla(dati)
    elif comando == "pubblica":
        token = os.environ.get("IG_AURORA_TOKEN", "")
        if not token:
            print("[aurora] manca IG_AURORA_TOKEN: nessuna pubblicazione (i post restano in coda)")
            sys.exit(0)
        scrivi(pubblica(dati, token))
    else:
        sys.exit("Uso: python agenti/aurora.py controlla | pubblica")
