# CoachClub — Contexte projet pour Claude

## Présentation
Plateforme IA pour coachs de basket, développée par Laurent Evain (Lolo), coach U15 filles D6 Nord (Wasquehal FEM B). App full-stack déployée sur Vercel + Supabase.

- **URL** : https://coachclub.vercel.app
- **GitHub** : github.com/laurentevain-bzh/coachclub
- **Utilisateur** : Laurent (coachName dans la session)

---

## Stack technique

| Couche | Techno |
|--------|--------|
| Frontend | React 18 + Vite 4, CSS inline dans `App.jsx` |
| Déploiement | Vercel (auto-deploy sur push GitHub) |
| Backend | Vercel Serverless Functions (`/api/`) |
| Base de données | Supabase PostgreSQL (région Ireland) |
| Storage | Supabase Storage (bucket `positions-tirs` pour PDFs) |
| IA principal | `claude-haiku-4-5-20251001` (chat, plans, entraînements) |
| IA PDF | `claude-sonnet-4-20250514` (analyse feuilles FFBB) |
| IA tactique | `claude-sonnet-4-20250514` (Pop tactique) |
| YouTube | YouTube Data API v3 |

---

## Variables d'environnement Vercel

```
ANTHROPIC_API_KEY       — clé Anthropic
VITE_SUPABASE_URL       — URL Supabase
SUPABASE_SERVICE_KEY    — clé service role (backend only, pas exposée)
YOUTUBE_API_KEY         — clé Google YouTube Data API v3
```

---

## Structure fichiers

```
/
├── src/
│   ├── App.jsx           — Toute l'app (~1750 lignes, monolithique volontaire)
│   ├── TacticalBoard.jsx — Éditeur tactique canvas standalone
│   └── main.jsx          — Entry point React
├── api/
│   ├── claude.js         — Proxy sécurisé (Claude AI + Supabase DB + Storage + YouTube)
│   └── pop-tactic.js     — Route dédiée Pop tactique
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

---

## Architecture API

### `/api/claude.js` — Proxy unifié
Toutes les requêtes frontend passent par ce proxy (sécurité : clés jamais exposées).
Dispatche selon le champ `service` :

- `service: undefined` → Claude AI (chat, plans)
- `service: "supabase"` → Supabase REST API
- `service: "storage_upload"` → Supabase Storage (upload PDF)
- `service: "youtube"` → YouTube Search API (50 résultats max)

### `/api/pop-tactic.js` — Pop tactique
Appel direct à Anthropic avec system prompt tactique. Retourne un JSON de schéma de jeu.

---

## Schéma Supabase

Toutes les tables ont RLS activé avec policy "Service role only".

### `clubs`
```
id text PK, name text, password text (SHA-256+salt),
coaches text[], contexte text, email_recuperation text
```

### `saisons`
```
id text PK, club_id → clubs, nom text, equipe text,
division text, seances_par_semaine int, active boolean
```

### `joueuses` (profil permanent, transcende les saisons)
```
id text PK, club_id → clubs, numero text, prenom text, nom text,
date_naissance text, notes_globales text,
type_joueuse text ('fixe' | 'regional')
```

### `evaluations` (par saison)
```
id text PK, joueuse_id → joueuses, saison_id → saisons,
poste text, notes text,
tir int, dribble int, passe int, defense int, physique int, mental int
(échelle 1-5)
```

### `matches`
```
id text PK, club_id → clubs, saison_id → saisons,
date text, adversaire text, score_nous text, score_eux text,
defense_adverse text, joueuses_cles text,
mon_attaque text, ma_defense text, attaque_adverse text, defense_adverse_notes text,
stats_joueuses jsonb, stats_equipe jsonb, progression_score jsonb,
stats_adversaires jsonb, pdf_tirs_url text
```

### `stats_match_joueuse`
```
id text PK, match_id → matches, joueuse_id → joueuses,
saison_id → saisons, club_id → clubs,
points int, tirs_reussis int, tirs_tentes int, tirs_3pts int,
lf_reussis int, lf_tentes int, fautes int, temps_jeu text, titulaire boolean
```

### `calendrier`
```
id text PK, saison_id → saisons, club_id → clubs,
date text, heure text, adversaire text, lieu text,
type text ('match' | 'entrainement' | 'tournoi'), notes text
```

### `chat_history`
```
id (auto), club_id → clubs, saison_id → saisons,
role text ('user' | 'assistant'), content text, coach text
```

### `plans_match`
```
id text PK, club_id → clubs, saison_id → saisons,
calendrier_id → calendrier (nullable), adversaire text,
contenu text, format text ('court' | 'long')
```

### `plans_entrainement`
```
id text PK, club_id → clubs, saison_id → saisons,
calendrier_id → calendrier (nullable),
focus text, duree text, contenu text
```

### `exercices`
```
id text PK, club_id → clubs,
nom text (obligatoire), categorie text (obligatoire),
youtube_url text (obligatoire), description text,
niveau text ('Tous niveaux' | 'Débutant' | 'Intermédiaire' | 'Avancé'),
tags text (virgule-séparés)
```

### Supabase Storage
- Bucket : `positions-tirs` (public)
- Contenu : PDFs positions de tirs FFBB, nommés `{matchId}.pdf`

---

## Composants React (App.jsx)

| Composant | Rôle |
|-----------|------|
| `AuthPage` | Login / création club + 1ère saison |
| `ForgotPassword` | Reset mdp via email de récupération |
| `SaisonModal` | Switcher et créer des saisons |
| `JoueusesPage` | Effectif permanent + évaluations par saison + stats |
| `MatchsPage` | Liste matchs, upload PDF FFBB, analyse IA, fiche détail |
| `CalendrierPage` | Calendrier cliquable → déclenche GamePlan ou Training |
| `GamePlanPage` | Plan de match avec sélection joueuses + matchs de référence |
| `TrainingPage` | Plan entraînement avec sélection joueuses + exercices bibliothèque |
| `ExercicesPage` | Bibliothèque d'exercices + recherche YouTube |
| `SparringPage` | Pop (sparring partner IA) + bouton "Ouvrir dans l'éditeur tactique" |
| `App` (Root) | State global, routing, chargement données |

### `TacticalBoard.jsx` (standalone)
Éditeur tactique canvas demi-terrain basket :
- Grille 8×7 (colonnes A-H, lignes 1-7, panier en haut)
- 5 attaquants (verts 1-5) + 5 défenseurs (rouges D1-D5) + ballon
- Modes : déplacer (drag & drop) / dessiner flèches
- Animation séquentielle des flèches
- Formations prédéfinies : 2-1-2, 2-2-1, 1-3-1, Zone 2-3
- Sauvegarde de schémas en session
- Reçoit `initData` depuis Pop tactique pour charger un schéma

---

## Routing (SPA)

Pas de router externe. État `page` dans le Root :

```
sparring | gameplan | training | tactique | calendrier | joueuses | matchs | exercices
```

Navigation via `navigate(page, context?)` — le `context` permet de passer des données (ex: événement calendrier → GamePlan pré-rempli).

---

## Auth

- Identifiant club = `clubName.toLowerCase().replace(/\s+/g, "_")`
- Mot de passe hashé SHA-256 + sel `coachclub_salt_2024` (Web Crypto API côté navigateur)
- Session stockée dans `localStorage` (clé `cc_sess`) : `{ clubId, coachName, saisonId }`
- Récupération mdp : email de récupération saisi à la création du club

---

## Analyse PDF FFBB

Fiche de score officielle FFBB. Colonnes dans l'ordre :
`N° Maillot | NOM Prénom | 5 de départ (X=titulaire) | Tps de jeu | Nb Pts Marqués | Nb Tirs Réussis (IGNORER) | 3 Pts Réussis | 2 Int Réussis | 2 Ext Réussis | LF Réussis | Ftes Com`

**Important** : colonne "Nb Tirs Réussis" = total de contrôle, à ignorer dans l'extraction.
**Important** : identifier WASQUEHAL par le nom (pas par position locaux/visiteurs).

Analyse en 2 passes :
1. `askClaudeWithPDFs` avec Sonnet → JSON stats (1 seul appel PDF pour éviter rate limit)
2. `askClaude` sans PDF → analyse narrative en 4 blocs (mon_attaque, ma_defense, attaque_adverse, defense_adverse)

---

## Pop / Sparring Partner

- Nom affiché : **Cortex** (renommage en **Pop** prévu mais pas encore fait)
- Mémoire : historique de la saison courante en base + accès allMatches (toutes saisons)
- Rôle : avocat du diable bienveillant, challenge les décisions du coach
- Bouton "🏀 Ouvrir dans l'éditeur" sur chaque réponse → appelle `/api/pop-tactic` → ouvre TacticalBoard avec le schéma animé

### Pop tactique (référentiel grille)
```
Colonnes A-H (gauche→droite), lignes 1-7 (haut=panier→bas)
Panier : D1-E1
Raquette : C1 à F3
Positions de référence :
  1 (meneur) : D4
  2 (ailier dr) : G2
  3 (ailier g) : B2
  4 (poste bas g) : B6
  5 (poste bas dr) : G6
  D1-D5 : défenseurs
```

---

## Conventions de code

- **Pas de router externe** — state `page` simple
- **Pas de CSS externe** — tout dans la constante `CSS` dans App.jsx (injection via `<style>`)
- **Pas de state manager** — props drilling depuis le Root
- **DB calls** — tous via l'objet `db` qui utilise `sb()` → `/api/claude` (service: "supabase")
- **IDs** — générés côté client avec `uid()` = `Math.random().toString(36).slice(2, 9)`
- **JSONB Supabase** — toujours parser avec `safeJson()` avant utilisation (peut revenir string)
- **Joueuses** : matching par nom uniquement (pas par numéro de maillot qui peut changer)
- **Type joueuse** : `'fixe'` (effectif permanent) ou `'regional'` (renfort ponctuel)

---

## Features à faire (backlog)

- [x] Renommer Cortex → Pop dans l'UI
- [ ] Refactoring App.jsx en composants séparés (>1700 lignes)
- [ ] Suivi progression individuelle joueuse (courbe visuelle sur la saison)
- [ ] Bilan de fin de saison généré par Pop
- [ ] Transfert joueuses entre saisons en un clic
- [ ] Gestion absences/blessures
- [ ] Temps de jeu par joueuse sur la saison

---

## Points d'attention / bugs connus

- Les champs JSONB (stats_joueuses, stats_equipe, progression_score, stats_adversaires) peuvent revenir comme string depuis Supabase → toujours utiliser `safeJson(v, def)`
- Rate limit Haiku sur les PDFs lourds → utiliser Sonnet pour l'analyse PDF
- Le `useEffect` qui réinitialise `selectedJoueuses` dans GamePlan/Training ne doit s'activer que si la sélection est vide (pour ne pas écraser la sélection manuelle)
- La page Matchs peut crasher silencieusement si un champ JSONB est malformé → chaque match est dans un try/catch individuel
