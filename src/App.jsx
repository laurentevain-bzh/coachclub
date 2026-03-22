import { useState, useRef, useEffect } from "react";

/* ─── AI CALL HELPER — appel via proxy Vercel sécurisé ─── */
const askClaude = async (system, messages) => {
  const body = { model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages };
  if (system) body.system = system;

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.map(c => c.text || "").join("") || "Réponse vide.";
};

/* ─── STORAGE HELPERS (persistent across sessions via window.storage) ─── */
const STORE_KEY = "coachclub_v1";

const loadStore = async () => {
  try {
    const result = localStorage.getItem(STORE_KEY) ? Promise.resolve({value: localStorage.getItem(STORE_KEY)}) : Promise.resolve(null);
    return result ? JSON.parse(result.value) : null;
  } catch { return null; }
};

const saveStore = async (data) => {
  try { Promise.resolve(localStorage.setItem(STORE_KEY, JSON.stringify(data))); } catch {}
};

const initStore = () => ({
  clubs: {},        // { clubId: { name, password, coaches: [], players: [], matches: [], chatHistory: [] } }
  session: null,    // { clubId, coachName }
});

/* ─── STYLES ─── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #111214;
  --surface: #1a1c20;
  --surface2: #21242a;
  --border: #2e3038;
  --accent: #e8f040;
  --accent-dim: #e8f04022;
  --accent-glow: #e8f04011;
  --white: #eef0f5;
  --muted: #686b7a;
  --red: #ff4d4d;
  --green: #4dff9a;
  --court: #c8a96e;
  --court-dim: #c8a96e18;
  --sparring: #a78bfa;
  --sparring-dim: #a78bfa18;
}

body { background: var(--bg); color: var(--white); font-family: 'DM Sans', sans-serif; min-height: 100vh; overflow-x: hidden; }

/* COURT TEXTURE */
.court-bg {
  position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.03;
  background-image: repeating-linear-gradient(0deg, transparent, transparent 59px, var(--court) 59px, var(--court) 60px),
    repeating-linear-gradient(90deg, transparent, transparent 59px, var(--court) 59px, var(--court) 60px);
}

.app { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }

/* ─── AUTH ─── */
.auth-wrap {
  min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
}

.auth-box {
  width: 100%; max-width: 440px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 2px;
  overflow: hidden;
}

.auth-top {
  background: var(--accent); padding: 28px 32px 24px;
}

.auth-logo {
  font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 28px;
  letter-spacing: 3px; text-transform: uppercase; color: #111; line-height: 1;
}

.auth-sub { font-size: 12px; color: #333; margin-top: 4px; letter-spacing: 1px; text-transform: uppercase; }

.auth-body { padding: 28px 32px; }

.auth-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; }

.auth-tab {
  font-family: 'Oswald', sans-serif; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase;
  padding: 10px 16px; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent;
  background: none; border-top: none; border-left: none; border-right: none; transition: all 0.15s;
}
.auth-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ─── LAYOUT ─── */
.header {
  background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 0 16px; display: flex; align-items: center; justify-content: space-between;
  height: 52px; position: sticky; top: 0; z-index: 100;
}

.logo {
  font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 20px;
  letter-spacing: 2px; text-transform: uppercase;
}
.logo em { color: var(--accent); font-style: normal; }

.header-right { display: flex; align-items: center; gap: 10px; }
.club-badge {
  font-family: 'Oswald', sans-serif; font-size: 10px; letter-spacing: 1px;
  text-transform: uppercase; background: var(--accent-dim); color: var(--accent);
  padding: 3px 8px; border-radius: 2px; border: 1px solid var(--accent);
  max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.coach-name { font-size: 12px; color: var(--muted); display: none; }

.main { display: flex; flex: 1; }

/* DESKTOP SIDEBAR */
.sidebar {
  width: 220px; background: var(--surface); border-right: 1px solid var(--border);
  padding: 20px 0; flex-shrink: 0; position: sticky; top: 52px; height: calc(100vh - 52px); overflow-y: auto;
}

.nav-group { margin-bottom: 28px; }
.nav-label {
  font-family: 'Oswald', sans-serif; font-size: 9px; letter-spacing: 2.5px;
  text-transform: uppercase; color: var(--muted); padding: 0 18px; margin-bottom: 6px;
}

.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 18px;
  cursor: pointer; transition: all 0.12s; color: var(--muted); font-size: 14px;
  border-left: 2px solid transparent;
}
.nav-item:hover { color: var(--white); background: var(--surface2); }
.nav-item.active { color: var(--accent); border-left-color: var(--accent); background: var(--accent-glow); font-weight: 500; }
.nav-item .ni { width: 18px; text-align: center; font-size: 15px; }

.content { flex: 1; padding: 24px; overflow-y: auto; max-width: 1100px; }

/* MOBILE BOTTOM NAV */
.bottom-nav {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  background: var(--surface); border-top: 1px solid var(--border);
  height: 60px; padding-bottom: env(safe-area-inset-bottom);
}
.bottom-nav-inner {
  display: flex; height: 60px;
}
.bnav-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; cursor: pointer; color: var(--muted); transition: color 0.15s;
  border: none; background: none; padding: 0;
  -webkit-tap-highlight-color: transparent;
}
.bnav-item.active { color: var(--accent); }
.bnav-icon { font-size: 20px; line-height: 1; }
.bnav-label { font-family: 'Oswald', sans-serif; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; }

/* RESPONSIVE */
@media (max-width: 640px) {
  .sidebar { display: none; }
  .bottom-nav { display: block; }
  .content { padding: 16px 14px 76px; }
  .header { height: 48px; padding: 0 14px; }
  .coach-name { display: none; }
  .club-badge { max-width: 100px; font-size: 9px; }
  .grid2 { grid-template-columns: 1fr !important; }
  .grid3 { grid-template-columns: 1fr 1fr !important; }
  .page-title { font-size: 20px; margin-bottom: 16px; }
  .card { padding: 14px; }
  .stat-strip { gap: 8px; }
  .sval { font-size: 24px; }
  .player-grid { grid-template-columns: 1fr 1fr; }
  .modal { padding: 18px; }
  .sparring-wrap { height: calc(100vh - 48px - 60px); }
  .field input, .field textarea, .field select { font-size: 16px; } /* prevent iOS zoom */
  .btn { padding: 11px 16px; }
  .mitem { padding: 10px 12px; gap: 10px; }
  .mscore { font-size: 16px; }
  .auth-body { padding: 20px; }
  .auth-top { padding: 20px; }
}

/* ─── COMPONENTS ─── */
.page-title {
  font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 26px;
  letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px;
}
.page-title span { color: var(--accent); }

.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 2px;
  padding: 20px; margin-bottom: 16px;
}
.card-title {
  font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 13px;
  letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent);
  margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
}

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }

.field { margin-bottom: 14px; }
.field label {
  display: block; font-family: 'Oswald', sans-serif; font-size: 10px;
  letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px;
}
.field input, .field textarea, .field select {
  width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 2px;
  color: var(--white); font-family: 'DM Sans', sans-serif; font-size: 14px;
  padding: 9px 12px; outline: none; transition: border-color 0.15s;
}
.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--accent); }
.field textarea { resize: vertical; min-height: 80px; }
.field select option { background: var(--surface2); }

.btn {
  font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 12px;
  letter-spacing: 2px; text-transform: uppercase; padding: 9px 20px;
  border-radius: 2px; cursor: pointer; border: none; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px;
}
.btn-accent { background: var(--accent); color: #111; }
.btn-accent:hover { filter: brightness(1.08); }
.btn-accent:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
.btn-ghost:hover { color: var(--white); border-color: var(--muted); }
.btn-danger { background: transparent; color: var(--red); border: 1px solid #ff4d4d33; font-size: 11px; padding: 5px 12px; }
.btn-danger:hover { background: #ff4d4d18; }
.btn-sparring { background: var(--sparring-dim); color: var(--sparring); border: 1px solid var(--sparring); }
.btn-sparring:hover { background: #a78bfa33; }

/* PLAYER CARDS */
.player-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.pcard {
  background: var(--surface2); border: 1px solid var(--border); border-radius: 2px;
  padding: 14px; transition: border-color 0.15s; position: relative;
}
.pcard:hover { border-color: var(--accent); }
.pnum {
  font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 36px;
  color: var(--court); line-height: 1; margin-bottom: 2px;
}
.pname { font-weight: 500; font-size: 14px; }
.ppos { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
.skill-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.skill-lbl { font-size: 10px; color: var(--muted); width: 52px; flex-shrink: 0; }
.skill-track { flex: 1; height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
.skill-fill { height: 100%; background: var(--accent); }
.skill-val { font-size: 10px; color: var(--white); width: 12px; }

/* MATCH LIST */
.mitem {
  display: flex; align-items: center; gap: 14px; padding: 12px 16px;
  background: var(--surface2); border: 1px solid var(--border); border-radius: 2px;
  margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s;
}
.mitem:hover { border-color: var(--accent); }
.mdate { font-family: 'Oswald', sans-serif; font-size: 11px; color: var(--muted); width: 72px; flex-shrink: 0; }
.mvs { flex: 1; font-size: 14px; font-weight: 500; }
.mscore { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 20px; }
.mscore.w { color: var(--green); }
.mscore.l { color: var(--red); }

.stat-strip { display: flex; gap: 12px; margin-bottom: 20px; }
.sbox {
  flex: 1; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 2px; padding: 14px; text-align: center;
}
.sval { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 30px; color: var(--accent); line-height: 1; }
.slbl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }

/* STARS */
.stars { display: flex; gap: 3px; }
.star { font-size: 17px; cursor: pointer; color: var(--border); transition: color 0.1s; }
.star.on { color: var(--accent); }

/* BADGE */
.badge {
  font-family: 'Oswald', sans-serif; font-size: 9px; letter-spacing: 1.5px;
  text-transform: uppercase; padding: 2px 7px; border-radius: 2px; font-weight: 600;
}
.b-yellow { background: var(--accent-dim); color: var(--accent); }
.b-green { background: #4dff9a18; color: var(--green); }
.b-red { background: #ff4d4d18; color: var(--red); }

/* UPLOAD */
.dropzone {
  border: 2px dashed var(--border); border-radius: 2px; padding: 28px;
  text-align: center; cursor: pointer; transition: all 0.15s; margin-bottom: 16px;
}
.dropzone:hover, .dropzone.drag { border-color: var(--accent); background: var(--accent-glow); }
.dropzone-icon { font-size: 28px; margin-bottom: 6px; }
.dropzone-txt { font-size: 13px; color: var(--muted); }
.dropzone-txt strong { color: var(--white); }

/* MODAL */
.overlay {
  position: fixed; inset: 0; background: #000000d0;
  display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px;
}
.modal {
  background: var(--surface); border: 1px solid var(--border); border-radius: 2px;
  padding: 24px; width: 100%; max-width: 560px; max-height: 85vh; overflow-y: auto;
}
.modal-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-ttl {
  font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 16px;
  letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent);
}
.close { background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; }
.close:hover { color: var(--white); }

/* ─── SPARRING PARTNER ─── */
.sparring-wrap {
  display: flex; flex-direction: column; height: calc(100vh - 56px - 56px);
  background: var(--bg); border-radius: 2px; overflow: hidden; border: 1px solid var(--sparring);
}

.sparring-header {
  background: var(--sparring-dim); border-bottom: 1px solid var(--sparring);
  padding: 14px 20px; display: flex; align-items: center; gap: 12px;
}
.sparring-avatar {
  width: 36px; height: 36px; border-radius: 50%; background: var(--sparring);
  display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
}
.sparring-name {
  font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 15px;
  letter-spacing: 1.5px; text-transform: uppercase; color: var(--sparring);
}
.sparring-desc { font-size: 11px; color: var(--muted); font-family: 'Lora', serif; font-style: italic; }

.sparring-status { margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--sparring); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sparring); animation: blink 2s ease-in-out infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

.chat-messages {
  flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;
}

.msg { display: flex; gap: 10px; max-width: 85%; }
.msg.user { align-self: flex-end; flex-direction: row-reverse; }

.msg-bubble {
  padding: 12px 16px; border-radius: 2px; font-size: 14px; line-height: 1.6;
}
.msg.bot .msg-bubble {
  background: var(--sparring-dim); border: 1px solid var(--sparring);
  font-family: 'Lora', serif; color: var(--white);
}
.msg.user .msg-bubble {
  background: var(--surface2); border: 1px solid var(--border); color: var(--white);
}

.msg-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
  display: flex; align-items: center; justify-content: center; font-size: 13px;
}
.msg.bot .msg-avatar { background: var(--sparring-dim); border: 1px solid var(--sparring); color: var(--sparring); }
.msg.user .msg-avatar { background: var(--surface2); border: 1px solid var(--border); }

.typing-indicator {
  display: flex; gap: 4px; align-items: center; padding: 14px 16px;
  background: var(--sparring-dim); border: 1px solid var(--sparring); border-radius: 2px;
}
.typing-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--sparring);
  animation: bounce 1.2s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

.chat-input-wrap {
  padding: 14px 16px; border-top: 1px solid var(--border);
  background: var(--surface); display: flex; gap: 10px; align-items: flex-end;
}
.chat-input {
  flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 2px;
  color: var(--white); font-family: 'DM Sans', sans-serif; font-size: 14px;
  padding: 10px 14px; outline: none; resize: none; max-height: 100px;
  transition: border-color 0.15s; line-height: 1.5;
}
.chat-input:focus { border-color: var(--sparring); }

.sparring-starters {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 0 20px 16px;
}
.starter-chip {
  font-size: 12px; font-family: 'Lora', serif; font-style: italic;
  background: var(--sparring-dim); border: 1px solid var(--sparring);
  color: var(--sparring); padding: 6px 12px; border-radius: 2px; cursor: pointer;
  transition: all 0.15s;
}
.starter-chip:hover { background: #a78bfa33; }

/* AI output */
.ai-output {
  background: var(--bg); border: 1px solid var(--accent);
  border-radius: 2px; padding: 18px; font-size: 14px; line-height: 1.75;
  white-space: pre-wrap; color: var(--white); min-height: 100px;
}
.ai-loading {
  display: flex; align-items: center; gap: 10px; color: var(--muted);
  font-family: 'Lora', serif; font-style: italic; font-size: 14px; min-height: 80px;
}
.spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--accent);
  animation: spin 0.8s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* UTILS */
.flex { display: flex; }
.gap2 { gap: 8px; }
.gap3 { gap: 12px; }
.items-c { align-items: center; }
.jc-sb { justify-content: space-between; }
.jc-end { justify-content: flex-end; }
.mt2 { margin-top: 8px; }
.mt3 { margin-top: 14px; }
.mt4 { margin-top: 20px; }
.mb2 { margin-bottom: 8px; }
.w100 { width: 100%; }
.muted { color: var(--muted); font-size: 13px; }
.divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
`;

const POSITIONS = ["Meneuse","Arrière","Ailière","Ailière-forte","Pivot"];
const SKILLS = ["Tir","Dribble","Passe","Défense","Physique","Mental"];

/* ─── HELPERS ─── */
function uid() { return Math.random().toString(36).slice(2, 9); }

function Stars({ v, onChange }) {
  return <div className="stars">{[1,2,3,4,5].map(i=>(
    <span key={i} className={`star ${i<=v?"on":""}`} onClick={()=>onChange&&onChange(i)}>★</span>
  ))}</div>;
}

function SkillBar({label,value}) {
  return <div className="skill-row">
    <span className="skill-lbl">{label}</span>
    <div className="skill-track"><div className="skill-fill" style={{width:`${value*20}%`}}/></div>
    <span className="skill-val">{value}</span>
  </div>;
}

/* ─── AUTH PAGE ─── */
function AuthPage({ onAuth }) {
  const [tab, setTab] = useState("join");
  const [clubName, setClubName] = useState("");
  const [password, setPassword] = useState("");
  const [coachName, setCoachName] = useState("");
  const [contexte, setContexte] = useState("");
  const [err, setErr] = useState("");

  const handle = async () => {
    setErr("");
    if (!clubName.trim() || !password.trim() || !coachName.trim()) { setErr("Tous les champs sont requis."); return; }
    const store = (await loadStore()) || initStore();
    const id = clubName.trim().toLowerCase().replace(/\s+/g,"_");
    if (tab === "create") {
      if (store.clubs[id]) { setErr("Un club avec ce nom existe déjà."); return; }
      store.clubs[id] = { name: clubName.trim(), password, coaches: [coachName.trim()], players: [], matches: [], chatHistory: [], contexte: contexte.trim() };
    } else {
      if (!store.clubs[id]) { setErr("Club introuvable. Vérifie le nom."); return; }
      if (store.clubs[id].password !== password) { setErr("Mot de passe incorrect."); return; }
      if (!store.clubs[id].coaches.includes(coachName.trim())) {
        store.clubs[id].coaches.push(coachName.trim());
      }
    }
    store.session = { clubId: id, coachName: coachName.trim() };
    await saveStore(store);
    onAuth({ clubId: id, coachName: coachName.trim(), store });
  };

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-top">
          <div className="auth-logo">Coach<em>Club</em> 🏀</div>
          <div className="auth-sub">Plateforme IA pour coachs basket</div>
        </div>
        <div className="auth-body">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab==="join"?"active":""}`} onClick={()=>setTab("join")}>Rejoindre un club</button>
            <button className={`auth-tab ${tab==="create"?"active":""}`} onClick={()=>setTab("create")}>Créer un club</button>
          </div>
          <div className="field">
            <label>Nom du club</label>
            <input value={clubName} onChange={e=>setClubName(e.target.value)} placeholder="Ex: BC Villeneuve d'Ascq" />
          </div>
          <div className="field">
            <label>Mot de passe du club</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Partagé entre tous les coachs" />
          </div>
          <div className="field">
            <label>Ton prénom (coach)</label>
            <input value={coachName} onChange={e=>setCoachName(e.target.value)} placeholder="Ex: Laurent" />
          </div>
          {tab==="create" && <div className="field">
            <label>Contexte de l'équipe</label>
            <textarea value={contexte} onChange={e=>setContexte(e.target.value)}
              placeholder="Ex: U15 filles, D6 Nord, 12 joueuses, niveau hétérogène, 2e année de compét ensemble..."
              rows={3}/>
            <p style={{fontSize:11,color:"var(--muted)",marginTop:4}}>Cortex s'en souviendra toute la saison.</p>
          </div>}
          {err && <p style={{color:"var(--red)",fontSize:13,marginBottom:12}}>{err}</p>}
          <button className="btn btn-accent w100" onClick={handle} style={{width:"100%"}}>
            {tab==="create" ? "Créer le club" : "Rejoindre"}
          </button>
          <p className="muted mt2" style={{textAlign:"center", marginTop:12}}>
            {tab==="join" ? "Demande le nom et mot de passe au coach principal." : "Partage ces identifiants avec tes adjoints."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── PLAYERS ─── */
function PlayersPage({ club, persist }) {
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});

  const blank = () => ({ numero:"", prenom:"", nom:"", poste: POSITIONS[0], notes:"", ...Object.fromEntries(SKILLS.map(k=>[k,3])) });

  const openNew = () => { setEditId(null); setForm(blank()); setShowModal(true); };
  const openEdit = p => { setEditId(p.id); setForm({...p}); setShowModal(true); };
  const save = () => {
    if (!form.nom) return;
    const updated = editId
      ? club.players.map(p => p.id===editId ? {...form,id:editId} : p)
      : [...club.players, {...form, id:uid()}];
    persist({...club, players: updated});
    setShowModal(false);
  };
  const del = id => persist({...club, players: club.players.filter(p=>p.id!==id)});

  return <div>
    <div className="flex jc-sb items-c" style={{marginBottom:20}}>
      <h2 className="page-title" style={{margin:0}}>Effectif <span>({club.players.length})</span></h2>
      <button className="btn btn-accent" onClick={openNew}>+ Joueuse</button>
    </div>

    {club.players.length===0 && <div className="card" style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:48,marginBottom:12}}>🏀</div>
      <p className="muted">Aucune joueuse. Commence par construire ton effectif.</p>
    </div>}

    <div className="player-grid">
      {club.players.map(p=>(
        <div key={p.id} className="pcard" onClick={()=>openEdit(p)}>
          <div className="pnum">#{p.numero||"?"}</div>
          <div className="pname">{p.prenom} {p.nom}</div>
          <div className="ppos">{p.poste}</div>
          {SKILLS.map(k=><SkillBar key={k} label={k} value={p[k]||3}/>)}
          {p.notes && <p style={{fontSize:11,color:"var(--muted)",marginTop:8,fontStyle:"italic",lineHeight:1.4}}>{p.notes}</p>}
          <button className="btn btn-danger" style={{marginTop:10}} onClick={e=>{e.stopPropagation();del(p.id);}}>Supprimer</button>
        </div>
      ))}
    </div>

    {showModal && <div className="overlay" onClick={()=>setShowModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr">
          <span className="modal-ttl">{editId?"Modifier":"Nouvelle joueuse"}</span>
          <button className="close" onClick={()=>setShowModal(false)}>✕</button>
        </div>
        <div className="grid2">
          <div className="field"><label>Prénom</label><input value={form.prenom||""} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))} placeholder="Prénom"/></div>
          <div className="field"><label>Nom</label><input value={form.nom||""} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Nom"/></div>
        </div>
        <div className="grid2">
          <div className="field"><label>N° maillot</label><input type="number" value={form.numero||""} onChange={e=>setForm(f=>({...f,numero:e.target.value}))} placeholder="7"/></div>
          <div className="field"><label>Poste</label>
            <select value={form.poste||POSITIONS[0]} onChange={e=>setForm(f=>({...f,poste:e.target.value}))}>
              {POSITIONS.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Notes</label><textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Points forts, axes de progression, comportement..."/></div>
        <hr className="divider"/>
        <p className="muted mb2" style={{fontFamily:"Oswald",letterSpacing:1,textTransform:"uppercase",fontSize:10}}>Évaluation (1–5)</p>
        {SKILLS.map(k=>(
          <div key={k} className="field flex items-c gap2" style={{marginBottom:10}}>
            <label style={{width:72,margin:0,flexShrink:0}}>{k}</label>
            <Stars v={form[k]||3} onChange={v=>setForm(f=>({...f,[k]:v}))}/>
          </div>
        ))}
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
          <button className="btn btn-accent" onClick={save}>Enregistrer</button>
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── MATCHES ─── */
function MatchesPage({ club, persist }) {
  const [showModal, setShowModal] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");
  const fileRef = useRef();
  const [form, setForm] = useState({ date:"", adversaire:"", scoreNous:"", scoreEux:"", defense_adverse:"", joueuses_cles:"", resume:"" });

  const handlePdf = async file => {
    if (!file || file.type!=="application/pdf") return;
    setParsing(true); setPdfMsg("Analyse en cours...");
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result.split(",")[1];
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1000,
            messages: [{ role:"user", content:[
              {type:"document", source:{type:"base64",media_type:"application/pdf",data:b64}},
              {type:"text", text:`Extrais les infos de cette feuille de match basket. Réponds UNIQUEMENT en JSON:\n{"adversaire":"","score_nous":0,"score_eux":0,"joueuses":"stats clés en 1 ligne"}`}
            ]}]
          })
        });
        const data = await res.json();
        const txt = data.content?.map(c=>c.text||"").join("") || "";
        const p = JSON.parse(txt.replace(/```json|```/g,"").trim());
        setForm(f=>({...f, adversaire:p.adversaire||f.adversaire, scoreNous:String(p.score_nous||f.scoreNous), scoreEux:String(p.score_eux||f.scoreEux), joueuses_cles:p.joueuses||f.joueuses_cles}));
        setPdfMsg("✅ Analysé");
      } catch { setPdfMsg("PDF chargé — complète manuellement"); }
      setParsing(false);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.adversaire) return;
    persist({...club, matches:[{...form,id:uid()}, ...club.matches]});
    setShowModal(false);
    setForm({date:"",adversaire:"",scoreNous:"",scoreEux:"",defense_adverse:"",joueuses_cles:"",resume:""});
    setPdfMsg("");
  };

  const wins = club.matches.filter(m=>parseInt(m.scoreNous)>parseInt(m.scoreEux)).length;

  return <div>
    <div className="flex jc-sb items-c" style={{marginBottom:20}}>
      <h2 className="page-title" style={{margin:0}}>Matchs <span>({club.matches.length})</span></h2>
      <button className="btn btn-accent" onClick={()=>setShowModal(true)}>+ Match</button>
    </div>

    {club.matches.length>0 && <div className="stat-strip">
      <div className="sbox"><div className="sval">{club.matches.length}</div><div className="slbl">Joués</div></div>
      <div className="sbox"><div className="sval" style={{color:"var(--green)"}}>{wins}</div><div className="slbl">Victoires</div></div>
      <div className="sbox"><div className="sval" style={{color:"var(--red)"}}>{club.matches.length-wins}</div><div className="slbl">Défaites</div></div>
      <div className="sbox"><div className="sval">{club.matches.length?Math.round(wins/club.matches.length*100):0}%</div><div className="slbl">% Victoire</div></div>
    </div>}

    {club.matches.length===0 && <div className="card" style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:48,marginBottom:12}}>📋</div>
      <p className="muted">Aucun match. Charge ta première feuille !</p>
    </div>}

    {club.matches.map(m=>{
      const w = parseInt(m.scoreNous)>parseInt(m.scoreEux);
      return <div key={m.id} className="mitem">
        <span className="mdate">{m.date||"–"}</span>
        <div style={{flex:1}}>
          <div className="mvs">vs {m.adversaire}</div>
          {m.defense_adverse && <span className="badge b-yellow" style={{display:"inline-block",marginTop:3}}>{m.defense_adverse}</span>}
          {m.resume && <p style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{m.resume.slice(0,90)}{m.resume.length>90?"…":""}</p>}
        </div>
        <div className={`mscore ${w?"w":"l"}`}>{m.scoreNous}–{m.scoreEux}</div>
        <span className={`badge ${w?"b-green":"b-red"}`}>{w?"V":"D"}</span>
      </div>;
    })}

    {showModal && <div className="overlay" onClick={()=>setShowModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr">
          <span className="modal-ttl">Nouveau match</span>
          <button className="close" onClick={()=>setShowModal(false)}>✕</button>
        </div>
        <div className={`dropzone ${parsing?"drag":""}`} onClick={()=>fileRef.current?.click()}
          onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handlePdf(e.dataTransfer.files[0]);}}>
          <input ref={fileRef} type="file" accept=".pdf" style={{display:"none"}} onChange={e=>handlePdf(e.target.files[0])}/>
          <div className="dropzone-icon">📄</div>
          <div className="dropzone-txt">{parsing?"Analyse...":(pdfMsg||<><strong>Charge la feuille PDF</strong><br/>Glisse ou clique</>)}</div>
        </div>
        <div className="grid2">
          <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
          <div className="field"><label>Adversaire</label><input value={form.adversaire} onChange={e=>setForm(f=>({...f,adversaire:e.target.value}))} placeholder="Nom équipe"/></div>
        </div>
        <div className="grid2">
          <div className="field"><label>Notre score</label><input type="number" value={form.scoreNous} onChange={e=>setForm(f=>({...f,scoreNous:e.target.value}))}/></div>
          <div className="field"><label>Score adverse</label><input type="number" value={form.scoreEux} onChange={e=>setForm(f=>({...f,scoreEux:e.target.value}))}/></div>
        </div>
        <div className="field"><label>Défense adverse</label><input value={form.defense_adverse} onChange={e=>setForm(f=>({...f,defense_adverse:e.target.value}))} placeholder="Zone 2-3, H/H, Press..."/></div>
        <div className="field"><label>Joueuses clés adverses</label><input value={form.joueuses_cles} onChange={e=>setForm(f=>({...f,joueuses_cles:e.target.value}))} placeholder="#7 très forte au tir, #12 dominant en rebond..."/></div>
        <div className="field"><label>Résumé du match</label><textarea value={form.resume} onChange={e=>setForm(f=>({...f,resume:e.target.value}))} rows={4} placeholder="Ce qui a marché, ce qui n'a pas marché, dynamique d'équipe..."/></div>
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
          <button className="btn btn-accent" onClick={save}>Enregistrer</button>
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── GAME PLAN ─── */
function GamePlanPage({ club }) {
  const [adversaire, setAdversaire] = useState("");
  const [infos, setInfos] = useState("");
  const [mode, setMode] = useState("court");
  const [output, setOutput] = useState(""); const [loading, setLoading] = useState(false);

  const buildCtx = () => {
    const p = club.players.map(pl=>`${pl.prenom} ${pl.nom} (#${pl.numero}, ${pl.poste}) Tir:${pl.Tir} Déf:${pl.Défense} Phys:${pl.Physique} Mental:${pl.Mental}. ${pl.notes||""}`).join("\n");
    const m = club.matches.slice(0,6).map(ma=>{
      const r = parseInt(ma.scoreNous)>parseInt(ma.scoreEux)?"V":"D";
      return `${ma.date} vs ${ma.adversaire} ${r} ${ma.scoreNous}-${ma.scoreEux} | Déf: ${ma.defense_adverse||"?"} | ${ma.resume||"–"}`;
    }).join("\n");
    return {p, m};
  };

  const generate = async () => {
    if (!adversaire) return;
    setLoading(true); setOutput("");
    const {p,m} = buildCtx();
    const fmt = mode==="court" ? "Format COURT : 1 page max, bullet points opérationnels, direct." : "Format DÉTAILLÉ : analyse tactique complète, justifie chaque choix, couvre attaque, défense, situations spéciales, management.";
    try {
      const prompt = `Tu es un assistant coach basket expert. Adapte tes conseils au contexte de l'équipe.

CONTEXTE ÉQUIPE: ${club.contexte||"Non renseigné"}

EFFECTIF:\n${p||"Non renseigné"}

HISTORIQUE (6 derniers matchs):\n${m||"Aucun"}

PROCHAIN ADVERSAIRE: ${adversaire}
CE QUE JE SAIS D'EUX: ${infos||"Rien de particulier"}

Génère un plan de match. ${fmt}
Couvre: analyse adversaire, défense recommandée, système offensif, matchups clés, joueuses à mettre en avant, préparation entraînement avant le match, message à l'équipe.`;
      const reply = await askClaude(null, [{role:"user", content: prompt}]);
      setOutput(reply);
    } catch(e) { setOutput(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  return <div>
    <h2 className="page-title">Plan de <span>match</span></h2>
    <div className="grid2">
      <div className="card">
        <div className="card-title">⚙️ Paramètres</div>
        <div className="field"><label>Adversaire *</label><input value={adversaire} onChange={e=>setAdversaire(e.target.value)} placeholder="Nom de l'équipe adverse"/></div>
        <div className="field"><label>Ce que tu sais d'eux</label><textarea value={infos} onChange={e=>setInfos(e.target.value)} placeholder="Défense habituelle, joueuses dangereuses, résultats récents..." rows={4}/></div>
        <div className="field">
          <label>Format</label>
          <div className="flex gap2">
            {["court","long"].map(v=>(
              <button key={v} className={`btn ${mode===v?"btn-accent":"btn-ghost"}`} onClick={()=>setMode(v)}>
                {v==="court"?"Court (1 page)":"Détaillé"}
              </button>
            ))}
          </div>
        </div>
        <p className="muted mt2">{club.players.length} joueuses · {club.matches.length} matchs dans la mémoire</p>
        <button className="btn btn-accent w100 mt3" style={{width:"100%",marginTop:14}} onClick={generate} disabled={loading||!adversaire}>
          {loading?"⏳ Génération...":"🎯 Générer le plan de match"}
        </button>
      </div>
      <div className="card">
        <div className="card-title">📋 Plan généré</div>
        {loading ? <div className="ai-loading"><div className="spinner"/><span>Analyse en cours...</span></div>
          : output ? <div className="ai-output">{output}</div>
          : <div className="ai-loading"><span>Le plan apparaîtra ici après génération.</span></div>}
      </div>
    </div>
  </div>;
}

/* ─── SPARRING PARTNER ─── */
function SparringPage({ club, persist, coachName }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const history = club.chatHistory || [];

  const STARTERS = [
    "Challenge ma compo de départ pour le prochain match",
    "Est-ce que je sur-utilise certaines joueuses ?",
    "Qu'est-ce que mes stats de matchs révèlent que je ne vois pas ?",
    "Comment gérer une joueuse qui perd confiance ?",
    "Ma défense est-elle vraiment adaptée à mon effectif ?",
    "Qu'est-ce que je devrais travailler en priorité à l'entraînement ?"
  ];

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [history, loading]);

  const buildCtx = () => {
    const p = club.players.map(pl=>`${pl.prenom} ${pl.nom} (#${pl.numero}, ${pl.poste}) Tir:${pl.Tir||3} Déf:${pl.Défense||3} Phys:${pl.Physique||3} Mental:${pl.Mental||3}. Notes: ${pl.notes||"–"}`).join("\n");
    const m = club.matches.slice(0,8).map(ma=>{
      const r = parseInt(ma.scoreNous)>parseInt(ma.scoreEux)?"Victoire":"Défaite";
      return `${ma.date||"–"} vs ${ma.adversaire}: ${r} ${ma.scoreNous}-${ma.scoreEux} | Déf adverse: ${ma.defense_adverse||"?"} | ${ma.resume||"–"}`;
    }).join("\n");
    return {p,m};
  };

  const send = async (msg) => {
    if (!msg.trim() || loading) return;
    setInput("");
    const userMsg = { role:"user", content: msg.trim(), coach: coachName, ts: Date.now() };
    const newHistory = [...history, userMsg];
    persist({...club, chatHistory: newHistory});
    setLoading(true);

    const {p,m} = buildCtx();
    const sysPrompt = `Tu es un sparring partner exigeant pour un coach basket féminin. Ton rôle est de challenger ses décisions, pas de les valider. Tu joues l'avocat du diable avec bienveillance.

RÈGLES :
- Ne valide jamais sans questionner d'abord
- Identifie les angles morts et les biais cognitifs du coach
- Pose des questions qui font réfléchir autrement
- Base-toi sur les données réelles de l'équipe quand elles sont disponibles
- Sois direct, parfois inconfortable, toujours constructif
- Si une décision semble bonne, cherche quand même ce qui pourrait la mettre en défaut
- Adapte ton niveau d'exigence et tes références tactiques au contexte de l'équipe
- Ton ton : intellectuellement stimulant, pas condescendant

MÉMOIRE DU CLUB :
Coach: ${coachName} | Club: ${club.name}
CONTEXTE ÉQUIPE: ${club.contexte||"Non renseigné"}

EFFECTIF:
${p||"Non renseigné"}

HISTORIQUE MATCHS:
${m||"Aucun match enregistré"}`;

    const messages = history.map(h=>({ role: h.role, content: h.content }));
    messages.push({ role:"user", content: msg.trim() });

    try {
      const reply = await askClaude(sysPrompt, messages);
      const botMsg = { role:"assistant", content: reply, ts: Date.now() };
      persist({...club, chatHistory: [...newHistory, botMsg]});
    } catch(e) {
      persist({...club, chatHistory: [...newHistory, {role:"assistant", content:`Erreur: ${e.message}`, ts:Date.now()}]});
    }
    setLoading(false);
  };

  const clearHistory = () => persist({...club, chatHistory:[]});

  return <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px - 56px)",gap:0}}>
    <h2 className="page-title" style={{marginBottom:16}}>Sparring <span>Partner</span></h2>
    <div className="sparring-wrap" style={{flex:1}}>
      <div className="sparring-header">
        <div className="sparring-avatar">🧠</div>
        <div>
          <div className="sparring-name">Cortex</div>
          <div className="sparring-desc">Je challenge, je questionne, je dérange — pour que tu coaches mieux.</div>
        </div>
        <div className="sparring-status"><span className="dot"/><span>Actif</span></div>
        {history.length>0 && <button className="btn btn-ghost" style={{marginLeft:8,fontSize:10,padding:"4px 10px"}} onClick={clearHistory}>Effacer</button>}
      </div>

      <div className="chat-messages">
        {history.length===0 && (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <p style={{fontFamily:"'Lora',serif",fontStyle:"italic",color:"var(--muted)",fontSize:14,marginBottom:6}}>
              "Le meilleur coach n'est pas celui qui a toutes les réponses,<br/>mais celui qui pose les bonnes questions."
            </p>
            <p style={{fontSize:12,color:"var(--border)"}}>— Cortex</p>
          </div>
        )}
        {history.map((h,i)=>(
          <div key={i} className={`msg ${h.role==="user"?"user":"bot"}`}>
            <div className="msg-avatar">{h.role==="user"?"👤":"🧠"}</div>
            <div className="msg-bubble">{h.content}</div>
          </div>
        ))}
        {loading && (
          <div className="msg bot">
            <div className="msg-avatar">🧠</div>
            <div className="typing-indicator">
              <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {history.length===0 && (
        <div className="sparring-starters">
          {STARTERS.map((s,i)=>(
            <span key={i} className="starter-chip" onClick={()=>send(s)}>{s}</span>
          ))}
        </div>
      )}

      <div className="chat-input-wrap">
        <textarea
          className="chat-input"
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}}
          placeholder="Pose une question ou soumets une décision à challenger... (Entrée pour envoyer)"
          rows={2}
        />
        <button className="btn btn-sparring" onClick={()=>send(input)} disabled={loading||!input.trim()}>
          {loading?"...":"→"}
        </button>
      </div>
    </div>
  </div>;
}

/* ─── TRAINING ─── */
function TrainingPage({ club }) {
  const [focus, setFocus] = useState(""); const [duree, setDuree] = useState("90");
  const [output, setOutput] = useState(""); const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true); setOutput("");
    const p = club.players.map(pl=>`${pl.prenom} (${pl.poste}) Tir:${pl.Tir||3} Déf:${pl.Défense||3}. ${pl.notes||""}`).join("\n");
    try {
      const prompt = `Tu es assistant coach basket. Génère un plan d'entraînement adapté au contexte de l'équipe.

CONTEXTE ÉQUIPE: ${club.contexte||"Non renseigné"}
EFFECTIF:\n${p||"Non renseigné"}
FOCUS: ${focus||"Travail général équilibré"}
DURÉE: ${duree} minutes

Format: Échauffement → Exercices techniques (avec durée et consignes précises) → Situation de jeu → Retour au calme. Très opérationnel.`;
      const reply = await askClaude(null, [{role:"user", content: prompt}]);
      setOutput(reply);
    } catch(e) { setOutput(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  return <div>
    <h2 className="page-title">Plan <span>d'entraînement</span></h2>
    <div className="grid2">
      <div className="card">
        <div className="card-title">⚙️ Paramètres</div>
        <div className="field"><label>Focus de séance</label><input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="Ex: Défense de zone, Tirs en contre-attaque, PNR..."/></div>
        <div className="field"><label>Durée</label>
          <select value={duree} onChange={e=>setDuree(e.target.value)}>
            {["60","75","90","105","120"].map(d=><option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
        <button className="btn btn-accent w100 mt3" style={{width:"100%",marginTop:14}} onClick={generate} disabled={loading}>
          {loading?"⏳...":"⚡ Générer l'entraînement"}
        </button>
      </div>
      <div className="card">
        <div className="card-title">📋 Plan généré</div>
        {loading ? <div className="ai-loading"><div className="spinner"/><span>Génération...</span></div>
          : output ? <div className="ai-output">{output}</div>
          : <div className="ai-loading"><span>Le plan apparaîtra ici.</span></div>}
      </div>
    </div>
  </div>;
}

/* ─── ROOT ─── */
export default function App() {
  const [store, setStore] = useState(null);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState("sparring");

  useEffect(() => {
    loadStore().then(s => {
      const loaded = s || initStore();
      setStore(loaded);
      setSession(loaded.session || null);
      setReady(true);
    });
  }, []);

  const club = session && store ? store.clubs[session.clubId] : null;

  const persist = async (updatedClub) => {
    const newStore = {...store, clubs:{...store.clubs, [session.clubId]: updatedClub}};
    setStore(newStore);
    await saveStore(newStore);
  };

  const logout = async () => {
    const s = {...store, session:null};
    setStore(s);
    await saveStore(s);
    setSession(null);
  };

  const onAuth = async ({clubId, coachName, store: s}) => {
    setStore(s);
    await saveStore(s);
    setSession({clubId, coachName});
  };

  const NAV = [
    { group:"IA", items:[
      {id:"sparring", icon:"🧠", label:"Sparring Partner"},
      {id:"gameplan", icon:"🎯", label:"Plan de match"},
      {id:"training", icon:"⚡", label:"Entraînement"},
    ]},
    { group:"Club", items:[
      {id:"players", icon:"👥", label:"Effectif"},
      {id:"matches", icon:"📋", label:"Matchs"},
    ]},
  ];

  const FLAT_NAV = NAV.flatMap(g=>g.items);

  if (!ready) return (
    <>
      <style>{CSS}</style>
      <div className="court-bg"/>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
        <div className="spinner" style={{width:24,height:24}}/>
        <p style={{color:"var(--muted)",fontFamily:"Oswald",letterSpacing:2,textTransform:"uppercase",fontSize:12}}>Chargement...</p>
      </div>
    </>
  );

  if (!session || !club) return (
    <>
      <style>{CSS}</style>
      <div className="court-bg"/>
      <AuthPage onAuth={onAuth}/>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="court-bg"/>
      <div className="app">
        <header className="header">
          <div className="logo">Coach<em>Club</em> 🏀</div>
          <div className="header-right">
            <span className="club-badge">{club.name}</span>
            <span className="coach-name">👤 {session.coachName}</span>
            <button className="btn btn-ghost" style={{fontSize:11,padding:"5px 12px"}} onClick={logout}>⏏</button>
          </div>
        </header>

        <div className="main">
          <aside className="sidebar">
            {NAV.map(g=>(
              <div key={g.group} className="nav-group">
                <div className="nav-label">{g.group}</div>
                {g.items.map(item=>(
                  <div key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={()=>setPage(item.id)}>
                    <span className="ni">{item.icon}</span>{item.label}
                  </div>
                ))}
              </div>
            ))}
            <div className="nav-group" style={{marginTop:"auto",padding:"0 12px"}}>
              <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.5,padding:"8px 6px",borderTop:"1px solid var(--border)"}}>
                <div>{club.players.length} joueuses</div>
                <div>{club.matches.length} matchs</div>
                <div>{club.coaches.length} coach{club.coaches.length>1?"s":""}</div>
              </div>
            </div>
          </aside>

          <main className="content">
            {page==="sparring" && <SparringPage club={club} persist={persist} coachName={session.coachName}/>}
            {page==="gameplan" && <GamePlanPage club={club}/>}
            {page==="training" && <TrainingPage club={club}/>}
            {page==="players" && <PlayersPage club={club} persist={persist}/>}
            {page==="matches" && <MatchesPage club={club} persist={persist}/>}
          </main>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {FLAT_NAV.map(item=>(
              <button key={item.id} className={`bnav-item ${page===item.id?"active":""}`} onClick={()=>setPage(item.id)}>
                <span className="bnav-icon">{item.icon}</span>
                <span className="bnav-label">{item.label === "Sparring Partner" ? "Cortex" : item.label === "Plan de match" ? "Match" : item.label === "Entraînement" ? "Training" : item.label}</span>
              </button>
            ))}
            <button className="bnav-item" onClick={logout}>
              <span className="bnav-icon">⏏</span>
              <span className="bnav-label">Quitter</span>
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
