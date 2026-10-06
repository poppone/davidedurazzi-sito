# davidedurazzi.it — contesto per Claude Code

Sito personale di attualità di Davide Durazzi (dirette Twitch, YouTube, Instagram) con redazione AI.
Rispondi sempre in italiano. Davide preferisce risposte dirette e pratiche.

## Stack
- Sito statico (HTML/CSS/JS, nessuna build) su **Vercel**, dominio davidedurazzi.it (www è il principale; .com fa redirect).
- DNS su Register.it. Repo: github.com/poppone/davidedurazzi-sito, branch `main` → ogni push = deploy.
- Funzioni serverless Node in `api/` (CommonJS, `module.exports = async (req, res)`). I file `api/_*.js` non sono endpoint.
- Database commenti: Upstash Redis via REST (env `UPSTASH_REDIS_REST_URL/TOKEN` o `KV_REST_API_URL/TOKEN`).
- AI: Google Gemini free tier via REST (env `GEMINI_API_KEY`), modelli di riserva in caso di 429/503.

## Struttura
- `config.js` — UNICO file di configurazione del sito (canali, testi, orari, sezioni). Davide lo modifica a mano: non sovrascriverlo, modificalo solo dove serve.
- `content/articoli.json` — articoli pubblicati (visibili solo con `"pubblicato": true`).
- `index.html`, `articolo.html`, `privacy.html`, `app.js`, `style.css` — frontend. Font: Archivo + Source Serif 4. Colori: ink #10162B, blu tesi #2F55E4, arancio antitesi #E85A16, live #E5263B. Light/dark con token CSS.
- `assets/logo-*.png` — logo di Davide (64/192/512).
- `overlay/contraddittorio.html` — fonte Browser OBS 1920x1080: sondaggio live !si/!no letto dalla chat Twitch anonima; comandi mod !apri !chiudi !reset !nascondi !mostra; `?demo=1` per test.
- `admin/index.html` + `api/admin.js` — moderazione commenti (password env `ADMIN_PASSWORD`). All'approvazione l'agente classifica: "pratica" → risposta automatica firmata "Redazione AI" (sempre dichiarata); "discussione" → bozza che Davide pubblica col suo nome; "ignora".
- `api/commenti.js` — GET commenti approvati / POST nuovo commento in moderazione (honeypot, rate limit su IP anonimizzato).
- `api/youtube.js` — ultimi video dal feed RSS del canale.

## Redazione AI (cartella `agenti/`, Python 3.12 su GitHub Actions)
- `.github/workflows/redazione.yml` — ogni giorno alle 05:00 UTC: `agenti/main.py`.
  Palinsesto in `agenti/config.py` (`PALINSESTO`): 1 tema di attualità + 2 aree del giorno; Scout per area → fact-check (min 2 testate) → Redattore → Critico → Il Contraddittorio (tema più "divisivo"). Output: `bozze/bozze.json` + `bozze/scaletta-AAAA-MM-GG.md`.
- `.github/workflows/pubblica.yml` — su push di `bozze/bozze.json`: `promuovi.py` sposta le bozze con `"approvato": true` in `content/articoli.json`; `instagram.py genera` crea il carosello (`slides.py`, Pillow) in `ig/<slug>/`; `instagram.py pubblica` pubblica via Instagram API with Instagram Login (secret `IG_ACCESS_TOKEN`), registro in `social/instagram.json`.
- `.github/workflows/token-instagram.yml` — rinnovo token il 1 e il 15 del mese (secret `GH_PAT`).
- `.vercelignore` esclude agenti, bozze, social, .github.

## Regole
- Su politica e cronaca: niente contenuti inventati, fonti sempre citate, nulla va online senza approvazione di Davide.
- L'agente commenti non deve mai fingersi Davide: le risposte automatiche restano dichiarate come AI (AI Act).
- In Python scrivi sempre file con `encoding="utf-8"`.
- Prima di modificare file grandi, leggili; non riscrivere `config.js` né `content/articoli.json` interi.

## Da fare (ottobre 2026)
- In Vercel: collegare Upstash Redis, impostare `GEMINI_API_KEY` e `ADMIN_PASSWORD`, poi redeploy (attiva i commenti).
- Prima prova reale: approvare una bozza e verificare sito + carosello Instagram + overlay.
- Controllare nei log della redazione quali feed RSS non rispondono e sostituirli.
