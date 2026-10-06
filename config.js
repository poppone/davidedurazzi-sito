// ============================================================
//  CONFIGURAZIONE DEL SITO — modifica solo questo file
// ============================================================
window.SITE = {
  nome: "Davide Durazzi",
  sottotitolo: "L'attualità, senza copione",
  presentazione:
    "Ogni giorno prendo una notizia, un problema di tutti i giorni o una novità e la smonto pezzo per pezzo: in diretta, con gli ospiti e con il contraddittorio. Le fonti sono sempre in fondo all'articolo.",

  // Twitch: nome del canale (es. "popponetv")
  twitch: "popponetv",
  orariLive: "La diretta: martedì alle 21:30",

  // YouTube: ID del canale (inizia con UC..., lo trovi in YouTube Studio > Impostazioni > Canale > Impostazioni avanzate)
  youtubeChannelId: "https://www.youtube.com/channel/UCbEC2iCWFdT_W3WgdxYl7Hw",
  youtubeUrl: "https://www.youtube.com/@Notiziein60secondioff",

  // Instagram: profilo + link dei post da mostrare (copia l'URL del post)
  instagram: "poppone.tech",
  instagramPost: [
    // "https://www.instagram.com/p/XXXXXXXXXXX/",
  ],

  // Piazza Aperta: link a un Google Form per proporre temi (se vuoto usa l'email)
  modulTemi: "",
  email: "info@davidedurazzi.it",

  // Sezioni del sito (non rinominare gli id: li usano gli articoli)
  sezioni: [
    { id: "cronaca", nome: "Cronaca" },
    { id: "politica", nome: "Politica ed elezioni" },
    { id: "quotidiano", nome: "Vita quotidiana" },
    { id: "economia", nome: "Economia e soldi" },
    { id: "tecnologia", nome: "Tecnologia e AI" },
    { id: "sport", nome: "Sport" },
    { id: "spettacolo", nome: "Spettacolo e social" },
    { id: "gaming", nome: "Gaming" },
    { id: "motori", nome: "Motori" }
  ]
};
