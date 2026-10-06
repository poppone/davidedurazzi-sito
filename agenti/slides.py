"""Disegna le slide del carosello Instagram (1080x1350) con i colori e i font del sito."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
M = 96  # margine
FONT_DIR = Path(__file__).resolve().parent / "fonts"
LOGO = Path(__file__).resolve().parent.parent / "assets" / "logo-192.png"
_logo_cache = {}


def _logo(lato: int):
    if lato not in _logo_cache:
        _logo_cache[lato] = Image.open(LOGO).convert("RGBA").resize((lato, lato), Image.LANCZOS) if LOGO.exists() else None
    return _logo_cache[lato]

INK = (16, 22, 43)
BG = (238, 241, 245)
MUTED = (88, 96, 121)
TESI = (47, 85, 228)
ANTI = (232, 90, 22)
LIVE = (229, 38, 59)
WHITE = (255, 255, 255)


def _sans(size: int, peso: int = 800, larghezza: int = 100) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT_DIR / "Archivo.ttf"), size)
    f.set_variation_by_axes([peso, larghezza])
    return f


def _serif(size: int, peso: int = 400) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT_DIR / "SourceSerif4.ttf"), size)
    f.set_variation_by_axes([peso, min(60, max(8, size // 2))])
    return f


def _a_capo(d: ImageDraw.ImageDraw, testo: str, font, larghezza: int) -> list[str]:
    righe, riga = [], ""
    for parola in testo.split():
        prova = (riga + " " + parola).strip()
        if d.textlength(prova, font=font) <= larghezza:
            riga = prova
        else:
            if riga:
                righe.append(riga)
            riga = parola
    if riga:
        righe.append(riga)
    return righe


def _blocco(d, testo, crea_font, size_max, size_min, x, y, larghezza, altezza_max, colore, interlinea=1.2):
    """Scrive il testo alla dimensione più grande che entra nello spazio. Restituisce la y finale."""
    for size in range(size_max, size_min - 1, -2):
        font = crea_font(size)
        righe = _a_capo(d, testo, font, larghezza)
        alto = int(len(righe) * size * interlinea)
        if alto <= altezza_max:
            break
    for i, r in enumerate(righe):
        d.text((x, y + int(i * size * interlinea)), r, font=font, fill=colore)
    return y + alto


def _cornice(img, d, fondo_scuro: bool, n: int, tot: int, sezione: str = ""):
    testo = WHITE if fondo_scuro else INK
    tenue = (170, 178, 200) if fondo_scuro else MUTED
    logo = _logo(64)
    if logo:
        img.paste(logo, (M, M - 14), logo)
        x_nome = M + 80
    else:
        d.ellipse((M, M + 6, M + 22, M + 28), fill=LIVE)
        x_nome = M + 36
    d.text((x_nome, M), "Davide Durazzi", font=_sans(34, 800, 112), fill=testo)
    if sezione:
        f = _sans(30, 600)
        d.text((W - M - d.textlength(sezione, font=f), M + 2), sezione, font=f, fill=tenue)
    f = _sans(28, 600)
    d.text((M, H - M - 28), f"{n}/{tot}", font=f, fill=tenue)
    sito = "davidedurazzi.it"
    d.text((W - M - d.textlength(sito, font=f), H - M - 28), sito, font=f, fill=tenue)


def _nuova(colore):
    img = Image.new("RGB", (W, H), colore)
    return img, ImageDraw.Draw(img)


def crea_carosello(articolo: dict, sezione: str, twitch: str, cartella: Path) -> list[Path]:
    cartella.mkdir(parents=True, exist_ok=True)
    pagine = []
    ha_duello = bool(articolo.get("tesi") and articolo.get("antitesi"))

    # 1. Copertina
    def copertina(n, tot):
        img, d = _nuova(INK)
        _cornice(img, d, True, n, tot, sezione)
        y = _blocco(d, articolo["titolo"], lambda s: _sans(s, 900, 112), 104, 60, M, 330, W - 2 * M, 640, WHITE, 1.08)
        d.rectangle((M, y + 50, M + 120, y + 60), fill=ANTI if ha_duello else TESI)
        d.text((M, H - M - 110), "Scorri per capire", font=_sans(36, 600), fill=(170, 178, 200))
        return img
    pagine.append(copertina)

    # 2. Cosa sta succedendo
    def contesto(n, tot):
        img, d = _nuova(BG)
        _cornice(img, d, False, n, tot, sezione)
        d.text((M, 230), "Cosa sta succedendo", font=_sans(56, 800, 112), fill=INK)
        y = _blocco(d, articolo.get("sommario", ""), lambda s: _serif(s, 600), 50, 34, M, 340, W - 2 * M, 330, INK, 1.32)
        primo = (articolo.get("testo") or [""])[0]
        if primo:
            _blocco(d, primo, lambda s: _serif(s, 400), 38, 26, M, y + 50, W - 2 * M, H - M - 120 - (y + 50), MUTED, 1.42)
        return img
    pagine.append(contesto)

    if ha_duello:
        def domanda(n, tot):
            img, d = _nuova(BG)
            _cornice(img, d, False, n, tot, "Il Contraddittorio")
            d.rectangle((M, 300, M + 120, 312), fill=TESI)
            d.rectangle((M + 120, 300, M + 240, 312), fill=ANTI)
            _blocco(d, articolo.get("domanda", ""), lambda s: _sans(s, 900, 112), 92, 52, M, 380, W - 2 * M, 700, INK, 1.1)
            return img
        pagine.append(domanda)

        for lato, colore in (("tesi", TESI), ("antitesi", ANTI)):
            def pagina_lato(n, tot, lato=lato, colore=colore):
                img, d = _nuova(colore)
                _cornice(img, d, True, n, tot, "Il Contraddittorio")
                d.text((M, 240), articolo[lato]["titolo"], font=_sans(220, 900, 125), fill=WHITE)
                y = 560
                spazio = (H - M - 110 - y) // max(1, len(articolo[lato]["punti"]))
                for punto in articolo[lato]["punti"]:
                    d.rectangle((M, y + 18, M + 18, y + 36), fill=WHITE)
                    _blocco(d, punto, lambda s: _sans(s, 600), 42, 28, M + 44, y, W - 2 * M - 44, spazio - 30, WHITE, 1.25)
                    y += spazio
                return img
            pagine.append(pagina_lato)
    else:
        resto = " ".join((articolo.get("testo") or [])[1:3])
        if resto:
            def approfondimento(n, tot):
                img, d = _nuova(BG)
                _cornice(img, d, False, n, tot, sezione)
                d.text((M, 230), "Perché ci riguarda", font=_sans(56, 800, 112), fill=INK)
                _blocco(d, resto, lambda s: _serif(s, 400), 44, 28, M, 340, W - 2 * M, H - M - 120 - 340, INK, 1.4)
                return img
            pagine.append(approfondimento)

    # Ultima: invito alla diretta + fonti
    def chiusura(n, tot):
        img, d = _nuova(INK)
        _cornice(img, d, True, n, tot)
        invito = "Tu da che parte stai?" if ha_duello else "Tu cosa ne pensi?"
        y = _blocco(d, invito, lambda s: _sans(s, 900, 112), 110, 70, M, 300, W - 2 * M, 300, WHITE, 1.05)
        d.text((M, y + 40), "Scrivilo nei commenti.", font=_sans(44, 600), fill=(170, 178, 200))
        d.ellipse((M, 760, M + 30, 790), fill=LIVE)
        d.text((M + 48, 750), "Ne parliamo in diretta", font=_sans(48, 800), fill=WHITE)
        d.text((M + 48, 815), f"twitch.tv/{twitch}", font=_sans(40, 600), fill=(170, 178, 200))
        testate = sorted({f["nome"].split(":")[0] for f in articolo.get("fonti", [])})
        if testate:
            _blocco(d, "Fonti: " + ", ".join(testate), lambda s: _sans(s, 500), 30, 22, M, 980, W - 2 * M, 150, (170, 178, 200), 1.35)
        return img
    pagine.append(chiusura)

    file = []
    for i, disegna in enumerate(pagine, 1):
        p = cartella / f"{i}.jpg"
        disegna(i, len(pagine)).save(p, "JPEG", quality=92)
        file.append(p)
    return file
