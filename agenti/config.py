"""Configurazione della redazione AI. Modifica qui fonti e numero di temi."""
import os

# Modello Gemini: l'alias "latest" segue l'ultima versione Flash gratuita.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-flash-latest"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Usati in ordine se il modello principale non risponde o ha finito la quota gratuita
MODELLI_RISERVA = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"]

# Pausa tra una chiamata e l'altra (secondi) per stare nei limiti del free tier
PAUSA_TRA_CHIAMATE = 7

# Quanti temi preparare ogni mattina (uno diventa anche Il Contraddittorio)
NUMERO_TEMI = 3

# Finestra temporale delle notizie (ore)
ORE_NOTIZIE = 30

# Fonti RSS. "testata" serve al fact-checker: un tema passa solo se
# ne parlano almeno 2 testate diverse. Se un feed non risponde viene saltato.
FEED = [
    {"testata": "ANSA", "url": "https://www.ansa.it/sito/ansait_rss.xml"},
    {"testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/politica/politica_rss.xml"},
    {"testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/cronaca/cronaca_rss.xml"},
    {"testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/economia/economia_rss.xml"},
    {"testata": "Rai News", "url": "https://www.rainews.it/rss/tutti"},
    {"testata": "Sky TG24", "url": "https://tg24.sky.it/rss/tg24.xml"},
    {"testata": "Il Sole 24 Ore", "url": "https://www.ilsole24ore.com/rss/italia.xml"},
    {"testata": "Corriere della Sera", "url": "https://xml2.corriereobjects.it/rss/homepage.xml"},
    {"testata": "la Repubblica", "url": "https://www.repubblica.it/rss/homepage/rss2.0.xml"},
    {"testata": "TGCom24", "url": "https://www.tgcom24.mediaset.it/rss/homepage.xml"},
    {"testata": "Il Fatto Quotidiano", "url": "https://www.ilfattoquotidiano.it/feed/"},
    {"testata": "AGI", "url": "https://www.agi.it/cronaca/rss"},
]
MIN_TESTATE = 2

# Sezioni del sito (devono coincidere con config.js)
SEZIONI = ["cronaca", "politica", "quotidiano", "novita"]
