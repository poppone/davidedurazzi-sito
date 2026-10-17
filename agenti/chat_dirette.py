"""Chat delle dirette: assistente AI nella chat Twitch durante la diretta.

- Risponde alle domande pratiche ripetute (orari, link, come si vota il
  Contraddittorio...) con le risposte di agenti/chat_faq.json, sempre con il
  prefisso che lo dichiara AI. Non si finge mai Davide.
- Non risponde a niente altro: le domande vere le raccoglie per Davide. In onda
  le vede nel pannello overlay/domande.html (dock di OBS); a fine diretta le
  salva in stanza/chat/AAAA-MM-GG.json per il verbale di Finch.
- Ignora i comandi (!si, !no, !apri...) che servono all'overlay del
  Contraddittorio, e i messaggi di Davide e dei bot.

Segreti (repo del sito): TWITCH_BOT_NOME (account del bot, minuscolo) e
TWITCH_BOT_TOKEN (token utente con chat:read e chat:edit, senza "oauth:").
Facoltativi: TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET per fermarsi da solo
20 minuti dopo la fine della diretta.

Uso:
  python agenti/chat_dirette.py            -> parte solo nella finestra della diretta
  python agenti/chat_dirette.py --subito   -> parte adesso (prove)
  python agenti/chat_dirette.py --prova "a che ora è la live?"  -> mostra la risposta, senza Twitch
"""
import json
import os
import re
import socket
import ssl
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

RADICE = Path(__file__).resolve().parent.parent
FAQ = json.loads((RADICE / "agenti" / "chat_faq.json").read_text(encoding="utf-8"))
CARTELLA = RADICE / "stanza" / "chat"
CANALE = os.environ.get("TWITCH_CANALE", "davidedurazzi").lower()
BOT = os.environ.get("TWITCH_BOT_NOME", "").lower()
TOKEN = os.environ.get("TWITCH_BOT_TOKEN", "").removeprefix("oauth:")
DURATA_MAX = int(os.environ.get("DURATA_MINUTI", "240")) * 60
ATTESA_RIPETIZIONE = 180   # la stessa risposta al massimo ogni 3 minuti
ATTESA_GLOBALE = 20        # e al massimo un messaggio del bot ogni 20 secondi
ROMA = ZoneInfo("Europe/Rome")
GIORNO_LIVE, ORA_LIVE = 1, (21, 30)  # martedì (lunedì = 0) alle 21:30, come config.js


def normalizza(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip()


def contiene(testo: str, chiave: str) -> bool:
    chiave = normalizza(chiave)
    if " " in chiave or not chiave.isalnum():
        return chiave in testo
    return re.search(r"(?<![a-z0-9])" + re.escape(chiave) + r"(?![a-z0-9])", testo) is not None


def risposta_per(messaggio: str) -> dict | None:
    t = normalizza(messaggio)
    if t.startswith("!"):
        return None
    if not any(contiene(t, p) for p in FAQ["parole_domanda"]):
        return None
    for voce in FAQ["voci"]:
        if any(contiene(t, k) for k in voce["chiavi"]):
            return voce
    return None


def e_domanda_per_davide(messaggio: str) -> bool:
    t = messaggio.strip()
    if t.startswith("!") or "http" in t.lower() or len(t) < 12:
        return False
    return "?" in t or normalizza(t).startswith(("davide", "domanda"))


def in_finestra(adesso: datetime) -> bool:
    inizio = adesso.replace(hour=ORA_LIVE[0], minute=ORA_LIVE[1], second=0, microsecond=0)
    return adesso.weekday() == GIORNO_LIVE and -50 * 60 <= (adesso - inizio).total_seconds() <= 30 * 60


class Twitch:
    def __init__(self):
        ctx = ssl.create_default_context()
        self.s = ctx.wrap_socket(socket.create_connection(("irc.chat.twitch.tv", 6697), timeout=300), server_hostname="irc.chat.twitch.tv")
        self.buf = ""
        self.invia(f"PASS oauth:{TOKEN}")
        self.invia(f"NICK {BOT}")
        self.invia("CAP REQ :twitch.tv/tags")
        self.invia(f"JOIN #{CANALE}")

    def invia(self, riga: str) -> None:
        self.s.sendall((riga + "\r\n").encode("utf-8"))

    def scrivi(self, testo: str) -> None:
        self.invia(f"PRIVMSG #{CANALE} :{testo[:480]}")

    def righe(self):
        while True:
            try:
                dati = self.s.recv(4096).decode("utf-8", "replace")
            except socket.timeout:
                yield None
                continue
            if not dati:
                raise ConnectionError("connessione chiusa da Twitch")
            self.buf += dati
            while "\r\n" in self.buf:
                riga, self.buf = self.buf.split("\r\n", 1)
                yield riga


def stream_attivo() -> bool | None:
    """True/False se Twitch lo sa dire (servono le chiavi dell'app), altrimenti None."""
    cid, seg = os.environ.get("TWITCH_CLIENT_ID", ""), os.environ.get("TWITCH_CLIENT_SECRET", "")
    if not cid or not seg:
        return None
    try:
        import requests
        tok = requests.post("https://id.twitch.tv/oauth2/token", params={"client_id": cid, "client_secret": seg, "grant_type": "client_credentials"}, timeout=15).json()["access_token"]
        r = requests.get("https://api.twitch.tv/helix/streams", params={"user_login": CANALE}, headers={"Client-Id": cid, "Authorization": "Bearer " + tok}, timeout=15)
        return bool(r.json().get("data"))
    except Exception:
        return None


def salva(registro: dict) -> None:
    CARTELLA.mkdir(parents=True, exist_ok=True)
    f = CARTELLA / f"{datetime.now(ROMA).date().isoformat()}.json"
    f.write_text(json.dumps(registro, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Salvato {f.relative_to(RADICE)}")


def main() -> None:
    if "--prova" in sys.argv:
        msg = sys.argv[sys.argv.index("--prova") + 1]
        v = risposta_per(msg)
        print(FAQ["prefisso"] + v["risposta"] if v else ("(nessuna risposta: domanda per Davide)" if e_domanda_per_davide(msg) else "(ignorato)"))
        return
    adesso = datetime.now(ROMA)
    if "--subito" not in sys.argv and not in_finestra(adesso):
        print(f"Fuori dalla finestra della diretta ({adesso:%a %H:%M}): non parto.")
        return
    if not BOT or not TOKEN:
        print("Mancano TWITCH_BOT_NOME o TWITCH_BOT_TOKEN: la chat resta senza assistente.")
        sys.exit(1)

    registro = {"canale": CANALE, "inizio": adesso.isoformat(timespec="minutes"), "risposte": {}, "domande": []}
    ultima_voce: dict[str, float] = {}
    ultimo_invio = 0.0
    inizio = time.time()
    visto_live, ultimo_controllo, offline_da = False, 0.0, None
    tw = Twitch()
    print(f"Collegato alla chat di #{CANALE} come {BOT}.")
    try:
        for riga in tw.righe():
            ora = time.time()
            if ora - inizio > DURATA_MAX:
                print("Tempo massimo raggiunto.")
                break
            if ora - ultimo_controllo > 300:
                ultimo_controllo = ora
                stato = stream_attivo()
                if stato:
                    visto_live, offline_da = True, None
                elif stato is False and visto_live:
                    offline_da = offline_da or ora
                    if ora - offline_da > 20 * 60:
                        print("La diretta è finita da 20 minuti.")
                        break
            if riga is None:
                continue
            if riga.startswith("PING"):
                tw.invia("PONG :tmi.twitch.tv")
                continue
            if " NOTICE " in riga and "authentication failed" in riga.lower():
                raise SystemExit("Twitch ha rifiutato il token del bot: rigeneralo (scope chat:read e chat:edit).")
            m = re.search(r"(?:^@(?P<tag>\S+) )?:(?P<nick>[^!]+)!\S+ PRIVMSG #\S+ :(?P<testo>.*)$", riga)
            if not m:
                continue
            nick, testo = m.group("nick").lower(), m.group("testo")
            tag = m.group("tag") or ""
            if nick in (BOT, CANALE) or "badges=broadcaster" in tag or nick.endswith("bot"):
                continue
            voce = risposta_per(testo)
            if voce:
                if ora - ultima_voce.get(voce["id"], 0) > ATTESA_RIPETIZIONE and ora - ultimo_invio > ATTESA_GLOBALE:
                    tw.scrivi(f"@{nick} {FAQ['prefisso']}{voce['risposta']}")
                    ultima_voce[voce["id"]] = ultimo_invio = ora
                    registro["risposte"][voce["id"]] = registro["risposte"].get(voce["id"], 0) + 1
            elif e_domanda_per_davide(testo):
                registro["domande"].append({"ora": datetime.now(ROMA).strftime("%H:%M"), "da": nick, "testo": testo[:300]})
    finally:
        registro["fine"] = datetime.now(ROMA).isoformat(timespec="minutes")
        salva(registro)


if __name__ == "__main__":
    main()
