# Il design system di Davide Durazzi

Una pagina sola di regole, per il sito, per le slide dei caroselli e per il
Grafico. I valori stanno in [`tokens.json`](tokens.json); il sito li usa da
[`tokens.css`](tokens.css). Se cambi un colore, cambialo in tutti e due.

## L'idea in una riga

**Si legge di giorno, la macchina vive di notte.** Le pagine da leggere sono
chiare e calme. Dove c'è qualcosa che si muove da solo (l'apertura con la
costellazione, la diretta, il Contraddittorio, la mappa degli agenti) si apre
uno **schermo notturno**: un pannello scuro, arrotondato, che brilla di blu e
arancio. Il futuro sta negli schermi, la lettura sta sulla carta.

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

## Schermi notturni

- Raggio 28px, sfondo notte, bordo di 1px con gradiente blu-arancio.
- Dentro vale la palette notte. Fuori dagli schermi, solo palette giorno.
- Uno schermo per idea: l'apertura, la diretta, il Contraddittorio, la mappa.
  Non diventano card per ogni cosa.

## Movimento

- Si muove solo ciò che è vivo: la costellazione dell'apertura, il nome che si
  compone, il nastro delle ultime notizie, lo scontro Sì/No, la mappa.
- Una sola apparizione per sezione quando entra nello schermo. Niente card che
  si inclinano, niente anelli che girano, niente testi che scorrono in doppio.
- Con "riduci movimento" attivo nel telefono, tutto resta fermo.

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
