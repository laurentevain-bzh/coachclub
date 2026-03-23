import { useState, useRef, useEffect } from "react";

/* ─── AI ─── */
const askClaude = async (system, messages) => {
  const body = { model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages };
  if (system) body.system = system;
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.map(c => c.text || "").join("") || "Réponse vide.";
};

/* ─── SUPABASE ─── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sb = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": options.prefer || "return=representation" },
    method: options.method || "GET",
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) throw new Error(`DB ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const db = {
  getClub: id => sb(`clubs?id=eq.${id}`).then(r => r?.[0] || null),
  createClub: c => sb(`clubs`, { method: "POST", body: c }),
  updateClub: (id, d) => sb(`clubs?id=eq.${id}`, { method: "PATCH", body: d }),
  getPlayers: cid => sb(`players?club_id=eq.${cid}&order=created_at.asc`),
  createPlayer: p => sb(`players`, { method: "POST", body: p }),
  updatePlayer: (id, d) => sb(`players?id=eq.${id}`, { method: "PATCH", body: d }),
  deletePlayer: id => sb(`players?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  getMatches: cid => sb(`matches?club_id=eq.${cid}&order=created_at.desc`),
  createMatch: m => sb(`matches`, { method: "POST", body: m }),
  getChat: cid => sb(`chat_history?club_id=eq.${cid}&order=created_at.asc`),
  addChat: m => sb(`chat_history`, { method: "POST", body: m, prefer: "return=minimal" }),
  clearChat: cid => sb(`chat_history?club_id=eq.${cid}`, { method: "DELETE", prefer: "return=minimal" }),
};

const getSession = () => { try { const s = localStorage.getItem("cc_sess"); return s ? JSON.parse(s) : null; } catch { return null; } };
const saveSession = s => { try { localStorage.setItem("cc_sess", s ? JSON.stringify(s) : ""); } catch {} };
const uid = () => Math.random().toString(36).slice(2, 9);

/* ─── STYLES ─── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#111214;--surface:#1a1c20;--surface2:#21242a;--border:#2e3038;--accent:#e8f040;--accent-dim:#e8f04022;--accent-glow:#e8f04011;--white:#eef0f5;--muted:#686b7a;--red:#ff4d4d;--green:#4dff9a;--court:#c8a96e;--sparring:#a78bfa;--sparring-dim:#a78bfa18;}
body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;min-height:100vh;overflow-x:hidden;}
.court-bg{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.03;background-image:repeating-linear-gradient(0deg,transparent,transparent 59px,var(--court) 59px,var(--court) 60px),repeating-linear-gradient(90deg,transparent,transparent 59px,var(--court) 59px,var(--court) 60px);}
.app{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;}
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.auth-box{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--border);border-radius:2px;overflow:hidden;}
.auth-top{background:var(--accent);padding:28px 32px 24px;}
.auth-logo{font-family:'Oswald',sans-serif;font-weight:700;font-size:28px;letter-spacing:3px;text-transform:uppercase;color:#111;line-height:1;}
.auth-sub{font-size:12px;color:#333;margin-top:4px;letter-spacing:1px;text-transform:uppercase;}
.auth-body{padding:28px 32px;}
.auth-tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:24px;}
.auth-tab{font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;padding:10px 16px;cursor:pointer;color:var(--muted);border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;transition:all .15s;}
.auth-tab.active{color:var(--accent);border-bottom-color:var(--accent);}
.header{background:var(--surface);border-bottom:1px solid var(--border);padding:0 16px;display:flex;align-items:center;justify-content:space-between;height:52px;position:sticky;top:0;z-index:100;}
.logo{font-family:'Oswald',sans-serif;font-weight:700;font-size:20px;letter-spacing:2px;text-transform:uppercase;}
.logo em{color:var(--accent);font-style:normal;}
.header-right{display:flex;align-items:center;gap:10px;}
.club-badge{font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;background:var(--accent-dim);color:var(--accent);padding:3px 8px;border-radius:2px;border:1px solid var(--accent);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.main{display:flex;flex:1;}
.sidebar{width:220px;background:var(--surface);border-right:1px solid var(--border);padding:20px 0;flex-shrink:0;position:sticky;top:52px;height:calc(100vh - 52px);overflow-y:auto;}
.nav-group{margin-bottom:28px;}
.nav-label{font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);padding:0 18px;margin-bottom:6px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 18px;cursor:pointer;transition:all .12s;color:var(--muted);font-size:14px;border-left:2px solid transparent;}
.nav-item:hover{color:var(--white);background:var(--surface2);}
.nav-item.active{color:var(--accent);border-left-color:var(--accent);background:var(--accent-glow);font-weight:500;}
.ni{width:18px;text-align:center;font-size:15px;}
.content{flex:1;padding:24px;overflow-y:auto;max-width:1100px;}
.page-title{font-family:'Oswald',sans-serif;font-weight:700;font-size:26px;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px;}
.page-title span{color:var(--accent);}
.card{background:var(--surface);border:1px solid var(--border);border-radius:2px;padding:20px;margin-bottom:16px;}
.card-title{font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);margin-bottom:16px;display:flex;align-items:center;gap:8px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.field{margin-bottom:14px;}
.field label{display:block;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.field input,.field textarea,.field select{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--white);font-family:'DM Sans',sans-serif;font-size:14px;padding:9px 12px;outline:none;transition:border-color .15s;}
.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--accent);}
.field textarea{resize:vertical;min-height:80px;}
.field select option{background:var(--surface2);}
.btn{font-family:'Oswald',sans-serif;font-weight:600;font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:9px 20px;border-radius:2px;cursor:pointer;border:none;transition:all .15s;display:inline-flex;align-items:center;gap:6px;}
.btn-accent{background:var(--accent);color:#111;}
.btn-accent:hover{filter:brightness(1.08);}
.btn-accent:disabled{opacity:.35;cursor:not-allowed;}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);}
.btn-ghost:hover{color:var(--white);border-color:var(--muted);}
.btn-danger{background:transparent;color:var(--red);border:1px solid #ff4d4d33;font-size:11px;padding:5px 12px;}
.btn-danger:hover{background:#ff4d4d18;}
.btn-sparring{background:var(--sparring-dim);color:var(--sparring);border:1px solid var(--sparring);}
.player-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;}
.pcard{background:var(--surface2);border:1px solid var(--border);border-radius:2px;padding:14px;transition:border-color .15s;cursor:pointer;}
.pcard:hover{border-color:var(--accent);}
.pnum{font-family:'Oswald',sans-serif;font-weight:700;font-size:36px;color:var(--court);line-height:1;margin-bottom:2px;}
.pname{font-weight:500;font-size:14px;}
.ppos{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;}
.skill-row{display:flex;align-items:center;gap:6px;margin-bottom:4px;}
.skill-lbl{font-size:10px;color:var(--muted);width:52px;flex-shrink:0;}
.skill-track{flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden;}
.skill-fill{height:100%;background:var(--accent);}
.skill-val{font-size:10px;color:var(--white);width:12px;}
.mitem{display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;margin-bottom:8px;transition:border-color .15s;}
.mitem:hover{border-color:var(--accent);}
.mdate{font-family:'Oswald',sans-serif;font-size:11px;color:var(--muted);width:72px;flex-shrink:0;}
.mvs{flex:1;font-size:14px;font-weight:500;}
.mscore{font-family:'Oswald',sans-serif;font-weight:700;font-size:20px;}
.mscore.w{color:var(--green);}
.mscore.l{color:var(--red);}
.stat-strip{display:flex;gap:12px;margin-bottom:20px;}
.sbox{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:2px;padding:14px;text-align:center;}
.sval{font-family:'Oswald',sans-serif;font-weight:700;font-size:30px;color:var(--accent);line-height:1;}
.slbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;}
.stars{display:flex;gap:3px;}
.star{font-size:17px;cursor:pointer;color:var(--border);transition:color .1s;}
.star.on{color:var(--accent);}
.badge{font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;padding:2px 7px;border-radius:2px;font-weight:600;}
.b-yellow{background:var(--accent-dim);color:var(--accent);}
.b-green{background:#4dff9a18;color:var(--green);}
.b-red{background:#ff4d4d18;color:var(--red);}
.dropzone{border:2px dashed var(--border);border-radius:2px;padding:28px;text-align:center;cursor:pointer;transition:all .15s;margin-bottom:16px;}
.dropzone:hover,.dropzone.drag{border-color:var(--accent);background:var(--accent-glow);}
.dropzone-icon{font-size:28px;margin-bottom:6px;}
.dropzone-txt{font-size:13px;color:var(--muted);}
.dropzone-txt strong{color:var(--white);}
.overlay{position:fixed;inset:0;background:#000000d0;display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:2px;padding:24px;width:100%;max-width:560px;max-height:85vh;overflow-y:auto;}
.modal-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
.modal-ttl{font-family:'Oswald',sans-serif;font-weight:600;font-size:16px;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);}
.close{background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;}
.close:hover{color:var(--white);}
.sparring-wrap{display:flex;flex-direction:column;flex:1;background:var(--bg);border:1px solid var(--sparring);border-radius:2px;overflow:hidden;}
.sparring-header{background:var(--sparring-dim);border-bottom:1px solid var(--sparring);padding:14px 20px;display:flex;align-items:center;gap:12px;}
.sparring-avatar{width:36px;height:36px;border-radius:50%;background:var(--sparring);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.sparring-name{font-family:'Oswald',sans-serif;font-weight:600;font-size:15px;letter-spacing:1.5px;text-transform:uppercase;color:var(--sparring);}
.sparring-desc{font-size:11px;color:var(--muted);font-family:'Lora',serif;font-style:italic;}
.sparring-status{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--sparring);}
.dot{width:6px;height:6px;border-radius:50%;background:var(--sparring);animation:blink 2s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;}
.msg{display:flex;gap:10px;max-width:85%;}
.msg.user{align-self:flex-end;flex-direction:row-reverse;}
.msg-bubble{padding:12px 16px;border-radius:2px;font-size:14px;line-height:1.6;}
.msg.bot .msg-bubble{background:var(--sparring-dim);border:1px solid var(--sparring);font-family:'Lora',serif;color:var(--white);}
.msg.user .msg-bubble{background:var(--surface2);border:1px solid var(--border);color:var(--white);}
.msg-avatar{width:28px;height:28px;border-radius:50%;flex-shrink:0;margin-top:4px;display:flex;align-items:center;justify-content:center;font-size:13px;}
.msg.bot .msg-avatar{background:var(--sparring-dim);border:1px solid var(--sparring);color:var(--sparring);}
.msg.user .msg-avatar{background:var(--surface2);border:1px solid var(--border);}
.typing-indicator{display:flex;gap:4px;align-items:center;padding:14px 16px;background:var(--sparring-dim);border:1px solid var(--sparring);border-radius:2px;}
.typing-dot{width:6px;height:6px;border-radius:50%;background:var(--sparring);animation:bounce 1.2s ease-in-out infinite;}
.typing-dot:nth-child(2){animation-delay:.2s;}
.typing-dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
.chat-input-wrap{padding:14px 16px;border-top:1px solid var(--border);background:var(--surface);display:flex;gap:10px;align-items:flex-end;}
.chat-input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--white);font-family:'DM Sans',sans-serif;font-size:14px;padding:10px 14px;outline:none;resize:none;max-height:100px;transition:border-color .15s;line-height:1.5;}
.chat-input:focus{border-color:var(--sparring);}
.sparring-starters{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 16px;}
.starter-chip{font-size:12px;font-family:'Lora',serif;font-style:italic;background:var(--sparring-dim);border:1px solid var(--sparring);color:var(--sparring);padding:6px 12px;border-radius:2px;cursor:pointer;transition:all .15s;}
.starter-chip:hover{background:#a78bfa33;}
.ai-output{background:var(--bg);border:1px solid var(--accent);border-radius:2px;padding:18px;font-size:14px;line-height:1.75;white-space:pre-wrap;color:var(--white);min-height:100px;}
.ai-loading{display:flex;align-items:center;gap:10px;color:var(--muted);font-family:'Lora',serif;font-style:italic;font-size:14px;min-height:80px;}
.spinner{width:16px;height:16px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin .8s linear infinite;flex-shrink:0;}
@keyframes spin{to{transform:rotate(360deg)}}
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;background:var(--surface);border-top:1px solid var(--border);height:60px;padding-bottom:env(safe-area-inset-bottom);}
.bottom-nav-inner{display:flex;height:60px;}
.bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:var(--muted);transition:color .15s;border:none;background:none;padding:0;-webkit-tap-highlight-color:transparent;}
.bnav-item.active{color:var(--accent);}
.bnav-icon{font-size:20px;line-height:1;}
.bnav-label{font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:1px;text-transform:uppercase;}
.flex{display:flex;}.gap2{gap:8px;}.items-c{align-items:center;}.jc-sb{justify-content:space-between;}.jc-end{justify-content:flex-end;}.mt2{margin-top:8px;}.mt3{margin-top:14px;}.mb2{margin-bottom:8px;}.muted{color:var(--muted);font-size:13px;}.divider{border:none;border-top:1px solid var(--border);margin:16px 0;}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:var(--bg);}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
@media(max-width:640px){
  .sidebar{display:none;}
  .bottom-nav{display:block;}
  .content{padding:16px 14px 76px;}
  .header{height:48px;padding:0 14px;}
  .grid2{grid-template-columns:1fr!important;}
  .page-title{font-size:20px;margin-bottom:16px;}
  .card{padding:14px;}
  .stat-strip{gap:8px;}
  .player-grid{grid-template-columns:1fr 1fr;}
  .modal{padding:18px;}
  .field input,.field textarea,.field select{font-size:16px;}
  .sparring-wrap{height:calc(100vh - 48px - 60px);}
}
`;

/* ─── HELPERS ─── */
function Stars({ v, onChange }) {
  return <div className="stars">{[1,2,3,4,5].map(i=>(
    <span key={i} className={`star ${i<=v?"on":""}`} onClick={()=>onChange&&onChange(i)}>★</span>
  ))}</div>;
}

function SkillBar({ label, value }) {
  return <div className="skill-row">
    <span className="skill-lbl">{label}</span>
    <div className="skill-track"><div className="skill-fill" style={{width:`${value*20}%`}}/></div>
    <span className="skill-val">{value}</span>
  </div>;
}

const POSITIONS = ["Meneuse","Arrière","Ailière","Ailière-forte","Pivot"];
const SKILLS    = ["Tir","Dribble","Passe","Défense","Physique","Mental"];
const SKILL_DB  = ["tir","dribble","passe","defense","physique","mental"];

/* ─── AUTH ─── */
function AuthPage({ onAuth }) {
  const [tab, setTab] = useState("join");
  const [clubName, setClubName] = useState("");
  const [password, setPassword] = useState("");
  const [coachName, setCoachName] = useState("");
  const [contexte, setContexte] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setErr(""); setLoading(true);
    if (!clubName.trim() || !password.trim() || !coachName.trim()) { setErr("Tous les champs sont requis."); setLoading(false); return; }
    const id = clubName.trim().toLowerCase().replace(/\s+/g,"_");
    try {
      if (tab === "create") {
        const existing = await db.getClub(id);
        if (existing) { setErr("Un club avec ce nom existe déjà."); setLoading(false); return; }
        await db.createClub({ id, name: clubName.trim(), password, coaches: [coachName.trim()], contexte: contexte.trim() });
      } else {
        const club = await db.getClub(id);
        if (!club) { setErr("Club introuvable. Vérifie le nom."); setLoading(false); return; }
        if (club.password !== password) { setErr("Mot de passe incorrect."); setLoading(false); return; }
        if (!club.coaches.includes(coachName.trim())) {
          await db.updateClub(id, { coaches: [...club.coaches, coachName.trim()] });
        }
      }
      const sess = { clubId: id, coachName: coachName.trim() };
      saveSession(sess);
      onAuth(sess);
    } catch(e) { setErr(`Erreur: ${e.message}`); }
    setLoading(false);
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
            <button className={`auth-tab ${tab==="join"?"active":""}`} onClick={()=>setTab("join")}>Rejoindre</button>
            <button className={`auth-tab ${tab==="create"?"active":""}`} onClick={()=>setTab("create")}>Créer un club</button>
          </div>
          <div className="field"><label>Nom du club</label><input value={clubName} onChange={e=>setClubName(e.target.value)} placeholder="Ex: BC Villeneuve d'Ascq"/></div>
          <div className="field"><label>Mot de passe du club</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Partagé entre coachs"/></div>
          <div className="field"><label>Ton prénom</label><input value={coachName} onChange={e=>setCoachName(e.target.value)} placeholder="Ex: Laurent"/></div>
          {tab==="create" && <div className="field">
            <label>Contexte équipe</label>
            <textarea value={contexte} onChange={e=>setContexte(e.target.value)} rows={3} placeholder="Ex: U15 filles, D6 Nord, 12 joueuses..."/>
            <p style={{fontSize:11,color:"var(--muted)",marginTop:4}}>Cortex s'en souviendra toute la saison.</p>
          </div>}
          {err && <p style={{color:"var(--red)",fontSize:13,marginBottom:12}}>{err}</p>}
          <button className="btn btn-accent" style={{width:"100%"}} onClick={handle} disabled={loading}>
            {loading?"...":tab==="create"?"Créer le club":"Rejoindre"}
          </button>
          <p className="muted mt2" style={{textAlign:"center",marginTop:12}}>
            {tab==="join"?"Demande le nom et mot de passe au coach principal.":"Partage ces identifiants avec tes adjoints."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── PLAYERS ─── */
function PlayersPage({ club, players, reload }) {
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const blank = () => ({ numero:"", prenom:"", nom:"", poste:POSITIONS[0], notes:"", ...Object.fromEntries(SKILLS.map(k=>[k,3])) });
  const openNew = () => { setEditId(null); setForm(blank()); setShowModal(true); };
  const openEdit = p => {
    const f = { ...p };
    SKILLS.forEach((k,i) => { f[k] = p[SKILL_DB[i]] || 3; });
    setEditId(p.id); setForm(f); setShowModal(true);
  };

  const save = async () => {
    if (!form.nom) return;
    setSaving(true);
    try {
      const payload = {
        numero: form.numero||"", prenom: form.prenom||"", nom: form.nom,
        poste: form.poste||POSITIONS[0], notes: form.notes||"",
        tir: form.Tir||form.tir||3, dribble: form.Dribble||form.dribble||3,
        passe: form.Passe||form.passe||3, defense: form["Défense"]||form.defense||3,
        physique: form.Physique||form.physique||3, mental: form.Mental||form.mental||3
      };
      if (editId) await db.updatePlayer(editId, payload);
      else await db.createPlayer({ id: uid(), club_id: club.id, ...payload });
      await reload(); setShowModal(false);
    } catch(e) { alert(`Erreur: ${e.message}`); }
    setSaving(false);
  };

  const del = async id => { await db.deletePlayer(id); await reload(); };

  return <div>
    <div className="flex jc-sb items-c" style={{marginBottom:20}}>
      <h2 className="page-title" style={{margin:0}}>Effectif <span>({players.length})</span></h2>
      <button className="btn btn-accent" onClick={openNew}>+ Joueuse</button>
    </div>
    {players.length===0 && <div className="card" style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:48,marginBottom:12}}>🏀</div>
      <p className="muted">Aucune joueuse. Commence par construire ton effectif.</p>
    </div>}
    <div className="player-grid">
      {players.map(p=>(
        <div key={p.id} className="pcard" onClick={()=>openEdit(p)}>
          <div className="pnum">#{p.numero||"?"}</div>
          <div className="pname">{p.prenom} {p.nom}</div>
          <div className="ppos">{p.poste}</div>
          {SKILL_DB.map((k,i)=><SkillBar key={k} label={SKILLS[i]} value={p[k]||3}/>)}
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
        <div className="field"><label>Notes</label><textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Points forts, axes de progression..."/></div>
        <hr className="divider"/>
        <p className="muted mb2" style={{fontFamily:"Oswald",letterSpacing:1,textTransform:"uppercase",fontSize:10}}>Évaluation (1–5)</p>
        {SKILLS.map(k=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <label style={{width:72,fontSize:10,fontFamily:"Oswald",letterSpacing:1,textTransform:"uppercase",color:"var(--muted)",flexShrink:0}}>{k}</label>
            <Stars v={form[k]||3} onChange={v=>setForm(f=>({...f,[k]:v}))}/>
          </div>
        ))}
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>{saving?"...":"Enregistrer"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── MATCHES ─── */
function MatchesPage({ club, matches, reload }) {
  const [showModal, setShowModal] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const [form, setForm] = useState({ date:"", adversaire:"", scoreNous:"", scoreEux:"", defense_adverse:"", joueuses_cles:"", resume:"" });

  const handlePdf = async file => {
    if (!file || file.type!=="application/pdf") return;
    setParsing(true); setPdfMsg("Analyse en cours...");
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result.split(",")[1];
      try {
        const res = await fetch("/api/claude", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:500, messages:[{ role:"user", content:[
            {type:"document", source:{type:"base64",media_type:"application/pdf",data:b64}},
            {type:"text", text:'Extrais les infos de cette feuille de match basket. Réponds UNIQUEMENT en JSON:\n{"adversaire":"","score_nous":0,"score_eux":0,"joueuses":"stats clés en 1 ligne"}'}
          ]}]})
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

  const save = async () => {
    if (!form.adversaire) return;
    setSaving(true);
    try {
      await db.createMatch({ id:uid(), club_id:club.id, date:form.date, adversaire:form.adversaire, score_nous:form.scoreNous, score_eux:form.scoreEux, defense_adverse:form.defense_adverse, joueuses_cles:form.joueuses_cles, resume:form.resume });
      await reload();
      setShowModal(false);
      setForm({ date:"", adversaire:"", scoreNous:"", scoreEux:"", defense_adverse:"", joueuses_cles:"", resume:"" });
      setPdfMsg("");
    } catch(e) { alert(`Erreur: ${e.message}`); }
    setSaving(false);
  };

  const wins = matches.filter(m=>parseInt(m.score_nous)>parseInt(m.score_eux)).length;

  return <div>
    <div className="flex jc-sb items-c" style={{marginBottom:20}}>
      <h2 className="page-title" style={{margin:0}}>Matchs <span>({matches.length})</span></h2>
      <button className="btn btn-accent" onClick={()=>setShowModal(true)}>+ Match</button>
    </div>
    {matches.length>0 && <div className="stat-strip">
      <div className="sbox"><div className="sval">{matches.length}</div><div className="slbl">Joués</div></div>
      <div className="sbox"><div className="sval" style={{color:"var(--green)"}}>{wins}</div><div className="slbl">Victoires</div></div>
      <div className="sbox"><div className="sval" style={{color:"var(--red)"}}>{matches.length-wins}</div><div className="slbl">Défaites</div></div>
      <div className="sbox"><div className="sval">{matches.length?Math.round(wins/matches.length*100):0}%</div><div className="slbl">% Victoire</div></div>
    </div>}
    {matches.length===0 && <div className="card" style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:48,marginBottom:12}}>📋</div>
      <p className="muted">Aucun match. Charge ta première feuille !</p>
    </div>}
    {matches.map(m=>{
      const w = parseInt(m.score_nous)>parseInt(m.score_eux);
      return <div key={m.id} className="mitem">
        <span className="mdate">{m.date||"–"}</span>
        <div style={{flex:1}}>
          <div className="mvs">vs {m.adversaire}</div>
          {m.defense_adverse && <span className="badge b-yellow" style={{display:"inline-block",marginTop:3}}>{m.defense_adverse}</span>}
          {m.resume && <p style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{m.resume.slice(0,90)}{m.resume.length>90?"…":""}</p>}
        </div>
        <div className={`mscore ${w?"w":"l"}`}>{m.score_nous}–{m.score_eux}</div>
        <span className={`badge ${w?"b-green":"b-red"}`}>{w?"V":"D"}</span>
      </div>;
    })}
    {showModal && <div className="overlay" onClick={()=>setShowModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr"><span className="modal-ttl">Nouveau match</span><button className="close" onClick={()=>setShowModal(false)}>✕</button></div>
        <div className={`dropzone ${parsing?"drag":""}`} onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handlePdf(e.dataTransfer.files[0]);}}>
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
        <div className="field"><label>Joueuses clés adverses</label><input value={form.joueuses_cles} onChange={e=>setForm(f=>({...f,joueuses_cles:e.target.value}))} placeholder="#7 forte au tir..."/></div>
        <div className="field"><label>Résumé</label><textarea value={form.resume} onChange={e=>setForm(f=>({...f,resume:e.target.value}))} rows={4} placeholder="Ce qui a marché, ce qui n'a pas marché..."/></div>
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>{saving?"...":"Enregistrer"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── GAME PLAN ─── */
function GamePlanPage({ club, players, matches }) {
  const [adversaire, setAdversaire] = useState("");
  const [infos, setInfos] = useState("");
  const [mode, setMode] = useState("court");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!adversaire) return;
    setLoading(true); setOutput("");
    const p = players.map(pl=>`${pl.prenom} ${pl.nom} (#${pl.numero}, ${pl.poste}) Tir:${pl.tir} Déf:${pl.defense} Phys:${pl.physique} Mental:${pl.mental}. ${pl.notes||""}`).join("\n");
    const m = matches.slice(0,6).map(ma=>`${ma.date} vs ${ma.adversaire} ${parseInt(ma.score_nous)>parseInt(ma.score_eux)?"V":"D"} ${ma.score_nous}-${ma.score_eux} | Déf: ${ma.defense_adverse||"?"} | ${ma.resume||"–"}`).join("\n");
    const fmt = mode==="court"?"Format COURT : 1 page max, bullet points opérationnels.":"Format DÉTAILLÉ : analyse tactique complète, justifie chaque choix.";
    try {
      const prompt = `Tu es un assistant coach basket expert.\n\nCONTEXTE: ${club.contexte||"Non renseigné"}\nEFFECTIF:\n${p||"Non renseigné"}\nHISTORIQUE:\n${m||"Aucun"}\nADVERSAIRE: ${adversaire}\nINFOS: ${infos||"Rien"}\n\nGénère un plan de match. ${fmt} Couvre: défense recommandée, système offensif, matchups clés, message équipe.`;
      setOutput(await askClaude(null, [{role:"user",content:prompt}]));
    } catch(e) { setOutput(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  return <div>
    <h2 className="page-title">Plan de <span>match</span></h2>
    <div className="grid2">
      <div className="card">
        <div className="card-title">⚙️ Paramètres</div>
        <div className="field"><label>Adversaire *</label><input value={adversaire} onChange={e=>setAdversaire(e.target.value)} placeholder="Nom équipe adverse"/></div>
        <div className="field"><label>Ce que tu sais d'eux</label><textarea value={infos} onChange={e=>setInfos(e.target.value)} rows={3} placeholder="Défense, joueuses dangereuses..."/></div>
        <div className="field"><label>Format</label>
          <div className="flex gap2">{["court","long"].map(v=><button key={v} className={`btn ${mode===v?"btn-accent":"btn-ghost"}`} onClick={()=>setMode(v)}>{v==="court"?"Court":"Détaillé"}</button>)}</div>
        </div>
        <p className="muted mt2">{players.length} joueuses · {matches.length} matchs</p>
        <button className="btn btn-accent" style={{width:"100%",marginTop:14}} onClick={generate} disabled={loading||!adversaire}>{loading?"⏳ Génération...":"🎯 Générer le plan"}</button>
      </div>
      <div className="card">
        <div className="card-title">📋 Plan généré</div>
        {loading?<div className="ai-loading"><div className="spinner"/><span>Analyse...</span></div>
          :output?<div className="ai-output">{output}</div>
          :<div className="ai-loading"><span>Le plan apparaîtra ici.</span></div>}
      </div>
    </div>
  </div>;
}

/* ─── SPARRING ─── */
function SparringPage({ club, players, matches, chatHistory, reloadChat, coachName }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  const STARTERS = [
    "Challenge ma compo de départ pour le prochain match",
    "Est-ce que je sur-utilise certaines joueuses ?",
    "Qu'est-ce que mes stats révèlent que je ne vois pas ?",
    "Comment gérer une joueuse qui perd confiance ?",
    "Ma défense est-elle adaptée à mon effectif ?",
    "Qu'est-ce que je devrais travailler en priorité ?"
  ];

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [chatHistory, loading]);

  const send = async msg => {
    if (!msg.trim() || loading) return;
    setInput(""); setLoading(true);
    try { await db.addChat({ club_id:club.id, role:"user", content:msg.trim(), coach:coachName }); await reloadChat(); } catch {}
    const p = players.map(pl=>`${pl.prenom} ${pl.nom} (#${pl.numero}, ${pl.poste}) Tir:${pl.tir||3} Déf:${pl.defense||3} Phys:${pl.physique||3} Mental:${pl.mental||3}. ${pl.notes||""}`).join("\n");
    const m = matches.slice(0,8).map(ma=>`${ma.date||"–"} vs ${ma.adversaire}: ${parseInt(ma.score_nous)>parseInt(ma.score_eux)?"V":"D"} ${ma.score_nous}-${ma.score_eux} | ${ma.defense_adverse||"?"} | ${ma.resume||"–"}`).join("\n");
    const sys = `Tu es un sparring partner exigeant pour un coach basket. Challenger ses décisions, pas les valider. Avocat du diable bienveillant.\n\nRÈGLES: Ne valide jamais sans questionner. Identifie les angles morts et biais. Adapte-toi au contexte. Direct, inconfortable si nécessaire, toujours constructif.\n\nCLUB: ${coachName} | ${club.name}\nCONTEXTE: ${club.contexte||"Non renseigné"}\nEFFECTIF:\n${p||"Non renseigné"}\nMATCHS:\n${m||"Aucun"}`;
    const msgs = [...chatHistory.map(h=>({role:h.role,content:h.content})), {role:"user",content:msg.trim()}];
    try {
      const reply = await askClaude(sys, msgs);
      await db.addChat({ club_id:club.id, role:"assistant", content:reply });
    } catch(e) {
      await db.addChat({ club_id:club.id, role:"assistant", content:`Erreur: ${e.message}` });
    }
    await reloadChat();
    setLoading(false);
  };

  return <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 52px - 60px)",gap:0}}>
    <h2 className="page-title" style={{marginBottom:16}}>Sparring <span>Partner</span></h2>
    <div className="sparring-wrap">
      <div className="sparring-header">
        <div className="sparring-avatar">🧠</div>
        <div>
          <div className="sparring-name">Cortex</div>
          <div className="sparring-desc">Je challenge, je questionne — pour que tu coaches mieux.</div>
        </div>
        <div className="sparring-status"><span className="dot"/><span>Actif</span></div>
        {chatHistory.length>0 && <button className="btn btn-ghost" style={{marginLeft:8,fontSize:10,padding:"4px 10px"}} onClick={async()=>{await db.clearChat(club.id);await reloadChat();}}>Effacer</button>}
      </div>
      <div className="chat-messages">
        {chatHistory.length===0 && <div style={{textAlign:"center",padding:"20px 0"}}>
          <p style={{fontFamily:"'Lora',serif",fontStyle:"italic",color:"var(--muted)",fontSize:14,marginBottom:6}}>"Le meilleur coach n'est pas celui qui a toutes les réponses,<br/>mais celui qui pose les bonnes questions."</p>
          <p style={{fontSize:12,color:"var(--border)"}}>— Cortex</p>
        </div>}
        {chatHistory.map((h,i)=>(
          <div key={i} className={`msg ${h.role==="user"?"user":"bot"}`}>
            <div className="msg-avatar">{h.role==="user"?"👤":"🧠"}</div>
            <div className="msg-bubble">{h.content}</div>
          </div>
        ))}
        {loading && <div className="msg bot"><div className="msg-avatar">🧠</div><div className="typing-indicator"><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div></div>}
        <div ref={bottomRef}/>
      </div>
      {chatHistory.length===0 && <div className="sparring-starters">{STARTERS.map((s,i)=><span key={i} className="starter-chip" onClick={()=>send(s)}>{s}</span>)}</div>}
      <div className="chat-input-wrap">
        <textarea className="chat-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}} placeholder="Pose une question... (Entrée pour envoyer)" rows={2}/>
        <button className="btn btn-sparring" onClick={()=>send(input)} disabled={loading||!input.trim()}>{loading?"...":"→"}</button>
      </div>
    </div>
  </div>;
}

/* ─── TRAINING ─── */
function TrainingPage({ club, players }) {
  const [focus, setFocus] = useState("");
  const [duree, setDuree] = useState("90");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true); setOutput("");
    const p = players.map(pl=>`${pl.prenom} (${pl.poste}) Tir:${pl.tir||3} Déf:${pl.defense||3}. ${pl.notes||""}`).join("\n");
    try {
      const prompt = `Tu es assistant coach basket. Génère un plan d'entraînement adapté.\n\nCONTEXTE: ${club.contexte||"Non renseigné"}\nEFFECTIF:\n${p||"Non renseigné"}\nFOCUS: ${focus||"Travail général équilibré"}\nDURÉE: ${duree} minutes\n\nFormat: Échauffement → Exercices techniques (durée + consignes précises) → Situation de jeu → Retour au calme. Très opérationnel.`;
      setOutput(await askClaude(null, [{role:"user",content:prompt}]));
    } catch(e) { setOutput(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  return <div>
    <h2 className="page-title">Plan <span>d'entraînement</span></h2>
    <div className="grid2">
      <div className="card">
        <div className="card-title">⚙️ Paramètres</div>
        <div className="field"><label>Focus de séance</label><input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="Ex: Défense zone, tirs en transition..."/></div>
        <div className="field"><label>Durée</label>
          <select value={duree} onChange={e=>setDuree(e.target.value)}>{["60","75","90","105","120"].map(d=><option key={d} value={d}>{d} min</option>)}</select>
        </div>
        <button className="btn btn-accent" style={{width:"100%",marginTop:14}} onClick={generate} disabled={loading}>{loading?"⏳...":"⚡ Générer l'entraînement"}</button>
      </div>
      <div className="card">
        <div className="card-title">📋 Plan généré</div>
        {loading?<div className="ai-loading"><div className="spinner"/><span>Génération...</span></div>
          :output?<div className="ai-output">{output}</div>
          :<div className="ai-loading"><span>Le plan apparaîtra ici.</span></div>}
      </div>
    </div>
  </div>;
}

/* ─── ROOT ─── */
export default function App() {
  const [session, setSessionState] = useState(()=>getSession());
  const [club, setClub] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState("sparring");

  const loadAll = async sess => {
    if (!sess) { setReady(true); return; }
    try {
      const [c, p, m, ch] = await Promise.all([
        db.getClub(sess.clubId), db.getPlayers(sess.clubId),
        db.getMatches(sess.clubId), db.getChat(sess.clubId)
      ]);
      if (!c) { saveSession(null); setSessionState(null); setReady(true); return; }
      setClub(c); setPlayers(p||[]); setMatches(m||[]); setChatHistory(ch||[]);
    } catch(e) { console.error(e); }
    setReady(true);
  };

  useEffect(()=>{ loadAll(session); }, []);

  const reloadPlayers = async () => setPlayers((await db.getPlayers(session.clubId))||[]);
  const reloadMatches = async () => setMatches((await db.getMatches(session.clubId))||[]);
  const reloadChat    = async () => setChatHistory((await db.getChat(session.clubId))||[]);

  const logout = () => {
    saveSession(null); setSessionState(null); setClub(null);
    setPlayers([]); setMatches([]); setChatHistory([]); setReady(true);
  };

  const onAuth = async sess => { setSessionState(sess); await loadAll(sess); };

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
    <><style>{CSS}</style><div className="court-bg"/>
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div className="spinner" style={{width:24,height:24}}/>
      <p style={{color:"var(--muted)",fontFamily:"Oswald",letterSpacing:2,textTransform:"uppercase",fontSize:12}}>Chargement...</p>
    </div></>
  );

  if (!session || !club) return (
    <><style>{CSS}</style><div className="court-bg"/><AuthPage onAuth={onAuth}/></>
  );

  return (
    <><style>{CSS}</style><div className="court-bg"/>
    <div className="app">
      <header className="header">
        <div className="logo">Coach<em>Club</em> 🏀</div>
        <div className="header-right">
          <span className="club-badge">{club.name}</span>
          <span style={{fontSize:12,color:"var(--muted)"}}>👤 {session.coachName}</span>
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
          <div style={{padding:"0 12px"}}>
            <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.6,padding:"10px 6px",borderTop:"1px solid var(--border)"}}>
              <div>{players.length} joueuses</div>
              <div>{matches.length} matchs</div>
              <div>{club.coaches?.length||1} coach{(club.coaches?.length||1)>1?"s":""}</div>
            </div>
          </div>
        </aside>
        <main className="content">
          {page==="sparring" && <SparringPage club={club} players={players} matches={matches} chatHistory={chatHistory} reloadChat={reloadChat} coachName={session.coachName}/>}
          {page==="gameplan" && <GamePlanPage club={club} players={players} matches={matches}/>}
          {page==="training" && <TrainingPage club={club} players={players}/>}
          {page==="players" && <PlayersPage club={club} players={players} reload={reloadPlayers}/>}
          {page==="matches" && <MatchesPage club={club} matches={matches} reload={reloadMatches}/>}
        </main>
      </div>
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {FLAT_NAV.map(item=>(
            <button key={item.id} className={`bnav-item ${page===item.id?"active":""}`} onClick={()=>setPage(item.id)}>
              <span className="bnav-icon">{item.icon}</span>
              <span className="bnav-label">{item.label==="Sparring Partner"?"Cortex":item.label==="Plan de match"?"Match":item.label==="Entraînement"?"Training":item.label}</span>
            </button>
          ))}
          <button className="bnav-item" onClick={logout}>
            <span className="bnav-icon">⏏</span>
            <span className="bnav-label">Quitter</span>
          </button>
        </div>
      </nav>
    </div></>
  );
}
