"""Configurazione della redazione AI. Modifica qui fonti e numero di temi."""
import os

# Modello Gemini: l'alias "latest" segue l'ultima versione Flash gratuita.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-flash-latest"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Usati in ordine se il modello principale non risponde o ha finito la quota gratuita
MODELLI_RISERVA = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"]

# Pausa tra una chiamata e l'altra (secondi) per stare nei limiti del free tier
PAUSA_TRA_CHIAMATE = 7

# Palinsesto: ogni giorno 1 tema di attualità (cronaca o politica) + 2 aree fisse.
# 0 = lunedì ... 6 = domenica. "libero" = lo Scout pesca da tutte le aree.
PALINSESTO = {
    0: ["economia", "tecnologia"],
    1: ["sport", "spettacolo"],
    2: ["gaming", "motori"],
    3: ["economia", "tecnologia"],
    4: ["spettacolo", "sport"],
    5: ["gaming", "motori"],
    6: ["quotidiano", "libero"],
}

# Finestra temporale delle notizie (ore)
ORE_NOTIZIE = 30

# Fonti RSS, ognuna con la sua area. "testata" serve al fact-checker: un tema passa
# solo se ne parlano almeno 2 testate diverse. Se un feed non risponde viene saltato.
FEED = [
    # Attualità (cronaca e politica)
    {"area": "attualita", "testata": "ANSA", "url": "https://www.ansa.it/sito/ansait_rss.xml"},
    {"area": "attualita", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/politica/politica_rss.xml"},
    {"area": "attualita", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/cronaca/cronaca_rss.xml"},
    {"area": "attualita", "testata": "Rai News", "url": "https://www.rainews.it/rss/tutti"},
    {"area": "attualita", "testata": "Sky TG24", "url": "https://tg24.sky.it/rss/tg24.xml"},
    {"area": "attualita", "testata": "Il Sole 24 Ore", "url": "https://www.ilsole24ore.com/rss/italia.xml"},
    {"area": "attualita", "testata": "Corriere della Sera", "url": "https://xml2.corriereobjects.it/rss/homepage.xml"},
    {"area": "attualita", "testata": "la Repubblica", "url": "https://www.repubblica.it/rss/homepage/rss2.0.xml"},
    {"area": "attualita", "testata": "TGCom24", "url": "https://www.tgcom24.mediaset.it/rss/homepage.xml"},
    {"area": "attualita", "testata": "Il Fatto Quotidiano", "url": "https://www.ilfattoquotidiano.it/feed/"},
    {"area": "attualita", "testata": "AGI", "url": "https://www.agi.it/cronaca/rss"},
    # Economia e soldi
    {"area": "economia", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/economia/economia_rss.xml"},
    {"area": "economia", "testata": "Il Sole 24 Ore", "url": "https://www.ilsole24ore.com/rss/economia.xml"},
    {"area": "economia", "testata": "Corriere della Sera", "url": "https://xml2.corriereobjects.it/rss/economia.xml"},
    {"area": "economia", "testata": "QuiFinanza", "url": "https://quifinanza.it/feed/"},
    # Tecnologia e AI
    {"area": "tecnologia", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/tecnologia/tecnologia_rss.xml"},
    {"area": "tecnologia", "testata": "Wired Italia", "url": "https://www.wired.it/feed/rss"},
    {"area": "tecnologia", "testata": "HDblog", "url": "https://www.hdblog.it/feed/"},
    {"area": "tecnologia", "testata": "Il Sole 24 Ore", "url": "https://www.ilsole24ore.com/rss/tecnologia.xml"},
    # Sport
    {"area": "sport", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/sport/sport_rss.xml"},
    {"area": "sport", "testata": "Gazzetta dello Sport", "url": "https://www.gazzetta.it/rss/home.xml"},
    {"area": "sport", "testata": "Corriere dello Sport", "url": "https://www.corrieredellosport.it/rss"},
    {"area": "sport", "testata": "Sky Sport", "url": "https://sport.sky.it/rss/sport_rss.xml"},
    # Spettacolo, TV e social
    {"area": "spettacolo", "testata": "ANSA", "url": "https://www.ansa.it/sito/notizie/cultura/cultura_rss.xml"},
    {"area": "spettacolo", "testata": "TGCom24", "url": "https://www.tgcom24.mediaset.it/rss/spettacolo.xml"},
    {"area": "spettacolo", "testata": "Corriere della Sera", "url": "https://xml2.corriereobjects.it/rss/spettacoli.xml"},
    # Gaming
    {"area": "gaming", "testata": "Multiplayer.it", "url": "https://multiplayer.it/feed/rss/"},
    {"area": "gaming", "testata": "Spaziogames", "url": "https://www.spaziogames.it/feed"},
    {"area": "gaming", "testata": "IGN Italia", "url": "https://it.ign.com/feed.xml"},
    # Motori
    {"area": "motori", "testata": "Motor1 Italia", "url": "https://it.motor1.com/rss/news/all/"},
    {"area": "motori", "testata": "Motorbox", "url": "https://www.motorbox.com/rss"},
    {"area": "motori", "testata": "ANSA", "url": "https://www.ansa.it/canale_motori/notizie/motori_rss.xml"},
]
MIN_TESTATE = 2

# Sezioni del sito (devono coincidere con config.js)
SEZIONI = ["cronaca", "politica", "quotidiano", "economia", "tecnologia", "sport", "spettacolo", "gaming", "motori"]
NOMI_AREE = {
    "attualita": "cronaca o politica",
    "quotidiano": "vita quotidiana: problemi di tutti i giorni, casa, famiglia, servizi, consumi",
    "economia": "economia e soldi: bollette, mutui, stipendi, lavoro, prezzi, tasse",
    "tecnologia": "tecnologia e intelligenza artificiale",
    "sport": "sport",
    "spettacolo": "spettacolo, TV, musica e social network",
    "gaming": "videogiochi e gaming",
    "motori": "auto, moto e mobilità",
    "libero": "qualsiasi area",
}
