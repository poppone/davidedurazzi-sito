"""Chiamata a Gemini via REST, con risposta JSON e gestione dei limiti (429)."""
import json
import time

import requests

import config

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_ultima = 0.0


def chiedi(sistema: str, richiesta: str, temperatura: float = 0.4) -> dict:
    global _ultima
    if not config.GEMINI_API_KEY:
        raise RuntimeError("Manca GEMINI_API_KEY (secret del repository).")
    attesa = config.PAUSA_TRA_CHIAMATE - (time.time() - _ultima)
    if attesa > 0:
        time.sleep(attesa)

    corpo = {
        "systemInstruction": {"parts": [{"text": sistema}]},
        "contents": [{"role": "user", "parts": [{"text": richiesta}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": temperatura},
    }
    for tentativo in range(4):
        r = requests.post(
            URL.format(model=config.GEMINI_MODEL),
            headers={"x-goog-api-key": config.GEMINI_API_KEY, "Content-Type": "application/json"},
            json=corpo,
            timeout=120,
        )
        _ultima = time.time()
        if r.status_code in (429, 500, 503):
            time.sleep(20 * (tentativo + 1))
            continue
        r.raise_for_status()
        dati = r.json()
        parti = dati.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        testo = "".join(p.get("text", "") for p in parti if not p.get("thought"))
        testo = testo.strip().removeprefix("```json").removesuffix("```").strip()
        try:
            return json.loads(testo)
        except json.JSONDecodeError:
            corpo["contents"][0]["parts"][0]["text"] = richiesta + "\n\nRispondi SOLO con JSON valido."
            continue
    raise RuntimeError("Gemini non ha risposto in modo valido dopo 4 tentativi.")
