"""Finch nel canale #chiedi-a-finch di Discord.

Gira ogni 10 minuti (workflow discord-finch.yml): legge gli ultimi messaggi del
canale e risponde a quelli a cui non ha ancora risposto. Usa le risposte di
agenti/chat_faq.json e l'AI; ogni risposta è dichiarata AI e non si finge Davide.

Segreti: DISCORD_BOT_TOKEN e una chiave AI (GROQ_API_KEY, GEMINI_API_KEY o GITHUB_TOKEN).
Nel portale Discord va attivato "Message Content Intent" (Bot -> Privileged Gateway Intents).
"""

import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

import llm
from discord_server import TOKEN, chiama

RADICE = Path(__file__).resolve().parent.parent
FAQ = json.loads((RADICE / "agenti" / "chat_faq.json").read_text(encoding="utf-8"))
FINCH = json.loads((RADICE / "agenti" / "finch_discord.json").read_text(encoding="utf-8"))
CANALE = "chiedi-a-finch"
FINESTRA = timedelta(hours=6)   # risponde solo a messaggi recenti
MASSIMO = 10                    # risposte al massimo per giro


def normalizza(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip()


def risposta_faq(testo: str) -> str | None:
    t = normalizza(testo)
    for voce in FAQ["voci"]:
        if any(normalizza(k) in t for k in voce["chiavi"]):
            return voce["risposta"].replace("qui su Twitch", "su twitch.tv/DavideDurazzi")
    return None


def rispondi(testo: str) -> str:
    fatti = "\n".join("- " + v["risposta"] for v in FAQ["voci"])
    fatti += "\n" + "\n".join("- " + f for f in FINCH["fatti"])
    risposta = None
    try:
        r = llm.chiedi(FINCH["sistema"] + "\n\nFATTI:\n" + fatti, "MESSAGGIO: " + testo[:500])
        risposta = str(r.get("risposta") or "").strip()[:1500] or None
    except RuntimeError as e:
        print(f"AI non disponibile: {e}")
    return FINCH["prefisso"] + (risposta or risposta_faq(testo) or FINCH["non_so"])


def main():
    if not TOKEN:
        print("Manca DISCORD_BOT_TOKEN: salto.")
        return
    io = chiama("GET", "/users/@me")["id"]
    server = chiama("GET", "/users/@me/guilds")
    if len(server) != 1:
        print("Il bot deve essere in un solo server: salto.")
        return
    canali = chiama("GET", f"/guilds/{server[0]['id']}/channels")
    cid = next((c["id"] for c in canali if c["name"] == CANALE), None)
    if not cid:
        print(f"Il canale #{CANALE} non esiste ancora (lancia il workflow Server Discord): salto.")
        return

    messaggi = chiama("GET", f"/channels/{cid}/messages?limit=50")
    gia_fatti = {m["message_reference"]["message_id"] for m in messaggi
                 if m["author"]["id"] == io and m.get("message_reference")}
    limite = datetime.now(timezone.utc) - FINESTRA
    da_fare = [m for m in reversed(messaggi)
               if not m["author"].get("bot") and m["id"] not in gia_fatti and m["type"] in (0, 19)
               and datetime.fromisoformat(m["timestamp"]) > limite]
    vuoti = [m for m in da_fare if not m.get("content", "").strip()]
    if vuoti and len(vuoti) == len(da_fare):
        print("I messaggi arrivano vuoti: attiva 'Message Content Intent' nel portale Discord.")
        return

    for m in [m for m in da_fare if m.get("content", "").strip()][:MASSIMO]:
        chiama("POST", f"/channels/{cid}/messages", {
            "content": rispondi(m["content"]),
            "message_reference": {"message_id": m["id"], "fail_if_not_exists": False},
            "allowed_mentions": {"parse": [], "replied_user": True},
        })
        print(f"Risposto al messaggio {m['id']}")
    print("Fatto.")


if __name__ == "__main__":
    main()
