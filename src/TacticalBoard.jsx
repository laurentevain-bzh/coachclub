import { useRef, useEffect, useState, useCallback } from "react";

/* ─── GRILLE 8×7 ─── */
// Colonnes A-H, Lignes 1-7
const COLS = ["A","B","C","D","E","F","G","H"];
const ROWS = [1,2,3,4,5,6,7];

// Convertit "D4" → coordonnées canvas relatives (0-1)
const gridToXY = (pos) => {
  if (!pos || pos.length < 2) return { x: 0.5, y: 0.5 };
  const col = COLS.indexOf(pos[0]);
  const row = parseInt(pos[1]) - 1;
  return {
    x: (col + 0.5) / 8,
    y: (row + 0.5) / 7,
  };
};

// Positions initiales des joueurs
const DEFAULT_ATTACK = [
  { label: "1", pos: "D4", team: "atk" },
  { label: "2", pos: "G2", team: "atk" },
  { label: "3", pos: "B2", team: "atk" },
  { label: "4", pos: "B6", team: "atk" },
  { label: "5", pos: "G6", team: "atk" },
];
const DEFAULT_DEFENSE = [
  { label: "D1", pos: "D2", team: "def" },
  { label: "D2", pos: "E2", team: "def" },
  { label: "D3", pos: "C3", team: "def" },
  { label: "D4", pos: "F3", team: "def" },
  { label: "D5", pos: "D5", team: "def" },
];

const FORMATIONS = {
  "2-1-2": [
    { label: "1", pos: "D4" }, { label: "2", pos: "G2" }, { label: "3", pos: "B2" },
    { label: "4", pos: "B5" }, { label: "5", pos: "G5" },
  ],
  "2-2-1": [
    { label: "1", pos: "C3" }, { label: "2", pos: "F3" }, { label: "3", pos: "B5" },
    { label: "4", pos: "G5" }, { label: "5", pos: "D6" },
  ],
  "1-3-1": [
    { label: "1", pos: "D4" }, { label: "2", pos: "B3" }, { label: "3", pos: "D2" },
    { label: "4", pos: "G3" }, { label: "5", pos: "D6" },
  ],
  "Zone 2-3": [
    { label: "D1", pos: "C2" }, { label: "D2", pos: "F2" }, { label: "D3", pos: "B4" },
    { label: "D4", pos: "D4" }, { label: "D5", pos: "G4" },
  ],
};

const CSS_BOARD = `
.tb-wrap{display:flex;flex-direction:column;height:100%;background:#111214;color:#eef0f5;font-family:'DM Sans',sans-serif;}
.tb-toolbar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#1a1c20;border-bottom:1px solid #2e3038;flex-wrap:wrap;}
.tb-btn{font-family:'Oswald',sans-serif;font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;padding:6px 14px;border-radius:2px;cursor:pointer;border:none;transition:all .15s;}
.tb-btn-accent{background:#e8f040;color:#111;}
.tb-btn-accent:hover{filter:brightness(1.08);}
.tb-btn-ghost{background:transparent;color:#686b7a;border:1px solid #2e3038;}
.tb-btn-ghost:hover{color:#eef0f5;border-color:#686b7a;}
.tb-btn-active{background:#2e3038;color:#e8f040;border:1px solid #e8f040;}
.tb-btn-danger{background:transparent;color:#ff4d4d;border:1px solid #ff4d4d33;}
.tb-btn-sparring{background:#a78bfa18;color:#a78bfa;border:1px solid #a78bfa;}
.tb-canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;position:relative;}
.tb-canvas{border-radius:4px;cursor:crosshair;touch-action:none;}
.tb-explanation{padding:10px 16px;background:#a78bfa18;border-top:1px solid #a78bfa;font-size:13px;font-family:'Lora',serif;font-style:italic;color:#a78bfa;line-height:1.5;}
.tb-schemes{padding:8px 14px;background:#1a1c20;border-top:1px solid #2e3038;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.tb-scheme-chip{font-size:11px;background:#21242a;border:1px solid #2e3038;color:#686b7a;padding:4px 10px;border-radius:2px;cursor:pointer;}
.tb-scheme-chip:hover{border-color:#e8f040;color:#eef0f5;}
.tb-sep{width:1px;height:20px;background:#2e3038;margin:0 4px;}
.tb-mode-label{font-size:10px;font-family:'Oswald',sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#686b7a;}
`;

export default function TacticalBoard({ initData, onClose, embedded = false }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [players, setPlayers] = useState(() => [
    ...DEFAULT_ATTACK.map(p => ({ ...p })),
    ...DEFAULT_DEFENSE.map(p => ({ ...p })),
  ]);
  const [ball, setBall] = useState("D4");
  const [arrows, setArrows] = useState([]);
  const [savedSchemes, setSavedSchemes] = useState([]);
  const [explanation, setExplanation] = useState("");
  const [mode, setMode] = useState("move"); // "move" | "arrow"
  const [dragging, setDragging] = useState(null); // { index, offsetX, offsetY }
  const [arrowStart, setArrowStart] = useState(null); // label or "ball"
  const [animating, setAnimating] = useState(false);
  const [animStep, setAnimStep] = useState(-1);
  const stateRef = useRef({ players, ball, arrows, mode, dragging, arrowStart });

  useEffect(() => { stateRef.current = { players, ball, arrows, mode, dragging, arrowStart }; });

  // Taille canvas responsive
  const [canvasSize, setCanvasSize] = useState({ w: 480, h: 400 });
  useEffect(() => {
    const update = () => {
      const wrap = canvasRef.current?.parentElement;
      if (!wrap) return;
      const maxW = wrap.clientWidth - 24;
      const maxH = wrap.clientHeight - 24;
      const ratio = 480 / 400;
      let w = Math.min(maxW, 600);
      let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      setCanvasSize({ w: Math.round(w), h: Math.round(h) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Init depuis Pop
  useEffect(() => {
    if (!initData) return;
    if (initData.reset) {
      if (initData.players) {
        const newPlayers = initData.players.map(p => ({
          label: p.label,
          pos: p.pos,
          team: p.label.startsWith("D") ? "def" : "atk",
        }));
        setPlayers(newPlayers);
      }
      if (initData.ball) setBall(initData.ball);
      setArrows(initData.arrows || []);
    }
    if (initData.explanation) setExplanation(initData.explanation);
    setAnimStep(-1);
    // Auto-play animation
    setTimeout(() => startAnimation(), 500);
  }, [initData]);

  // ─── DESSIN DU TERRAIN ───
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = canvasSize;
    canvas.width = w;
    canvas.height = h;

    const toXY = (pos) => {
      const p = gridToXY(pos);
      return { x: p.x * w, y: p.y * h };
    };

    // Fond parquet
    ctx.fillStyle = "#c8a96e";
    ctx.fillRect(0, 0, w, h);

    // Lames de parquet
    ctx.strokeStyle = "#b8996050";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < h; i += h / 20) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }

    // ─── TERRAIN ───
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;

    // Bordure terrain
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Ligne médiane (bas du demi-terrain)
    ctx.beginPath();
    ctx.moveTo(4, h - 4);
    ctx.lineTo(w - 4, h - 4);
    ctx.stroke();

    // Raquette (C1 à F3)
    const raq1 = toXY("C1");
    const raq2 = toXY("F1");
    const raq3 = toXY("F3");
    const raqW = raq2.x - raq1.x;
    const raqH = raq3.y - raq1.y;
    ctx.strokeRect(raq1.x, raq1.y, raqW, raqH);

    // Cercle lancer franc
    const lfCenter = toXY("D3");
    const lfR = (toXY("F3").x - toXY("C3").x) / 2;
    ctx.beginPath();
    ctx.arc(lfCenter.x + (toXY("E3").x - toXY("D3").x) / 2, lfCenter.y, lfR, 0, Math.PI * 2);
    ctx.stroke();

    // Ligne 3 points - grand arc centré sur milieu raquette, bombe vers le bas
    const basketX = (toXY("D1").x + toXY("E1").x) / 2;
    const basketY = toXY("D1").y;
    const arc3R = w * 0.42;
    ctx.beginPath();
    ctx.arc(basketX, basketY - h * 0.05, arc3R, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // Lignes latérales 3pts
    ctx.beginPath();
    ctx.moveTo(4, toXY("A3").y);
    ctx.lineTo(toXY("B3").x - 10, toXY("A3").y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - 4, toXY("H3").y);
    ctx.lineTo(toXY("G3").x + 10, toXY("H3").y);
    ctx.stroke();

    // Panier
    ctx.strokeStyle = "#ff8800";
    ctx.lineWidth = 3;
    const bkX = basketX;
    const bkY = basketY + h * 0.01;
    ctx.beginPath();
    ctx.arc(bkX, bkY, w * 0.025, 0, Math.PI * 2);
    ctx.stroke();

    // Planche
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bkX - w * 0.05, bkY - h * 0.02);
    ctx.lineTo(bkX + w * 0.05, bkY - h * 0.02);
    ctx.stroke();

    // ─── GRILLE (debug léger) ───
    ctx.strokeStyle = "#ffffff18";
    ctx.lineWidth = 0.5;
    COLS.forEach((c, i) => {
      const x = ((i + 0.5) / 8) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.fillStyle = "#ffffff33";
      ctx.font = `${Math.round(h * 0.025)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(c, x, h - 4);
    });
    ROWS.forEach((r, i) => {
      const y = ((i + 0.5) / 7) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillStyle = "#ffffff33";
      ctx.textAlign = "left";
      ctx.fillText(r, 4, y + 4);
    });

    // ─── FLÈCHES ───
    const { arrows: arrs, animStep: step } = stateRef.current;
    const visibleArrows = step >= 0 ? arrs.slice(0, step + 1) : arrs;
    visibleArrows.forEach((arr, i) => {
      const fromPos = stateRef.current.players.find(p => p.label === arr.from)?.pos || arr.from;
      const toPos = stateRef.current.players.find(p => p.label === arr.to)?.pos || arr.to;
      const from = gridToXY(fromPos === "ball" ? stateRef.current.ball : fromPos);
      const to = gridToXY(toPos);
      const fx = from.x * w, fy = from.y * h;
      const tx = to.x * w, ty = to.y * h;
      const color = arr.team === "def" ? "#ff6b6b" : "#4dff9a";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      // Tête de flèche
      const angle = Math.atan2(ty - fy, tx - fx);
      const hs = 10;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - hs * Math.cos(angle - 0.4), ty - hs * Math.sin(angle - 0.4));
      ctx.lineTo(tx - hs * Math.cos(angle + 0.4), ty - hs * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
      // Numéro
      const mx = (fx + tx) / 2, my = (fy + ty) / 2;
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = `bold ${Math.round(h * 0.028)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(i + 1, mx, my);
    });
    ctx.textBaseline = "alphabetic";

    // ─── JOUEURS ───
    stateRef.current.players.forEach(p => {
      const { x, y } = gridToXY(p.pos);
      const px = x * w, py = y * h;
      const r = Math.round(Math.min(w, h) * 0.042);
      const isAtk = p.team === "atk";
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = isAtk ? "#22c55e" : "#ef4444";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label, px, py);
    });
    ctx.textBaseline = "alphabetic";

    // ─── BALLON ───
    const ballPos = stateRef.current.ball;
    if (ballPos) {
      const { x, y } = gridToXY(ballPos);
      const bx = x * w, by = y * h;
      const br = Math.round(Math.min(w, h) * 0.03);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = "#f97316";
      ctx.fill();
      ctx.strokeStyle = "#7c3d12";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Lignes ballon
      ctx.strokeStyle = "#7c3d1280";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, br, -0.5, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx, by, br, Math.PI - 0.5, Math.PI + 0.5);
      ctx.stroke();
    }
  }, [canvasSize, players, ball, arrows, animStep]);

  useEffect(() => { draw(); }, [draw, players, ball, arrows, animStep, canvasSize]);

  // ─── ANIMATION ───
  const startAnimation = () => {
    if (arrows.length === 0) return;
    setAnimating(true);
    setAnimStep(-1);
    let step = 0;
    const next = () => {
      setAnimStep(step);
      if (step < arrows.length - 1) {
        step++;
        animRef.current = setTimeout(next, 900);
      } else {
        setTimeout(() => setAnimating(false), 600);
      }
    };
    animRef.current = setTimeout(next, 300);
  };
  useEffect(() => () => clearTimeout(animRef.current), []);

  // ─── EVENTS CANVAS ───
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const findPlayerAt = (rx, ry) => {
    const { players: pls } = stateRef.current;
    const r = 0.06;
    return pls.findIndex(p => {
      const g = gridToXY(p.pos);
      return Math.hypot(g.x - rx, g.y - ry) < r;
    });
  };

  const xyToGridPos = (rx, ry) => {
    const col = Math.max(0, Math.min(7, Math.round(rx * 8 - 0.5)));
    const row = Math.max(0, Math.min(6, Math.round(ry * 7 - 0.5)));
    return COLS[col] + (row + 1);
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    const { mode: m } = stateRef.current;
    if (m === "move") {
      const idx = findPlayerAt(x, y);
      if (idx >= 0) setDragging({ index: idx });
      // Drag ballon
      const ballG = gridToXY(stateRef.current.ball);
      if (Math.hypot(ballG.x - x, ballG.y - y) < 0.05) setDragging({ ball: true });
    } else if (m === "arrow") {
      const idx = findPlayerAt(x, y);
      if (idx >= 0) setArrowStart(stateRef.current.players[idx].label);
      else {
        const ballG = gridToXY(stateRef.current.ball);
        if (Math.hypot(ballG.x - x, ballG.y - y) < 0.05) setArrowStart("ball");
      }
    }
  };

  const onMouseMove = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    const { dragging: d } = stateRef.current;
    if (!d) return;
    const newPos = xyToGridPos(x, y);
    if (d.ball) { setBall(newPos); return; }
    if (d.index !== undefined) {
      setPlayers(pls => pls.map((p, i) => i === d.index ? { ...p, pos: newPos } : p));
    }
  };

  const onMouseUp = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    const { arrowStart: as, mode: m } = stateRef.current;
    if (m === "arrow" && as) {
      const idx = findPlayerAt(x, y);
      const toLabel = idx >= 0 ? stateRef.current.players[idx].label : xyToGridPos(x, y);
      if (toLabel !== as) {
        const fromPlayer = stateRef.current.players.find(p => p.label === as);
        setArrows(arr => [...arr, { from: as, to: toLabel, team: fromPlayer?.team || "atk" }]);
      }
      setArrowStart(null);
    }
    setDragging(null);
  };

  const reset = () => {
    setPlayers([...DEFAULT_ATTACK.map(p => ({ ...p })), ...DEFAULT_DEFENSE.map(p => ({ ...p }))]);
    setBall("D4");
    setArrows([]);
    setExplanation("");
    setAnimStep(-1);
  };

  const applyFormation = (name) => {
    const f = FORMATIONS[name];
    if (!f) return;
    const isDefFormation = name.startsWith("Zone");
    if (isDefFormation) {
      setPlayers(pls => [
        ...DEFAULT_ATTACK.map(p => ({ ...p })),
        ...f.map((p, i) => ({ ...p, team: "def" })),
      ]);
    } else {
      setPlayers(pls => [
        ...f.map(p => ({ ...p, team: "atk" })),
        ...DEFAULT_DEFENSE.map(p => ({ ...p })),
      ]);
    }
    setArrows([]);
    setAnimStep(-1);
  };

  const saveScheme = () => {
    const name = `Schéma ${savedSchemes.length + 1}`;
    setSavedSchemes(s => [...s, { name, players: [...players], ball, arrows }]);
  };

  const loadScheme = (s) => {
    setPlayers(s.players);
    setBall(s.ball);
    setArrows(s.arrows);
    setAnimStep(-1);
  };

  return (
    <>
      <style>{CSS_BOARD}</style>
      <div className="tb-wrap">
        {/* TOOLBAR */}
        <div className="tb-toolbar">
          {onClose && <button className="tb-btn tb-btn-ghost" onClick={onClose}>← Retour</button>}
          <span className="tb-sep"/>
          <span className="tb-mode-label">Mode :</span>
          <button className={`tb-btn ${mode === "move" ? "tb-btn-active" : "tb-btn-ghost"}`} onClick={() => setMode("move")}>✋ Déplacer</button>
          <button className={`tb-btn ${mode === "arrow" ? "tb-btn-active" : "tb-btn-ghost"}`} onClick={() => setMode("arrow")}>→ Flèche</button>
          <span className="tb-sep"/>
          <button className="tb-btn tb-btn-ghost" onClick={() => setArrows(a => a.slice(0, -1))}>↩ Annuler flèche</button>
          <button className="tb-btn tb-btn-ghost" onClick={reset}>🗑 Reset</button>
          <span className="tb-sep"/>
          {arrows.length > 0 && (
            <button className={`tb-btn tb-btn-sparring`} onClick={startAnimation} disabled={animating}>
              {animating ? "⏳ Animation..." : "▶ Animer"}
            </button>
          )}
          <button className="tb-btn tb-btn-accent" onClick={saveScheme}>💾 Sauvegarder</button>
        </div>

        {/* FORMATIONS */}
        <div className="tb-schemes">
          <span className="tb-mode-label">Formations :</span>
          {Object.keys(FORMATIONS).map(f => (
            <span key={f} className="tb-scheme-chip" onClick={() => applyFormation(f)}>{f}</span>
          ))}
          {savedSchemes.length > 0 && <>
            <span className="tb-sep"/>
            <span className="tb-mode-label">Sauvegardés :</span>
            {savedSchemes.map((s, i) => (
              <span key={i} className="tb-scheme-chip" onClick={() => loadScheme(s)}>📋 {s.name}</span>
            ))}
          </>}
        </div>

        {/* CANVAS */}
        <div className="tb-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="tb-canvas"
            width={canvasSize.w}
            height={canvasSize.h}
            style={{ width: canvasSize.w, height: canvasSize.h }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onTouchStart={onMouseDown}
            onTouchMove={onMouseMove}
            onTouchEnd={onMouseUp}
          />
        </div>

        {/* EXPLICATION POP */}
        {explanation && (
          <div className="tb-explanation">
            🧠 <strong>Pop :</strong> {explanation}
          </div>
        )}
      </div>
    </>
  );
}
