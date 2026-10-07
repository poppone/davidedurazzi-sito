"""Configurazione della redazione AI. Modifica qui fonti e numero di temi."""
import os

# Modello Gemini: l'alias "latest" segue l'ultima versione Flash gratuita.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-flash-latest"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Usati in ordine se il modello principale non risponde o ha finito la quota gratuita
MODELLI_RISERVA = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"]

# Pausa tra una chiamata e l'altra (secondi) per stare nei limiti del free tier
PAUSA_TRA_CHIAMATE = 7

# Palinsesto settimanale (0 = lunedì ... 6 = domenica).
PALINSESTO = {
    0: ["tecnologia", "ai"],
    1: ["gaming", "tecnologia"],
    2: ["ai", "gaming"],
    3: ["tecnologia", "ai"],
    4: ["gaming", "tecnologia"],
    5: ["ai", "gaming"],
    6: ["libero", "tecnologia"],
}

# Finestra temporale delle notizie (ore)
ORE_NOTIZIE = 30

# Fonti RSS filtrate per Tecnologia, AI e Gaming.
# "testata" serve al fact-checker: un tema passa solo se ne parlano almeno 2 testate diverse.
FEED = [
    # Tecnologia e AI
    {"area": "tecnologia", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/tecnologia/tecnologia_rss.xml"},
    {"area": "tecnologia", "testata": "Wired Italia", "url": "https://www.wired.it/feed/rss"},
    {"area": "tecnologia", "testata": "HDblog", "url": "https://www.hdblog.it/feed/"},
    {"area": "tecnologia", "testata": "Il Sole 24 Ore", "url": "https://www.ilsole24ore.com/rss/tecnologia.xml"},
    # Gaming
    {"area": "gaming", "testata": "Multiplayer.it", "url": "https://multiplayer.it/feed/rss/"},
    {"area": "gaming", "testata": "Spaziogames", "url": "https://www.spaziogames.it/feed"},
    {"area": "gaming", "testata": "IGN Italia", "url": "https://it.ign.com/feed.xml"},
]
MIN_TESTATE = 2

# Sezioni del sito (devono coincidere con quelle in config.js)
SEZIONI = ["tecnologia", "gaming", "ai"]

NOMI_AREE = {
    "tecnologia": "tecnologia, dispositivi e innovazione",
    "ai": "intelligenza artificiale, modelli di linguaggio e algoritmi",
    "gaming": "videogiochi, console e settore gaming",
    "libero": "qualsiasi tema tra tecnologia, ai e gaming",
}
