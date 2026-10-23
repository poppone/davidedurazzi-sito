# Il design system di Davide Durazzi

Una pagina sola di regole, per il sito, per le slide dei caroselli e per il
Grafico. I colori stanno in [`tokens.json`](tokens.json); il sito li usa da
[`plancia.css`](plancia.css), le slide da `agenti/slides.py`. Se cambi un
colore, cambialo in `tokens.json` e in `plancia.css`.

## L'idea in una riga

**Il sito è la plancia di comando della redazione.** Fondo buio da sala
controllo, pannelli di vetro con il bordo che prende luce blu e arancio, e al
centro dell'apertura la **rete viva** degli agenti (`rete.js`): la squadra vera,
presa da `content/azienda.json`, che gira, segue il mouse e fa correre i
pacchetti di lavoro lungo i fili. Gli articoli invece si leggono su un
**foglio chiaro** estratto dalla plancia: il futuro sta intorno, la lettura sta
sulla carta.

## Colori

| Nome | Giorno | Notte | Per cosa |
|---|---|---|---|
| Carta | `#F2F4F9` | `#070B18` | Sfondo della pagina |
| Superficie | `#FFFFFF` | `#0F1630` | Riquadri, moduli, schede |
| Inchiostro | `#10162B` | `#EAEEF6` | Testo e titoli |
| Nebbia | `#4A5573` | `#9AA6C6` | Testo secondario, date, note |
| Linea | `#D8DDE9` | `#1F2848` | Bordi e separatori |
| Tesi (blu) | `#2F55E4` | `#7B97FF` | Link, il Sì, Tecnologia e AI |
| Antitesi (arancio) | `#E85A16` | `#FF8A4C` | Il No, Gaming, accenti |
| Diretta (rosso) | `#E5263B` | `#FF4D61` | Solo "in diretta" e Motori |

- Su sfondo chiaro l'arancio e il rosso come **testo piccolo** diventano
  `#B8430C` e `#C81E33`, altrimenti non si leggono (contrasto sotto 4,5).
- Sul sito la plancia usa la colonna Notte, con il fondo ancora più buio
  (`#04060D`) e il testo secondario `#A3AECB`; la colonna Giorno vale per il
  foglio degli articoli e per le slide di testo.
- Blu e arancio insieme in un gradiente solo sui bordi degli schermi e sulle
  barre del voto. Mai sul testo.
- Ogni sezione degli articoli ha il suo colore, sempre lo stesso: vedi
  `sezioni` in `tokens.json`.

## Caratteri

- **Archivo** per titoli e interfaccia. Titoli: larghezza 112-125, peso
  800-900, interlinea stretta. Interfaccia: larghezza normale, peso 500-700.
- **Source Serif 4** per leggere: articoli, sommari, introduzioni.
  Negli articoli almeno 1,2rem con interlinea 1,7 e righe sotto i 70
  caratteri.
- Niente maiuscolo per le etichette: la sezione di un articolo si scrive
  normale, preceduta dal pallino del suo colore.

## Plancia, pannelli e foglio

- Fondo: il vuoto (`#04060D`) con una griglia leggera che sfuma verso il basso.
- Pannelli: vetro scuro, raggio 22px, bordo di 1px con la luce blu in alto a
  sinistra e arancio in basso a destra. Uno per idea (diretta, Contraddittorio,
  il gioco, l'app, newsletter, Piazza), mai una card per ogni cosa.
- Schermi: la diretta ha anche gli angoli da mirino.
- Ogni canale (sezione) ha il titolo grande, la riga sotto e un punto acceso
  all'inizio della riga.
- Testo secondario mai più scuro di `#A3AECB` sul fondo: si deve leggere.
- Foglio dell'articolo: carta `#F4F6FB`, inchiostro `#10162B`, Source Serif 4
  a 1,2rem con interlinea 1,78. Il Contraddittorio dentro il foglio resta scuro.

## Movimento

- Si muove solo ciò che è vivo: la rete degli agenti, il nome che si compone,
  il nastro delle ultime notizie, lo scontro Sì/No, la mappa in /azienda.
- La rete esce dal cervello una volta sola all'apertura, poi gira piano.
- Al passaggio del mouse: la scheda dell'agente, i fili accesi, la riga che si
  illumina sotto un articolo. Niente card che si inclinano o anelli che girano.
- Con "riduci movimento" attivo, tutto resta fermo (la rete si può ancora
  esplorare col mouse).

## Caroselli, copertine e Pin (il lavoro del Grafico)

| Regola | Come |
|---|---|
| Formato | Carosello 1080x1350, Pin 1000x1500, copertina YouTube 1280x720 |
| Margini | Almeno 96px dal bordo: niente testo tagliato dalle app |
| Sfondo | Slide di testo su Carta giorno; slide d'impatto (copertina, chiusura con la diretta) su Notte; Sì e No pieni di blu e arancio |
| Titolo | Archivo 800-900, massimo 3 righe, mai sopra il viso |
| Corpo | Source Serif 4, meglio 36-44px su 1080 di larghezza, mai sotto 28px |
| Colori | Solo quelli della tabella; un accento per slide |
| Firma | "Davide Durazzi" in alto a sinistra, numero di slide e davidedurazzi.it in basso |
| Fonti | L'ultima slide elenca le testate citate |
| Prodotti ZampaViva | Almeno 3 foto, testo alternativo in italiano |
| Diritti | Solo immagini ufficiali, nostre o generate; mai di altri creator |

### Come vota il Grafico (1-5)

Per ogni grafica, un punto per ciascuna di queste cose fatte bene:
1. si legge da telefono (margini, dimensione, contrasto);
2. usa solo colori e caratteri di questa pagina;
3. una sola idea per slide, con un solo accento di colore;
4. firma, numerazione e fonti al loro posto;
5. nessun problema di diritti.

Il Grafico esce dalla prova quando la media dei suoi controlli resta **almeno
4 per 5 giorni di fila**: a quel punto il Direttore propone a Davide di
metterlo "attivo".

## Lo studio (home, dal 23/10/2026)

Davide ha scelto su Canva lo stile "streamer professionale" (bozza
https://www.canva.com/d/3vXvC-Sn0BptFgA). In home `studio.css` si carica dopo
`plancia.css`: stessi colori e stesse animazioni, ma superfici piene, bordi
netti, angoli di 6-10px, niente vetro né aloni. Intorno alla rete gira
l'anello dei social (`social.js` + `rete.js`): icone cliccabili collegate al
cervello, dove arrivano i pacchetti dei lavori pubblicati.
