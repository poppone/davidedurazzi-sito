# Foto → Video (stato WhatsApp)

Programma per Windows: metti le foto in una cartella, lui crea `video.mp4` verticale 1080x1920 (max 30 s) con zoom lento, dissolvenze e sfondo sfocato.

## Come si usa
1. Crea una cartella (es. `S3`) e mettici le foto. L'ordine è quello del nome file: rinominale `01.jpg`, `02.jpg`, ...
2. Facoltativo: un file `musica.mp3` (o .m4a/.wav) nella stessa cartella → va in sottofondo (tagliato o ripetuto alla durata del video, con dissolvenza finale).
3. Facoltativo: un file `testo.txt` con due righe → titolo e sottotitolo sulla prima foto. Se manca, il programma li chiede.
4. Doppio clic su `FotoVideo.exe`, scegli la cartella, aspetta: alla fine si apre la cartella con `video.mp4`.

Da riga di comando: `FotoVideo.exe C:\cartella "Titolo" "Sottotitolo"`.

Con più di 15 foto il video supera i 30 secondi dello stato: il programma avvisa.

Sorgente: `foto_video.py` (Python 3, Pillow, numpy, ffmpeg). Compilazione: `pyinstaller --onefile --windowed --name FotoVideo --collect-all imageio_ffmpeg foto_video.py`.
