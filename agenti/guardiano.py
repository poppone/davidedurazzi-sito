"""Guardiano delle chiavi: ogni mattina controlla che niente si stia per fermare.

Controlla, senza mai stampare un segreto:
- che le chiavi e i token usati dagli agenti rispondano ancora;
- quando scade il token GitHub GH_PAT (lo dice GitHub stesso);
- che l'ultima esecuzione di ogni workflow dei repo dell'azienda sia andata bene;
- che il sito e le sue funzioni rispondano.

Scrive il risultato in stanza/guardiano.json e, per ogni problema nuovo, apre un
compito "da fare" per Davide in stanza/bacheca.json (se c'è già, aumenta
`volte`). Non corregge niente da solo: i segreti li cambia solo Davide.

Uso: python agenti/guardiano.py
"""
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

import requests

RADICE = Path(__file__).resolve().parent.parent
USCITA = RADICE / "stanza" / "guardiano.json"
BACHECA = RADICE / "stanza" / "bacheca.json"
SITO = "https://www.davidedurazzi.it"
REPO = ["poppone/davidedurazzi-sito", "poppone/samaritan_v2", "poppone/samaritan-notizie", "poppone/samaritan-animali"]
AVVISO_GIORNI = 14  # avvisa quando un token scade entro questi giorni
T = 20  # secondi di attesa massima per ogni richiesta

OK, ATTENZIONE, ROTTO, SALTATO = "ok", "attenzione", "rotto", "non controllato"
controlli: list[dict] = []


def esito(nome: str, stato: str, messaggio: str, rimedio: str = "") -> None:
    controlli.append({"nome": nome, "esito": stato, "messaggio": messaggio, "rimedio": rimedio})
    print(f"[{stato}] {nome}: {messaggio}")


def chiave(nome_env: str, nome: str, prova, rimedio: str) -> None:
    """Prova una chiave con una chiamata innocua (solo lettura)."""
    valore = os.environ.get(nome_env, "")
    if not valore:
        esito(nome, SALTATO, f"{nome_env} non è passato al Guardiano", "")
        return
    try:
        r = prova(valore)
    except requests.RequestException as e:
        esito(nome, ATTENZIONE, f"servizio non raggiungibile ({type(e).__name__})", "Riprovo domani; se continua, controlla il servizio.")
        return
    if r.status_code in (200, 201):
        esito(nome, OK, "risponde")
    elif r.status_code in (401, 403):
        esito(nome, ROTTO, f"rifiutata ({r.status_code}): scaduta o revocata", rimedio)
    else:
        esito(nome, ATTENZIONE, f"risposta insolita ({r.status_code})", "Controlla il servizio; se continua, rigenera la chiave.")


def controlla_chiavi() -> None:
    chiave("IG_ACCESS_TOKEN", "Token Instagram",
           lambda v: requests.get("https://graph.instagram.com/me", params={"fields": "user_id", "access_token": v}, timeout=T),
           "Rigenera il token dal pannello Meta (Instagram API with Instagram Login) e aggiorna il segreto IG_ACCESS_TOKEN nel repo del sito.")
    chiave("IG_AURORA_TOKEN", "Token Instagram di Aurora",
           lambda v: requests.get("https://graph.instagram.com/me", params={"fields": "user_id", "access_token": v}, timeout=T),
           "Rigenera il token dell'account di Aurora dal pannello Meta (Instagram API with Instagram Login) e aggiorna il segreto IG_AURORA_TOKEN nel repo del sito.")
    chiave("FB_PAGE_TOKEN", "Token pagina Facebook",
           lambda v: requests.get("https://graph.facebook.com/me", params={"access_token": v}, timeout=T),
           "Rigenera il token della pagina e aggiorna il segreto FB_PAGE_TOKEN nel repo del sito.")
    chiave("GEMINI_API_KEY", "Chiave Gemini (redazione)",
           lambda v: requests.get("https://generativelanguage.googleapis.com/v1beta/models", params={"key": v, "pageSize": 1}, timeout=T),
           "Crea una chiave nuova su aistudio.google.com e aggiorna GEMINI_API_KEY nel repo del sito e su Vercel.")
    chiave("GROQ_API_KEY", "Chiave Groq",
           lambda v: requests.get("https://api.groq.com/openai/v1/models", headers={"Authorization": "Bearer " + v}, timeout=T),
           "Crea una chiave nuova su console.groq.com e aggiorna GROQ_API_KEY nel repo del sito.")
    chiave("PINTEREST_TOKEN", "Token Pinterest",
           lambda v: requests.get("https://api.pinterest.com/v5/user_account", headers={"Authorization": "Bearer " + v}, timeout=T),
           "Rigenera il token dall'app Pinterest e aggiorna PINTEREST_TOKEN nel repo del sito.")


def controlla_gh_pat() -> None:
    v = os.environ.get("GH_PAT", "")
    if not v:
        esito("Token GitHub GH_PAT", SALTATO, "GH_PAT non è passato al Guardiano")
        return
    try:
        r = requests.get("https://api.github.com/user", headers={"Authorization": "Bearer " + v}, timeout=T)
    except requests.RequestException as e:
        esito("Token GitHub GH_PAT", ATTENZIONE, f"GitHub non raggiungibile ({type(e).__name__})")
        return
    rimedio = "Crea un token nuovo su github.com/settings/tokens con gli stessi permessi e aggiorna il segreto GH_PAT nel repo del sito."
    if r.status_code != 200:
        esito("Token GitHub GH_PAT", ROTTO, f"rifiutato ({r.status_code})", rimedio)
        return
    scade = r.headers.get("github-authentication-token-expiration", "")
    if not scade:
        esito("Token GitHub GH_PAT", OK, "risponde, senza scadenza")
        return
    try:
        quando = datetime.strptime(scade[:19], "%Y-%m-%d %H:%M:%S").date()
    except ValueError:
        esito("Token GitHub GH_PAT", OK, f"risponde (scadenza: {scade})")
        return
    giorni = (quando - date.today()).days
    if giorni <= AVVISO_GIORNI:
        esito("Token GitHub GH_PAT", ATTENZIONE, f"scade il {quando.isoformat()}, tra {giorni} giorni", rimedio)
    else:
        esito("Token GitHub GH_PAT", OK, f"scade il {quando.isoformat()}")


def controlla_bot_twitch() -> None:
    v = os.environ.get("TWITCH_BOT_TOKEN", "").removeprefix("oauth:")
    nome = "Token del bot della chat Twitch"
    if not v:
        esito(nome, SALTATO, "TWITCH_BOT_TOKEN non c'è ancora: la Chat delle dirette non può partire")
        return
    rimedio = "Rigenera il token del bot (scope chat:read e chat:edit) e aggiorna TWITCH_BOT_TOKEN nel repo del sito."
    try:
        r = requests.get("https://id.twitch.tv/oauth2/validate", headers={"Authorization": "OAuth " + v}, timeout=T)
    except requests.RequestException as e:
        esito(nome, ATTENZIONE, f"Twitch non raggiungibile ({type(e).__name__})")
        return
    if r.status_code != 200:
        esito(nome, ROTTO, f"rifiutato ({r.status_code})", rimedio)
        return
    j = r.json()
    mancano = {"chat:read", "chat:edit"} - set(j.get("scopes", []))
    giorni = int(j.get("expires_in", 0)) // 86400
    if mancano:
        esito(nome, ROTTO, "mancano i permessi " + ", ".join(sorted(mancano)), rimedio)
    elif j.get("expires_in") and giorni <= AVVISO_GIORNI:
        esito(nome, ATTENZIONE, f"scade tra {giorni} giorni", rimedio)
    else:
        esito(nome, OK, "valido" + (f", scade tra {giorni} giorni" if j.get("expires_in") else ""))


def controlla_workflow() -> None:
    gh = os.environ.get("GITHUB_TOKEN", "")
    intest = {"Authorization": "Bearer " + gh} if gh else {}
    for repo in REPO:
        try:
            r = requests.get(f"https://api.github.com/repos/{repo}/actions/workflows", headers=intest, timeout=T)
            r.raise_for_status()
        except requests.RequestException:
            esito(f"Workflow di {repo}", ATTENZIONE, "elenco dei workflow non leggibile")
            continue
        for wf in r.json().get("workflows", []):
            if wf.get("state") != "active":
                continue
            try:
                runs = requests.get(f"https://api.github.com/repos/{repo}/actions/workflows/{wf['id']}/runs",
                                    params={"per_page": 1, "status": "completed", "branch": "main"}, headers=intest, timeout=T).json().get("workflow_runs", [])
            except (requests.RequestException, ValueError):
                continue
            if not runs:
                continue
            ultima = runs[0]
            nome = f"{repo.split('/')[1]} · {wf['name']}"
            quando = ultima.get("updated_at", "")[:10]
            if ultima.get("conclusion") in ("failure", "timed_out", "startup_failure"):
                esito(nome, ROTTO, f"l'ultima esecuzione del {quando} è fallita", "Apri il log: " + ultima.get("html_url", ""))
            else:
                esito(nome, OK, f"ultima esecuzione del {quando}: {ultima.get('conclusion')}")


def controlla_sito() -> None:
    prove = [
        ("Sito davidedurazzi.it", SITO + "/", None),
        ("Commenti del sito", SITO + "/api/commenti?slug=prova-guardiano", "commenti"),
        ("Ultima diretta Twitch sul sito", SITO + "/api/twitch?canale=davidedurazzi", "video"),
    ]
    for nome, url, campo in prove:
        try:
            r = requests.get(url, timeout=T)
        except requests.RequestException as e:
            esito(nome, ROTTO, f"non risponde ({type(e).__name__})", "Controlla Vercel.")
            continue
        if r.status_code != 200:
            esito(nome, ROTTO, f"risponde {r.status_code}", "Controlla i log delle funzioni su Vercel e le variabili d'ambiente.")
            continue
        if campo == "video":
            j = r.json()
            if j.get("video"):
                esito(nome, OK, "c'è l'ultima diretta salvata")
            else:
                esito(nome, ATTENZIONE, j.get("motivo") or "nessuna diretta salvata",
                      "Se mancano le chiavi: crea un'app su dev.twitch.tv/console e metti TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET su Vercel. Altrimenti attiva l'archivio delle dirette su Twitch.")
        else:
            esito(nome, OK, "risponde")


def apri_compiti() -> None:
    if not BACHECA.exists():
        return
    b = json.loads(BACHECA.read_text(encoding="utf-8"))
    compiti = b.setdefault("compiti", [])
    oggi = date.today().isoformat()
    n = sum(1 for c in compiti if str(c.get("id", "")).startswith(oggi))
    cambiato = False
    for c in controlli:
        if c["esito"] not in (ROTTO, ATTENZIONE) or not c["rimedio"]:
            continue
        titolo = f"Guardiano: {c['nome']}"
        aperto = next((x for x in compiti if x.get("titolo") == titolo and x.get("stato") in ("da fare", "da approvare")), None)
        if aperto:
            aperto["volte"] = int(aperto.get("volte", 1)) + 1
            aperto["dettagli"] = f"{c['messaggio']}. {c['rimedio']}"
        else:
            n += 1
            compiti.append({"id": f"{oggi}-g{n}", "per": "davide", "da": "guardiano", "stato": "da fare",
                            "titolo": titolo, "dettagli": f"{c['messaggio']}. {c['rimedio']}",
                            "origine": "controllo del Guardiano delle chiavi", "volte": 1})
        cambiato = True
    if cambiato:
        b["aggiornato"] = oggi
        BACHECA.write_text(json.dumps(b, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    controlla_chiavi()
    controlla_gh_pat()
    controlla_bot_twitch()
    controlla_workflow()
    controlla_sito()
    conta = {s: sum(1 for c in controlli if c["esito"] == s) for s in (OK, ATTENZIONE, ROTTO, SALTATO)}
    USCITA.write_text(json.dumps({
        "aggiornato": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "riassunto": conta,
        "controlli": controlli,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    apri_compiti()
    print(f"Fatto: {conta}")


if __name__ == "__main__":
    main()
