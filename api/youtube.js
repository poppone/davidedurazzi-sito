// Funzione serverless Vercel: legge il feed RSS pubblico del canale YouTube
// e restituisce gli ultimi video in JSON. Nessuna chiave API necessaria.
const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

module.exports = async (req, res) => {
  const id = String((req.query && req.query.channel) || process.env.YOUTUBE_CHANNEL_ID || "");
  if (!/^UC[\w-]{22}$/.test(id)) {
    res.status(400).json({ error: "ID canale YouTube non valido" });
    return;
  }
  try {
    const r = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + id);
    if (!r.ok) throw new Error("feed " + r.status);
    const xml = await r.text();
    const pick = (block, tag) => {
      const m = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">"));
      return m ? decode(m[1].trim()) : "";
    };
    const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 9).map((m) => ({
      id: pick(m[1], "yt:videoId"),
      titolo: pick(m[1], "title"),
      data: pick(m[1], "published")
    })).filter((v) => v.id);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json({ videos });
  } catch (e) {
    res.status(502).json({ error: "Feed YouTube non raggiungibile" });
  }
};
