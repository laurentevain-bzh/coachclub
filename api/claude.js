// Proxy sécurisé pour Claude AI et Supabase
// Les clés API ne sont jamais exposées au frontend

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { service, path, method, body, prefer } = req.body || {};

  // ─── CLAUDE AI ───
  if (service === "claude" || !service) {
    try {
      const payload = service === "claude" ? body : req.body;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─── SUPABASE ───
  if (service === "supabase") {
    if (!path) return res.status(400).json({ error: "Missing path" });
    try {
      const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`;
      const response = await fetch(url, {
        method: method || "GET",
        headers: {
          "apikey": process.env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": prefer || "return=representation",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      if (!response.ok) return res.status(response.status).json({ error: text });
      return res.status(200).json(text ? JSON.parse(text) : null);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: "Unknown service" });
}
