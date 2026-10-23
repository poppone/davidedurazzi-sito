"""Costruisce il server Discord della community di Davide con il bot "Finch".

Si lancia a mano dal workflow "Server Discord" (workflow_dispatch).
Si può rilanciare quante volte si vuole: crea solo quello che manca.

Fa: ruoli, categorie e canali, canali di sola lettura, modalità lenta,
Community, sicurezza, regole AutoMod, onboarding e messaggi di benvenuto
e regole. Non tocca il profilo personale di Davide (vietato da Discord).

Segreto richiesto: DISCORD_BOT_TOKEN. Il bot deve essere in un solo server.
"""

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://discord.com/api/v10"
TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "").strip()

SEND_MESSAGES = 1 << 11
CREATE_PUBLIC_THREADS = 1 << 35
SEND_MESSAGES_IN_THREADS = 1 << 38
SOLO_LETTURA = SEND_MESSAGES | CREATE_PUBLIC_THREADS | SEND_MESSAGES_IN_THREADS

TESTO, VOCALE, CATEGORIA = 0, 2, 4

# (categoria, [(nome, tipo, opzioni)])
STRUTTURA = [
    ("📌 INIZIA QUI", [
        ("benvenuto", TESTO, {"sola_lettura": True, "topic": "Leggi qui per iniziare"}),
        ("regole", TESTO, {"sola_lettura": True, "topic": "Le regole della community"}),
        ("annunci", TESTO, {"sola_lettura": True, "topic": "Dirette, video nuovi e novità"}),
    ]),
    ("🔴 DIRETTE", [
        ("live-ora", TESTO, {"sola_lettura": True, "topic": "Avvisi quando Davide è in diretta su Twitch"}),
        ("domande-per-davide", TESTO, {"lenta": 10, "topic": "Domande da leggere in diretta"}),
        ("clip", TESTO, {"topic": "I momenti migliori delle dirette (qui i link sono ammessi)"}),
    ]),
    ("💬 COMMUNITY", [
        ("chiacchiere", TESTO, {"lenta": 10, "topic": "Parla di quello che vuoi, con rispetto"}),
        ("auto-e-motori", TESTO, {"topic": "Auto, moto e motori"}),
        ("tech-e-ai", TESTO, {"topic": "Tecnologia e intelligenza artificiale"}),
    ]),
    ("🎮 GIOCHI", [
        ("ea-fc", TESTO, {"topic": "EA SPORTS FC"}),
        ("fortnite", TESTO, {"topic": "Fortnite"}),
        ("rocket-league", TESTO, {"topic": "Rocket League"}),
        ("cerca-squadra", TESTO, {"topic": "Trova compagni su davidedurazzi.it/squadre"}),
    ]),
    ("🔊 VOCALI", [
        ("Lobby", VOCALE, {}),
        ("Partita 1", VOCALE, {}),
        ("Partita 2", VOCALE, {}),
    ]),
]

RUOLI = [
    ("Moderatori", 0x2F55E4),
    ("EA FC", 0x1DB954),
    ("Fortnite", 0x9B59B6),
    ("Rocket League", 0xE85A16),
]

BENVENUTO = (
    "**Benvenuto nella community di Davide Durazzi!** 👋\n\n"
    "Qui parliamo di tecnologia, AI, gaming e motori.\n"
    "🔴 Diretta su Twitch ogni martedì alle 21:30: https://twitch.tv/DavideDurazzi\n"
    "🎮 Cerchi compagni per EA FC, Fortnite o Rocket League? https://www.davidedurazzi.it/squadre\n"
    "📜 Leggi le <#{regole}>, poi presentati in <#{chiacchiere}>."
)

REGOLE = (
    "📜 **Regole della community**\n\n"
    "1. Rispetto per tutti: niente insulti, razzismo o molestie.\n"
    "2. Niente spam, pubblicità o inviti ad altri server.\n"
    "3. Niente contenuti per adulti o violenti.\n"
    "4. Niente dati personali (tuoi o di altri): indirizzi, numeri, password.\n"
    "5. Politica e cronaca: con calma e senza attacchi personali.\n"
    "6. Usa il canale giusto per ogni argomento.\n\n"
    "La moderazione automatica blocca spam, link d'invito e parole offensive.\n"
    "Chi non rispetta le regole viene silenziato o allontanato."
)

CERCA_SQUADRA = (
    "🎮 **Cerchi compagni?** Usa la bacheca annunci del sito: "
    "https://www.davidedurazzi.it/squadre\n"
    "Lì trovi squadre per EA FC, Fortnite e Rocket League, con l'affidabilità dei giocatori."
)


def chiama(metodo, percorso, dati=None, tentativi=5):
    corpo = json.dumps(dati).encode("utf-8") if dati is not None else None
    for _ in range(tentativi):
        req = urllib.request.Request(API + percorso, data=corpo, method=metodo)
        req.add_header("Authorization", f"Bot {TOKEN}")
        req.add_header("User-Agent", "DiscordBot (https://www.davidedurazzi.it, 1.0)")
        if corpo is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                testo = r.read().decode("utf-8")
                return json.loads(testo) if testo else None
        except urllib.error.HTTPError as e:
            testo = e.read().decode("utf-8", "replace")
            if e.code == 429:
                attesa = json.loads(testo).get("retry_after", 2)
                time.sleep(float(attesa) + 0.5)
                continue
            raise RuntimeError(f"{metodo} {percorso} -> {e.code}: {testo}") from None
    raise RuntimeError(f"{metodo} {percorso}: troppi limiti di frequenza")


def prova(descrizione, funzione):
    """Esegue un passo facoltativo: se fallisce lo scrive e va avanti."""
    try:
        funzione()
        print(f"OK  {descrizione}")
    except RuntimeError as e:
        print(f"NO  {descrizione}: {e}")


def main():
    if not TOKEN:
        sys.exit("Manca il segreto DISCORD_BOT_TOKEN.")

    server = chiama("GET", "/users/@me/guilds")
    if len(server) != 1:
        nomi = ", ".join(s["name"] for s in server) or "nessuno"
        sys.exit(f"Il bot deve essere in un solo server (ora: {nomi}).")
    gid = server[0]["id"]
    print(f"Server: {server[0]['name']} ({gid})")

    # Ruoli
    ruoli = {r["name"]: r["id"] for r in chiama("GET", f"/guilds/{gid}/roles")}
    for nome, colore in RUOLI:
        if nome not in ruoli:
            r = chiama("POST", f"/guilds/{gid}/roles",
                       {"name": nome, "color": colore, "hoist": nome == "Moderatori"})
            ruoli[nome] = r["id"]
            print(f"Ruolo creato: {nome}")

    # Categorie e canali
    esistenti = chiama("GET", f"/guilds/{gid}/channels")
    per_nome = {(c["name"], c["type"]): c for c in esistenti}
    canali = {}
    for pos_cat, (categoria, figli) in enumerate(STRUTTURA):
        cat = per_nome.get((categoria, CATEGORIA))
        if not cat:
            cat = chiama("POST", f"/guilds/{gid}/channels",
                         {"name": categoria, "type": CATEGORIA, "position": pos_cat})
            print(f"Categoria creata: {categoria}")
        for pos, (nome, tipo, opz) in enumerate(figli):
            ch = per_nome.get((nome.lower() if tipo == TESTO else nome, tipo))
            if not ch:
                dati = {"name": nome, "type": tipo, "parent_id": cat["id"], "position": pos}
                if opz.get("topic"):
                    dati["topic"] = opz["topic"]
                if opz.get("lenta"):
                    dati["rate_limit_per_user"] = opz["lenta"]
                if opz.get("sola_lettura"):
                    dati["permission_overwrites"] = [
                        {"id": gid, "type": 0, "allow": "0", "deny": str(SOLO_LETTURA)},
                        {"id": ruoli["Moderatori"], "type": 0,
                         "allow": str(SOLO_LETTURA), "deny": "0"},
                    ]
                ch = chiama("POST", f"/guilds/{gid}/channels", dati)
                print(f"Canale creato: {nome}")
            canali[nome] = ch["id"]

    # Messaggi fissi (solo se il canale è ancora vuoto)
    def scrivi_se_vuoto(nome, testo):
        if chiama("GET", f"/channels/{canali[nome]}/messages?limit=1"):
            print(f"--  #{nome} ha già messaggi, non scrivo")
            return
        msg = chiama("POST", f"/channels/{canali[nome]}/messages",
                     {"content": testo, "allowed_mentions": {"parse": []}})
        prova(f"fissato il messaggio in #{nome}",
              lambda: chiama("PUT", f"/channels/{canali[nome]}/pins/{msg['id']}"))

    scrivi_se_vuoto("regole", REGOLE)
    scrivi_se_vuoto("benvenuto", BENVENUTO.format(regole=canali["regole"],
                                                  chiacchiere=canali["chiacchiere"]))
    scrivi_se_vuoto("cerca-squadra", CERCA_SQUADRA)

    # Icona del server: il logo del sito, solo se non ce n'è già una
    if not server[0].get("icon"):
        with open("assets/logo-512.png", "rb") as f:
            icona = "data:image/png;base64," + base64.b64encode(f.read()).decode()
        prova("icona del server (logo del sito)",
              lambda: chiama("PATCH", f"/guilds/{gid}", {"icon": icona}))

    # Sicurezza e Community
    prova("sicurezza: verifica media, filtro contenuti espliciti, notifiche solo menzioni",
          lambda: chiama("PATCH", f"/guilds/{gid}", {
              "verification_level": 2,
              "explicit_content_filter": 2,
              "default_message_notifications": 1,
          }))
    info = chiama("GET", f"/guilds/{gid}")
    if "COMMUNITY" not in info.get("features", []):
        prova("Community attivata", lambda: chiama("PATCH", f"/guilds/{gid}", {
            "features": info.get("features", []) + ["COMMUNITY"],
            "rules_channel_id": canali["regole"],
            "public_updates_channel_id": canali["annunci"],
            "preferred_locale": "it",
            "description": "La community di Davide Durazzi: tecnologia, AI, gaming e motori.",
        }))

    # AutoMod
    regole_am = {r["name"] for r in chiama("GET", f"/guilds/{gid}/auto-moderation/rules")}
    blocca = lambda testo: {"type": 1, "metadata": {"custom_message": testo}}
    timeout = {"type": 3, "metadata": {"duration_seconds": 600}}
    nuove = [
        {"name": "Spam sospetto", "event_type": 1, "trigger_type": 3,
         "actions": [blocca("Messaggio bloccato: sembra spam.")]},
        {"name": "Menzioni di massa", "event_type": 1, "trigger_type": 5,
         "trigger_metadata": {"mention_total_limit": 5, "mention_raid_protection_enabled": True},
         "actions": [blocca("Troppe menzioni in un messaggio."), timeout]},
        {"name": "Parole offensive", "event_type": 1, "trigger_type": 4,
         "trigger_metadata": {"presets": [1, 2, 3]},
         "actions": [blocca("Messaggio bloccato dalla moderazione automatica.")]},
        {"name": "Link d'invito e pubblicità", "event_type": 1, "trigger_type": 1,
         "trigger_metadata": {"regex_patterns": [
             r"discord(app)?\.(gg|com/invite)/",
             r"t\.me/",
             r"bit\.ly/",
         ]},
         "exempt_roles": [ruoli["Moderatori"]],
         "exempt_channels": [canali["clip"]],
         "actions": [blocca("I link d'invito e la pubblicità non sono ammessi."), timeout]},
    ]
    for regola in nuove:
        if regola["name"] not in regole_am:
            prova(f"AutoMod: {regola['name']}", lambda r=regola: chiama(
                "POST", f"/guilds/{gid}/auto-moderation/rules", {**r, "enabled": True}))

    # Onboarding con la domanda "A cosa giochi?"
    def onboarding():
        def opzione(titolo, emoji, ruolo=None, canale=None):
            o = {"title": titolo, "emoji_name": emoji,
                 "role_ids": [ruoli[ruolo]] if ruolo else [],
                 "channel_ids": [canali[canale]] if canale else []}
            return o

        chiama("PUT", f"/guilds/{gid}/onboarding", {
            "enabled": True,
            "mode": 0,
            "default_channel_ids": [canali[n] for n in (
                "benvenuto", "regole", "annunci", "live-ora", "domande-per-davide",
                "clip", "chiacchiere", "cerca-squadra")],
            "prompts": [{
                # Discord vuole un id per ogni domanda: uno snowflake generato qui va bene
                "id": str((int(time.time() * 1000) - 1420070400000) << 22),
                "type": 0,
                "title": "A cosa giochi?",
                "single_select": False,
                "required": False,
                "in_onboarding": True,
                "options": [
                    opzione("EA FC", "⚽", "EA FC", "ea-fc"),
                    opzione("Fortnite", "🪂", "Fortnite", "fortnite"),
                    opzione("Rocket League", "🚗", "Rocket League", "rocket-league"),
                    opzione("Solo le dirette", "🔴", canale="live-ora"),
                ],
            }],
        })

    prova("Onboarding con la domanda \"A cosa giochi?\"", onboarding)
    print("Fatto.")


if __name__ == "__main__":
    main()
