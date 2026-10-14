"""Chiamata ai modelli AI gratuiti via REST, con risposta JSON, gestione dei limiti e riserve.
I fornitori si provano nell'ordine di config.LLM_ORDINE (groq, github, gemini): se uno
non risponde, si passa al successivo e per il resto del giro si salta quello caduto."""
import json
import re
import time

import requests

import config

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_ultima = 0.0
_esauriti: set[str] = set()
_caduti: set[str] = set()  # fornitori falliti del tutto: per il resto del giro si saltano


def _modelli() -> list[str]:
    riserva = getattr(config, "MODELLI_RISERVA", ["gemini-flash-lite-latest", "gemini-3.5-flash-lite"])
    lista = [config.GEMINI_MODEL] + [m for m in riserva if m != config.GEMINI_MODEL]
    return [m for m in lista if m not in _esauriti]


def _attesa_suggerita(r: requests.Response) -> float:
    m = re.search(r'"retryDelay":\s*"(\d+)', r.text)
    return float(m.group(1)) + 2 if m else 20.0


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_LISTA = "https://api.groq.com/openai/v1/models"
_NON_CHAT = ("whisper", "guard", "tts", "orpheus", "playai", "distil")


def _groq_modelli() -> list[str]:
    """Modelli Groq da provare: prima quelli di config, poi quelli che Groq dice di avere oggi."""
    lista = list(config.GROQ_MODELLI)
    try:
        r = requests.get(GROQ_LISTA, headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"}, timeout=30)
        if r.status_code == 200:
            attivi = [m["id"] for m in r.json().get("data", [])
                      if m.get("active", True) and not any(x in m["id"].lower() for x in _NON_CHAT)]
            # i modelli più grandi rispondono meglio in italiano: prima quelli con più parametri dichiarati
            attivi.sort(key=lambda n: -max([int(x) for x in re.findall(r"(\d+)b", n.lower())] or [0]))
            lista = [m for m in lista if m in attivi] + [m for m in attivi if m not in lista]
            print(f"[llm] groq modelli disponibili: {', '.join(lista[:6])}")
    except (requests.exceptions.RequestException, ValueError, KeyError) as e:
        print(f"[llm] groq elenco modelli non disponibile: {e}")
    return lista


def _groq(sistema: str, richiesta: str, temperatura: float) -> dict:
    """Riserva gratuita: Groq (API compatibile OpenAI). Prova i modelli in ordine."""
    ultimo = ""
    for modello in _groq_modelli()[:5]:
        for tentativo in range(2):
            try:
                r = requests.post(
                    GROQ_URL,
                    headers={"Authorization": f"Bearer {config.GROQ_API_KEY}", "Content-Type": "application/json"},
                    json={"model": modello, "temperature": temperatura, "response_format": {"type": "json_object"},
                          "messages": [{"role": "system", "content": sistema + "\nRispondi solo con un oggetto JSON valido, in italiano."},
                                       {"role": "user", "content": richiesta}]},
                    timeout=120,
                )
            except requests.exceptions.RequestException as e:
                ultimo = f"{modello}: rete {e}"
                time.sleep(10)
                continue
            if r.status_code == 200:
                try:
                    return json.loads(r.json()["choices"][0]["message"]["content"])
                except (KeyError, IndexError, json.JSONDecodeError):
                    ultimo = f"{modello}: JSON non valido"
                    continue
            ultimo = f"{modello}: HTTP {r.status_code} {r.text[:300]}"
            print(f"[llm] groq {ultimo}")
            if r.status_code == 429:
                time.sleep(min(30, 8 * (tentativo + 1)))
                continue
            break
        time.sleep(3)
    raise RuntimeError(f"Groq non disponibile. Ultimo errore: {ultimo}")


GITHUB_URL = "https://models.github.ai/inference/chat/completions"


def _github(sistema: str, richiesta: str, temperatura: float) -> dict:
    """GitHub Models: gratuito con il GITHUB_TOKEN del workflow (permesso models: read)."""
    ultimo = ""
    for modello in config.GITHUB_MODELLI:
        for tentativo in range(2):
            try:
                r = requests.post(
                    GITHUB_URL,
                    headers={"Authorization": f"Bearer {config.GITHUB_TOKEN}", "Content-Type": "application/json",
                             "Accept": "application/json"},
                    json={"model": modello, "temperature": temperatura, "response_format": {"type": "json_object"},
                          "messages": [{"role": "system", "content": sistema + "\nRispondi solo con un oggetto JSON valido, in italiano."},
                                       {"role": "user", "content": richiesta}]},
                    timeout=120,
                )
            except requests.exceptions.RequestException as e:
                ultimo = f"{modello}: rete {e}"
                time.sleep(10)
                continue
            if r.status_code == 200:
                try:
                    return json.loads(r.json()["choices"][0]["message"]["content"])
                except (KeyError, IndexError, TypeError, json.JSONDecodeError):
                    ultimo = f"{modello}: JSON non valido"
                    continue
            ultimo = f"{modello}: HTTP {r.status_code} {r.text[:300]}"
            print(f"[llm] github {ultimo}")
            if r.status_code == 429 and tentativo == 0:
                time.sleep(min(60, float(r.headers.get("retry-after", 20) or 20)))
                continue
            break
    raise RuntimeError(f"GitHub Models non disponibile. Ultimo errore: {ultimo}")


def _fornitori() -> list[tuple[str, object]]:
    disponibili = {
        "groq": (config.GROQ_API_KEY, _groq),
        "github": (config.GITHUB_TOKEN, _github),
        "gemini": (config.GEMINI_API_KEY, _gemini),
    }
    return [(nome, disponibili[nome][1]) for nome in config.LLM_ORDINE
            if nome in disponibili and disponibili[nome][0] and nome not in _caduti]


def chiedi(sistema: str, richiesta: str, temperatura: float = 0.4) -> dict:
    """Prova i fornitori nell'ordine di config.LLM_ORDINE; il primo che risponde vince."""
    errori = []
    for nome, funzione in _fornitori():
        try:
            return funzione(sistema, richiesta, temperatura)
        except RuntimeError as e:
            _caduti.add(nome)
            errori.append(str(e))
            print(f"[llm] {e} -> salto {nome} per il resto del giro")
    if not errori:
        raise RuntimeError("Nessun fornitore AI configurato: servono GROQ_API_KEY, GITHUB_TOKEN o GEMINI_API_KEY.")
    raise RuntimeError("Nessun fornitore AI ha risposto. " + " | ".join(errori))


def _gemini(sistema: str, richiesta: str, temperatura: float = 0.4) -> dict:
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
            
            try:
                r = requests.post(
                    URL.format(model=modello),
                    headers={"x-goog-api-key": config.GEMINI_API_KEY, "Content-Type": "application/json"},
                    json=corpo,
                    timeout=180,
                )
                _ultima = time.time()
            except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
                ultimo_errore = f"{modello}: Errore di rete/Timeout - {e}"
                print(f"[llm] {ultimo_errore}, tentativo {tentativo+1}/3")
                time.sleep(15 * (tentativo + 1))
                continue

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
    
