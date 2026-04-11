// /api/pop-tactic.js — Route Vercel pour Pop tactique

const SYSTEM_PROMPT = `Tu es Pop, coach basket IA expert pour équipes féminines U15.
Terrain grille 8x7. Colonnes A-H (gauche→droite), lignes 1-7 (haut=panier→bas).
Panier en haut centre (D1-E1). Raquette : C1 à F3. Zone 3pts autour.
Joueurs attaque: 1(meneur D4), 2(ailier dr G2), 3(ailier g B2), 4(poste bas g B6), 5(poste bas dr G6).
Défense: D1-D5 positionnés face aux attaquants.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte avant ou après :
{"explanation":"explication courte en français","reset":true,"players":[{"label":"1","pos":"D4"},{"label":"2","pos":"G2"},{"label":"3","pos":"B2"},{"label":"4","pos":"B6"},{"label":"5","pos":"G6"},{"label":"D1","pos":"D2"},{"label":"D2","pos":"E2"},{"label":"D3","pos":"C3"},{"label":"D4","pos":"F3"},{"label":"D5","pos":"D5"}],"ball":"D4","arrows":[{"from":"1","to":"C2","team":"atk"}]}
Les flèches sont dans l'ordre séquentiel d'animation. Maximum 6 flèches. Adapte au niveau U15.
Utilise uniquement des positions dans la grille A-H × 1-7.`;

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
