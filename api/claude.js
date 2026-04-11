// Proxy sécurisé pour Claude AI, Supabase DB et Supabase Storage

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { service, path, method, body, prefer } = req.body || {};

  // ─── CLAUDE AI ───
  if (service === "claude" || !service) {
    try {
      const payload = service === "claude" ? body : req.body;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ─── SUPABASE DB ───
  if (service === "supabase") {
    if (!path) return res.status(400).json({ error: "Missing path" });
    try {
      const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`;
      const response = await fetch(url, {
        method: method || "GET",
        headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": prefer || "return=representation" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      if (!response.ok) return res.status(response.status).json({ error: text });
      return res.status(200).json(text ? JSON.parse(text) : null);
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ─── SUPABASE STORAGE UPLOAD ───
  if (service === "storage_upload") {
    const { bucket, filename, fileBase64, contentType } = req.body;
    if (!bucket || !filename || !fileBase64) return res.status(400).json({ error: "Missing params" });
    try {
      const fileBuffer = Buffer.from(fileBase64, "base64");
      const url = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": contentType || "application/pdf", "x-upsert": "true" },
        body: fileBuffer,
      });
      if (!response.ok) { const err = await response.text(); return res.status(response.status).json({ error: err }); }
      const publicUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
      return res.status(200).json({ url: publicUrl });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ─── YOUTUBE SEARCH ───
  if (service === "youtube") {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query" });
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "YouTube error" });
      return res.status(200).json(data);
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  return res.status(400).json({ error: "Unknown service" });
}
