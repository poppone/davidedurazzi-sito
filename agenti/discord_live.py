"""Avviso "Davide è in diretta" nel canale #live-ora di Discord.

Gira insieme a Finch su Discord (ogni 10 minuti). Se il canale Twitch è in
diretta e nelle ultime 6 ore il bot non ha già avvisato, scrive un messaggio
in #live-ora con @everyone. Messaggio automatico, dichiarato come tale.

Stato della diretta: API Twitch se ci sono TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET,
altrimenti il servizio pubblico decapi.me.
"""

import os
from datetime import datetime, timedelta, timezone

import requests

from discord_server import TOKEN, chiama

CANALE_TWITCH = os.environ.get("TWITCH_CANALE", "DavideDurazzi")
CANALE_DISCORD = "live-ora"
PAUSA = timedelta(hours=6)  # un solo avviso per diretta


def diretta() -> tuple[bool, str]:
    """(in diretta?, titolo)."""
    cid, seg = os.environ.get("TWITCH_CLIENT_ID", ""), os.environ.get("TWITCH_CLIENT_SECRET", "")
    if cid and seg:
        tok = requests.post("https://id.twitch.tv/oauth2/token", params={
            "client_id": cid, "client_secret": seg, "grant_type": "client_credentials"}, timeout=15).json()["access_token"]
        dati = requests.get("https://api.twitch.tv/helix/streams", params={"user_login": CANALE_TWITCH.lower()},
                            headers={"Client-Id": cid, "Authorization": "Bearer " + tok}, timeout=15).json().get("data") or []
        return bool(dati), (dati[0].get("title", "") if dati else "")
    testo = requests.get(f"https://decapi.me/twitch/uptime/{CANALE_TWITCH}", timeout=15).text.strip().lower()
    acceso = bool(testo) and "offline" not in testo and "error" not in testo and "not found" not in testo
    titolo = requests.get(f"https://decapi.me/twitch/title/{CANALE_TWITCH}", timeout=15).text.strip() if acceso else ""
    return acceso, titolo


def main():
    if not TOKEN:
        print("Manca DISCORD_BOT_TOKEN: salto.")
        return
    try:
        acceso, titolo = diretta()
    except Exception as e:  # Twitch o decapi non rispondono: si riprova al prossimo giro
        print(f"Stato della diretta non disponibile: {e}")
        return
    if not acceso:
        print("Twitch: non in diretta.")
        return

    io = chiama("GET", "/users/@me")["id"]
    gid = chiama("GET", "/users/@me/guilds")[0]["id"]
    cid = next((c["id"] for c in chiama("GET", f"/guilds/{gid}/channels") if c["name"] == CANALE_DISCORD), None)
    if not cid:
        print(f"Il canale #{CANALE_DISCORD} non esiste: salto.")
        return
    limite = datetime.now(timezone.utc) - PAUSA
    for m in chiama("GET", f"/channels/{cid}/messages?limit=20"):
        if m["author"]["id"] == io and datetime.fromisoformat(m["timestamp"]) > limite:
            print("Avviso già mandato per questa diretta.")
            return

    righe = ["@everyone 🔴 **Davide è in diretta su Twitch!**"]
    if titolo:
        righe.append(f"> {titolo[:200]}")
    righe += [f"https://www.twitch.tv/{CANALE_TWITCH}", "-# Avviso automatico"]
    chiama("POST", f"/channels/{cid}/messages", {
        "content": "\n".join(righe),
        "allowed_mentions": {"parse": ["everyone"]},
    })
    print("Avviso della diretta pubblicato.")


if __name__ == "__main__":
    main()
