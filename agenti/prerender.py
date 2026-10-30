"""Genera le pagine statiche del sito, leggibili anche senza JavaScript
(Google, anteprime social, assistenti AI).

Legge content/articoli.json e config.js e scrive:
  - articoli/<slug>.html   una pagina completa per ogni articolo pubblicato
  - sezioni/<id>.html      l'elenco degli articoli di ogni sezione
  - index.html             riempie i blocchi tra i segnaposto <!--PR:...-->
  - sitemap.xml, sitemap-news.xml (ultime 48 ore), feed.xml (RSS), robots.txt
  - indexnow-nuovi.txt     gli URL nuovi da segnalare a IndexNow (non va nel repo)

Si lancia dalla radice del repo:  python agenti/prerender.py
Non serve nessuna libreria esterna. Usa node (se c'è) per leggere config.js.
"""
import html
import json
import re
import subprocess
from datetime import date, datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

RADICE = Path(__file__).resolve().parent.parent
SITO = "https://www.davidedurazzi.it"
ROMA = ZoneInfo("Europe/Rome")
FIRMA = "Scritto dalla Redazione AI, verificato e approvato da Davide Durazzi"
MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
        "agosto", "settembre", "ottobre", "novembre", "dicembre"]


def e(s) -> str:
    return html.escape("" if s is None else str(s), quote=True)


def e_xml(s) -> str:
    """Come e(), ma per feed e sitemap: toglie i caratteri di controllo, vietati in XML
    (uno solo basta a far scartare tutto il feed ai lettori RSS)."""
    return e(re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", "" if s is None else str(s)))


def url_ok(u) -> bool:
    return bool(re.match(r"^https?://", str(u or "").strip(), re.I))


def leggi_config() -> dict:
    try:
        out = subprocess.run(
            ["node", "-e", "global.window={};require(process.argv[1]);"
             "process.stdout.write(JSON.stringify(window.SITE||{}))", str(RADICE / "config.js")],
            capture_output=True, text=True, timeout=20, check=True)
        return json.loads(out.stdout)
    except Exception as err:  # senza node il sito funziona lo stesso, solo meno dettagli
        print("config.js non letto:", err)
        return {}


def data_it(d: str) -> str:
    try:
        x = date.fromisoformat(str(d)[:10])
        return f"{x.day} {MESI[x.month - 1]} {x.year}"
    except ValueError:
        return str(d or "")


def quando(a: dict) -> datetime | None:
    """Momento di pubblicazione con il fuso: "pubblicato_il" (lo scrive promuovi.py),
    altrimenti la sola data alla mezzanotte di Roma. None se manca una data valida:
    meglio nessuna data che l'ora della build, che cambierebbe a ogni giro."""
    try:
        t = datetime.fromisoformat(str(a.get("pubblicato_il")))
        return t if t.tzinfo else t.replace(tzinfo=ROMA)
    except ValueError:
        pass
    try:
        return datetime.combine(date.fromisoformat(str(a.get("data"))[:10]), datetime.min.time(), ROMA)
    except ValueError:
        return None


def iso_pub(a: dict) -> str:
    q = quando(a)
    return q.isoformat(timespec="seconds") if q else ""


def data_vis(a: dict) -> str:
    """Data visibile, la stessa di datePublished (Google segnala le date diverse)."""
    q = quando(a)
    return data_it(q.astimezone(ROMA).date().isoformat()) if q else ""


def html_data(a: dict) -> str:
    return f'<time datetime="{e(iso_pub(a))}">{e(data_vis(a))}</time>' if quando(a) else ""


def sezione_ok(sid) -> bool:
    """Solo queste sezioni hanno una pagina /sezioni/<id> (vedi main)."""
    return bool(re.fullmatch(r"[a-z0-9-]+", str(sid or "")))


def iso_mod(a: dict) -> str:
    """Ultima modifica: "modificato_il" se c'è, altrimenti la pubblicazione."""
    try:
        t = datetime.fromisoformat(str(a.get("modificato_il")))
        return (t if t.tzinfo else t.replace(tzinfo=ROMA)).isoformat(timespec="seconds")
    except ValueError:
        return iso_pub(a)


def nome_sezione(cfg: dict, sid: str) -> str:
    for s in cfg.get("sezioni") or []:
        if s.get("id") == sid:
            return s.get("nome", "")
    return (sid or "").replace("-", " ").capitalize()


def immagine(a: dict) -> tuple[str, int, int]:
    """Copertina del carosello (1080x1350, vedi slides.py) o il logo (512x512)."""
    cartella = RADICE / "ig" / a["slug"]
    for nome in ("1.jpg", "1.png"):
        if (cartella / nome).exists():
            return f"{SITO}/ig/{a['slug']}/{nome}", 1080, 1350
    return f"{SITO}/assets/logo-512.png", 512, 512


def link(a: dict) -> str:
    return f"/articoli/{a['slug']}"


def link_sezione(sid: str) -> str:
    return f"/sezioni/{sid}"


def json_ld(dati: dict) -> str:
    return ('<script type="application/ld+json">'
            + json.dumps(dati, ensure_ascii=False).replace("</", "<\\/") + "</script>")


# ---------- frammenti HTML (stessa struttura che disegna app.js) ----------

def html_duello(cfg, a, con_link: bool) -> str:
    def lato(cls, l):
        punti = "".join(f"<li>{e(p)}</li>" for p in (l or {}).get("punti") or [])
        return f'<div class="lato {cls}"><h4>{e((l or {}).get("titolo"))}</h4><ul>{punti}</ul></div>'
    piede = (f'<div class="piede"><a class="btn" href="{link(a)}">Leggi l’analisi completa</a></div>'
             if con_link else "")
    return (f'<div class="duello"><div class="domanda"><p class="meta">{e(nome_sezione(cfg, a.get("sezione")))}, '
            f'{e(data_vis(a))}</p><h3>{e(a.get("domanda") or a.get("titolo"))}</h3></div>'
            f'<div class="lati">{lato("si", a.get("tesi"))}{lato("no", a.get("antitesi"))}</div>{piede}</div>')


def html_lista(cfg, articoli) -> str:
    if not articoli:
        return '<li class="vuoto">Ancora nessun articolo.</li>'
    righe = []
    for a in articoli:
        som = f"<p>{e(a['sommario'])}</p>" if a.get("sommario") else ""
        righe.append(f'<li data-sez="{e(a.get("sezione") or "")}"><a href="{link(a)}"><span class="sez">{e(nome_sezione(cfg, a.get("sezione")))}<br>'
                     f'{html_data(a)}</span><span><h3>{e(a.get("titolo"))}</h3>{som}</span></a></li>')
    return "".join(righe)


def html_social(cfg) -> str:
    voci = []
    if cfg.get("twitch"):
        voci.append(("Twitch", f"https://www.twitch.tv/{cfg['twitch']}"))
    if url_ok(cfg.get("youtubeUrl")):
        voci.append(("YouTube", cfg["youtubeUrl"]))
    if cfg.get("instagram"):
        voci.append(("Instagram", f"https://www.instagram.com/{cfg['instagram']}/"))
    if cfg.get("tiktok"):
        voci.append(("TikTok", f"https://www.tiktok.com/@{cfg['tiktok']}"))
    if cfg.get("x"):
        voci.append(("X", f"https://x.com/{cfg['x']}"))
    if cfg.get("linkedin"):
        voci.append(("LinkedIn", f"https://www.linkedin.com/in/{cfg['linkedin']}/"))
    if url_ok(cfg.get("donazioni")):
        voci.append(("Sostienimi", cfg["donazioni"]))
    if cfg.get("email"):
        voci.append(("Scrivimi", f"mailto:{cfg['email']}"))
    return "".join(f'<a href="{e(u)}"' + ("" if u.startswith("mailto:") else ' target="_blank" rel="noopener"')
                   + f">{n}</a>" for n, u in voci)


SEZIONI_TECH = ("tecnologia", "gaming", "ai")


def html_banner(cfg, a) -> str:
    """Banner affiliato in fondo agli articoli (config.js > bannerMotori, bannerTech), scelto in base allo slug.

    Le pagine statiche si rigenerano solo quando cambia qualcosa: i banner con
    una scadenza ("fino") qui si saltano, li mostra solo il sito dinamico."""
    sezione = a.get("sezione")
    chiave = "bannerMotori" if sezione == "motori" else "bannerTech" if sezione in SEZIONI_TECH else ""
    if not chiave:
        return ""
    b = [x for x in cfg.get(chiave) or []
         if str(x.get("link", "")).startswith("https://") and not x.get("fino")
         and re.match(r"^(https://|/[^/])", str(x.get("img", "")))]
    if not b:
        return ""
    x = b[sum(map(ord, a.get("slug", ""))) % len(b)]
    return (f'<div class="banner-aff"><a href="{e(x["link"])}" target="_blank" rel="sponsored noopener">'
            f'<img src="{e(x["img"])}" alt="{e(x.get("alt") or "Pubblicità")}" loading="lazy"></a>'
            '<p class="nota-aff">Pubblicità con link affiliato.</p></div>')


def html_acquisto(cfg, a) -> str:
    """Box "Dove comprarlo" con link affiliato, solo se l'articolo indica un gioco o un prodotto."""
    from urllib.parse import quote_plus
    x = a.get("acquisto") or {}
    nome = str(x.get("nome") or "").strip()
    if not nome:
        return ""
    if x.get("tipo") == "gioco" and cfg.get("instantGaming"):
        url = f"https://www.instant-gaming.com/it/ricerca/?query={quote_plus(nome)}&igr={quote_plus(cfg['instantGaming'])}"
        dove = "Instant Gaming"
    elif x.get("tipo") == "link" and str(x.get("url") or "").startswith("https://"):
        url = x["url"]
        dove = e(x.get("dove") or "il sito del negozio")
    elif x.get("tipo") == "prodotto" and cfg.get("amazonTag"):
        url = f"https://www.amazon.it/s?k={quote_plus(nome)}&tag={quote_plus(cfg['amazonTag'])}"
        dove = "Amazon"
    else:
        return ""
    return ('<div class="acquisto"><h2>Dove comprarlo</h2>'
            f'<a class="btn" href="{e(url)}" target="_blank" rel="sponsored noopener">Cerca {e(nome)} su {dove}</a>'
            '<p class="nota-aff">Link affiliato: se compri da qui ricevo una piccola commissione, a te non costa nulla.</p></div>')


def html_leggi_anche(cfg, a, articoli) -> str:
    """Fino a 4 articoli recenti della stessa sezione, con la stessa grafica della home."""
    sid = a.get("sezione") or ""
    if not sezione_ok(sid):  # senza una sezione valida non c'è la pagina a cui rimandare
        return ""
    altri = [x for x in articoli if x.get("sezione") == sid and x["slug"] != a["slug"]][:4]
    if not altri:
        return ""
    return ('<section class="leggi-anche"><h2>Leggi anche</h2>'
            f'<ul class="lista">{html_lista(cfg, altri)}</ul>'
            f'<p class="meta"><a href="{link_sezione(sid)}">Tutti gli articoli di {e(nome_sezione(cfg, sid))}</a></p></section>')


def pagina_articolo(cfg, a, modello: str, articoli=()) -> str:
    nome = cfg.get("nome") or "Davide Durazzi"
    url = SITO + link(a)
    descr = a.get("sommario") or (a.get("testo") or [""])[0]
    img, img_w, img_h = immagine(a)
    sid = a.get("sezione") or ""
    sezione = nome_sezione(cfg, sid)
    fonti = [f for f in a.get("fonti") or [] if url_ok(f.get("url"))]
    davide = {"@type": "Person", "@id": f"{SITO}/#davide", "name": nome, "url": f"{SITO}/"}
    ld = {
        "@context": "https://schema.org", "@type": "NewsArticle",
        "headline": a.get("titolo"), "description": descr,
        **({"datePublished": iso_pub(a), "dateModified": iso_mod(a)} if quando(a) else {}),
        "inLanguage": "it", "mainEntityOfPage": url,
        "image": [{"@type": "ImageObject", "url": img, "width": img_w, "height": img_h}],
        "articleSection": sezione,
        # Trasparenza (AI Act): scrive la Redazione AI, Davide verifica e approva
        "author": {"@type": "Organization", "name": "Redazione AI", "url": f"{SITO}/azienda"},
        "editor": davide,
        "publisher": {"@type": "Organization", "name": nome,
                      "logo": {"@type": "ImageObject", "url": f"{SITO}/assets/logo-512.png"}},
        "citation": [f["url"] for f in fonti],
    }
    # percorso: Home › Sezione › Articolo; senza una sezione valida il livello di mezzo si salta
    livelli = [("Home", f"{SITO}/")] + ([(sezione, SITO + link_sezione(sid))] if sezione_ok(sid) else [])
    livelli.append((a.get("titolo"), url))
    briciole = {
        "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i, "name": n, "item": u} for i, (n, u) in enumerate(livelli, 1)],
    }
    nav_sez = f' › <a href="{link_sezione(sid)}">{e(sezione)}</a>' if sezione_ok(sid) else ""
    meta = ", ".join(v for v in (e(sezione), html_data(a)) if v)
    testa = (
        f"<title>{e(a.get('titolo'))} — {e(nome)}</title>\n"
        f'<meta name="description" content="{e(descr)}">\n'
        f'<link rel="canonical" href="{e(url)}">\n'
        f'<meta property="og:type" content="article">\n'
        f'<meta property="og:site_name" content="{e(nome)}">\n'
        f'<meta property="og:title" content="{e(a.get("titolo"))}">\n'
        f'<meta property="og:description" content="{e(descr)}">\n'
        f'<meta property="og:url" content="{e(url)}">\n'
        f'<meta property="og:locale" content="it_IT">\n'
        f'<meta property="og:image" content="{e(img)}">\n'
        f'<meta property="og:image:width" content="{img_w}">\n'
        f'<meta property="og:image:height" content="{img_h}">\n'
        f'<meta property="og:image:alt" content="{e(a.get("titolo"))}">\n'
        + (f'<meta property="article:published_time" content="{e(iso_pub(a))}">\n'
           f'<meta property="article:modified_time" content="{e(iso_mod(a))}">\n' if quando(a) else "") +
        f'<meta property="article:section" content="{e(sezione)}">\n'
        f'<meta name="twitter:card" content="summary_large_image">\n'
        + json_ld(ld) + json_ld(briciole)
    )
    som = f'<p class="som">{e(a["sommario"])}</p>' if a.get("sommario") else ""
    duello = html_duello(cfg, a, False) if a.get("tesi") and a.get("antitesi") else ""
    corpo = "".join(f"<p>{e(t)}</p>" for t in a.get("testo") or [])
    blocco_fonti = ""
    if fonti:
        blocco_fonti = ('<div class="fonti"><h2>Fonti</h2><ul>' + "".join(
            f'<li><a href="{e(f["url"])}" target="_blank" rel="noopener">{e(f.get("nome") or f["url"])}</a></li>'
            for f in fonti) + "</ul></div>")
    articolo = (
        f'<article class="art" id="art" data-statico="1">'
        f'<nav class="briciole" aria-label="Percorso"><a href="/">Home</a>{nav_sez}</nav>'
        f'<p class="meta">{meta}</p>'
        f'<h1>{e(a.get("titolo"))}</h1><p class="meta firma">{FIRMA}</p>'
        f'{som}{duello}<div class="corpo">{corpo}</div>{blocco_fonti}{html_acquisto(cfg, a)}{html_banner(cfg, a)}'
        '<div class="acts" style="margin-top:2rem"><a class="btn pieno" href="/#diretta">'
        '<span class="dot" aria-hidden="true"></span>Ne parliamo in diretta</a></div>'
        + html_leggi_anche(cfg, a, articoli) +
        '<section class="commenti" id="commenti"><h2>Commenti</h2><div id="listaCommenti">'
        '<p class="meta">Caricamento dei commenti.</p></div>'
        '<form class="form-commento" id="formCommento"><h3>Dì la tua</h3>'
        '<label>Nome<input name="nome" maxlength="40" autocomplete="nickname" required></label>'
        '<label>Commento<textarea name="testo" maxlength="1500" required></textarea></label>'
        '<label class="trappola" aria-hidden="true">Sito<input name="sito" tabindex="-1" autocomplete="off"></label>'
        '<p class="nota">I commenti vengono letti prima della pubblicazione. Alle domande pratiche può rispondere '
        'la Redazione AI, ed è sempre indicato.</p>'
        '<button class="btn pieno" type="submit">Invia commento</button>'
        '<p class="esito-commento" role="status"></p></form></section></article>'
    )
    out = modello.replace("<title>Davide Durazzi</title>", testa, 1)
    out = out.replace('<body data-page="articolo">', f'<body data-page="articolo" data-slug="{e(a["slug"])}">', 1)
    out = re.sub(r'<article class="art" id="art">.*?</article>', lambda _: articolo, out, count=1, flags=re.S)
    out = re.sub(r'<nav id="social" aria-label="Social">.*?</nav>',
                 lambda _: f'<nav id="social" aria-label="Social">{html_social(cfg)}</nav>', out, count=1, flags=re.S)
    return out


def pagina_sezione(cfg, sid: str, articoli, modello: str) -> str:
    """Elenco degli articoli di una sezione, sullo stesso modello delle pagine articolo."""
    nome = cfg.get("nome") or "Davide Durazzi"
    sezione = nome_sezione(cfg, sid)
    url = SITO + link_sezione(sid)
    descr = f"Gli articoli di {sezione} di {nome}: notizie verificate, con le fonti sempre citate."
    briciole = {
        "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITO}/"},
            {"@type": "ListItem", "position": 2, "name": sezione, "item": url},
        ],
    }
    testa = (
        f"<title>{e(sezione)} — {e(nome)}</title>\n"
        f'<meta name="description" content="{e(descr)}">\n'
        f'<link rel="canonical" href="{e(url)}">\n'
        f'<meta property="og:type" content="website">\n'
        f'<meta property="og:site_name" content="{e(nome)}">\n'
        f'<meta property="og:locale" content="it_IT">\n'
        f'<meta property="og:title" content="{e(sezione)} — {e(nome)}">\n'
        f'<meta property="og:description" content="{e(descr)}">\n'
        f'<meta property="og:url" content="{e(url)}">\n'
        f'<meta property="og:image" content="{SITO}/assets/logo-512.png">\n'
        f'<meta property="og:image:width" content="512">\n'
        f'<meta property="og:image:height" content="512">\n'
        + json_ld(briciole)
    )
    corpo = (
        f'<section class="art sezione"><nav class="briciole" aria-label="Percorso"><a href="/">Home</a> › '
        f'{e(sezione)}</nav><h1>{e(sezione)}</h1>'
        f'<ul class="lista">{html_lista(cfg, articoli)}</ul></section>'
    )
    out = modello.replace("<title>Davide Durazzi</title>", testa, 1)
    out = out.replace('<body data-page="articolo">', '<body data-page="sezione">', 1)
    out = re.sub(r'<article class="art" id="art">.*?</article>', lambda _: corpo, out, count=1, flags=re.S)
    out = re.sub(r'<nav id="social" aria-label="Social">.*?</nav>',
                 lambda _: f'<nav id="social" aria-label="Social">{html_social(cfg)}</nav>', out, count=1, flags=re.S)
    return out


def feed_rss(cfg, articoli) -> str:
    """RSS 2.0 con gli ultimi 30 articoli (lettori di feed, aggregatori, Google News)."""
    nome = cfg.get("nome") or "Davide Durazzi"
    voci = []
    for a in articoli[:30]:
        url = SITO + link(a)
        cat = f"<category>{e_xml(nome_sezione(cfg, a.get('sezione')))}</category>" if a.get("sezione") else ""
        pub = f"<pubDate>{format_datetime(quando(a))}</pubDate>" if quando(a) else ""
        voci.append(
            f"<item><title>{e_xml(a.get('titolo'))}</title><link>{url}</link>"
            f'<guid isPermaLink="true">{url}</guid>{pub}'
            f"<dc:creator>Redazione AI</dc:creator>{cat}"
            f"<description>{e_xml(a.get('sommario') or (a.get('testo') or [''])[0])}</description></item>")
    ultimo = format_datetime((quando(articoli[0]) if articoli else None) or datetime.now(timezone.utc))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
            f"<channel><title>{e_xml(nome)}</title><link>{SITO}/</link>"
            f"<description>{e_xml(cfg.get('sottotitolo') or 'Tecnologia, AI e Gaming')}: {FIRMA[0].lower() + FIRMA[1:]}.</description>"
            f'<language>it</language><lastBuildDate>{ultimo}</lastBuildDate>'
            f'<atom:link href="{SITO}/feed.xml" rel="self" type="application/rss+xml"/>'
            f"<image><url>{SITO}/assets/logo-192.png</url><title>{e_xml(nome)}</title><link>{SITO}/</link></image>\n"
            + "\n".join(voci) + "\n</channel></rss>\n")


def sitemap_news(cfg, articoli) -> str:
    """Sitemap per Google News: solo gli articoli delle ultime 48 ore (può restare vuota)."""
    nome = cfg.get("nome") or "Davide Durazzi"
    limite = datetime.now(timezone.utc) - timedelta(hours=48)
    voci = [
        f"  <url><loc>{SITO}{link(a)}</loc><news:news><news:publication><news:name>{e_xml(nome)}</news:name>"
        f"<news:language>it</news:language></news:publication>"
        f"<news:publication_date>{iso_pub(a)}</news:publication_date>"
        f"<news:title>{e_xml(a.get('titolo'))}</news:title></news:news></url>"
        for a in articoli if quando(a) and quando(a) >= limite]
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n'
            + "".join(v + "\n" for v in voci) + "</urlset>\n")


def riempi(testo: str, chiave: str, contenuto: str) -> str:
    """Sostituisce il contenuto tra <!--PR:chiave--> e <!--/PR:chiave-->."""
    schema = re.compile(rf"(<!--PR:{chiave}-->).*?(<!--/PR:{chiave}-->)", re.S)
    if not schema.search(testo):
        print(f"segnaposto PR:{chiave} non trovato in index.html")
        return testo
    return schema.sub(lambda m: m.group(1) + contenuto + m.group(2), testo, count=1)


def main():
    cfg = leggi_config()
    tutti = json.loads((RADICE / "content" / "articoli.json").read_text(encoding="utf-8"))
    # ordine per momento di pubblicazione (lo stesso di datePublished); senza data in fondo
    mai = datetime.min.replace(tzinfo=timezone.utc)
    articoli = sorted((a for a in tutti if a.get("pubblicato") is True and a.get("slug")),
                      key=lambda a: quando(a) or mai, reverse=True)

    # 1. pagine articolo
    modello = (RADICE / "articolo.html").read_text(encoding="utf-8")
    cartella = RADICE / "articoli"
    cartella.mkdir(exist_ok=True)
    gia_online = {p.stem for p in cartella.glob("*.html")}
    for a in articoli:
        if not re.fullmatch(r"[a-z0-9-]+", a["slug"]):
            print("slug non valido, salto:", a["slug"])
    articoli = [a for a in articoli if re.fullmatch(r"[a-z0-9-]+", a["slug"])]
    validi = {a["slug"] for a in articoli}
    for a in articoli:
        (cartella / f"{a['slug']}.html").write_text(pagina_articolo(cfg, a, modello, articoli), encoding="utf-8")
    for vecchio in cartella.glob("*.html"):  # articoli tolti dal sito
        if vecchio.stem not in validi:
            vecchio.unlink()

    # 1b. pagine di sezione
    cartella_sez = RADICE / "sezioni"
    cartella_sez.mkdir(exist_ok=True)
    sezioni = sorted({a["sezione"] for a in articoli if re.fullmatch(r"[a-z0-9-]+", a.get("sezione") or "")})
    for sid in sezioni:
        (cartella_sez / f"{sid}.html").write_text(
            pagina_sezione(cfg, sid, [a for a in articoli if a.get("sezione") == sid], modello), encoding="utf-8")
    for vecchio in cartella_sez.glob("*.html"):
        if vecchio.stem not in sezioni:
            vecchio.unlink()

    # 2. home già compilata
    home = (RADICE / "index.html").read_text(encoding="utf-8")
    home = riempi(home, "claim", e(cfg.get("sottotitolo")))
    home = riempi(home, "intro", e(cfg.get("presentazione")))
    home = riempi(home, "orari", e(cfg.get("orariLive")))
    duello = next((a for a in articoli if a.get("rubrica") == "contraddittorio" and a.get("tesi") and a.get("antitesi")), None)
    home = riempi(home, "duello", html_duello(cfg, duello, True) if duello
                  else '<p class="vuoto">Il primo Contraddittorio arriva a breve.</p>')
    home = riempi(home, "lista", html_lista(cfg, articoli))
    home = riempi(home, "social", html_social(cfg))
    (RADICE / "index.html").write_text(home, encoding="utf-8")

    # 3. sitemap, feed e robots
    oggi = datetime.now(timezone.utc).date().isoformat()
    voci = [f"  <url><loc>{SITO}/</loc><lastmod>{(iso_pub(articoli[0]) if articoli else "") or oggi}</lastmod></url>"]
    voci += [f"  <url><loc>{SITO}{link(a)}</loc>" + (f"<lastmod>{e(iso_mod(a))}</lastmod>" if iso_mod(a) else "")
             + "</url>" for a in articoli]
    voci += [f"  <url><loc>{SITO}{link_sezione(sid)}</loc></url>" for sid in sezioni]
    voci.append(f"  <url><loc>{SITO}/piazza</loc></url>")
    voci.append(f"  <url><loc>{SITO}/media-kit</loc></url>")
    voci.append(f"  <url><loc>{SITO}/azienda</loc></url>")
    voci.append(f"  <url><loc>{SITO}/consigli</loc></url>")
    voci.append(f"  <url><loc>{SITO}/contraddittorio-per-tutti</loc></url>")
    voci.append(f"  <url><loc>{SITO}/siti</loc></url>")
    voci.append(f"  <url><loc>{SITO}/clip</loc></url>")
    voci.append(f"  <url><loc>{SITO}/squadre</loc></url>")
    voci.append(f"  <url><loc>{SITO}/privacy</loc></url>")
    (RADICE / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(voci) + "\n</urlset>\n", encoding="utf-8")
    (RADICE / "sitemap-news.xml").write_text(sitemap_news(cfg, articoli), encoding="utf-8")
    (RADICE / "feed.xml").write_text(feed_rss(cfg, articoli), encoding="utf-8")
    (RADICE / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /obs/\nDisallow: /overlay/\n\n"
        f"Sitemap: {SITO}/sitemap.xml\nSitemap: {SITO}/sitemap-news.xml\n", encoding="utf-8")

    # 4. URL nuovi per IndexNow (li legge agenti/indexnow.py dopo il deploy; il file resta fuori dal repo)
    nuovi = [a for a in articoli if a["slug"] not in gia_online]
    lista = RADICE / "indexnow-nuovi.txt"
    if nuovi:  # prima gli articoli (il primo serve a capire se il deploy è online), poi home e sezioni toccate
        url = [SITO + link(a) for a in nuovi] + [f"{SITO}/"]
        url += [SITO + link_sezione(sid) for sid in sezioni if any(a.get("sezione") == sid for a in nuovi)]
        lista.write_text("\n".join(url) + "\n", encoding="utf-8")
    elif lista.exists():
        lista.unlink()
    print(f"Pagine statiche generate: {len(articoli)} articoli, {len(sezioni)} sezioni, home, "
          f"sitemap.xml, sitemap-news.xml, feed.xml, robots.txt; {len(nuovi)} URL nuovi")


if __name__ == "__main__":
    main()
