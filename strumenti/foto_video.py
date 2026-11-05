# -*- coding: utf-8 -*-
"""
Foto → Video (stato WhatsApp)
Metti le foto in una cartella (ordine = nome file: 01.jpg, 02.jpg...).
Se nella cartella c'è un file musica.mp3 (o .m4a/.wav) viene messo in sottofondo.
Se c'è un file testo.txt, la prima riga è il titolo e la seconda il sottotitolo.
Uscita: video.mp4 nella stessa cartella (1080x1920, max 30 secondi).

Uso: doppio clic sull'exe (chiede la cartella) oppure
     foto_video.exe <cartella> ["Titolo"] ["Sottotitolo"]
"""
import os, re, sys, glob, shutil, subprocess, datetime
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageEnhance, ImageOps

W, H = 1080, 1920
FPS = 25
MAX_SEC = 30.0        # limite stato WhatsApp
DUR_MAX, DUR_MIN = 2.0, 1.2
XF = 0.4              # dissolvenza
S = 1.18              # margine per lo zoom

def base_dir():
    return os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))

def trova_ffmpeg():
    cand = [os.path.join(getattr(sys, "_MEIPASS", base_dir()), "ffmpeg.exe"),
            os.path.join(base_dir(), "ffmpeg.exe")]
    for c in cand:
        if os.path.exists(c):
            return c
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    p = shutil.which("ffmpeg")
    if p:
        return p
    raise SystemExit("ffmpeg non trovato: metti ffmpeg.exe accanto al programma.")

def font(bold, size):
    nomi = (["segoeuib.ttf", "arialbd.ttf", "InterDisplay-Bold.otf", "DejaVuSans-Bold.ttf"] if bold
            else ["segoeui.ttf", "arial.ttf", "Inter-Medium.otf", "DejaVuSans.ttf"])
    dirs = [r"C:\Windows\Fonts", "/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/dejavu", base_dir()]
    for d in dirs:
        for n in nomi:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def ordina_naturale(nomi):
    def k(s):
        return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", os.path.basename(s))]
    return sorted(nomi, key=k)

def componi(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    BW, BH = int(W * S), int(H * S)
    r = max(BW / im.width, BH / im.height)
    bg = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
    bg = bg.crop(((bg.width - BW) // 2, (bg.height - BH) // 2, (bg.width - BW) // 2 + BW, (bg.height - BH) // 2 + BH))
    bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(45))).enhance(0.45)
    # foto nitida: se verticale riempie l'altezza, se orizzontale la larghezza
    if im.height / im.width >= BH / BW:
        fh = int(BH * 0.94); fw = int(im.width * fh / im.height)
    else:
        fw = int(BW * 0.94); fh = int(im.height * fw / im.width)
    fg = im.resize((fw, fh), Image.LANCZOS)
    mask = Image.new("L", (fw, fh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, fw - 1, fh - 1), radius=int(36 * S), fill=255)
    x, y = (BW - fw) // 2, (BH - fh) // 2
    sh = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x, y + int(18 * S), x + fw, y + fh + int(18 * S)), radius=int(36 * S), fill=(0, 0, 0, 160))
    sh = sh.filter(ImageFilter.GaussianBlur(30))
    base = bg.convert("RGBA"); base.alpha_composite(sh); base.paste(fg, (x, y), mask)
    return base.convert("RGB")

def titolo(fr, t, t1, t2):
    a = min(1.0, max(0.0, (t - 0.3) / 0.5))
    if a <= 0 or not t1:
        return fr
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    f1 = font(True, 88); f2 = font(False, 38)
    # riduci il titolo se troppo largo
    while d.textlength(t1, font=f1) > W - 120 and f1.size > 40:
        f1 = font(True, f1.size - 4)
    w1 = d.textlength(t1, font=f1); w2 = d.textlength(t2, font=f2) if t2 else 0
    wb = max(w1, w2); y0 = H - 470; hb = 200 if t2 else 130
    d.rounded_rectangle(((W - wb) // 2 - 40, y0 - 30, (W + wb) // 2 + 40, y0 + hb), radius=28, fill=(16, 22, 43, int(200 * a)))
    d.text(((W - w1) // 2, y0), t1, font=f1, fill=(255, 255, 255, int(255 * a)))
    if t2:
        d.text(((W - w2) // 2, y0 + 120), t2, font=f2, fill=(232, 90, 22, int(255 * a)))
    out = fr.convert("RGBA"); out.alpha_composite(ov); return out.convert("RGB")

def crea_video(cartella, t1="", t2="", log=print):
    foto = []
    for e in ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"):
        foto += glob.glob(os.path.join(cartella, e))
    foto = ordina_naturale(list(dict.fromkeys(foto)))
    if not foto:
        raise SystemExit("Nessuna foto (.jpg/.png) nella cartella.")
    musica = None
    for e in ("*.mp3", "*.m4a", "*.wav", "*.aac"):
        m = glob.glob(os.path.join(cartella, e))
        if m:
            musica = m[0]; break
    if not t1 and os.path.exists(os.path.join(cartella, "testo.txt")):
        righe = [r.strip() for r in open(os.path.join(cartella, "testo.txt"), encoding="utf-8") if r.strip()]
        t1 = righe[0] if righe else ""; t2 = righe[1] if len(righe) > 1 else ""
    n = len(foto)
    dur = min(DUR_MAX, max(DUR_MIN, (MAX_SEC + (n - 1) * XF) / n))
    totale = n * dur - (n - 1) * XF
    if totale > MAX_SEC + 0.01:
        log(f"Attenzione: {n} foto sono troppe per 30 secondi, il video durerà {totale:.0f} s. Togline qualcuna.")
    ffmpeg = trova_ffmpeg()
    out = os.path.join(cartella, "video.mp4")
    log(f"{n} foto, {dur:.1f} s ciascuna, durata {totale:.0f} s" + (f", musica: {os.path.basename(musica)}" if musica else ", senza musica"))
    log("Preparo le foto...")
    basi = [componi(p) for p in foto]
    BW, BH = basi[0].size
    nc, nx = int(dur * FPS), int(XF * FPS)

    def frame(i, k):
        p = k / (nc - 1)
        z0, z1 = (1.0, 1.10) if i % 2 == 0 else (1.10, 1.0)
        z = z0 + (z1 - z0) * p
        cw, ch = int(W * S / z), int(H * S / z)
        lat = 1 if i % 3 == 0 else -1 if i % 3 == 1 else 0
        dx = int((BW - cw) * (0.5 + 0.25 * (p - 0.5) * lat)); dy = (BH - ch) // 2
        fr = basi[i].crop((dx, dy, dx + cw, dy + ch)).resize((W, H), Image.LANCZOS)
        if i == 0:
            fr = titolo(fr, k / FPS, t1, t2)
        return np.asarray(fr, dtype=np.float32)

    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if musica:
        cmd += ["-stream_loop", "-1", "-i", musica, "-filter_complex",
                f"[1:a]atrim=0:{totale:.2f},afade=t=in:st=0:d=0.5,afade=t=out:st={max(0, totale - 1.5):.2f}:d=1.5[a]",
                "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "160k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    flags = {"creationflags": 0x08000000} if os.name == "nt" else {}
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE, **flags)
    coda = None
    for i in range(n):
        log(f"Montaggio foto {i + 1}/{n}")
        fr = [frame(i, k) for k in range(nc)]
        if i == 0:
            for k in range(nx): fr[k] *= k / nx
        if i == n - 1:
            for k in range(nx): fr[nc - 1 - k] *= k / nx
        if coda is not None:
            for k in range(nx):
                a = (k + 1) / (nx + 1); fr[k] = coda[k] * (1 - a) + fr[k] * a
        corpo = fr if i == n - 1 else fr[:nc - nx]
        for f in corpo:
            ff.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
        coda = fr[nc - nx:]
    ff.stdin.close(); ff.wait()
    if ff.returncode != 0 or not os.path.exists(out):
        raise SystemExit("ffmpeg ha dato errore, video non creato.")
    log(f"Fatto: {out}")
    return out

def gui():
    import tkinter as tk
    from tkinter import filedialog, simpledialog, messagebox
    root = tk.Tk(); root.withdraw()
    cartella = filedialog.askdirectory(title="Scegli la cartella con le foto")
    if not cartella:
        return
    t1 = simpledialog.askstring("Titolo", "Titolo sulla prima foto (vuoto = nessuno):", initialvalue="") or ""
    t2 = ""
    if t1:
        t2 = simpledialog.askstring("Sottotitolo", "Riga sotto il titolo (es. km, anno):", initialvalue="") or ""
    win = tk.Toplevel(); win.title("Foto → Video"); win.geometry("420x120")
    lab = tk.Label(win, text="Avvio...", wraplength=400, justify="left"); lab.pack(padx=12, pady=12)
    def log(m):
        lab.config(text=m); win.update()
    try:
        out = crea_video(cartella, t1, t2, log)
        messagebox.showinfo("Foto → Video", f"Video pronto:\n{out}")
        try:
            os.startfile(cartella)
        except Exception:
            pass
    except SystemExit as e:
        messagebox.showerror("Foto → Video", str(e))
    except Exception as e:
        messagebox.showerror("Foto → Video", f"Errore: {e}")
    win.destroy()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        crea_video(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "", sys.argv[3] if len(sys.argv) > 3 else "")
    else:
        try:
            gui()
        except Exception as e:
            print(f"Errore: {e}"); input("Premi Invio per chiudere")
