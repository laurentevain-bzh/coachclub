// /api/pop-tactic.js — Route Vercel pour Pop tactique

const SYSTEM_PROMPT = `Tu es Pop, coach basket IA expert pour équipes féminines U15.
Terrain grille 16x14. Colonnes A-P (gauche→droite), lignes 1-14 (haut=panier→bas).
Panier en haut centre (H2-I2). Raquette : F1 à L6.
Joueurs attaque: 1(meneur H8), 2(ailier dr N4), 3(ailier g D4), 4(poste bas g D12), 5(poste bas dr N12).
Défense: D1(H4), D2(J4), D3(F6), D4(L6), D5(H10).
Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte avant ou après :
{"explanation":"explication courte en français","reset":true,"players":[{"label":"1","pos":"H8"},{"label":"2","pos":"N4"},{"label":"3","pos":"D4"},{"label":"4","pos":"D12"},{"label":"5","pos":"N12"},{"label":"D1","pos":"H4"},{"label":"D2","pos":"J4"},{"label":"D3","pos":"F6"},{"label":"D4","pos":"L6"},{"label":"D5","pos":"H10"}],"ball":"H8","arrows":[{"from":"1","to":"F6","team":"atk"}]}
Les flèches sont dans l'ordre séquentiel d'animation. Maximum 6 flèches. Adapte au niveau U15.
Utilise uniquement des positions dans la grille A-P × 1-14.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Missing message" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("") || "";

    // Parse JSON strict
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
