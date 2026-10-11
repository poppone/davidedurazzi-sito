"""Configurazione della redazione AI. Modifica qui fonti e numero di temi."""
import os

# Modello Gemini: l'alias "latest" segue l'ultima versione Flash gratuita.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-flash-latest"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Usati in ordine se il modello principale non risponde o ha finito la quota gratuita
MODELLI_RISERVA = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"]

# Riserva gratuita Groq (opzionale): secret GROQ_API_KEY. Modelli provati in ordine.
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODELLI = [m for m in [os.environ.get("GROQ_MODEL", ""), "llama-3.3-70b-versatile", "llama-3.1-8b-instant"] if m]

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
ORE_NOTIZIE = 48

# Fonti RSS filtrate per Tecnologia, AI e Gaming.
FEED = [
    # Tecnologia
    {"area": "tecnologia", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/tecnologia/tecnologia_rss.xml"},
    {"area": "tecnologia", "testata": "Wired Italia", "url": "https://www.wired.it/feed/rss"},
    {"area": "tecnologia", "testata": "HDblog", "url": "https://www.hdblog.it/feed/"},
    {"area": "tecnologia", "testata": "Il Sole 24 Ore", "url": "https://www.ilsole24ore.com/rss/tecnologia.xml"},
    {"area": "tecnologia", "testata": "Punto Informatico", "url": "https://www.punto-informatico.it/feed/"},
    {"area": "tecnologia", "testata": "Tom's Hardware", "url": "https://www.tomshw.it/feed/"},
    {"area": "tecnologia", "testata": "TuttoTech", "url": "https://www.tuttotech.net/feed/"},
    
    # AI (condivide fonti tecnologiche per far trovare notizie anche all'area AI)
    {"area": "ai", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/tecnologia/tecnologia_rss.xml"},
    {"area": "ai", "testata": "Wired Italia", "url": "https://www.wired.it/feed/rss"},
    {"area": "ai", "testata": "HDblog", "url": "https://www.hdblog.it/feed/"},
    {"area": "ai", "testata": "Il Sole 24 Ore", "url": "https://www.ilsole24ore.com/rss/tecnologia.xml"},
    {"area": "ai", "testata": "Punto Informatico", "url": "https://www.punto-informatico.it/feed/"},
    {"area": "ai", "testata": "Tom's Hardware", "url": "https://www.tomshw.it/feed/"},

    # Gaming (corretto l'URL di Multiplayer)
    {"area": "gaming", "testata": "Multiplayer.it", "url": "https://multiplayer.it/feed/"},
    {"area": "gaming", "testata": "Spaziogames", "url": "https://www.spaziogames.it/feed"},
    {"area": "gaming", "testata": "IGN Italia", "url": "https://it.ign.com/feed.xml"},
    {"area": "gaming", "testata": "Everyeye", "url": "https://www.everyeye.it/feed_news_rss.asp"},
    {"area": "gaming", "testata": "Gamereactor", "url": "https://www.gamereactor.it/rss/rss.php?texttype=4"},
]
MIN_TESTATE = 2
# Il sito parla SOLO di tecnologia, AI e gaming: attualità, politica e cronaca non si pubblicano mai.
AREE_AMMESSE = {"tecnologia", "ai", "gaming", "libero"}
# Aree dove basta UNA testata (sempre citata, fatti attribuiti "secondo X")
AREE_FONTE_UNICA = {"tecnologia", "ai", "gaming", "libero"}
# Bozze da preparare ogni mattina (una per area del palinsesto, con ripiego sulle altre)
TEMI_AL_GIORNO = 3

# Sezioni del sito (devono coincidere con quelle in config.js)
SEZIONI = ["tecnologia", "gaming", "ai"]

NOMI_AREE = {
    "tecnologia": "tecnologia, dispositivi e innovazione",
    "ai": "intelligenza artificiale, modelli di linguaggio e algoritmi",
    "gaming": "videogiochi, console e settore gaming",
    "libero": "qualsiasi tema tra tecnologia, ai e gaming",
}
