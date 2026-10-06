"""Chiamata a Gemini via REST, con risposta JSON, gestione dei limiti e modelli di riserva."""
import json
import re
import time

import requests

import config

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_ultima = 0.0
_esauriti: set[str] = set()


def _modelli() -> list[str]:
    riserva = getattr(config, "MODELLI_RISERVA", ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"])
    lista = [config.GEMINI_MODEL] + [m for m in riserva if m != config.GEMINI_MODEL]
    return [m for m in lista if m not in _esauriti]


def _attesa_suggerita(r: requests.Response) -> float:
    m = re.search(r'"retryDelay":\s*"(\d+)', r.text)
    return float(m.group(1)) + 2 if m else 20.0


def chiedi(sistema: str, richiesta: str, temperatura: float = 0.4) -> dict:
    global _ultima
    if not config.GEMINI_API_KEY:
        raise RuntimeError("Manca GEMINI_API_KEY (secret del repository).")

    corpo = {
        "systemInstruction": {"parts": [{"text": sistema}]},
        "contents": [{"role": "user", "parts": [{"text": richiesta}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": temperatura},
    }
    ultimo_errore = ""
    for modello in _modelli():
        for tentativo in range(3):
            attesa = config.PAUSA_TRA_CHIAMATE - (time.time() - _ultima)
            if attesa > 0:
                time.sleep(attesa)
            r = requests.post(
                URL.format(model=modello),
                headers={"x-goog-api-key": config.GEMINI_API_KEY, "Content-Type": "application/json"},
                json=corpo,
                timeout=180,
            )
            _ultima = time.time()
            if r.status_code == 200:
                parti = r.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
                testo = "".join(p.get("text", "") for p in parti if not p.get("thought")).strip()
                testo = testo.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                try:
                    return json.loads(testo)
                except json.JSONDecodeError:
                    ultimo_errore = f"{modello}: JSON non valido"
                    print(f"[llm] {ultimo_errore}, riprovo")
                    continue
            ultimo_errore = f"{modello}: HTTP {r.status_code} {r.text[:400]}"
            print(f"[llm] {ultimo_errore}")
            if r.status_code == 429 and ("PerDay" in r.text or "limit: 0" in r.text):
                _esauriti.add(modello)  # quota giornaliera finita o modello non gratuito: passa al successivo
                break
            if r.status_code in (400, 403, 404):
                break  # modello inesistente o chiave senza accesso: passa al successivo
            time.sleep(_attesa_suggerita(r) if r.status_code == 429 else 15 * (tentativo + 1))
    raise RuntimeError(f"Gemini non disponibile. Ultimo errore: {ultimo_errore}")
