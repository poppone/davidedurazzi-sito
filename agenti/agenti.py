"""Gli agenti della redazione. Ognuno ha un compito solo."""
import json

import config
from llm import chiedi

REGOLE = """Fai parte della redazione AI del sito davidedurazzi.it (attualità, cronaca, politica, vita quotidiana).
Regole che non puoi violare:
- Usa SOLO le informazioni presenti nelle notizie fornite. Non inventare dati, cifre, nomi, date o citazioni.
- Non copiare frasi dalle fonti: riformula sempre con parole tue.
- Attribuisci i fatti alla testata ("secondo ANSA...") quando non sono certi o sono contestati.
- Nessuna accusa a persone che non sia riportata dalle fonti, e sempre attribuita.
- Su politica ed elezioni: nessuna preferenza per partiti o candidati, linguaggio neutro.
- Italiano semplice e diretto, adatto a chi ascolta una diretta.
- Rispondi SOLO con JSON valido nel formato richiesto."""


def _fonti_testo(notizie: list[dict]) -> str:
    return "\n".join(f"[{n['id']}] {n['testata']} | {n['titolo']} | {n['sommario']}" for n in notizie)


def scout(notizie: list[dict], area: str, sezioni: list[str], esclusi: list[str]) -> dict | None:
    """Sceglie IL tema migliore per un'area del palinsesto."""
    if not notizie:
        return None
    gia = ("\nNon scegliere storie già trattate oggi: " + "; ".join(esclusi)) if esclusi else ""
    r = chiedi(REGOLE, f"""Sei lo SCOUT. Scegli UN solo tema per una diretta, nell'area: {config.NOMI_AREE.get(area, area)}.
Criteri: interesse per il pubblico generalista, impatto sulla vita delle persone, potenziale di discussione in chat.
OBBLIGATORIO: negli "ids" metti notizie di ALMENO 2 testate diverse (la testata è il secondo campo di ogni riga) che parlano della stessa storia.
Se nessuna storia è coperta da 2 testate, rispondi {{"tema": null}}.{gia}

Sezione: scegli tra {", ".join(sezioni)}.
"divisivo": da 1 a 10, quanto la storia divide le opinioni (serve per scegliere Il Contraddittorio).

Formato:
{{"tema":{{"titolo_lavoro":"...","sezione":"...","perche":"una frase","ids":["n1","n7"],"divisivo":7}}}}

NOTIZIE:
{_fonti_testo(notizie)}""")
    return r.get("tema")


def fact_check(tema: dict, per_id: dict) -> list[dict] | None:
    """Controllo deterministico: il tema passa solo con almeno MIN_TESTATE testate diverse."""
    fonti = [per_id[i] for i in tema.get("ids", []) if i in per_id]
    testate = {f["testata"] for f in fonti}
    if len(testate) < config.MIN_TESTATE:
        print(f"[fact-check] scartato '{tema.get('titolo_lavoro')}': testate {sorted(testate)}")
        return None
    return fonti


def redattore(tema: dict, fonti: list[dict], problemi: list[str] | None = None) -> dict:
    correzioni = ""
    if problemi:
        correzioni = "\nUna bozza precedente aveva questi problemi, evitali:\n- " + "\n- ".join(problemi)
    return chiedi(REGOLE, f"""Sei il REDATTORE. Scrivi un articolo breve sul tema "{tema['titolo_lavoro']}".
Struttura: cosa è successo, perché conta per le persone, cosa resta da capire.{correzioni}

Formato:
{{"titolo":"max 90 caratteri","sommario":"1-2 frasi","testo":["3-5 paragrafi brevi"],"domande_live":["3 domande da porre al pubblico in diretta"]}}

NOTIZIE:
{_fonti_testo(fonti)}""")


def critico(articolo: dict, fonti: list[dict]) -> dict:
    return chiedi(REGOLE, f"""Sei il CRITICO / FACT-CHECKER. Confronta l'articolo con le notizie.
Segnala: affermazioni non presenti nelle fonti, cifre o nomi sbagliati, toni di parte, frasi copiate, accuse non attribuite.

Formato: {{"ok":true,"problemi":["..."]}}

ARTICOLO:
{json.dumps(articolo, ensure_ascii=False)}

NOTIZIE:
{_fonti_testo(fonti)}""", temperatura=0.1)


def contraddittorio(tema: dict, fonti: list[dict]) -> dict:
    """Moderatore pone la domanda, due agenti si schierano, il moderatore bilancia."""
    base = _fonti_testo(fonti)
    q = chiedi(REGOLE, f"""Sei il MODERATORE. Formula UNA domanda secca e neutra (risposta Sì/No) sul tema "{tema['titolo_lavoro']}",
che divida davvero le opinioni e riguardi la vita delle persone. Formato: {{"domanda":"..."}}

NOTIZIE:
{base}""")["domanda"]

    lato = lambda pos: chiedi(REGOLE, f"""Sei l'agente che sostiene il {pos} alla domanda: "{q}".
Porta i 3 argomenti più forti e onesti per questa posizione, basati sui fatti delle notizie o su ragionamenti generali chiari.
Niente attacchi a persone, niente dati inventati. Formato: {{"titolo":"{pos}","punti":["...","...","..."]}}

NOTIZIE:
{base}""", temperatura=0.7)
    tesi, antitesi = lato("Sì"), lato("No")

    return chiedi(REGOLE, f"""Sei il MODERATORE. Controlla che il confronto sia equilibrato: stessa forza e lunghezza dei due lati,
domanda neutra, nessun argomento falso o offensivo. Correggi dove serve senza cambiare le posizioni.
Formato: {{"domanda":"...","tesi":{{"titolo":"Sì","punti":[...]}},"antitesi":{{"titolo":"No","punti":[...]}}

DOMANDA: {q}
TESI: {json.dumps(tesi, ensure_ascii=False)}
ANTITESI: {json.dumps(antitesi, ensure_ascii=False)}""", temperatura=0.2)
