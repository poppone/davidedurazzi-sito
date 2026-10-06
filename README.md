# davidedurazzi.it

Sito statico (HTML/CSS/JS, nessuna build) + una funzione serverless Vercel per i video YouTube.

## Struttura
- `config.js` — **l'unico file da modificare**: canali, testi, orari, sezioni
- `content/articoli.json` — gli articoli. Visibili solo quelli con `"pubblicato": true`
- `api/youtube.js` — legge il feed RSS del canale YouTube (nessuna chiave API)
- `index.html`, `articolo.html`, `app.js`, `style.css`

## Messa online (una volta sola)
1. Crea un repository GitHub (es. `davidedurazzi-sito`) e carica questi file.
2. Su vercel.com: **Add New → Project → Import** il repository. Framework: *Other*. Deploy.
3. In Vercel: **Settings → Domains** → aggiungi `davidedurazzi.it` e `www.davidedurazzi.it`
   (e anche `davidedurazzi.com`, impostato come redirect verso `.it`).
4. Vercel ti mostra i record DNS da inserire nel pannello del registrar:
   - `A` per `@` → l'IP indicato da Vercel
   - `CNAME` per `www` → il valore indicato da Vercel
   Il certificato HTTPS si attiva da solo in pochi minuti.

Da quel momento ogni `git push` aggiorna il sito.

## Articoli
Ogni articolo in `content/articoli.json`:
```json
{
  "slug": "titolo-in-minuscolo-con-trattini",
  "pubblicato": false,
  "titolo": "...",
  "sezione": "cronaca | politica | quotidiano | novita",
  "rubrica": "contraddittorio | piazza | (vuoto)",
  "data": "AAAA-MM-GG",
  "sommario": "...",
  "testo": ["paragrafo 1", "paragrafo 2"],
  "domanda": "solo per il Contraddittorio",
  "tesi":     { "titolo": "Sì", "punti": ["..."] },
  "antitesi": { "titolo": "No", "punti": ["..."] },
  "fonti": [{ "nome": "ANSA", "url": "https://..." }]
}
```
Gli agenti scriveranno qui con `"pubblicato": false`. Tu rileggi, metti `true` e fai push.

## Note
- Diretta Twitch: funziona solo sul dominio reale (o sull'URL di anteprima Vercel), non aprendo il file dal PC.
- Instagram: incolla in `config.js` i link dei post da mostrare.
