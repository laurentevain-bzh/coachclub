import { useState, useRef, useEffect } from "react";

/* ─── AI ─── */
const askClaude = async (system, messages, maxTokens = 1500) => {
  const body = { model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages };
  if (system) body.system = system;
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.map(c => c.text || "").join("") || "Réponse vide.";
};

const askClaudeWithPDFs = async (pdfs, prompt) => {
  const content = [
    ...pdfs.map(p => ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: p } })),
    { type: "text", text: prompt }
  ];
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2000, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.map(c => c.text || "").join("") || "";
};

/* ─── SUPABASE ─── */
const sb = async (path, options = {}) => {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: "supabase", path, method: options.method || "GET", body: options.body, prefer: options.prefer || "return=representation" }),
  });
  if (!res.ok) throw new Error(`DB ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return data;
};

const db = {
  getClub: id => sb(`clubs?id=eq.${id}`).then(r => r?.[0] || null),
  createClub: c => sb(`clubs`, { method: "POST", body: c }),
  updateClub: (id, d) => sb(`clubs?id=eq.${id}`, { method: "PATCH", body: d }),
  getSaisons: cid => sb(`saisons?club_id=eq.${cid}&order=created_at.desc`),
  createSaison: s => sb(`saisons`, { method: "POST", body: s }),
  updateSaison: (id, d) => sb(`saisons?id=eq.${id}`, { method: "PATCH", body: d }),
  getJoueuses: cid => sb(`joueuses?club_id=eq.${cid}&order=nom.asc`),
  createJoueuse: j => sb(`joueuses`, { method: "POST", body: j }),
  updateJoueuse: (id, d) => sb(`joueuses?id=eq.${id}`, { method: "PATCH", body: d }),
  deleteJoueuse: id => sb(`joueuses?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  getEvals: sid => sb(`evaluations?saison_id=eq.${sid}`),
  getEvalJoueuse: (jid, sid) => sb(`evaluations?joueuse_id=eq.${jid}&saison_id=eq.${sid}`).then(r => r?.[0] || null),
  createEval: e => sb(`evaluations`, { method: "POST", body: e }),
  updateEval: (id, d) => sb(`evaluations?id=eq.${id}`, { method: "PATCH", body: d }),
  getMatches: sid => sb(`matches?saison_id=eq.${sid}&order=date.desc`),
  getAllMatches: cid => sb(`matches?club_id=eq.${cid}&order=date.desc`),
  createMatch: m => sb(`matches`, { method: "POST", body: m }),
  updateMatch: (id, d) => sb(`matches?id=eq.${id}`, { method: "PATCH", body: d }),
  getCalendrier: sid => sb(`calendrier?saison_id=eq.${sid}&order=date.asc`),
  createEvent: e => sb(`calendrier`, { method: "POST", body: e }),
  deleteEvent: id => sb(`calendrier?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  getChat: sid => sb(`chat_history?saison_id=eq.${sid}&order=created_at.asc`),
  getAllChat: cid => sb(`chat_history?club_id=eq.${cid}&order=created_at.asc`),
  addChat: m => sb(`chat_history`, { method: "POST", body: m, prefer: "return=minimal" }),
  clearChat: sid => sb(`chat_history?saison_id=eq.${sid}`, { method: "DELETE", prefer: "return=minimal" }),
  // PLANS
  getPlansMatch: sid => sb(`plans_match?saison_id=eq.${sid}&order=created_at.desc`),
  createPlanMatch: p => sb(`plans_match`, { method: "POST", body: p }),
  deletePlanMatch: id => sb(`plans_match?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  getPlansEntr: sid => sb(`plans_entrainement?saison_id=eq.${sid}&order=created_at.desc`),
  createPlanEntr: p => sb(`plans_entrainement`, { method: "POST", body: p }),
  deletePlanEntr: id => sb(`plans_entrainement?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  // STATS PAR MATCH
  getStatsMatch: mid => sb(`stats_match_joueuse?match_id=eq.${mid}`),
  getStatsSaison: sid => sb(`stats_match_joueuse?saison_id=eq.${sid}&order=created_at.asc`),
  getStatsJoueuse: (jid, sid) => sb(`stats_match_joueuse?joueuse_id=eq.${jid}&saison_id=eq.${sid}&order=created_at.asc`),
  createStatMatch: s => sb(`stats_match_joueuse`, { method: "POST", body: s, prefer: "return=minimal" }),
  deleteStatsMatch: mid => sb(`stats_match_joueuse?match_id=eq.${mid}`, { method: "DELETE", prefer: "return=minimal" }),
};

/* ─── SUPABASE STORAGE ─── */
const uploadPdfTirs = async (matchId, file) => {
  const b64 = await toBase64(file);
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: "storage_upload", bucket: "positions-tirs", filename: `${matchId}.pdf`, fileBase64: b64, contentType: "application/pdf" }),
  });
  if (!res.ok) throw new Error(`Storage ${res.status}`);
  const data = await res.json();
  return data.url || null;
};

const getSession = () => { try { const s = localStorage.getItem("cc_sess"); return s ? JSON.parse(s) : null; } catch { return null; } };
const saveSession = s => { try { localStorage.setItem("cc_sess", s ? JSON.stringify(s) : ""); } catch {} };
const uid = () => Math.random().toString(36).slice(2, 9);
const hashPassword = async (pwd) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd + "coachclub_salt_2024"));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
};
const toBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });

const POSITIONS = ["Meneuse","Arrière","Ailière","Ailière-forte","Pivot"];
const SKILLS = ["Tir","Dribble","Passe","Défense","Physique","Mental"];
const SKILL_DB = ["tir","dribble","passe","defense","physique","mental"];

/* ─── STYLES ─── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#111214;--surface:#1a1c20;--surface2:#21242a;--border:#2e3038;--accent:#e8f040;--accent-dim:#e8f04022;--accent-glow:#e8f04011;--white:#eef0f5;--muted:#686b7a;--red:#ff4d4d;--green:#4dff9a;--court:#c8a96e;--sparring:#a78bfa;--sparring-dim:#a78bfa18;--blue:#40b4e8;--blue-dim:#40b4e822;}
body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;min-height:100vh;overflow-x:hidden;}
.court-bg{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.03;background-image:repeating-linear-gradient(0deg,transparent,transparent 59px,var(--court) 59px,var(--court) 60px),repeating-linear-gradient(90deg,transparent,transparent 59px,var(--court) 59px,var(--court) 60px);}
.app{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;}
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.auth-box{width:100%;max-width:480px;background:var(--surface);border:1px solid var(--border);border-radius:2px;overflow:hidden;}
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
.club-badge{font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;background:var(--accent-dim);color:var(--accent);padding:3px 8px;border-radius:2px;border:1px solid var(--accent);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.saison-badge{font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;background:var(--blue-dim);color:var(--blue);padding:3px 8px;border-radius:2px;border:1px solid var(--blue);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;}
.main{display:flex;flex:1;}
.sidebar{width:220px;background:var(--surface);border-right:1px solid var(--border);padding:20px 0;flex-shrink:0;position:sticky;top:52px;height:calc(100vh - 52px);overflow-y:auto;}
.nav-group{margin-bottom:24px;}
.nav-label{font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);padding:0 18px;margin-bottom:6px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 18px;cursor:pointer;transition:all .12s;color:var(--muted);font-size:14px;border-left:2px solid transparent;}
.nav-item:hover{color:var(--white);background:var(--surface2);}
.nav-item.active{color:var(--accent);border-left-color:var(--accent);background:var(--accent-glow);font-weight:500;}
.ni{width:18px;text-align:center;font-size:15px;}
.content{flex:1;padding:24px;overflow-y:auto;max-width:1200px;}
.page-title{font-family:'Oswald',sans-serif;font-weight:700;font-size:26px;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px;}
.page-title span{color:var(--accent);}
.card{background:var(--surface);border:1px solid var(--border);border-radius:2px;padding:20px;margin-bottom:16px;}
.card-title{font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);margin-bottom:16px;display:flex;align-items:center;gap:8px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
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
.player-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;}
.pcard{background:var(--surface2);border:1px solid var(--border);border-radius:2px;padding:14px;transition:border-color .15s;cursor:pointer;}
.pcard:hover{border-color:var(--accent);}
.pnum{font-family:'Oswald',sans-serif;font-weight:700;font-size:36px;color:var(--court);line-height:1;margin-bottom:2px;}
.pname{font-weight:600;font-size:15px;}
.ppos{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;}
.skill-row{display:flex;align-items:center;gap:6px;margin-bottom:4px;}
.skill-lbl{font-size:10px;color:var(--muted);width:52px;flex-shrink:0;}
.skill-track{flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden;}
.skill-fill{height:100%;background:var(--accent);}
.skill-val{font-size:10px;color:var(--white);width:12px;}
.mitem{display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;margin-bottom:8px;transition:border-color .15s;cursor:pointer;}
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
.b-blue{background:var(--blue-dim);color:var(--blue);}
.dropzone{border:2px dashed var(--border);border-radius:2px;padding:24px;text-align:center;cursor:pointer;transition:all .15s;margin-bottom:12px;}
.dropzone:hover,.dropzone.drag{border-color:var(--accent);background:var(--accent-glow);}
.dropzone-icon{font-size:24px;margin-bottom:4px;}
.dropzone-txt{font-size:12px;color:var(--muted);}
.dropzone-txt strong{color:var(--white);}
.overlay{position:fixed;inset:0;background:#000000d0;display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:2px;padding:24px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;}
.modal-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
.modal-ttl{font-family:'Oswald',sans-serif;font-weight:600;font-size:16px;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);}
.close{background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;}
.close:hover{color:var(--white);}
.tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:20px;}
.tab{font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 16px;cursor:pointer;color:var(--muted);border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;transition:all .15s;}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);}
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
.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;}
.summary-block{background:var(--surface2);border:1px solid var(--border);border-radius:2px;padding:12px;}
.summary-block-title{font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;}
.summary-block.att .summary-block-title{color:var(--green);}
.summary-block.att{border-color:#4dff9a33;}
.summary-block.def .summary-block-title{color:var(--blue);}
.summary-block.def{border-color:#40b4e833;}
.summary-block.adv-att .summary-block-title{color:var(--red);}
.summary-block.adv-att{border-color:#ff4d4d33;}
.summary-block.adv-def .summary-block-title{color:var(--sparring);}
.summary-block.adv-def{border-color:#a78bfa33;}
.cal-item{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;margin-bottom:8px;}
.cal-item.next{border-color:var(--accent);background:var(--accent-glow);}
.cal-date{font-family:'Oswald',sans-serif;font-size:11px;color:var(--muted);width:80px;flex-shrink:0;line-height:1.5;}
.cal-info{flex:1;}
.cal-title{font-size:14px;font-weight:500;}
.cal-sub{font-size:11px;color:var(--muted);margin-top:2px;}
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;background:var(--surface);border-top:1px solid var(--border);height:60px;padding-bottom:env(safe-area-inset-bottom);}
.bottom-nav-inner{display:flex;height:60px;}
.bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:var(--muted);transition:color .15s;border:none;background:none;padding:0;-webkit-tap-highlight-color:transparent;}
.bnav-item.active{color:var(--accent);}
.bnav-icon{font-size:20px;line-height:1;}
.bnav-label{font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:1px;text-transform:uppercase;}
.flex{display:flex;}.gap2{gap:8px;}.gap3{gap:12px;}.items-c{align-items:center;}.jc-sb{justify-content:space-between;}.jc-end{justify-content:flex-end;}.mt2{margin-top:8px;}.mt3{margin-top:14px;}.mt4{margin-top:20px;}.mb2{margin-bottom:8px;}.mb3{margin-bottom:14px;}.muted{color:var(--muted);font-size:13px;}.divider{border:none;border-top:1px solid var(--border);margin:16px 0;}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:var(--bg);}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
@media(max-width:640px){
  .sidebar{display:none;}
  .bottom-nav{display:block;}
  .content{padding:16px 14px 76px;}
  .header{height:48px;padding:0 14px;}
  .grid2,.summary-grid{grid-template-columns:1fr!important;}
  .grid3{grid-template-columns:1fr 1fr!important;}
  .page-title{font-size:20px;margin-bottom:16px;}
  .card{padding:14px;}
  .stat-strip{gap:8px;}
  .player-grid{grid-template-columns:1fr 1fr;}
  .modal{padding:18px;max-width:100%;}
  .field input,.field textarea,.field select{font-size:16px;}
  .sparring-wrap{height:calc(100vh - 48px - 60px);}
  .saison-badge{display:none;}
}
`;

/* ─── UI HELPERS ─── */
function Stars({ v, onChange }) {
  return <div className="stars">{[1,2,3,4,5].map(i=>(
    <span key={i} className={`star ${i<=v?"on":""}`} onClick={()=>onChange&&onChange(i)}>★</span>
  ))}</div>;
}
function SkillBar({ label, value }) {
  return <div className="skill-row">
    <span className="skill-lbl">{label}</span>
    <div className="skill-track"><div className="skill-fill" style={{width:`${(value||0)*20}%`}}/></div>
    <span className="skill-val">{value||0}</span>
  </div>;
}

/* ─── AUTH ─── */
function ForgotPassword({ onBack }) {
  const [step, setStep] = useState("verify"); // verify | reset | done
  const [clubName, setClubName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    setErr(""); setLoading(true);
    if (!clubName.trim() || !email.trim()) { setErr("Tous les champs sont requis."); setLoading(false); return; }
    const id = clubName.trim().toLowerCase().replace(/\s+/g,"_");
    try {
      const club = await db.getClub(id);
      if (!club) { setErr("Club introuvable."); setLoading(false); return; }
      if (!club.email_recuperation || club.email_recuperation.toLowerCase() !== email.trim().toLowerCase()) {
        setErr("Email incorrect pour ce club."); setLoading(false); return;
      }
      setStep("reset");
    } catch(e) { setErr(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  const reset = async () => {
    setErr(""); setLoading(true);
    if (!newPassword || newPassword.length < 4) { setErr("Mot de passe trop court (4 caractères min)."); setLoading(false); return; }
    if (newPassword !== confirm) { setErr("Les mots de passe ne correspondent pas."); setLoading(false); return; }
    const id = clubName.trim().toLowerCase().replace(/\s+/g,"_");
    try {
      const hashed = await hashPassword(newPassword);
      await db.updateClub(id, { password: hashed });
      setStep("done");
    } catch(e) { setErr(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  return <div className="auth-wrap"><div className="auth-box">
    <div className="auth-top"><div className="auth-logo">Coach<em>Club</em> 🏀</div><div className="auth-sub">Récupération de mot de passe</div></div>
    <div className="auth-body">
      {step==="verify" && <>
        <p className="muted mb3" style={{marginBottom:16}}>Saisis le nom de ton club et l'email de récupération défini à la création.</p>
        <div className="field"><label>Nom du club</label><input value={clubName} onChange={e=>setClubName(e.target.value)} placeholder="Ex: BC Wasquehal"/></div>
        <div className="field"><label>Email de récupération</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ton@email.com"/></div>
        {err && <p style={{color:"var(--red)",fontSize:13,marginBottom:12}}>{err}</p>}
        <button className="btn btn-accent" style={{width:"100%"}} onClick={verify} disabled={loading}>{loading?"...":"Vérifier"}</button>
      </>}
      {step==="reset" && <>
        <p className="muted mb3" style={{marginBottom:16}}>✅ Email vérifié ! Choisis un nouveau mot de passe pour <strong>{clubName}</strong>.</p>
        <div className="field"><label>Nouveau mot de passe</label><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Nouveau mot de passe"/></div>
        <div className="field"><label>Confirmer</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Répète le mot de passe"/></div>
        {err && <p style={{color:"var(--red)",fontSize:13,marginBottom:12}}>{err}</p>}
        <button className="btn btn-accent" style={{width:"100%"}} onClick={reset} disabled={loading}>{loading?"...":"Réinitialiser"}</button>
      </>}
      {step==="done" && <>
        <p style={{color:"var(--green)",fontSize:15,marginBottom:16,textAlign:"center"}}>✅ Mot de passe réinitialisé !</p>
        <p className="muted" style={{textAlign:"center",marginBottom:16}}>Tu peux maintenant te connecter avec ton nouveau mot de passe.</p>
      </>}
      <button className="btn btn-ghost" style={{width:"100%",marginTop:12}} onClick={onBack}>← Retour à la connexion</button>
    </div>
  </div></div>;
}

function AuthPage({ onAuth }) {
  const [tab, setTab] = useState("join");
  const [showForgot, setShowForgot] = useState(false);
  const [clubName, setClubName] = useState(""); const [password, setPassword] = useState(""); const [coachName, setCoachName] = useState("");
  const [email, setEmail] = useState("");
  const [saisonNom, setSaisonNom] = useState("2025-2026"); const [equipe, setEquipe] = useState(""); const [division, setDivision] = useState(""); const [seances, setSeances] = useState("2"); const [contexte, setContexte] = useState("");
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);

  if (showForgot) return <ForgotPassword onBack={()=>setShowForgot(false)}/>;

  const handle = async () => {
    setErr(""); setLoading(true);
    if (!clubName.trim() || !password.trim() || !coachName.trim()) { setErr("Tous les champs sont requis."); setLoading(false); return; }
    const id = clubName.trim().toLowerCase().replace(/\s+/g,"_");
    try {
      const hashed = await hashPassword(password);
      if (tab === "create") {
        if (!equipe.trim()) { setErr("Nom équipe requis."); setLoading(false); return; }
        if (!email.trim()) { setErr("Email de récupération requis."); setLoading(false); return; }
        const existing = await db.getClub(id);
        if (existing) { setErr("Club déjà existant."); setLoading(false); return; }
        await db.createClub({ id, name: clubName.trim(), password: hashed, coaches: [coachName.trim()], contexte: contexte.trim(), email_recuperation: email.trim().toLowerCase() });
        const saisonId = uid();
        await db.createSaison({ id: saisonId, club_id: id, nom: saisonNom, equipe: equipe.trim(), division: division.trim(), seances_par_semaine: parseInt(seances)||2, active: true });
        const sess = { clubId: id, coachName: coachName.trim(), saisonId };
        saveSession(sess); onAuth(sess);
      } else {
        const club = await db.getClub(id);
        if (!club) { setErr("Club introuvable."); setLoading(false); return; }
        if (club.password !== hashed) { setErr("Mot de passe incorrect."); setLoading(false); return; }
        if (!club.coaches.includes(coachName.trim())) await db.updateClub(id, { coaches: [...club.coaches, coachName.trim()] });
        const saisons = await db.getSaisons(id);
        const active = saisons?.find(s=>s.active) || saisons?.[0];
        if (!active) { setErr("Aucune saison trouvée."); setLoading(false); return; }
        const sess = { clubId: id, coachName: coachName.trim(), saisonId: active.id };
        saveSession(sess); onAuth(sess);
      }
    } catch(e) { setErr(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  return <div className="auth-wrap"><div className="auth-box">
    <div className="auth-top"><div className="auth-logo">Coach<em>Club</em> 🏀</div><div className="auth-sub">Plateforme IA pour coachs basket</div></div>
    <div className="auth-body">
      <div className="auth-tabs">
        <button className={`auth-tab ${tab==="join"?"active":""}`} onClick={()=>setTab("join")}>Rejoindre</button>
        <button className={`auth-tab ${tab==="create"?"active":""}`} onClick={()=>setTab("create")}>Créer un club</button>
      </div>
      <div className="field"><label>Nom du club</label><input value={clubName} onChange={e=>setClubName(e.target.value)} placeholder="Ex: BC Wasquehal"/></div>
      <div className="field"><label>Mot de passe</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Partagé entre coachs"/></div>
      <div className="field"><label>Ton prénom</label><input value={coachName} onChange={e=>setCoachName(e.target.value)} placeholder="Ex: Laurent"/></div>
      {tab==="create" && <>
        <div className="field"><label>Email de récupération</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ton@email.com — pour récupérer l'accès"/></div>
        <hr className="divider"/>
        <p style={{fontFamily:"Oswald",fontSize:10,letterSpacing:1,textTransform:"uppercase",color:"var(--muted)",marginBottom:12}}>Première saison</p>
        <div className="grid2">
          <div className="field"><label>Saison</label><input value={saisonNom} onChange={e=>setSaisonNom(e.target.value)} placeholder="2025-2026"/></div>
          <div className="field"><label>Équipe</label><input value={equipe} onChange={e=>setEquipe(e.target.value)} placeholder="Ex: U15 Filles B"/></div>
        </div>
        <div className="grid2">
          <div className="field"><label>Division</label><input value={division} onChange={e=>setDivision(e.target.value)} placeholder="Ex: D6 Nord"/></div>
          <div className="field"><label>Séances/semaine</label>
            <select value={seances} onChange={e=>setSeances(e.target.value)}>{["1","2","3","4","5"].map(n=><option key={n} value={n}>{n}</option>)}</select>
          </div>
        </div>
        <div className="field"><label>Contexte équipe</label><textarea value={contexte} onChange={e=>setContexte(e.target.value)} rows={2} placeholder="U15 filles, niveau hétérogène, 2e année ensemble..."/></div>
      </>}
      {err && <p style={{color:"var(--red)",fontSize:13,marginBottom:12}}>{err}</p>}
      <button className="btn btn-accent" style={{width:"100%"}} onClick={handle} disabled={loading}>{loading?"...":tab==="create"?"Créer le club":"Rejoindre"}</button>
      {tab==="join" && <p style={{textAlign:"center",marginTop:14}}><span style={{fontSize:13,color:"var(--muted)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setShowForgot(true)}>Mot de passe oublié ?</span></p>}
    </div>
  </div></div>;
}

/* ─── SAISON MODAL ─── */
function SaisonModal({ club, saisons, currentSaisonId, onSelect, onClose, onNewSaison }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nom:"2026-2027", equipe:"", division:"", seances_par_semaine:2 });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.equipe.trim()) return;
    setSaving(true);
    try {
      await db.updateSaison(currentSaisonId, { active: false });
      const id = uid();
      await db.createSaison({ id, club_id: club.id, ...form, active: true });
      await onNewSaison(id); onClose();
    } catch(e) { alert(e.message); }
    setSaving(false);
  };

  return <div className="overlay" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
      <div className="modal-hdr"><span className="modal-ttl">Saisons</span><button className="close" onClick={onClose}>✕</button></div>
      {!creating ? <>
        {saisons.map(s=><div key={s.id} className={`cal-item ${s.id===currentSaisonId?"next":""}`} style={{cursor:"pointer"}} onClick={()=>{onSelect(s.id);onClose();}}>
          <div style={{flex:1}}><div className="cal-title">{s.equipe} — {s.nom}</div><div className="cal-sub">{s.division} · {s.seances_par_semaine} séances/sem</div></div>
          {s.active && <span className="badge b-green">Active</span>}
        </div>)}
        <button className="btn btn-accent" style={{width:"100%",marginTop:16}} onClick={()=>setCreating(true)}>+ Nouvelle saison</button>
      </> : <>
        <div className="grid2">
          <div className="field"><label>Saison</label><input value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></div>
          <div className="field"><label>Équipe</label><input value={form.equipe} onChange={e=>setForm(f=>({...f,equipe:e.target.value}))} placeholder="Ex: U18 Filles"/></div>
        </div>
        <div className="grid2">
          <div className="field"><label>Division</label><input value={form.division} onChange={e=>setForm(f=>({...f,division:e.target.value}))}/></div>
          <div className="field"><label>Séances/sem</label><select value={form.seances_par_semaine} onChange={e=>setForm(f=>({...f,seances_par_semaine:parseInt(e.target.value)}))}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></div>
        </div>
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>setCreating(false)}>Annuler</button>
          <button className="btn btn-accent" onClick={create} disabled={saving}>{saving?"...":"Créer"}</button>
        </div>
      </>}
    </div>
  </div>;
}

/* ─── JOUEUSES ─── */
function JoueusesPage({ club, saison, joueuses, evals, reload, statsSaison }) {
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState("profil");
  const [form, setForm] = useState({});
  const [evalForm, setEvalForm] = useState({});
  const [statsJoueuse, setStatsJoueuse] = useState([]);
  const [saving, setSaving] = useState(false);

  const blankEval = () => ({ poste:POSITIONS[0], notes:"", ...Object.fromEntries(SKILLS.map(k=>[k,3])) });
  const getEval = jid => evals.find(e => e.joueuse_id === jid);

  const openNew = () => { setEditId(null); setForm({ numero:"", prenom:"", nom:"", date_naissance:"", notes_globales:"" }); setEvalForm(blankEval()); setTab("profil"); setStatsJoueuse([]); setShowModal(true); };
  const openEdit = async j => {
    const ev = getEval(j.id);
    const ef = ev ? { poste:ev.poste||POSITIONS[0], notes:ev.notes||"", ...Object.fromEntries(SKILLS.map((k,i)=>[k,ev[SKILL_DB[i]]||3])) } : blankEval();
    const stats = await db.getStatsJoueuse(j.id, saison.id);
    setStatsJoueuse(stats||[]);
    setEditId(j.id); setForm({...j}); setEvalForm(ef); setTab("profil"); setShowModal(true);
  };

  const save = async () => {
    if (!form.nom) return;
    setSaving(true);
    try {
      let jid = editId;
      if (editId) { await db.updateJoueuse(editId, { numero:form.numero||"", prenom:form.prenom||"", nom:form.nom, date_naissance:form.date_naissance||"", notes_globales:form.notes_globales||"" }); }
      else { jid = uid(); await db.createJoueuse({ id:jid, club_id:club.id, numero:form.numero||"", prenom:form.prenom||"", nom:form.nom, date_naissance:form.date_naissance||"", notes_globales:form.notes_globales||"" }); }
      const ep = { poste:evalForm.poste||POSITIONS[0], notes:evalForm.notes||"", tir:evalForm.Tir||evalForm.tir||3, dribble:evalForm.Dribble||evalForm.dribble||3, passe:evalForm.Passe||evalForm.passe||3, defense:evalForm["Défense"]||evalForm.defense||3, physique:evalForm.Physique||evalForm.physique||3, mental:evalForm.Mental||evalForm.mental||3 };
      const ex = await db.getEvalJoueuse(jid, saison.id);
      if (ex) { await db.updateEval(ex.id, ep); } else { await db.createEval({ id:uid(), joueuse_id:jid, saison_id:saison.id, ...ep }); }
      await reload(); setShowModal(false);
    } catch(e) { alert(`Erreur: ${e.message}`); }
    setSaving(false);
  };

  const del = async id => { if (!confirm("Supprimer cette joueuse définitivement ?")) return; await db.deleteJoueuse(id); await reload(); };

  // Stats rapides depuis statsSaison
  const getQuickStats = jid => {
    const jStats = (statsSaison||[]).filter(s=>s.joueuse_id===jid);
    if (!jStats.length) return null;
    const totalPts = jStats.reduce((a,s)=>a+s.points,0);
    const totalF = jStats.reduce((a,s)=>a+s.fautes,0);
    return { matchs: jStats.length, pts: totalPts, moy: (totalPts/jStats.length).toFixed(1), fautes: totalF };
  };

  return <div>
    <div className="flex jc-sb items-c" style={{marginBottom:20}}>
      <h2 className="page-title" style={{margin:0}}>Effectif <span>({joueuses.length})</span></h2>
      <button className="btn btn-accent" onClick={openNew}>+ Joueuse</button>
    </div>
    {joueuses.length===0 && <div className="card" style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>🏀</div><p className="muted">Aucune joueuse. Commence par construire ton effectif.</p></div>}
    <div className="player-grid">
      {joueuses.map(j=>{
        const ev = getEval(j.id);
        const qs = getQuickStats(j.id);
        return <div key={j.id} className="pcard" onClick={()=>openEdit(j)}>
          <div className="pnum">#{j.numero||"?"}</div>
          <div className="pname">{j.prenom} {j.nom}</div>
          <div className="ppos">{ev?.poste||"–"}</div>
          {ev ? SKILL_DB.map((k,i)=><SkillBar key={k} label={SKILLS[i]} value={ev[k]||3}/>) : <p className="muted" style={{fontSize:11,marginTop:8}}>Pas encore évalué cette saison</p>}
          {qs && <div style={{marginTop:10,padding:"8px 0",borderTop:"1px solid var(--border)"}}>
            <div style={{display:"flex",gap:12}}>
              <div style={{textAlign:"center"}}><div style={{fontFamily:"Oswald",fontSize:18,fontWeight:700,color:"var(--accent)"}}>{qs.moy}</div><div style={{fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1}}>Moy pts</div></div>
              <div style={{textAlign:"center"}}><div style={{fontFamily:"Oswald",fontSize:18,fontWeight:700,color:"var(--white)"}}>{qs.matchs}</div><div style={{fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1}}>Matchs</div></div>
              <div style={{textAlign:"center"}}><div style={{fontFamily:"Oswald",fontSize:18,fontWeight:700,color:qs.fautes>qs.matchs*2?"var(--red)":"var(--white)"}}>{(qs.fautes/qs.matchs).toFixed(1)}</div><div style={{fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1}}>Moy F</div></div>
            </div>
          </div>}
          {j.notes_globales && <p style={{fontSize:11,color:"var(--muted)",marginTop:8,fontStyle:"italic",lineHeight:1.4}}>{j.notes_globales}</p>}
          <button className="btn btn-danger" style={{marginTop:10}} onClick={e=>{e.stopPropagation();del(j.id);}}>Supprimer</button>
        </div>;
      })}
    </div>
    {showModal && <div className="overlay" onClick={()=>setShowModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr"><span className="modal-ttl">{editId?"Modifier":"Nouvelle joueuse"}</span><button className="close" onClick={()=>setShowModal(false)}>✕</button></div>
        <div className="tabs">
          <button className={`tab ${tab==="profil"?"active":""}`} onClick={()=>setTab("profil")}>👤 Profil permanent</button>
          <button className={`tab ${tab==="eval"?"active":""}`} onClick={()=>setTab("eval")}>⭐ Éval {saison.nom}</button>
          {editId && <button className={`tab ${tab==="stats"?"active":""}`} onClick={()=>setTab("stats")}>📊 Stats saison</button>}
        </div>
        {tab==="stats" && <>
          {statsJoueuse.length===0 ? <p className="muted" style={{textAlign:"center",padding:20}}>Aucune stat enregistrée pour cette joueuse cette saison.</p> :
          <>
            <div className="flex gap2" style={{marginBottom:16,justifyContent:"center"}}>
              {[["Matchs",statsJoueuse.length,"var(--white)"],["Total pts",statsJoueuse.reduce((a,s)=>a+s.points,0),"var(--accent)"],["Moy pts",(statsJoueuse.reduce((a,s)=>a+s.points,0)/statsJoueuse.length).toFixed(1),"var(--accent)"],["Total F",statsJoueuse.reduce((a,s)=>a+s.fautes,0),"var(--red)"]].map(([l,v,c])=>(
                <div key={l} className="sbox" style={{flex:"0 0 auto",minWidth:70}}><div className="sval" style={{color:c,fontSize:22}}>{v}</div><div className="slbl">{l}</div></div>
              ))}
            </div>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
                {["Match","Pts","Tirs","3pts","LF","Fautes"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"left",fontFamily:"Oswald",fontSize:10,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>{h}</th>)}
              </tr></thead>
              <tbody>{statsJoueuse.map((s,i)=>{
                const m = matches?.find(m=>m.id===s.match_id);
                return <tr key={i} style={{borderBottom:"1px solid var(--border)22"}}>
                  <td style={{padding:"6px 8px",fontSize:11,color:"var(--muted)"}}>{m?`vs ${m.adversaire} ${m.date}`:s.match_id?.slice(0,8)}</td>
                  <td style={{padding:"6px 8px",fontWeight:700,color:s.points>0?"var(--accent)":"var(--muted)"}}>{s.points}</td>
                  <td style={{padding:"6px 8px"}}>{s.tirs_reussis}/{s.tirs_tentes}</td>
                  <td style={{padding:"6px 8px"}}>{s.tirs_3pts}</td>
                  <td style={{padding:"6px 8px"}}>{s.lf_reussis}/{s.lf_tentes}</td>
                  <td style={{padding:"6px 8px",color:s.fautes>=4?"var(--red)":"var(--white)"}}>{s.fautes}</td>
                </tr>;
              })}</tbody>
            </table>
          </>}
        </>}
        {tab==="profil" && <>
          <div className="grid2">
            <div className="field"><label>Prénom</label><input value={form.prenom||""} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))} placeholder="Prénom"/></div>
            <div className="field"><label>Nom</label><input value={form.nom||""} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Nom"/></div>
          </div>
          <div className="grid2">
            <div className="field"><label>N° maillot</label><input value={form.numero||""} onChange={e=>setForm(f=>({...f,numero:e.target.value}))} placeholder="7"/></div>
            <div className="field"><label>Date naissance</label><input type="date" value={form.date_naissance||""} onChange={e=>setForm(f=>({...f,date_naissance:e.target.value}))}/></div>
          </div>
          <div className="field"><label>Notes permanentes</label><textarea value={form.notes_globales||""} onChange={e=>setForm(f=>({...f,notes_globales:e.target.value}))} placeholder="Notes sur la joueuse qui traversent les saisons et les équipes..."/></div>
        </>}
        {tab==="eval" && <>
          <div className="field"><label>Poste</label><select value={evalForm.poste||POSITIONS[0]} onChange={e=>setEvalForm(f=>({...f,poste:e.target.value}))}>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></div>
          <hr className="divider"/>
          <p style={{fontFamily:"Oswald",fontSize:10,letterSpacing:1,textTransform:"uppercase",color:"var(--muted)",marginBottom:12}}>Évaluation saison (1–5)</p>
          {SKILLS.map(k=><div key={k} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <label style={{width:72,fontSize:10,fontFamily:"Oswald",letterSpacing:1,textTransform:"uppercase",color:"var(--muted)",flexShrink:0}}>{k}</label>
            <Stars v={evalForm[k]||3} onChange={v=>setEvalForm(f=>({...f,[k]:v}))}/>
          </div>)}
          <div className="field" style={{marginTop:12}}><label>Notes saison {saison.nom}</label><textarea value={evalForm.notes||""} onChange={e=>setEvalForm(f=>({...f,notes:e.target.value}))} placeholder="Points forts, axes de progression cette saison..."/></div>
        </>}
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>{saving?"...":"Enregistrer"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── MATCHS ─── */
function MatchsPage({ club, saison, joueuses, matches, reload }) {
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null); // match en détail
  const [editMatch, setEditMatch] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [pdfStatus, setPdfStatus] = useState({ feuille:"", score:"", tirs:"" });
  const [pdfs, setPdfs] = useState({ feuille:null, score:null, tirs:null });
  const [tirsPdfFile, setTirsPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statsMatch, setStatsMatch] = useState([]);
  const fileRefs = { feuille: useRef(), score: useRef(), tirs: useRef() };
  const emptyForm = () => ({ date:"", adversaire:"", score_nous:"", score_eux:"", defense_adverse:"", joueuses_cles:"", mon_attaque:"", ma_defense:"", attaque_adverse:"", defense_adverse_notes:"", stats_joueuses:[], stats_equipe:{}, progression_score:{}, pdf_tirs_url:"" });
  const [form, setForm] = useState(emptyForm());

  const openNew = () => { setEditMatch(null); setPdfs({ feuille:null, score:null, tirs:null }); setTirsPdfFile(null); setPdfStatus({ feuille:"", score:"", tirs:"" }); setForm(emptyForm()); setStatsMatch([]); setShowModal(true); };
  const openEdit = m => {
    setEditMatch(m);
    setForm({ date:m.date||"", adversaire:m.adversaire||"", score_nous:m.score_nous||"", score_eux:m.score_eux||"", defense_adverse:m.defense_adverse||"", joueuses_cles:m.joueuses_cles||"", mon_attaque:m.mon_attaque||"", ma_defense:m.ma_defense||"", attaque_adverse:m.attaque_adverse||"", defense_adverse_notes:m.defense_adverse_notes||"", stats_joueuses:m.stats_joueuses||[], stats_equipe:m.stats_equipe||{}, progression_score:m.progression_score||{}, pdf_tirs_url:m.pdf_tirs_url||"" });
    setPdfs({ feuille:null, score:null, tirs:null }); setTirsPdfFile(null); setPdfStatus({ feuille:"", score:"", tirs:"" });
    db.getStatsMatch(m.id).then(s=>setStatsMatch(s||[]));
    setShowModal(true);
  };

  const openDetail = async m => {
    const stats = await db.getStatsMatch(m.id);
    setStatsMatch(stats||[]);
    setShowDetail(m);
  };

  const handlePdf = async (type, file) => {
    if (!file || file.type !== "application/pdf") return;
    setPdfStatus(s=>({...s,[type]:"Chargement..."}));
    try {
      const b64 = await toBase64(file);
      setPdfs(p=>({...p,[type]:b64}));
      if (type === "tirs") setTirsPdfFile(file);
      setPdfStatus(s=>({...s,[type]:"✅"}));
    } catch { setPdfStatus(s=>({...s,[type]:"Erreur"})); }
  };

  const analyze = async () => {
    const available = [["feuille",pdfs.feuille],["score",pdfs.score]].filter(([,v])=>v);
    if (!available.length && !pdfs.tirs) return;
    setParsing(true);
    try {
      const allPdfs = Object.entries(pdfs).filter(([,v])=>v).map(([,v])=>v);
      const txt = await askClaudeWithPDFs(allPdfs,
        `Tu as des documents d'un match basket U15 féminin FFBB. Analyse-les tous et réponds UNIQUEMENT en JSON avec cette structure exacte:
{
  "adversaire": "",
  "score_nous": 0,
  "score_eux": 0,
  "date": "YYYY-MM-DD",
  "defense_type": "",
  "stats_joueuses": [{"nom":"","prenom":"","numero":0,"titulaire":false,"points":0,"tirs_reussis":0,"tirs_tentes":0,"tirs_3pts":0,"lf_reussis":0,"lf_tentes":0,"fautes":0,"temps_jeu":""}],
  "stats_equipe": {"points_banc":0,"avantage_max":0,"serie_max":0,"total_tirs_reussis":0,"total_tirs_tentes":0},
  "progression_score": {"qt1_nous":0,"qt1_eux":0,"qt2_nous":0,"qt2_eux":0,"qt3_nous":0,"qt3_eux":0,"qt4_nous":0,"qt4_eux":0},
  "mon_attaque": "analyse offensive",
  "ma_defense": "analyse défensive",
  "attaque_adverse": "comment l'adversaire a attaqué",
  "defense_adverse": "leur défense et comment on y a répondu"
}`);
      const p = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setForm(f=>({
        ...f,
        adversaire: p.adversaire||f.adversaire,
        score_nous: String(p.score_nous||f.score_nous),
        score_eux: String(p.score_eux||f.score_eux),
        date: p.date||f.date,
        defense_adverse: p.defense_type||f.defense_adverse,
        stats_joueuses: p.stats_joueuses||f.stats_joueuses,
        stats_equipe: p.stats_equipe||f.stats_equipe,
        progression_score: p.progression_score||f.progression_score,
        mon_attaque: p.mon_attaque||f.mon_attaque,
        ma_defense: p.ma_defense||f.ma_defense,
        attaque_adverse: p.attaque_adverse||f.attaque_adverse,
        defense_adverse_notes: p.defense_adverse||f.defense_adverse_notes,
        joueuses_cles: p.stats_joueuses?.filter(j=>j.points>0).map(j=>`${j.nom}: ${j.points}pts`).join(", ")||f.joueuses_cles,
      }));
      // Pré-remplir les stats match en liant aux joueuses connues
      const statsPreview = (p.stats_joueuses||[]).map(sj => {
        const match = joueuses.find(j => j.nom.toLowerCase()===sj.nom?.toLowerCase() || j.prenom?.toLowerCase()===sj.prenom?.toLowerCase());
        return { ...sj, joueuse_id: match?.id||null, joueuse_nom: match ? `${match.prenom} ${match.nom}` : `${sj.prenom||""} ${sj.nom||""}`.trim() };
      });
      setStatsMatch(statsPreview);
    } catch(e) { alert(`Erreur d'analyse: ${e.message}`); }
    setParsing(false);
  };

  const save = async () => {
    if (!form.adversaire) return;
    setSaving(true);
    try {
      let pdfTirsUrl = form.pdf_tirs_url;
      const matchId = editMatch?.id || uid();
      // Upload PDF tirs si nouveau
      if (tirsPdfFile) {
        pdfTirsUrl = await uploadPdfTirs(matchId, tirsPdfFile);
      }
      const payload = { club_id:club.id, saison_id:saison.id, date:form.date, adversaire:form.adversaire, score_nous:form.score_nous, score_eux:form.score_eux, defense_adverse:form.defense_adverse, joueuses_cles:form.joueuses_cles, mon_attaque:form.mon_attaque, ma_defense:form.ma_defense, attaque_adverse:form.attaque_adverse, defense_adverse_notes:form.defense_adverse_notes, stats_joueuses:form.stats_joueuses, stats_equipe:form.stats_equipe, progression_score:form.progression_score, pdf_tirs_url:pdfTirsUrl };
      if (editMatch) { await db.updateMatch(editMatch.id, payload); }
      else { await db.createMatch({ id:matchId, ...payload }); }
      // Sauvegarder stats individuelles liées aux joueuses
      if (statsMatch.length > 0) {
        if (editMatch) await db.deleteStatsMatch(editMatch.id);
        const mid = editMatch?.id || matchId;
        for (const s of statsMatch) {
          if (s.joueuse_id) {
            await db.createStatMatch({ id:uid(), match_id:mid, joueuse_id:s.joueuse_id, saison_id:saison.id, club_id:club.id, points:s.points||0, tirs_reussis:s.tirs_reussis||0, tirs_tentes:s.tirs_tentes||0, tirs_3pts:s.tirs_3pts||0, lf_reussis:s.lf_reussis||0, lf_tentes:s.lf_tentes||0, fautes:s.fautes||0, temps_jeu:s.temps_jeu||"", titulaire:s.titulaire||false });
          }
        }
      }
      await reload(); setShowModal(false);
    } catch(e) { alert(`Erreur: ${e.message}`); }
    setSaving(false);
  };

  const wins = matches.filter(m=>parseInt(m.score_nous)>parseInt(m.score_eux)).length;
  const totalPts = matches.reduce((a,m)=>a+parseInt(m.score_nous||0),0);
  const avgPts = matches.length ? Math.round(totalPts/matches.length) : 0;

  return <div>
    <div className="flex jc-sb items-c" style={{marginBottom:20}}>
      <h2 className="page-title" style={{margin:0}}>Matchs <span>({matches.length})</span></h2>
      <button className="btn btn-accent" onClick={openNew}>+ Match</button>
    </div>
    {matches.length>0 && <div className="stat-strip">
      <div className="sbox"><div className="sval">{matches.length}</div><div className="slbl">Joués</div></div>
      <div className="sbox"><div className="sval" style={{color:"var(--green)"}}>{wins}</div><div className="slbl">Victoires</div></div>
      <div className="sbox"><div className="sval" style={{color:"var(--red)"}}>{matches.length-wins}</div><div className="slbl">Défaites</div></div>
      <div className="sbox"><div className="sval">{avgPts}</div><div className="slbl">Moy. pts</div></div>
    </div>}
    {matches.length===0 && <div className="card" style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>📋</div><p className="muted">Aucun match cette saison.</p></div>}
    {matches.map(m=>{
      const w=parseInt(m.score_nous)>parseInt(m.score_eux);
      const hasStats = m.stats_joueuses?.length > 0;
      return <div key={m.id} className="mitem">
        <span className="mdate" style={{cursor:"pointer"}} onClick={()=>openDetail(m)}>{m.date||"–"}</span>
        <div style={{flex:1,cursor:"pointer"}} onClick={()=>openDetail(m)}>
          <div className="mvs">vs {m.adversaire}</div>
          <div className="flex gap2" style={{marginTop:4,flexWrap:"wrap"}}>
            {m.defense_adverse && <span className="badge b-yellow">{m.defense_adverse}</span>}
            {hasStats && <span className="badge b-blue">📊 Stats</span>}
            {m.pdf_tirs_url && <span className="badge b-green">🎯 PDF</span>}
          </div>
        </div>
        <div className={`mscore ${w?"w":"l"}`}>{m.score_nous}–{m.score_eux}</div>
        <span className={`badge ${w?"b-green":"b-red"}`}>{w?"V":"D"}</span>
        <button className="btn btn-ghost" style={{fontSize:10,padding:"3px 8px",marginLeft:4}} onClick={()=>openEdit(m)}>✏️</button>
      </div>;
    })}

    {/* DETAIL MODAL */}
    {showDetail && <div className="overlay" onClick={()=>setShowDetail(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:700}}>
        <div className="modal-hdr">
          <span className="modal-ttl">vs {showDetail.adversaire} — {showDetail.date}</span>
          <button className="close" onClick={()=>setShowDetail(null)}>✕</button>
        </div>
        {/* Score + quarts */}
        <div className="flex gap2 items-c" style={{marginBottom:16}}>
          <div style={{fontFamily:"Oswald",fontSize:32,fontWeight:700,color:parseInt(showDetail.score_nous)>parseInt(showDetail.score_eux)?"var(--green)":"var(--red)"}}>{showDetail.score_nous}–{showDetail.score_eux}</div>
          {showDetail.progression_score && Object.keys(showDetail.progression_score).length>0 && <div style={{display:"flex",gap:8,marginLeft:16}}>
            {[1,2,3,4].map(q=><div key={q} style={{textAlign:"center",background:"var(--surface2)",padding:"6px 10px",borderRadius:2}}>
              <div style={{fontSize:9,color:"var(--muted)",fontFamily:"Oswald",letterSpacing:1}}>QT{q}</div>
              <div style={{fontSize:13,fontWeight:600}}>{showDetail.progression_score[`qt${q}_nous`]||0}–{showDetail.progression_score[`qt${q}_eux`]||0}</div>
            </div>)}
          </div>}
        </div>
        {/* Stats équipe */}
        {showDetail.stats_equipe && Object.keys(showDetail.stats_equipe).length>0 && <div className="flex gap2" style={{marginBottom:16,flexWrap:"wrap"}}>
          {showDetail.stats_equipe.avantage_max && <span className="badge b-yellow">Avantage max: {showDetail.stats_equipe.avantage_max}</span>}
          {showDetail.stats_equipe.serie_max && <span className="badge b-blue">Série max: {showDetail.stats_equipe.serie_max}</span>}
          {showDetail.stats_equipe.points_banc !== undefined && <span className="badge b-green">Pts banc: {showDetail.stats_equipe.points_banc}</span>}
        </div>}
        {/* Stats joueuses */}
        {statsMatch.length>0 && <>
          <hr className="divider"/>
          <p style={{fontFamily:"Oswald",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>Stats joueuses</p>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
                {["Joueuse","T","Pts","Tirs","3pts","LF","F"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"left",fontFamily:"Oswald",fontSize:10,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>{h}</th>)}
              </tr></thead>
              <tbody>{statsMatch.map((s,i)=><tr key={i} style={{borderBottom:"1px solid var(--border)22"}}>
                <td style={{padding:"6px 8px",fontWeight:500}}>{s.joueuse_nom||`Joueuse ${i+1}`}</td>
                <td style={{padding:"6px 8px"}}>{s.titulaire?"✓":""}</td>
                <td style={{padding:"6px 8px",fontWeight:700,color:s.points>0?"var(--accent)":"var(--muted)"}}>{s.points||0}</td>
                <td style={{padding:"6px 8px"}}>{s.tirs_reussis||0}/{s.tirs_tentes||0}</td>
                <td style={{padding:"6px 8px"}}>{s.tirs_3pts||0}</td>
                <td style={{padding:"6px 8px"}}>{s.lf_reussis||0}/{s.lf_tentes||0}</td>
                <td style={{padding:"6px 8px",color:s.fautes>=4?"var(--red)":"var(--white)"}}>{s.fautes||0}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
        {/* PDF tirs */}
        {showDetail.pdf_tirs_url && <>
          <hr className="divider"/>
          <a href={showDetail.pdf_tirs_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{width:"100%",justifyContent:"center",textDecoration:"none"}}>
            🎯 Voir les positions de tirs (PDF)
          </a>
        </>}
        {/* Résumé structuré */}
        {(showDetail.mon_attaque||showDetail.ma_defense||showDetail.attaque_adverse||showDetail.defense_adverse_notes) && <>
          <hr className="divider"/>
          <div className="summary-grid">
            {showDetail.mon_attaque && <div className="summary-block att"><div className="summary-block-title">⚡ Mon attaque</div><p style={{fontSize:13,lineHeight:1.6}}>{showDetail.mon_attaque}</p></div>}
            {showDetail.ma_defense && <div className="summary-block def"><div className="summary-block-title">🛡️ Ma défense</div><p style={{fontSize:13,lineHeight:1.6}}>{showDetail.ma_defense}</p></div>}
            {showDetail.attaque_adverse && <div className="summary-block adv-att"><div className="summary-block-title">⚔️ Attaque adverse</div><p style={{fontSize:13,lineHeight:1.6}}>{showDetail.attaque_adverse}</p></div>}
            {showDetail.defense_adverse_notes && <div className="summary-block adv-def"><div className="summary-block-title">🔒 Défense adverse</div><p style={{fontSize:13,lineHeight:1.6}}>{showDetail.defense_adverse_notes}</p></div>}
          </div>
        </>}
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>{setShowDetail(null);openEdit(showDetail);}}>✏️ Modifier</button>
          <button className="btn btn-ghost" onClick={()=>setShowDetail(null)}>Fermer</button>
        </div>
      </div>
    </div>}

    {/* EDIT/CREATE MODAL */}
    {showModal && <div className="overlay" onClick={()=>setShowModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:680}}>
        <div className="modal-hdr"><span className="modal-ttl">{editMatch?"Modifier":"Nouveau match"}</span><button className="close" onClick={()=>setShowModal(false)}>✕</button></div>

        {/* PDF Upload */}
        <div style={{marginBottom:16}}>
          <p style={{fontFamily:"Oswald",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>📄 Documents PDF FFBB</p>
          <div className="grid3">
            {[["feuille","📋","Feuille match"],["score","📊","Fiche score"],["tirs","🎯","Positions tirs"]].map(([type,icon,label])=>(
              <div key={type}>
                <div className={`dropzone ${pdfs[type]?"drag":""}`} style={{padding:14}} onClick={()=>fileRefs[type].current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handlePdf(type,e.dataTransfer.files[0]);}}>
                  <input ref={fileRefs[type]} type="file" accept=".pdf" style={{display:"none"}} onChange={e=>handlePdf(type,e.target.files[0])}/>
                  <div className="dropzone-icon" style={{fontSize:18}}>{icon}</div>
                  <div className="dropzone-txt" style={{fontSize:11}}>{pdfStatus[type]||(type==="tirs"&&editMatch?.pdf_tirs_url?"✅ Déjà uploadé":<strong>{label}</strong>)}</div>
                </div>
              </div>
            ))}
          </div>
          {(pdfs.feuille||pdfs.score) && <button className="btn btn-accent" style={{width:"100%",marginTop:4}} onClick={analyze} disabled={parsing}>{parsing?"⏳ Analyse en cours...":"🧠 Analyser les PDFs"}</button>}
          <p style={{fontSize:11,color:"var(--muted)",marginTop:6}}>💡 La feuille + fiche score extraient les stats. Le PDF tirs est stocké et consultable.</p>
        </div>

        <div className="grid2">
          <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
          <div className="field"><label>Adversaire</label><input value={form.adversaire} onChange={e=>setForm(f=>({...f,adversaire:e.target.value}))} placeholder="Nom équipe"/></div>
        </div>
        <div className="grid2">
          <div className="field"><label>Notre score</label><input type="number" value={form.score_nous} onChange={e=>setForm(f=>({...f,score_nous:e.target.value}))}/></div>
          <div className="field"><label>Score adverse</label><input type="number" value={form.score_eux} onChange={e=>setForm(f=>({...f,score_eux:e.target.value}))}/></div>
        </div>
        <div className="field"><label>Type défense adverse</label><input value={form.defense_adverse} onChange={e=>setForm(f=>({...f,defense_adverse:e.target.value}))} placeholder="Zone 2-3, H/H, Press..."/></div>

        {/* Stats joueuses extraites */}
        {statsMatch.length>0 && <>
          <hr className="divider"/>
          <p style={{fontFamily:"Oswald",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>📊 Stats joueuses extraites</p>
          <div style={{overflowX:"auto",marginBottom:12}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
                {["Nom extrait","Liée à","Pts","Tirs","3pts","LF","F"].map(h=><th key={h} style={{padding:"4px 6px",textAlign:"left",fontFamily:"Oswald",fontSize:10,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>{h}</th>)}
              </tr></thead>
              <tbody>{statsMatch.map((s,i)=><tr key={i} style={{borderBottom:"1px solid var(--border)22"}}>
                <td style={{padding:"4px 6px",fontSize:11}}>{s.joueuse_nom}</td>
                <td style={{padding:"4px 6px"}}>
                  <select style={{background:"var(--bg)",border:"1px solid var(--border)",color:"var(--white)",fontSize:11,padding:"2px 4px",borderRadius:2}} value={s.joueuse_id||""} onChange={e=>setStatsMatch(sm=>sm.map((x,j)=>j===i?{...x,joueuse_id:e.target.value||null}:x))}>
                    <option value="">–</option>
                    {joueuses.map(j=><option key={j.id} value={j.id}>{j.prenom} {j.nom}</option>)}
                  </select>
                </td>
                <td style={{padding:"4px 6px",fontWeight:700}}>{s.points||0}</td>
                <td style={{padding:"4px 6px"}}>{s.tirs_reussis||0}/{s.tirs_tentes||0}</td>
                <td style={{padding:"4px 6px"}}>{s.tirs_3pts||0}</td>
                <td style={{padding:"4px 6px"}}>{s.lf_reussis||0}/{s.lf_tentes||0}</td>
                <td style={{padding:"4px 6px"}}>{s.fautes||0}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}

        <hr className="divider"/>
        <p style={{fontFamily:"Oswald",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:12}}>Résumé structuré</p>
        <div className="summary-grid">
          <div className="summary-block att"><div className="summary-block-title">⚡ Mon attaque</div><textarea style={{background:"transparent",border:"none",outline:"none",width:"100%",color:"var(--white)",fontSize:13,resize:"vertical",minHeight:60,fontFamily:"DM Sans"}} value={form.mon_attaque} onChange={e=>setForm(f=>({...f,mon_attaque:e.target.value}))} placeholder="Ce qui a marché offensivement..."/></div>
          <div className="summary-block def"><div className="summary-block-title">🛡️ Ma défense</div><textarea style={{background:"transparent",border:"none",outline:"none",width:"100%",color:"var(--white)",fontSize:13,resize:"vertical",minHeight:60,fontFamily:"DM Sans"}} value={form.ma_defense} onChange={e=>setForm(f=>({...f,ma_defense:e.target.value}))} placeholder="Notre organisation défensive..."/></div>
          <div className="summary-block adv-att"><div className="summary-block-title">⚔️ Attaque adverse</div><textarea style={{background:"transparent",border:"none",outline:"none",width:"100%",color:"var(--white)",fontSize:13,resize:"vertical",minHeight:60,fontFamily:"DM Sans"}} value={form.attaque_adverse} onChange={e=>setForm(f=>({...f,attaque_adverse:e.target.value}))} placeholder="Comment ils ont attaqué..."/></div>
          <div className="summary-block adv-def"><div className="summary-block-title">🔒 Défense adverse</div><textarea style={{background:"transparent",border:"none",outline:"none",width:"100%",color:"var(--white)",fontSize:13,resize:"vertical",minHeight:60,fontFamily:"DM Sans"}} value={form.defense_adverse_notes} onChange={e=>setForm(f=>({...f,defense_adverse_notes:e.target.value}))} placeholder="Leur défense, comment on y a répondu..."/></div>
        </div>
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>{saving?"⏳ Sauvegarde...":"Enregistrer"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── CALENDRIER ─── */
function CalendrierPage({ club, saison, calendrier, matches, reload, onNavigate }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date:"", heure:"", adversaire:"", lieu:"Domicile", type:"match", notes:"" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.date) return;
    setSaving(true);
    try { await db.createEvent({ id:uid(), saison_id:saison.id, club_id:club.id, ...form }); await reload(); setShowModal(false); setForm({ date:"", heure:"", adversaire:"", lieu:"Domicile", type:"match", notes:"" }); }
    catch(e) { alert(e.message); }
    setSaving(false);
  };
  const del = async id => { await db.deleteEvent(id); await reload(); };

  const today = new Date().toISOString().split("T")[0];
  const next = calendrier.find(e=>e.date>=today && e.type==="match");
  const grouped = calendrier.reduce((acc,e)=>{ const m=e.date?.slice(0,7)||"–"; if(!acc[m]) acc[m]=[]; acc[m].push(e); return acc; }, {});

  const handleClick = (e) => {
    if (e.date < today) return; // match passé, pas cliquable
    if (e.type === "match") onNavigate("gameplan", { adversaire: e.adversaire, calendrierEvent: e });
    else if (e.type === "entrainement") onNavigate("training", { calendrierEvent: e });
  };

  return <div>
    <div className="flex jc-sb items-c" style={{marginBottom:20}}>
      <h2 className="page-title" style={{margin:0}}>Calendrier</h2>
      <button className="btn btn-accent" onClick={()=>setShowModal(true)}>+ Événement</button>
    </div>
    {next && <div className="card" style={{borderColor:"var(--accent)",background:"var(--accent-glow)",marginBottom:20,padding:14,cursor:"pointer"}} onClick={()=>handleClick(next)}>
      <p style={{fontSize:11,color:"var(--muted)",fontFamily:"Oswald",letterSpacing:1,textTransform:"uppercase"}}>🔜 Prochain match — clique pour préparer</p>
      <p style={{fontSize:16,fontWeight:600,marginTop:4}}>vs {next.adversaire}</p>
      <p style={{fontSize:13,color:"var(--muted)",marginTop:2}}>{next.date} {next.heure} · {next.lieu}</p>
      <div className="flex gap2" style={{marginTop:8}}>
        <span className="badge b-yellow">🎯 Plan de match</span>
      </div>
    </div>}
    {calendrier.length===0 && <div className="card" style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>📅</div><p className="muted">Aucun événement. Ajoute les matchs de la saison !</p></div>}
    {Object.entries(grouped).sort().map(([month,events])=>(
      <div key={month} style={{marginBottom:20}}>
        <p style={{fontFamily:"Oswald",fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"var(--muted)",marginBottom:8}}>{month}</p>
        {events.map(e=>{
          const isNext = e.id===next?.id;
          const linked = matches.find(m=>m.id===e.match_id);
          const isFuture = e.date >= today;
          return <div key={e.id} className={`cal-item ${isNext?"next":""}`} style={{cursor:isFuture?"pointer":"default"}} onClick={()=>isFuture&&handleClick(e)}>
            <div className="cal-date">{e.date}<br/><span style={{fontSize:10}}>{e.heure}</span></div>
            <div className="cal-info">
              <div className="cal-title">{e.type==="match"?`vs ${e.adversaire}`:e.notes||e.type}</div>
              <div className="cal-sub">{e.lieu}{linked?` · ${linked.score_nous}-${linked.score_eux}`:""}{isFuture && e.type==="match"?" · 🎯 Préparer":""}{isFuture && e.type==="entrainement"?" · ⚡ Préparer":""}</div>
            </div>
            <span className={`badge ${e.type==="match"?"b-yellow":e.type==="entrainement"?"b-blue":"b-green"}`}>{e.type==="match"?"Match":e.type==="entrainement"?"Entraîn.":"Tournoi"}</span>
            {linked && <span className={`badge ${parseInt(linked.score_nous)>parseInt(linked.score_eux)?"b-green":"b-red"}`}>{parseInt(linked.score_nous)>parseInt(linked.score_eux)?"V":"D"}</span>}
            <button className="btn btn-danger" style={{padding:"3px 8px",fontSize:10}} onClick={ev=>{ev.stopPropagation();del(e.id);}}>✕</button>
          </div>;
        })}
      </div>
    ))}
    {showModal && <div className="overlay" onClick={()=>setShowModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr"><span className="modal-ttl">Nouvel événement</span><button className="close" onClick={()=>setShowModal(false)}>✕</button></div>
        <div className="field"><label>Type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="match">Match</option><option value="entrainement">Entraînement</option><option value="tournoi">Tournoi</option></select></div>
        <div className="grid2">
          <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
          <div className="field"><label>Heure</label><input type="time" value={form.heure} onChange={e=>setForm(f=>({...f,heure:e.target.value}))}/></div>
        </div>
        {form.type==="match" && <>
          <div className="field"><label>Adversaire</label><input value={form.adversaire} onChange={e=>setForm(f=>({...f,adversaire:e.target.value}))} placeholder="Nom équipe"/></div>
          <div className="field"><label>Lieu</label><select value={form.lieu} onChange={e=>setForm(f=>({...f,lieu:e.target.value}))}><option>Domicile</option><option>Extérieur</option></select></div>
        </>}
        <div className="field"><label>Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Infos supplémentaires..."/></div>
        <div className="flex gap2 jc-end mt3">
          <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
          <button className="btn btn-accent" onClick={save} disabled={saving}>{saving?"...":"Ajouter"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── GAME PLAN ─── */
function GamePlanPage({ club, saison, joueuses, evals, matches, calendrier, initContext }) {
  const today = new Date().toISOString().split("T")[0];
  const next = calendrier.find(e=>e.type==="match"&&e.date>=today);
  const [adversaire, setAdversaire] = useState(initContext?.adversaire || next?.adversaire || "");
  const [infos, setInfos] = useState("");
  const [mode, setMode] = useState("court");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plansExistants, setPlansExistants] = useState([]);
  const [selectedJoueuses, setSelectedJoueuses] = useState(() => new Set(joueuses.map(j=>j.id)));
  const [renforts, setRenforts] = useState(""); // joueuses extérieures (texte libre)
  const [selectedMatches, setSelectedMatches] = useState(() => new Set(matches.slice(0,6).map(m=>m.id)));
  const [showSelections, setShowSelections] = useState(false);
  const calEvent = initContext?.calendrierEvent || null;

  useEffect(()=>{ loadPlans(); },[saison.id]);
  useEffect(()=>{ setSelectedJoueuses(new Set(joueuses.map(j=>j.id))); },[joueuses]);
  useEffect(()=>{ setSelectedMatches(new Set(matches.slice(0,6).map(m=>m.id))); },[matches]);

  const loadPlans = async () => setPlansExistants((await db.getPlansMatch(saison.id))||[]);
  const toggleJ = id => setSelectedJoueuses(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleM = id => setSelectedMatches(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });

  const generate = async () => {
    if (!adversaire) return;
    setLoading(true); setOutput(""); setSaved(false);

    const joueusesDispo = joueuses.filter(j=>selectedJoueuses.has(j.id));
    const p = joueusesDispo.map(j=>{ const ev=evals.find(e=>e.joueuse_id===j.id); return `${j.prenom} ${j.nom} (#${j.numero}, ${ev?.poste||"?"}) Tir:${ev?.tir||3} Déf:${ev?.defense||3} Phys:${ev?.physique||3} Mental:${ev?.mental||3}. ${j.notes_globales||""} ${ev?.notes||""}`; }).join("\n");
    const renfLine = renforts.trim() ? `\nRENFORTS (extérieurs): ${renforts}` : "";

    const matchesSel = matches.filter(m=>selectedMatches.has(m.id));
    const m = matchesSel.map(ma=>`${ma.date} vs ${ma.adversaire} ${parseInt(ma.score_nous)>parseInt(ma.score_eux)?"V":"D"} ${ma.score_nous}-${ma.score_eux}\nAtt: ${ma.mon_attaque?.slice(0,80)||"–"} | Déf: ${ma.ma_defense?.slice(0,80)||"–"}\nAdv att: ${ma.attaque_adverse?.slice(0,60)||"–"} | Adv déf: ${ma.defense_adverse_notes?.slice(0,60)||"–"}`).join("\n\n");

    const prev = matchesSel.find(ma=>ma.adversaire?.toLowerCase()===adversaire.toLowerCase());
    const fmt = mode==="court"?"Format COURT: 1 page max, bullet points opérationnels.":"Format DÉTAILLÉ: analyse tactique complète, justifie chaque choix.";
    try {
      const prompt = `Tu es assistant coach basket expert.\n\nCONTEXTE: ${saison.equipe} | ${saison.division} | ${club.contexte||""} | ${saison.seances_par_semaine} séances/semaine\n\nJOUEUSES DISPONIBLES POUR CE MATCH:\n${p||"Non renseigné"}${renfLine}\n\nHISTORIQUE SÉLECTIONNÉ (${matchesSel.length} matchs):\n${m||"Aucun"}\n${prev?`\nMATCH PRÉCÉDENT vs ${adversaire} (${prev.date}): ${prev.score_nous}-${prev.score_eux}\nNotre attaque: ${prev.mon_attaque||"–"}\nNotre défense: ${prev.ma_defense||"–"}\nLeur attaque: ${prev.attaque_adverse||"–"}\nLeur défense: ${prev.defense_adverse_notes||"–"}`:""}${calEvent?`\nMATCH: ${calEvent.date} ${calEvent.heure} vs ${adversaire} (${calEvent.lieu})`:""}${next&&!calEvent?`\nPROCHAIN MATCH: ${next.date} ${next.heure} vs ${adversaire}`:""}\n\nADVERSAIRE: ${adversaire}\nINFOS: ${infos||"Rien"}\n\nGénère un plan de match. ${fmt}\nCouvre: défense recommandée, système offensif, matchups clés, utilisation des renforts si applicable, travail à faire sur les ${saison.seances_par_semaine} séances avant le match, message équipe.`;
      setOutput(await askClaude(null, [{role:"user",content:prompt}]));
    } catch(e) { setOutput(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  const savePlan = async () => {
    if (!output) return;
    setSaving(true);
    try {
      await db.createPlanMatch({ id:uid(), club_id:club.id, saison_id:saison.id, calendrier_id:calEvent?.id||null, adversaire, contenu:output, format:mode });
      await loadPlans(); setSaved(true);
    } catch(e) { alert(e.message); }
    setSaving(false);
  };

  const delPlan = async id => { await db.deletePlanMatch(id); await loadPlans(); };

  return <div>
    <h2 className="page-title">Plan de <span>match</span></h2>
    {calEvent && <div className="card" style={{borderColor:"var(--accent)",background:"var(--accent-glow)",marginBottom:16,padding:14}}>
      <p style={{fontSize:11,color:"var(--muted)"}}>📅 Préparation depuis le calendrier</p>
      <p style={{fontSize:15,fontWeight:600,marginTop:4}}>vs {calEvent.adversaire} — {calEvent.date} {calEvent.heure} · {calEvent.lieu}</p>
    </div>}
    {!calEvent && next && <div className="card" style={{borderColor:"var(--accent)",background:"var(--accent-glow)",marginBottom:16,padding:14}}>
      <p style={{fontSize:11,color:"var(--muted)"}}>🔜 Prochain match détecté</p>
      <p style={{fontSize:15,fontWeight:600,marginTop:4}}>vs {next.adversaire} — {next.date} {next.heure}</p>
    </div>}
    <div className="grid2">
      <div className="card">
        <div className="card-title">⚙️ Paramètres</div>
        <div className="field"><label>Adversaire *</label><input value={adversaire} onChange={e=>setAdversaire(e.target.value)} placeholder="Nom équipe adverse"/></div>
        <div className="field"><label>Ce que tu sais d'eux</label><textarea value={infos} onChange={e=>setInfos(e.target.value)} rows={2} placeholder="Défense, joueuses dangereuses, résultats récents..."/></div>
        <div className="field"><label>Format</label><div className="flex gap2">{["court","long"].map(v=><button key={v} className={`btn ${mode===v?"btn-accent":"btn-ghost"}`} onClick={()=>setMode(v)}>{v==="court"?"Court":"Détaillé"}</button>)}</div></div>

        {/* SÉLECTIONS */}
        <button className="btn btn-ghost" style={{width:"100%",marginTop:8,fontSize:11}} onClick={()=>setShowSelections(s=>!s)}>
          {showSelections?"▲":"▼"} Joueuses disponibles & historique ({selectedJoueuses.size}/{joueuses.length} · {selectedMatches.size} matchs)
        </button>
        {showSelections && <div style={{marginTop:12}}>
          <p style={{fontFamily:"Oswald",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:8}}>👥 Joueuses disponibles</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {joueuses.map(j=><button key={j.id} className={`btn ${selectedJoueuses.has(j.id)?"btn-accent":"btn-ghost"}`} style={{fontSize:11,padding:"4px 10px"}} onClick={()=>toggleJ(j.id)}>
              #{j.numero} {j.prenom}
            </button>)}
          </div>
          <div className="field">
            <label>Renforts extérieurs (non dans l'effectif)</label>
            <input value={renforts} onChange={e=>setRenforts(e.target.value)} placeholder="Ex: Julie (pivot, U18A) — forte en rebond"/>
          </div>
          <p style={{fontFamily:"Oswald",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:8}}>📋 Matchs de référence</p>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {matches.map(m=>{
              const w=parseInt(m.score_nous)>parseInt(m.score_eux);
              return <button key={m.id} className={`btn ${selectedMatches.has(m.id)?"btn-accent":"btn-ghost"}`} style={{fontSize:11,padding:"5px 10px",justifyContent:"flex-start",gap:8}} onClick={()=>toggleM(m.id)}>
                <span>{m.date}</span><span>vs {m.adversaire}</span>
                <span className={`badge ${w?"b-green":"b-red"}`} style={{marginLeft:"auto"}}>{m.score_nous}-{m.score_eux}</span>
              </button>;
            })}
          </div>
        </div>}

        <button className="btn btn-accent" style={{width:"100%",marginTop:14}} onClick={generate} disabled={loading||!adversaire}>{loading?"⏳ Génération...":"🎯 Générer le plan"}</button>
      </div>
      <div className="card">
        <div className="card-title">📋 Plan généré</div>
        {loading?<div className="ai-loading"><div className="spinner"/><span>Analyse...</span></div>
          :output?<>
            <div className="ai-output" style={{marginBottom:12}}>{output}</div>
            <button className="btn btn-accent" style={{width:"100%"}} onClick={savePlan} disabled={saving||saved}>
              {saved?"✅ Plan sauvegardé !":saving?"...":"💾 Sauvegarder ce plan"}
            </button>
          </>
          :<div className="ai-loading"><span>Le plan apparaîtra ici.</span></div>}
      </div>
    </div>
    {plansExistants.length>0 && <div style={{marginTop:24}}>
      <h3 style={{fontFamily:"Oswald",fontSize:16,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Plans sauvegardés <span style={{color:"var(--accent)"}}>({plansExistants.length})</span></h3>
      {plansExistants.map(p=><div key={p.id} className="card" style={{marginBottom:10}}>
        <div className="flex jc-sb items-c" style={{marginBottom:8}}>
          <div>
            <span style={{fontWeight:600}}>vs {p.adversaire}</span>
            <span className="muted" style={{marginLeft:8,fontSize:12}}>{p.created_at?.slice(0,10)}</span>
            <span className={`badge ${p.format==="court"?"b-yellow":"b-blue"}`} style={{marginLeft:8}}>{p.format}</span>
          </div>
          <button className="btn btn-danger" style={{padding:"3px 10px"}} onClick={()=>delPlan(p.id)}>✕</button>
        </div>
        <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,whiteSpace:"pre-wrap",maxHeight:200,overflow:"hidden",maskImage:"linear-gradient(to bottom, black 60%, transparent 100%)"}}>{p.contenu}</div>
        <button className="btn btn-ghost" style={{marginTop:8,fontSize:11}} onClick={()=>setOutput(p.contenu)}>Afficher en entier</button>
      </div>)}
    </div>}
  </div>;
}

/* ─── TRAINING ─── */
function TrainingPage({ club, saison, joueuses, evals, calendrier, matches, initContext }) {
  const today = new Date().toISOString().split("T")[0];
  const next = calendrier.find(e=>e.type==="match"&&e.date>=today);
  const calEvent = initContext?.calendrierEvent || null;
  const nbEntr = calendrier.filter(e=>e.type==="entrainement"&&e.date>=today&&(!next||e.date<=next.date)).length;
  const [focus, setFocus] = useState(initContext?.focus || "");
  const [duree, setDuree] = useState("90");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plansExistants, setPlansExistants] = useState([]);
  const [selectedJoueuses, setSelectedJoueuses] = useState(() => new Set(joueuses.map(j=>j.id)));
  const [renforts, setRenforts] = useState("");
  const [selectedMatches, setSelectedMatches] = useState(() => new Set((matches||[]).slice(0,4).map(m=>m.id)));
  const [showSelections, setShowSelections] = useState(false);

  useEffect(()=>{ loadPlans(); },[saison.id]);
  useEffect(()=>{ setSelectedJoueuses(new Set(joueuses.map(j=>j.id))); },[joueuses]);
  useEffect(()=>{ setSelectedMatches(new Set((matches||[]).slice(0,4).map(m=>m.id))); },[matches]);

  const loadPlans = async () => setPlansExistants((await db.getPlansEntr(saison.id))||[]);
  const toggleJ = id => setSelectedJoueuses(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleM = id => setSelectedMatches(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });

  const generate = async () => {
    setLoading(true); setOutput(""); setSaved(false);
    const joueusesDispo = joueuses.filter(j=>selectedJoueuses.has(j.id));
    const p = joueusesDispo.map(j=>{ const ev=evals.find(e=>e.joueuse_id===j.id); return `${j.prenom} (${ev?.poste||"?"}) Tir:${ev?.tir||3} Déf:${ev?.defense||3}. ${ev?.notes||j.notes_globales||""}`; }).join("\n");
    const renfLine = renforts.trim() ? `\nRENFORTS: ${renforts}` : "";
    const matchesSel = (matches||[]).filter(m=>selectedMatches.has(m.id));
    const mCtx = matchesSel.length ? `\nHISTORIQUE SÉLECTIONNÉ:\n${matchesSel.map(ma=>`${ma.date} vs ${ma.adversaire} ${parseInt(ma.score_nous)>parseInt(ma.score_eux)?"V":"D"} ${ma.score_nous}-${ma.score_eux} | ${ma.mon_attaque?.slice(0,60)||"–"}`).join("\n")}` : "";
    try {
      const prompt = `Tu es assistant coach basket. Plan d'entraînement adapté.\n\nCONTEXTE: ${saison.equipe} | ${saison.division} | ${club.contexte||""}\nJOUEUSES PRÉSENTES:\n${p||"Non renseigné"}${renfLine}${mCtx}\nFOCUS: ${focus||"Travail général équilibré"}\nDURÉE: ${duree} minutes\n${next?`PROCHAIN MATCH: vs ${next.adversaire} le ${next.date} (${nbEntr} entraînement${nbEntr>1?"s":""} disponible${nbEntr>1?"s":""})`:"Aucun match imminent — travail de fond possible"}\n${calEvent?`CET ENTRAÎNEMENT est le ${calEvent.date} ${calEvent.heure}`:""}\n\nFormat: Échauffement → Exercices techniques (durée + consignes) → Situation de jeu → Retour au calme. Très opérationnel, adapté au niveau.`;
      setOutput(await askClaude(null, [{role:"user",content:prompt}]));
    } catch(e) { setOutput(`Erreur: ${e.message}`); }
    setLoading(false);
  };

  const savePlan = async () => {
    if (!output) return; setSaving(true);
    try { await db.createPlanEntr({ id:uid(), club_id:club.id, saison_id:saison.id, calendrier_id:calEvent?.id||null, focus:focus||"Général", duree, contenu:output }); await loadPlans(); setSaved(true); }
    catch(e) { alert(e.message); }
    setSaving(false);
  };
  const delPlan = async id => { await db.deletePlanEntr(id); await loadPlans(); };

  return <div>
    <h2 className="page-title">Plan <span>d'entraînement</span></h2>
    {calEvent && <div className="card" style={{borderColor:"var(--blue)",background:"var(--blue-dim)",marginBottom:16,padding:14}}>
      <p style={{fontSize:11,color:"var(--muted)"}}>📅 Entraînement du {calEvent.date} {calEvent.heure}</p>
      {next && <p style={{fontSize:13,color:"var(--muted)",marginTop:4}}>Prochain match : vs {next.adversaire} le {next.date} · {nbEntr} séance{nbEntr>1?"s":""} disponible{nbEntr>1?"s":""}</p>}
    </div>}
    {!calEvent && next && <div className="card" style={{borderColor:"var(--blue)",background:"var(--blue-dim)",marginBottom:16,padding:14}}>
      <p style={{fontSize:11,color:"var(--muted)"}}>🔜 Prépare le match vs {next.adversaire} — {next.date}</p>
      <p style={{fontSize:13,color:"var(--muted)",marginTop:2}}>{nbEntr} entraînement{nbEntr>1?"s":""} disponible{nbEntr>1?"s":""} avant le match</p>
    </div>}
    <div className="grid2">
      <div className="card">
        <div className="card-title">⚙️ Paramètres</div>
        <div className="field"><label>Focus de séance</label><input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="Ex: Défense zone, tirs transition, PNR..."/></div>
        <div className="field"><label>Durée</label><select value={duree} onChange={e=>setDuree(e.target.value)}>{["60","75","90","105","120"].map(d=><option key={d} value={d}>{d} min</option>)}</select></div>

        <button className="btn btn-ghost" style={{width:"100%",marginTop:8,fontSize:11}} onClick={()=>setShowSelections(s=>!s)}>
          {showSelections?"▲":"▼"} Joueuses présentes & historique ({selectedJoueuses.size}/{joueuses.length})
        </button>
        {showSelections && <div style={{marginTop:12}}>
          <p style={{fontFamily:"Oswald",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:8}}>👥 Joueuses présentes</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {joueuses.map(j=><button key={j.id} className={`btn ${selectedJoueuses.has(j.id)?"btn-accent":"btn-ghost"}`} style={{fontSize:11,padding:"4px 10px"}} onClick={()=>toggleJ(j.id)}>
              #{j.numero} {j.prenom}
            </button>)}
          </div>
          <div className="field"><label>Renforts extérieurs</label><input value={renforts} onChange={e=>setRenforts(e.target.value)} placeholder="Ex: Julie (pivot, U18A)"/></div>
          {(matches||[]).length>0 && <>
            <p style={{fontFamily:"Oswald",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginBottom:8}}>📋 Matchs de référence</p>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {(matches||[]).map(m=>{
                const w=parseInt(m.score_nous)>parseInt(m.score_eux);
                return <button key={m.id} className={`btn ${selectedMatches.has(m.id)?"btn-accent":"btn-ghost"}`} style={{fontSize:11,padding:"5px 10px",justifyContent:"flex-start",gap:8}} onClick={()=>toggleM(m.id)}>
                  <span>{m.date}</span><span>vs {m.adversaire}</span>
                  <span className={`badge ${w?"b-green":"b-red"}`} style={{marginLeft:"auto"}}>{m.score_nous}-{m.score_eux}</span>
                </button>;
              })}
            </div>
          </>}
        </div>}

        <button className="btn btn-accent" style={{width:"100%",marginTop:14}} onClick={generate} disabled={loading}>{loading?"⏳...":"⚡ Générer l'entraînement"}</button>
      </div>
      <div className="card">
        <div className="card-title">📋 Plan généré</div>
        {loading?<div className="ai-loading"><div className="spinner"/><span>Génération...</span></div>
          :output?<>
            <div className="ai-output" style={{marginBottom:12}}>{output}</div>
            <button className="btn btn-accent" style={{width:"100%"}} onClick={savePlan} disabled={saving||saved}>
              {saved?"✅ Plan sauvegardé !":saving?"...":"💾 Sauvegarder ce plan"}
            </button>
          </>
          :<div className="ai-loading"><span>Le plan apparaîtra ici.</span></div>}
      </div>
    </div>
    {plansExistants.length>0 && <div style={{marginTop:24}}>
      <h3 style={{fontFamily:"Oswald",fontSize:16,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Plans sauvegardés <span style={{color:"var(--accent)"}}>({plansExistants.length})</span></h3>
      {plansExistants.map(p=><div key={p.id} className="card" style={{marginBottom:10}}>
        <div className="flex jc-sb items-c" style={{marginBottom:8}}>
          <div><span style={{fontWeight:600}}>{p.focus}</span><span className="muted" style={{marginLeft:8,fontSize:12}}>{p.created_at?.slice(0,10)} · {p.duree}min</span></div>
          <button className="btn btn-danger" style={{padding:"3px 10px"}} onClick={()=>delPlan(p.id)}>✕</button>
        </div>
        <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,whiteSpace:"pre-wrap",maxHeight:200,overflow:"hidden",maskImage:"linear-gradient(to bottom, black 60%, transparent 100%)"}}>{p.contenu}</div>
        <button className="btn btn-ghost" style={{marginTop:8,fontSize:11}} onClick={()=>setOutput(p.contenu)}>Afficher en entier</button>
      </div>)}
    </div>}
  </div>;
}

/* ─── SPARRING ─── */
function SparringPage({ club, saison, joueuses, evals, matches, chatHistory, reloadChat, coachName, allMatches }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const STARTERS = ["Challenge ma compo de départ pour le prochain match","Est-ce que je sur-utilise certaines joueuses ?","Qu'est-ce que mes stats révèlent que je ne vois pas ?","Comment gérer une joueuse qui perd confiance ?","Ma défense est-elle adaptée à mon effectif ?","Qu'est-ce que je devrais travailler en priorité ?"];
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[chatHistory,loading]);

  const send = async msg => {
    if (!msg.trim()||loading) return;
    setInput(""); setLoading(true);
    try { await db.addChat({ club_id:club.id, saison_id:saison.id, role:"user", content:msg.trim(), coach:coachName }); await reloadChat(); } catch {}
    const p = joueuses.map(j=>{ const ev=evals.find(e=>e.joueuse_id===j.id); return `${j.prenom} ${j.nom} (#${j.numero}, ${ev?.poste||"?"}) Tir:${ev?.tir||3} Déf:${ev?.defense||3} Phys:${ev?.physique||3} Mental:${ev?.mental||3}. ${j.notes_globales||""} ${ev?.notes||""}`; }).join("\n");
    const m = matches.slice(0,8).map(ma=>`${ma.date||"–"} vs ${ma.adversaire}: ${parseInt(ma.score_nous)>parseInt(ma.score_eux)?"V":"D"} ${ma.score_nous}-${ma.score_eux}\nAtt: ${ma.mon_attaque||"–"} | Déf: ${ma.ma_defense||"–"}`).join("\n\n");
    const prev = allMatches?.filter(ma=>ma.saison_id!==saison.id).slice(0,8).map(ma=>`[Saison préc.] ${ma.date} vs ${ma.adversaire}: ${ma.score_nous}-${ma.score_eux}`).join("\n")||"";
    const sys = `Tu es un sparring partner exigeant pour un coach basket. Challenge ses décisions, ne les valide pas. Avocat du diable bienveillant.

RÈGLES: Ne valide jamais sans questionner. Identifie angles morts et biais. Adapte au niveau U15. Direct, inconfortable si nécessaire, constructif. Exploite l'historique inter-saisons.

CLUB: ${coachName} | ${club.name} | ${saison.equipe} ${saison.nom} | ${saison.division} | ${saison.seances_par_semaine} séances/sem
CONTEXTE: ${club.contexte||"Non renseigné"}
EFFECTIF:\n${p||"Non renseigné"}
MATCHS SAISON:\n${m||"Aucun"}
${prev?`HISTORIQUE SAISONS PRÉCÉDENTES:\n${prev}`:""}`;
    const msgs = [...chatHistory.map(h=>({role:h.role,content:h.content})), {role:"user",content:msg.trim()}];
    try {
      const reply = await askClaude(sys, msgs, 1500);
      await db.addChat({ club_id:club.id, saison_id:saison.id, role:"assistant", content:reply });
    } catch(e) { await db.addChat({ club_id:club.id, saison_id:saison.id, role:"assistant", content:`Erreur: ${e.message}` }); }
    await reloadChat(); setLoading(false);
  };

  return <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 52px - 60px)",gap:0}}>
    <h2 className="page-title" style={{marginBottom:16}}>Sparring <span>Partner</span></h2>
    <div className="sparring-wrap">
      <div className="sparring-header">
        <div className="sparring-avatar">🧠</div>
        <div><div className="sparring-name">Cortex</div><div className="sparring-desc">Je challenge, je questionne — pour que tu coaches mieux.</div></div>
        <div className="sparring-status"><span className="dot"/><span>Actif</span></div>
        {chatHistory.length>0 && <button className="btn btn-ghost" style={{marginLeft:8,fontSize:10,padding:"4px 10px"}} onClick={async()=>{await db.clearChat(saison.id);await reloadChat();}}>Effacer</button>}
      </div>
      <div className="chat-messages">
        {chatHistory.length===0 && <div style={{textAlign:"center",padding:"20px 0"}}>
          <p style={{fontFamily:"'Lora',serif",fontStyle:"italic",color:"var(--muted)",fontSize:14,marginBottom:6}}>"Le meilleur coach n'est pas celui qui a toutes les réponses,<br/>mais celui qui pose les bonnes questions."</p>
          <p style={{fontSize:12,color:"var(--border)"}}>— Cortex</p>
        </div>}
        {chatHistory.map((h,i)=><div key={i} className={`msg ${h.role==="user"?"user":"bot"}`}>
          <div className="msg-avatar">{h.role==="user"?"👤":"🧠"}</div>
          <div className="msg-bubble">{h.content}</div>
        </div>)}
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

/* ─── ROOT ─── */
export default function App() {
  const [session, setSessionState] = useState(()=>getSession());
  const [club, setClub] = useState(null);
  const [saison, setSaison] = useState(null);
  const [saisons, setSaisons] = useState([]);
  const [joueuses, setJoueuses] = useState([]);
  const [evals, setEvals] = useState([]);
  const [matches, setMatches] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [calendrier, setCalendrier] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState("sparring");
  const [navCtx, setNavCtx] = useState(null);
  const [showSaisonModal, setShowSaisonModal] = useState(false);

  const navigate = (targetPage, ctx = null) => {
    setNavCtx(ctx);
    setPage(targetPage);
  };

  const loadSaisonData = async (clubId, saisonId) => {
    const [j,ev,m,am,cal,ch] = await Promise.all([db.getJoueuses(clubId), db.getEvals(saisonId), db.getMatches(saisonId), db.getAllMatches(clubId), db.getCalendrier(saisonId), db.getChat(saisonId)]);
    setJoueuses(j||[]); setEvals(ev||[]); setMatches(m||[]); setAllMatches(am||[]); setCalendrier(cal||[]); setChatHistory(ch||[]);
  };

  const loadAll = async sess => {
    if (!sess) { setReady(true); return; }
    try {
      const [c,ss] = await Promise.all([db.getClub(sess.clubId), db.getSaisons(sess.clubId)]);
      if (!c) { saveSession(null); setSessionState(null); setReady(true); return; }
      setClub(c); setSaisons(ss||[]);
      const sid = sess.saisonId || ss?.find(s=>s.active)?.id || ss?.[0]?.id;
      if (!sid) { setReady(true); return; }
      setSaison(ss?.find(s=>s.id===sid)||null);
      await loadSaisonData(sess.clubId, sid);
    } catch(e) { console.error(e); }
    setReady(true);
  };

  useEffect(()=>{ loadAll(session); },[]);

  const switchSaison = async sid => {
    const s = saisons.find(x=>x.id===sid); setSaison(s);
    const newSess = {...session, saisonId:sid}; setSessionState(newSess); saveSession(newSess);
    await loadSaisonData(session.clubId, sid);
  };

  const reloadJ = async () => { setJoueuses((await db.getJoueuses(session.clubId))||[]); setEvals((await db.getEvals(saison.id))||[]); };
  const reloadM = async () => setMatches((await db.getMatches(saison.id))||[]);
  const reloadCal = async () => setCalendrier((await db.getCalendrier(saison.id))||[]);
  const reloadChat = async () => setChatHistory((await db.getChat(saison.id))||[]);

  const logout = () => { saveSession(null); setSessionState(null); setClub(null); setSaison(null); setReady(true); };
  const onAuth = async sess => { setSessionState(sess); await loadAll(sess); };

  const NAV = [
    { group:"IA", items:[{id:"sparring",icon:"🧠",label:"Sparring Partner"},{id:"gameplan",icon:"🎯",label:"Plan de match"},{id:"training",icon:"⚡",label:"Entraînement"}]},
    { group:"Saison", items:[{id:"calendrier",icon:"📅",label:"Calendrier"},{id:"joueuses",icon:"👥",label:"Effectif"},{id:"matchs",icon:"📋",label:"Matchs"}]},
  ];
  const FLAT_NAV = NAV.flatMap(g=>g.items);

  if (!ready) return (<><style>{CSS}</style><div className="court-bg"/><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}><div className="spinner" style={{width:24,height:24}}/><p style={{color:"var(--muted)",fontFamily:"Oswald",letterSpacing:2,textTransform:"uppercase",fontSize:12}}>Chargement...</p></div></>);
  if (!session||!club||!saison) return (<><style>{CSS}</style><div className="court-bg"/><AuthPage onAuth={onAuth}/></>);

  return (<><style>{CSS}</style><div className="court-bg"/>
    <div className="app">
      <header className="header">
        <div className="logo">Coach<em>Club</em> 🏀</div>
        <div className="header-right">
          <span className="club-badge">{club.name}</span>
          <span className="saison-badge" onClick={()=>setShowSaisonModal(true)}>{saison.equipe} {saison.nom}</span>
          <span style={{fontSize:12,color:"var(--muted)"}}>👤 {session.coachName}</span>
          <button className="btn btn-ghost" style={{fontSize:11,padding:"5px 12px"}} onClick={logout}>⏏</button>
        </div>
      </header>
      <div className="main">
        <aside className="sidebar">
          {NAV.map(g=><div key={g.group} className="nav-group">
            <div className="nav-label">{g.group}</div>
            {g.items.map(item=><div key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={()=>navigate(item.id)}><span className="ni">{item.icon}</span>{item.label}</div>)}
          </div>)}
          <div style={{padding:"0 12px"}}><div style={{fontSize:11,color:"var(--muted)",lineHeight:1.6,padding:"10px 6px",borderTop:"1px solid var(--border)"}}><div>{joueuses.length} joueuses</div><div>{matches.length} matchs</div><div>{saison.seances_par_semaine} séances/sem</div></div></div>
        </aside>
        <main className="content">
          {page==="sparring" && <SparringPage club={club} saison={saison} joueuses={joueuses} evals={evals} matches={matches} chatHistory={chatHistory} reloadChat={reloadChat} coachName={session.coachName} allMatches={allMatches}/>}
          {page==="gameplan" && <GamePlanPage club={club} saison={saison} joueuses={joueuses} evals={evals} matches={matches} calendrier={calendrier} initContext={navCtx}/>}
          {page==="training" && <TrainingPage club={club} saison={saison} joueuses={joueuses} evals={evals} calendrier={calendrier} matches={matches} initContext={navCtx}/>}
          {page==="calendrier" && <CalendrierPage club={club} saison={saison} calendrier={calendrier} matches={matches} reload={reloadCal} onNavigate={navigate}/>}
          {page==="joueuses" && <JoueusesPage club={club} saison={saison} joueuses={joueuses} evals={evals} reload={reloadJ} statsSaison={statsSaison} matches={matches}/>}
          {page==="matchs" && <MatchsPage club={club} saison={saison} joueuses={joueuses} matches={matches} reload={reloadM}/>}
        </main>
      </div>
      <nav className="bottom-nav"><div className="bottom-nav-inner">
        {FLAT_NAV.map(item=><button key={item.id} className={`bnav-item ${page===item.id?"active":""}`} onClick={()=>navigate(item.id)}>
          <span className="bnav-icon">{item.icon}</span>
          <span className="bnav-label">{item.label==="Sparring Partner"?"Cortex":item.label==="Plan de match"?"Match":item.label==="Entraînement"?"Training":item.label}</span>
        </button>)}
        <button className="bnav-item" onClick={logout}><span className="bnav-icon">⏏</span><span className="bnav-label">Quitter</span></button>
      </div></nav>
    </div>
    {showSaisonModal && <SaisonModal club={club} saisons={saisons} currentSaisonId={saison.id} onSelect={switchSaison} onClose={()=>setShowSaisonModal(false)} onNewSaison={async id=>{const ss=await db.getSaisons(club.id);setSaisons(ss);await switchSaison(id);}}/>}
  </>);
}
