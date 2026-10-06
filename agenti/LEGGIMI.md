# Redazione AI

Ogni mattina alle 7 GitHub Actions esegue:

1. **Raccolta**: legge le notizie delle ultime 30 ore dai feed RSS (`config.py`)
2. **Scout**: sceglie i 3 temi migliori
3. **Fact-checker**: scarta i temi riportati da una sola testata
4. **Redattore**: scrive l'articolo
5. **Critico**: lo confronta con le fonti; se trova problemi, il Redattore riscrive
6. **Il Contraddittorio**: il Moderatore pone la domanda, un agente difende il Sì, uno il No, il Moderatore bilancia

Risultato in `bozze/`:
- `bozze.json`: le bozze da approvare (NON visibili sul sito)
- `scaletta-AAAA-MM-GG.md`: la scaletta per la diretta, con domande per il pubblico

## Approvare
Su GitHub apri `bozze/bozze.json`, clicca la matita, e per ogni bozza:
- `"approvato": true` → va online (puoi correggere testo e titolo prima)
- `"scartare": true` → viene eliminata
Commit: il sito si aggiorna da solo in un minuto.

Controlla sempre `nota_critico` e le fonti prima di approvare.
