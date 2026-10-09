// ============================================================
//  CONFIGURAZIONE DEL SITO — modifica solo questo file
// ============================================================
window.SITE = {
  nome: "Davide Durazzi",
  sottotitolo: "Tecnologia, AI e Gaming",
  presentazione:
    "Ogni giorno prendo una notizia o una novità su tecnologia, intelligenza artificiale e videogiochi e la smonto pezzo per pezzo: in diretta, con gli ospiti e con il contraddittorio. Le fonti sono sempre in fondo all'articolo.",

  // Twitch: nome del canale (es. "popponetv")
  twitch: "DavideDurazzi",
  orariLive: "La diretta: martedì alle 21:30",

  // YouTube: ID del canale
  youtubeChannelId: "UCNMKJ6Etxs-2SMGGquGnaDg",
  youtubeUrl: "https://www.youtube.com/@davidedurazzioff",

  // Instagram: profilo + link dei post da mostrare
  instagram: "davidedurazzi.it",
  // X (Twitter): username senza @
  x: "PopponeTV",

  // LinkedIn: parte finale dell'indirizzo del profilo (linkedin.com/in/...)
  linkedin: "davide-durazzi-36a52665",
  instagramPost: [
    // "https://www.instagram.com/p/XXXXXXXXXXX/",
  ],

  // Piazza Aperta: link a un Google Form per proporre temi (se vuoto usa l'email)
  modulTemi: "",
  email: "info@davidedurazzi.it",

  // Affiliazioni: link "Dove comprarlo" in fondo agli articoli (lascia "" per spegnerle)
  instantGaming: "poppone",   // codice igr di Instant Gaming, per i giochi
  amazonTag: "",              // tag Amazon Affiliati (es. "davidedurazzi-21"), per i prodotti tech

  // Donazioni: link alla tua pagina Ko-fi o PayPal.me (lascia "" per nasconderle)
  donazioni: "",

  // Sezioni del sito (gli id coincidono esattamente con agenti/config.py)
  sezioni: [
    { id: "tecnologia", nome: "Tecnologia" },
    { id: "gaming", nome: "Gaming" },
    { id: "ai", nome: "Intelligenza Artificiale" }
  ]
};
