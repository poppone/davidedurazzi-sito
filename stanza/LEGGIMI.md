# La stanza degli agenti

Il posto dove gli agenti dell'azienda si incontrano. Ognuno continua a
lavorare dove lavora oggi (GitHub Actions, routine Claude, PC di Davide);
qui lasciano il risultato, si controllano a vicenda e ricevono le correzioni.

Chi tiene in ordine la stanza è il **Direttore**: una routine Claude che gira
**una volta al giorno**, alle 6:30 italiane, dopo la redazione del mattino e
prima che Davide si svegli. Le sue istruzioni sono in `direttore.md`.

## I file

| File | Cosa contiene | Chi lo scrive |
|---|---|---|
| `squadra.json` | Chi c'è, dove vive, cosa produce, chi lo controlla e con quale checklist | Davide (il Direttore propone modifiche) |
| `bacheca.json` | I compiti aperti: correzioni, migliorie, cose da approvare | Il Direttore |
| `qualita.json` | I voti di ogni controllo, agente per agente, giorno per giorno | Il Direttore |
| `diario/AAAA-MM-GG.md` | Il verbale del giorno: cosa è uscito, cosa è stato bocciato, cosa decide Davide | Il Direttore |

## Il ciclo del giorno

1. **Raccolta**: il Direttore legge cosa ha prodotto ogni agente nelle ultime 24 ore.
2. **Controllo incrociato**: ogni lavoro viene giudicato con la checklist del
   suo revisore (vedi `squadra.json`), voto da 1 a 5 per ogni punto.
3. **Correzioni**: sotto il 3 nasce un compito in bacheca per l'agente che ha
   prodotto il lavoro. Se lo stesso difetto torna due volte, il compito diventa
   una modifica al codice o alle istruzioni dell'agente (PR, mai unita da sola).
4. **Livellamento**: quello che funziona in un agente (titoli, ritmo, fonti)
   viene proposto agli altri. Il voto medio di ogni agente sta in `qualita.json`,
   così si vede se la qualità sale.
5. **Davide**: un solo messaggio al giorno con le decisioni da prendere.

## Regole che non si toccano

- **Davide approva ogni uscita nuova**: post, video, articoli, email, spese.
  Il Direttore prepara, propone e apre PR; non pubblica, non invia, non spende,
  non unisce PR.
- Le catene che oggi pubblicano da sole (Samaritan Gaming e Notizie) restano
  come sono finché Davide non decide diversamente: la stanza le controlla e
  propone correzioni, non le ferma.
- Niente numeri inventati: un dato che non si riesce a leggere si scrive
  "non disponibile".
- Gli agenti AI si dichiarano sempre come AI verso il pubblico.
