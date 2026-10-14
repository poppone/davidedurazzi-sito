"""Configurazione della redazione AI. Modifica qui fonti e numero di temi."""
import os

# Modello Gemini: l'alias "latest" segue l'ultima versione Flash gratuita.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-flash-latest"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Usati in ordine se il modello principale non risponde o ha finito la quota gratuita
# (i 2.5 sono stati ritirati: rispondevano 404 il 13/10/2026)
MODELLI_RISERVA = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite"]

# Riserva gratuita Groq (opzionale): secret GROQ_API_KEY. Prima i modelli scritti qui,
# poi quelli che Groq elenca come disponibili (i nomi cambiano spesso: il 13/10/2026
# entrambi i modelli llama qui sotto rispondevano 404).
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODELLI = [m for m in [os.environ.get("GROQ_MODEL", ""), "llama-3.3-70b-versatile", "llama-3.1-8b-instant"] if m]

# Ordine dei fornitori AI, tutti gratuiti (dal 14/10/2026 Gemini è l'ultimo: spesso sovraccarico).
# "groq": secret GROQ_API_KEY. "github": GitHub Models, usa il GITHUB_TOKEN del workflow
# (permesso models: read), nessun account in più. "gemini": secret GEMINI_API_KEY.
LLM_ORDINE = [x.strip() for x in (os.environ.get("LLM_ORDINE") or "groq,github,gemini").split(",") if x.strip()]
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_MODELLI = [m for m in [os.environ.get("GITHUB_MODEL", ""), "openai/gpt-4.1-mini", "openai/gpt-4o-mini", "openai/gpt-4.1-nano"] if m]

# Pausa tra una chiamata e l'altra (secondi) per stare nei limiti del free tier
PAUSA_TRA_CHIAMATE = 7

# Palinsesto settimanale (0 = lunedì ... 6 = domenica).
PALINSESTO = {
    0: ["tecnologia", "motori"],
    1: ["gaming", "ai"],
    2: ["motori", "tecnologia"],
    3: ["ai", "gaming"],
    4: ["motori", "gaming"],
    5: ["tecnologia", "ai"],
    6: ["libero", "motori"],
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

    # Motori: tecnologia per l'auto (feed non verificati al 11/10: se uno non risponde viene saltato, controllare i log)
    {"area": "motori", "testata": "HDmotori", "url": "https://www.hdmotori.it/feed/"},
    {"area": "motori", "testata": "Motor1 Italia", "url": "https://it.motor1.com/rss/news/all/"},
    {"area": "motori", "testata": "InsideEVs Italia", "url": "https://insideevs.it/rss/news/all/"},
]
MIN_TESTATE = 2
# Il sito parla SOLO di tecnologia, AI, gaming e motori: attualità, politica e cronaca non si pubblicano mai.
AREE_AMMESSE = {"tecnologia", "ai", "gaming", "motori", "libero"}
# Aree dove basta UNA testata (sempre citata, fatti attribuiti "secondo X")
AREE_FONTE_UNICA = {"tecnologia", "ai", "gaming", "motori", "libero"}
# Bozze da preparare ogni mattina (una per area del palinsesto, con ripiego sulle altre)
TEMI_AL_GIORNO = 3

# Sezioni del sito (devono coincidere con quelle in config.js)
SEZIONI = ["tecnologia", "gaming", "ai", "motori"]

NOMI_AREE = {
    "tecnologia": "tecnologia, dispositivi e innovazione",
    "ai": "intelligenza artificiale, modelli di linguaggio e algoritmi",
    "gaming": "videogiochi, console e settore gaming",
    "motori": "tecnologia per l'auto: auto elettriche e ibride, novità e prove di modelli, infotainment, guida assistita, accessori e gadget per l'auto (niente incidenti, cronaca stradale o politica)",
    "libero": "qualsiasi tema tra tecnologia, ai, gaming e motori",
}
