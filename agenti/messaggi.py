"""Messaggi privati: legge i DM di Instagram e li smista.

Ogni giro (workflow messaggi.yml, ogni 30 minuti):
1. invia le risposte che Davide ha approvato dal pannello /admin;
2. legge i messaggi nuovi arrivati su Instagram e li fa classificare all'AI:
   - "pratica": domanda a cui si risponde con i fatti (orari, link, come
     ordinare su ZampaViva...). Prepara una risposta che si dichiara AI;
   - "personale": tutto il resto (collaborazioni, opinioni, questioni
     private). Nessuna risposta automatica: la vede Davide;
   - "ignora": spam, insulti, messaggi vuoti.
3. Con MODALITA_DM=bozze (la partenza) anche le risposte pratiche aspettano
   l'ok di Davide nel pannello. Con MODALITA_DM=auto le invia da solo, sempre
   con la firma "Risposta automatica (AI)".

Privacy: il repo è pubblico, quindi testi e nomi dei messaggi stanno SOLO nel
database privato del sito (Upstash Redis, chiavi dd:dm:*), che il pannello
/admin legge. Nel repo finisce solo stanza/messaggi.json con i conteggi.

TikTok non dà accesso ai messaggi privati con le API pubbliche: lì niente agente.

Account di Aurora Riva (MESSAGGI_ACCOUNT=aurora, segreto IG_AURORA_TOKEN), regole di
Finch del 17/10/2026: l'agente smista e basta, non risponde MAI e non chatta mai
"come Aurora". Collaborazioni e il resto vanno a Davide; i messaggi a sfondo
sessuale o da profili che sembrano minorenni diventano "da bloccare": Davide li
blocca e li segnala dall'app (le API non permettono di bloccare). Chiavi
separate (dd:dma:*), così dal pannello non può partire nessuna risposta.

Segreti: IG_ACCESS_TOKEN (con il permesso instagram_business_manage_messages),
UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (gli stessi di Vercel),
una chiave AI (GROQ_API_KEY, GITHUB_TOKEN o GEMINI_API_KEY).
"""
import json
import re
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
import llm  # noqa: E402

RADICE = Path(__file__).resolve().parent.parent
CONTEGGI = RADICE / "stanza" / "messaggi.json"
API = "https://graph.instagram.com/" + os.environ.get("IG_API_VERSION", "v25.0")
ACCOUNT = os.environ.get("MESSAGGI_ACCOUNT", "davide")
AURORA = ACCOUNT == "aurora"
TOKEN = os.environ.get("IG_AURORA_TOKEN" if AURORA else "IG_ACCESS_TOKEN", "")
P = "dma:" if AURORA else "dm:"  # prefisso delle chiavi nel database privato
if AURORA:
    CONTEGGI = RADICE / "stanza" / "messaggi-aurora.json"
DB_URL = os.environ.get("UPSTASH_REDIS_REST_URL") or os.environ.get("KV_REST_API_URL", "")
DB_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN") or os.environ.get("KV_REST_API_TOKEN", "")
MODALITA = os.environ.get("MODALITA_DM", "bozze")
FIRMA = "Risposta automatica (AI) della redazione di Davide Durazzi: "
FINESTRA = timedelta(hours=23)  # Instagram permette di rispondere entro 24 ore dall'ultimo messaggio
T = 30

SISTEMA = """Smisti i messaggi privati Instagram di Davide Durazzi (creator italiano di tecnologia, AI e
gaming; ha anche il negozio per animali ZampaViva). Rispondi SOLO in JSON:
{"tipo": "pratica" | "personale" | "ignora", "risposta": "..."}
- "pratica": domande su fatti che trovi nelle INFORMAZIONI qui sotto (orari della diretta, link, dove
  leggere gli articoli, come ordinare o spedizioni di ZampaViva se indicate). "risposta": 1-3 frasi in
  italiano, cortese, solo fatti presenti nelle INFORMAZIONI. Se l'informazione non c'è, è "personale".
- "personale": collaborazioni, sponsor, opinioni, complimenti, critiche, richieste a Davide, qualsiasi
  cosa che deve leggere lui. "risposta" vuota.
- "ignora": spam, truffe, insulti, messaggi senza contenuto. "risposta" vuota.
Non fingerti mai Davide, non promettere niente a suo nome, non chiedere dati personali."""

SISTEMA_AURORA = """Smisti i messaggi privati Instagram di Aurora Riva, modella virtuale dichiaratamente IA
creata da Davide Durazzi (moda e look low cost a Roma). NON rispondi mai: classifichi e basta.
Rispondi SOLO in JSON: {"tipo": "collaborazione" | "segnala" | "personale" | "ignora"}
- "segnala": contenuto sessuale, richieste intime o di foto private, molestie, oppure il mittente
  sembra minorenne (dice un'età sotto i 18 anni, parla di scuola media o superiore, linguaggio da ragazzino).
  Nel dubbio su questi punti, "segnala".
- "collaborazione": brand, negozi, agenzie, proposte di lavoro o sponsor.
- "personale": domande sui look e sui capi, complimenti, critiche, tutto il resto che Davide può leggere.
- "ignora": spam, truffe, link sospetti, messaggi senza contenuto."""

# Rete di sicurezza se l'AI sbaglia o non risponde: questi messaggi vanno sempre segnalati
SEGNALA = re.compile(r"\b(nud[aeio]|sesso|sex|porno|onlyfans|hot|piccant[ei]|intim[aeio]|ho (1[0-7]|[5-9]) anni|"
                     r"(prima|seconda|terza) media|scuola media)\b", re.IGNORECASE)

INFORMAZIONI = """Diretta: martedì alle 21:30 su twitch.tv/davidedurazzi.
Sito con articoli e fonti: davidedurazzi.it. YouTube: youtube.com/@davidedurazzioff. TikTok: @davidedurazzi.
Il Contraddittorio: in diretta si vota con !si o !no in chat; le posizioni sono sul sito.
Il gioco Il Sistema: durazzidev.itch.io/il-sistema. L'app Ricordati: Google Play.
Sostenere il canale: ko-fi.com/davidedurazzi. Contatti per collaborazioni: info@davidedurazzi.it.
ZampaViva (negozio per animali): zampavivaoff.myshopify.com; per un ordine già fatto scrivere a info@davidedurazzi.it con il numero d'ordine."""


# ---------- database privato (stesso prefisso del sito: dd:) ----------
def db(*comandi):
    if not DB_URL or not DB_TOKEN:
        raise SystemExit("Mancano UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN: i messaggi non possono essere salvati in privato.")
    corpo = [[c[0], "dd:" + c[1], *c[2:]] for c in comandi]
    r = requests.post(DB_URL + "/pipeline", headers={"Authorization": "Bearer " + DB_TOKEN}, json=corpo, timeout=T)
    r.raise_for_status()
    return [x.get("result") for x in r.json()]


def leggi(mid: str) -> dict | None:
    v = db(["GET", P + mid])[0]
    return json.loads(v) if v else None


def salva(m: dict) -> None:
    db(["SET", P + m["id"], json.dumps(m, ensure_ascii=False), "EX", str(60 * 86400)])


# ---------- Instagram ----------
def ig(percorso: str, **params) -> dict:
    r = requests.get(f"{API}/{percorso}", params={**params, "access_token": TOKEN}, timeout=T)
    if r.status_code != 200:
        raise RuntimeError(f"Instagram {percorso}: {r.status_code} {r.text[:200]}")
    return r.json()


def invia_dm(igsid: str, testo: str) -> None:
    r = requests.post(f"{API}/me/messages", params={"access_token": TOKEN},
                      json={"recipient": {"id": igsid}, "message": {"text": testo[:1000]}}, timeout=T)
    if r.status_code != 200:
        raise RuntimeError(f"invio non riuscito ({r.status_code}): {r.text[:200]}")


def quando(s: str) -> datetime:
    return datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)


def invia_approvati(conta: dict) -> None:
    for mid in db(["LRANGE", P + "approvati", "0", "-1"])[0] or []:
        m = leggi(mid)
        db(["LREM", P + "approvati", "0", mid])
        if not m or m.get("stato") != "approvato":
            continue
        if datetime.now(timezone.utc) - quando(m["quando"]) > FINESTRA:
            m["stato"], m["errore"] = "scaduto", "passate 24 ore: Instagram non permette più di rispondere da qui"
        else:
            try:
                invia_dm(m["igsid"], FIRMA + m["bozza"] if not m.get("di_davide") else m["bozza"])
                m["stato"], m["inviato"] = "inviato", datetime.now(timezone.utc).isoformat(timespec="minutes")
                conta["inviati"] += 1
            except RuntimeError as e:
                m["stato"], m["errore"] = "errore", str(e)
        salva(m)


def smista_aurora(testo: str, utente: str) -> str:
    """Account di Aurora: solo una categoria, mai una risposta."""
    if SEGNALA.search(testo):
        return "segnala"
    try:
        tipo = llm.chiedi(SISTEMA_AURORA, f"MESSAGGIO DI @{utente}:\n{testo[:1500]}", 0.1).get("tipo")
    except RuntimeError as e:
        print(f"AI non disponibile, lo passo a Davide: {e}")
        return "personale"
    return tipo if tipo in ("collaborazione", "segnala", "personale", "ignora") else "personale"


def raccogli(conta: dict) -> None:
    io = ig("me", fields="user_id,username")
    mio_id = str(io.get("user_id") or io.get("id"))
    conversazioni = ig("me/conversations", platform="instagram",
                       fields="updated_time,messages.limit(5){id,from,message,created_time}").get("data", [])
    limite = datetime.now(timezone.utc) - timedelta(days=3)
    for conv in conversazioni:
        for msg in (conv.get("messages") or {}).get("data", []):
            mittente = msg.get("from") or {}
            if str(mittente.get("id")) == mio_id or not msg.get("message"):
                continue
            if quando(msg["created_time"]) < limite or db(["SISMEMBER", P + "visti", msg["id"]])[0]:
                continue
            db(["SADD", P + "visti", msg["id"]])
            conta["nuovi"] += 1
            if AURORA:
                tipo = smista_aurora(msg["message"], mittente.get("username", "?"))
                m = {"id": msg["id"], "igsid": str(mittente.get("id")), "utente": mittente.get("username", ""),
                     "testo": msg["message"][:2000], "quando": msg["created_time"], "tipo": tipo, "bozza": "",
                     "account": "aurora",
                     "stato": {"segnala": "da bloccare", "ignora": "ignorato"}.get(tipo, "per Davide")}
                conta[tipo] += 1
                salva(m)
                if m["stato"] != "ignorato":
                    db(["LPUSH", P + "coda", m["id"]])
                continue
            try:
                esito = llm.chiedi(SISTEMA, f"INFORMAZIONI:\n{INFORMAZIONI}\n\nMESSAGGIO DI @{mittente.get('username', '?')}:\n{msg['message'][:1500]}", 0.2)
            except RuntimeError as e:
                esito = {"tipo": "personale", "risposta": ""}
                print(f"AI non disponibile, lo passo a Davide: {e}")
            tipo = esito.get("tipo") if esito.get("tipo") in ("pratica", "personale", "ignora") else "personale"
            bozza = (esito.get("risposta") or "").strip()
            if tipo == "pratica" and not bozza:
                tipo = "personale"
            m = {"id": msg["id"], "igsid": str(mittente.get("id")), "utente": mittente.get("username", ""),
                 "testo": msg["message"][:2000], "quando": msg["created_time"], "tipo": tipo, "bozza": bozza,
                 "stato": {"pratica": "da approvare", "personale": "per Davide", "ignora": "ignorato"}[tipo]}
            conta[tipo] += 1
            if tipo == "pratica" and MODALITA == "auto":
                try:
                    invia_dm(m["igsid"], FIRMA + bozza)
                    m["stato"], m["inviato"] = "inviato", datetime.now(timezone.utc).isoformat(timespec="minutes")
                    conta["inviati"] += 1
                except RuntimeError as e:
                    m["stato"], m["errore"] = "da approvare", str(e)
            salva(m)
            if m["stato"] in ("da approvare", "per Davide"):
                db(["LPUSH", P + "coda", m["id"]])


def main() -> None:
    if not TOKEN:
        raise SystemExit("Manca " + ("IG_AURORA_TOKEN." if AURORA else "IG_ACCESS_TOKEN."))
    conta = {"nuovi": 0, "pratica": 0, "personale": 0, "ignora": 0, "inviati": 0}
    if AURORA:
        conta = {"nuovi": 0, "collaborazione": 0, "personale": 0, "segnala": 0, "ignora": 0}
    else:
        invia_approvati(conta)
    raccogli(conta)
    oggi = datetime.now(timezone.utc).date().isoformat()
    db(*[["HINCRBY", P + "giorno:" + oggi, k, str(v)] for k, v in conta.items()], ["EXPIRE", P + "giorno:" + oggi, str(40 * 86400)])
    in_attesa = len(db(["LRANGE", P + "coda", "0", "-1"])[0] or [])
    # Nel repo (pubblico) solo i numeri, una volta al giorno: meno commit, niente testi
    if os.environ.get("SCRIVI_CONTEGGI") == "1":
        giorni = {}
        for n in range(14):
            d = (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()
            v = db(["HGETALL", P + "giorno:" + d])[0] or []
            if v:
                giorni[d] = {v[k]: int(v[k + 1]) for k in range(0, len(v), 2)}
        CONTEGGI.write_text(json.dumps({"modalita": MODALITA, "in_attesa_nel_pannello": in_attesa, "giorni": dict(sorted(giorni.items()))},
                                       ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Messaggi: {conta}, in attesa nel pannello: {in_attesa}")


if __name__ == "__main__":
    main()
