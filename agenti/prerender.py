"""Genera le pagine statiche del sito, leggibili anche senza JavaScript
(Google, anteprime social, assistenti AI).

Legge content/articoli.json e config.js e scrive:
  - articoli/<slug>.html   una pagina completa per ogni articolo pubblicato
  - index.html             riempie i blocchi tra i segnaposto <!--PR:...-->
  - sitemap.xml, robots.txt

Si lancia dalla radice del repo:  python agenti/prerender.py
Non serve nessuna libreria esterna. Usa node (se c'è) per leggere config.js.
"""
import html
import json
import re
import subprocess
from datetime import date, datetime, timezone
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
SITO = "https://www.davidedurazzi.it"
MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
        "agosto", "settembre", "ottobre", "novembre", "dicembre"]


def e(s) -> str:
    return html.escape("" if s is None else str(s), quote=True)


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


def nome_sezione(cfg: dict, sid: str) -> str:
    for s in cfg.get("sezioni") or []:
        if s.get("id") == sid:
            return s.get("nome", "")
    return (sid or "").replace("-", " ").capitalize()


def immagine(a: dict) -> str:
    cartella = RADICE / "ig" / a["slug"]
    for nome in ("1.jpg", "1.png"):
        if (cartella / nome).exists():
            return f"{SITO}/ig/{a['slug']}/{nome}"
    return f"{SITO}/assets/logo-512.png"


def link(a: dict) -> str:
    return f"/articoli/{a['slug']}"


# ---------- frammenti HTML (stessa struttura che disegna app.js) ----------

def html_duello(cfg, a, con_link: bool) -> str:
    def lato(cls, l):
        punti = "".join(f"<li>{e(p)}</li>" for p in (l or {}).get("punti") or [])
        return f'<div class="lato {cls}"><h4>{e((l or {}).get("titolo"))}</h4><ul>{punti}</ul></div>'
    piede = (f'<div class="piede"><a class="btn" href="{link(a)}">Leggi l’analisi completa</a></div>'
             if con_link else "")
    return (f'<div class="duello"><div class="domanda"><p class="meta">{e(nome_sezione(cfg, a.get("sezione")))}, '
            f'{e(data_it(a.get("data")))}</p><h3>{e(a.get("domanda") or a.get("titolo"))}</h3></div>'
            f'<div class="lati">{lato("si", a.get("tesi"))}{lato("no", a.get("antitesi"))}</div>{piede}</div>')


def html_lista(cfg, articoli) -> str:
    if not articoli:
        return '<li class="vuoto">Ancora nessun articolo.</li>'
    righe = []
    for a in articoli:
        som = f"<p>{e(a['sommario'])}</p>" if a.get("sommario") else ""
        righe.append(f'<li><a href="{link(a)}"><span class="sez">{e(nome_sezione(cfg, a.get("sezione")))}<br>'
                     f'{e(data_it(a.get("data")))}</span><span><h3>{e(a.get("titolo"))}</h3>{som}</span></a></li>')
    return "".join(righe)


def html_social(cfg) -> str:
    voci = []
    if cfg.get("twitch"):
        voci.append(("Twitch", f"https://www.twitch.tv/{cfg['twitch']}"))
    if url_ok(cfg.get("youtubeUrl")):
        voci.append(("YouTube", cfg["youtubeUrl"]))
    if cfg.get("instagram"):
        voci.append(("Instagram", f"https://www.instagram.com/{cfg['instagram']}/"))
    if cfg.get("x"):
        voci.append(("X", f"https://x.com/{cfg['x']}"))
    if cfg.get("linkedin"):
        voci.append(("LinkedIn", f"https://www.linkedin.com/in/{cfg['linkedin']}/"))
    if cfg.get("email"):
        voci.append(("Scrivimi", f"mailto:{cfg['email']}"))
    return "".join(f'<a href="{e(u)}"' + ("" if u.startswith("mailto:") else ' target="_blank" rel="noopener"')
                   + f">{n}</a>" for n, u in voci)


def pagina_articolo(cfg, a, modello: str) -> str:
    nome = cfg.get("nome") or "Davide Durazzi"
    url = SITO + link(a)
    descr = a.get("sommario") or (a.get("testo") or [""])[0]
    img = immagine(a)
    fonti = [f for f in a.get("fonti") or [] if url_ok(f.get("url"))]
    ld = {
        "@context": "https://schema.org", "@type": "NewsArticle",
        "headline": a.get("titolo"), "description": descr, "datePublished": a.get("data"),
        "inLanguage": "it", "mainEntityOfPage": url, "image": [img],
        "articleSection": nome_sezione(cfg, a.get("sezione")),
        "author": {"@type": "Person", "name": nome, "url": SITO},
        "publisher": {"@type": "Organization", "name": nome,
                      "logo": {"@type": "ImageObject", "url": f"{SITO}/assets/logo-512.png"}},
        "citation": [f["url"] for f in fonti],
    }
    testa = (
        f"<title>{e(a.get('titolo'))} — {e(nome)}</title>\n"
        f'<meta name="description" content="{e(descr)}">\n'
        f'<link rel="canonical" href="{e(url)}">\n'
        f'<meta property="og:type" content="article">\n'
        f'<meta property="og:site_name" content="{e(nome)}">\n'
        f'<meta property="og:title" content="{e(a.get("titolo"))}">\n'
        f'<meta property="og:description" content="{e(descr)}">\n'
        f'<meta property="og:url" content="{e(url)}">\n'
        f'<meta property="og:image" content="{e(img)}">\n'
        f'<meta property="article:published_time" content="{e(a.get("data"))}">\n'
        f'<meta name="twitter:card" content="summary_large_image">\n'
        '<script type="application/ld+json">'
        + json.dumps(ld, ensure_ascii=False).replace("</", "<\\/") + "</script>"
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
        f'<a class="back" href="/#articoli">Torna agli articoli</a>'
        f'<p class="meta">{e(nome_sezione(cfg, a.get("sezione")))}, '
        f'<time datetime="{e(a.get("data"))}">{e(data_it(a.get("data")))}</time></p>'
        f'<h1>{e(a.get("titolo"))}</h1>{som}{duello}<div class="corpo">{corpo}</div>{blocco_fonti}'
        '<div class="acts" style="margin-top:2rem"><a class="btn pieno" href="/#diretta">'
        '<span class="dot" aria-hidden="true"></span>Ne parliamo in diretta</a></div>'
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
    articoli = sorted((a for a in tutti if a.get("pubblicato") is True and a.get("slug")),
                      key=lambda a: a.get("data") or "", reverse=True)

    # 1. pagine articolo
    modello = (RADICE / "articolo.html").read_text(encoding="utf-8")
    cartella = RADICE / "articoli"
    cartella.mkdir(exist_ok=True)
    validi = set()
    for a in articoli:
        if not re.fullmatch(r"[a-z0-9-]+", a["slug"]):
            print("slug non valido, salto:", a["slug"])
            continue
        validi.add(a["slug"])
        (cartella / f"{a['slug']}.html").write_text(pagina_articolo(cfg, a, modello), encoding="utf-8")
    for vecchio in cartella.glob("*.html"):  # articoli tolti dal sito
        if vecchio.stem not in validi:
            vecchio.unlink()
    articoli = [a for a in articoli if a["slug"] in validi]

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

    # 3. sitemap e robots
    oggi = datetime.now(timezone.utc).date().isoformat()
    voci = [f"  <url><loc>{SITO}/</loc><lastmod>{(articoli[0].get('data') if articoli else oggi)}</lastmod></url>"]
    voci += [f"  <url><loc>{SITO}{link(a)}</loc><lastmod>{e(a.get('data') or oggi)}</lastmod></url>" for a in articoli]
    voci.append(f"  <url><loc>{SITO}/piazza</loc></url>")
    voci.append(f"  <url><loc>{SITO}/media-kit</loc></url>")
    voci.append(f"  <url><loc>{SITO}/privacy</loc></url>")
    (RADICE / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(voci) + "\n</urlset>\n", encoding="utf-8")
    (RADICE / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /obs/\nDisallow: /overlay/\n\n"
        f"Sitemap: {SITO}/sitemap.xml\n", encoding="utf-8")
    print(f"Pagine statiche generate: {len(articoli)} articoli, home, sitemap.xml, robots.txt")


if __name__ == "__main__":
    main()
