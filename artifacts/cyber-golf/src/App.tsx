import { useState, useEffect, useRef, useCallback } from 'react';
import { GameScene } from './components/GameScene';
import { LEVELS } from './game/levels';
import { GameState, Player, BallState, PLAYER_COLORS, PLAYER_COLOR_NAMES, ShadingMode } from './game/types';

const TOTAL_HOLES = LEVELS.length;

function initPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `P${i + 1}`,
    color: PLAYER_COLORS[i],
    strokes: Array(TOTAL_HOLES).fill(0),
    totalStrokes: 0,
    finished: false,
    ballInHole: false,
  }));
}

function initBalls(players: Player[], teePos: [number, number, number]): BallState[] {
  return players.map((p, i) => ({
    position: [
      teePos[0] + (i % 2 === 0 ? -0.3 : 0.3) * Math.floor(i / 2 + 1),
      teePos[1] + 0.3,
      teePos[2] + (i % 2 === 0 ? 0.3 : -0.3) * Math.floor(i / 2 + 1),
    ] as [number, number, number],
    velocity: [0, 0, 0] as [number, number, number],
    isMoving: false,
    isInHole: false,
    playerId: p.id,
  }));
}

// ---- Start Screen ----
function StartScreen({ onStart }: { onStart: (playerCount: number, shading: ShadingMode) => void }) {
  const [count, setCount] = useState(2);
  const [shading, setShading] = useState<ShadingMode>('phong');

  return (
    <div className="overlay">
      <h1>CYBER-GOLF</h1>
      <div className="subtitle">MULTI · DIMENSION</div>

      <div className="player-setup">
        <div className="player-count-row">
          <span className="count-label">Players</span>
          <button className="count-btn" onClick={() => setCount(c => Math.max(2, c - 1))}>−</button>
          <span className="count-value">{count}</span>
          <button className="count-btn" onClick={() => setCount(c => Math.min(8, c + 1))}>+</button>
        </div>

        <div>
          <div className="count-label" style={{ marginBottom: 8, textAlign: 'center' }}>Shading Mode</div>
          <div className="shading-row">
            <button
              className={`shading-btn ${shading === 'gouraud' ? 'active' : ''}`}
              onClick={() => setShading('gouraud')}
            >
              Gouraud
            </button>
            <button
              className={`shading-btn ${shading === 'phong' ? 'active' : ''}`}
              onClick={() => setShading('phong')}
            >
              Phong
            </button>
          </div>
        </div>
      </div>

      <button className="btn" onClick={() => onStart(count, shading)}>
        INICIAR JUEGO
      </button>

      <div style={{ marginTop: 32, fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', textAlign: 'center', maxWidth: 320 }}>
        CONTROLES: CLICK Y ARRASTRA para apuntar · BARRA ESPACIADORA para disparar · RUEDA para ajustar potencia
      </div>
    </div>
  );
}

// ---- Scoreboard ----
function Scoreboard({ players, onRestart }: { players: Player[]; onRestart: () => void }) {
  const sorted = [...players].sort((a, b) => a.totalStrokes - b.totalStrokes);

  return (
    <div className="scoreboard-overlay">
      <h1 style={{ fontSize: 'clamp(20px,4vw,36px)', letterSpacing: 4, color: '#00f5ff', textShadow: '0 0 20px #00f5ff' }}>
        TABLA FINAL
      </h1>
      <table className="scoreboard-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Jugador</th>
            {LEVELS.map((l, i) => <th key={i}>H{i + 1}<br /><span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>par {l.par}</span></th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, pos) => (
            <tr key={p.id} className={pos === 0 ? 'winner-row' : ''}>
              <td style={{ color: pos === 0 ? '#39ff14' : 'rgba(255,255,255,0.7)' }}>{pos + 1}</td>
              <td style={{ color: p.color, textShadow: `0 0 8px ${p.color}` }}>{p.name}</td>
              {p.strokes.map((s, i) => {
                const par = LEVELS[i].par;
                const diff = s - par;
                const color = s === 0 ? 'rgba(255,255,255,0.3)'
                  : diff < -1 ? '#ff6600'
                  : diff === -1 ? '#39ff14'
                  : diff === 0 ? '#ffffff'
                  : diff === 1 ? '#ff3333'
                  : '#ff0000';
                return <td key={i} style={{ color }}>{s || '-'}</td>;
              })}
              <td style={{ fontWeight: 'bold', color: pos === 0 ? '#39ff14' : 'white' }}>{p.totalStrokes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn" onClick={onRestart}>JUGAR DE NUEVO</button>
    </div>
  );
}

// ---- HUD ----
function HUD({
  players, currentHole, activeBallIdx, shadingMode,
  aimAngle, setAimAngle, aimPower, setAimPower,
  onShoot, onRotateLevel, levelRotation, allBallsStopped,
  showRotateHint,
}: {
  players: Player[];
  currentHole: number;
  activeBallIdx: number;
  shadingMode: ShadingMode;
  aimAngle: number;
  setAimAngle: (v: number) => void;
  aimPower: number;
  setAimPower: (v: number) => void;
  onShoot: () => void;
  onRotateLevel: () => void;
  levelRotation: number;
  allBallsStopped: boolean;
  showRotateHint: boolean;
}) {
  const level = LEVELS[currentHole];
  const activePlayer = players[activeBallIdx];

  return (
    <>
      {/* Top HUD */}
      <div className="hud">
        <div className="hud-inner">
          <div className="hud-panel">
            <div className="game-title" style={{ marginBottom: 8 }}>⬡ CYBER-GOLF</div>
            <div className="score-grid">
              {players.map((p, i) => (
                <div
                  key={p.id}
                  className={`player-score ${i === activeBallIdx ? 'active' : ''}`}
                  style={{ color: p.color }}
                >
                  <span className="player-name">{p.name}</span>
                  <span className="player-strokes">{p.strokes[currentHole] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hud-panel info-panel">
            <div className="hole-info">HOYO {currentHole + 1} / {TOTAL_HOLES}</div>
            <div className="hole-info" style={{ color: '#bf00ff', fontSize: 10, marginTop: 2 }}>{level.name}</div>
            <div className="physics-mode">PAR {level.par} · {level.physicsMode.toUpperCase()}</div>
            <div className="physics-mode" style={{ marginTop: 2 }}>
              SHADING: <span style={{ color: shadingMode === 'phong' ? '#39ff14' : '#ff6600' }}>
                {shadingMode.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Aim controls */}
      {allBallsStopped && activePlayer && !activePlayer.ballInHole && (
        <div className="aim-hud">
          <div className="turn-label" style={{ color: activePlayer.color, textShadow: `0 0 10px ${activePlayer.color}` }}>
            TURNO DE {activePlayer.name}
          </div>

          <div className="aim-bar-wrap">
            <div className="aim-label">Ángulo (← →)</div>
            <input
              type="range"
              min={0} max={360} step={1}
              value={(aimAngle * 180 / Math.PI + 360) % 360}
              onChange={e => setAimAngle((Number(e.target.value) * Math.PI / 180))}
              style={{ width: '100%', accentColor: activePlayer.color }}
            />
          </div>

          <div className="aim-bar-wrap">
            <div className="aim-label">Potencia · {Math.round(aimPower * 100)}%</div>
            <div className="power-bar-bg">
              <div
                className="power-bar-fill"
                style={{
                  width: `${aimPower * 100}%`,
                  background: `linear-gradient(90deg, ${activePlayer.color}, #ffffff)`,
                }}
              />
            </div>
            <input
              type="range"
              min={0} max={100} step={1}
              value={aimPower * 100}
              onChange={e => setAimPower(Number(e.target.value) / 100)}
              style={{ width: '100%', marginTop: 4, accentColor: activePlayer.color }}
            />
          </div>

          <button
            className="btn"
            onClick={onShoot}
            style={{ borderColor: activePlayer.color, color: activePlayer.color, textShadow: `0 0 8px ${activePlayer.color}` }}
          >
            DISPARAR [SPACE]
          </button>
        </div>
      )}

      {/* Rotate level button */}
      <button className="rotate-btn" onClick={onRotateLevel} title="Rotar nivel 90°">
        ROTAR<br />NIVEL<br />↻
      </button>
    </>
  );
}

// ---- Main App ----
export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'scoreboard'>('menu');
  const [players, setPlayers] = useState<Player[]>([]);
  const [balls, setBalls] = useState<BallState[]>([]);
  const [currentHole, setCurrentHole] = useState(0);
  const [activeBallIdx, setActiveBallIdx] = useState(0);
  const [shadingMode, setShadingMode] = useState<ShadingMode>('phong');
  const [aimAngle, setAimAngle] = useState(0);
  const [aimPower, setAimPower] = useState(0.5);
  const [levelRotation, setLevelRotation] = useState(0);
  const [rotationText, setRotationText] = useState<string | null>(null);
  const [isAiming, setIsAiming] = useState(true);

  const level = LEVELS[currentHole];

  const allBallsStopped = balls.every(b => !b.isMoving || b.isInHole);

  const shoot = useCallback(() => {
    const ball = balls[activeBallIdx];
    if (!ball || ball.isMoving || ball.isInHole) return;

    const speed = 8 + aimPower * 14;
    const dx = Math.cos(aimAngle) * speed;
    const dz = Math.sin(aimAngle) * speed;

    setBalls(prev => prev.map((b, i) =>
      i === activeBallIdx
        ? { ...b, velocity: [dx, 2.5 + aimPower * 3, dz], isMoving: true }
        : b
    ));

    setPlayers(prev => prev.map((p, i) => {
      if (i !== activeBallIdx) return p;
      const newStrokes = [...p.strokes];
      newStrokes[currentHole] += 1;
      return { ...p, strokes: newStrokes, totalStrokes: p.totalStrokes + 1 };
    }));
  }, [balls, activeBallIdx, aimAngle, aimPower, currentHole]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.code === 'Space') { e.preventDefault(); shoot(); }
      if (e.code === 'ArrowLeft') setAimAngle(a => a - 0.05);
      if (e.code === 'ArrowRight') setAimAngle(a => a + 0.05);
      if (e.code === 'ArrowUp') setAimPower(p => Math.min(1, p + 0.05));
      if (e.code === 'ArrowDown') setAimPower(p => Math.max(0.05, p - 0.05));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, shoot]);

  const handleBallFinished = useCallback((playerIdx: number) => {
    setBalls(prev => prev.map((b, i) => i === playerIdx ? { ...b, isInHole: true, isMoving: false } : b));
    setPlayers(prev => prev.map((p, i) => i === playerIdx ? { ...p, ballInHole: true } : p));
  }, []);

  const handleBallFell = useCallback((playerIdx: number) => {
    // Penalty stroke
    setPlayers(prev => prev.map((p, i) => {
      if (i !== playerIdx) return p;
      const newStrokes = [...p.strokes];
      newStrokes[currentHole] += 1;
      return { ...p, strokes: newStrokes, totalStrokes: p.totalStrokes + 1 };
    }));
  }, [currentHole]);

  // Advance turn when all balls stopped
  useEffect(() => {
    if (!allBallsStopped || gameState !== 'playing') return;

    const activeBallsNotInHole = balls.filter(b => !b.isInHole);
    if (activeBallsNotInHole.length === 0) {
      // All in hole → next hole or end
      setTimeout(() => {
        if (currentHole + 1 >= TOTAL_HOLES) {
          setGameState('scoreboard');
        } else {
          const nextHole = currentHole + 1;
          setCurrentHole(nextHole);
          setLevelRotation(0);
          setBalls(initBalls(players, LEVELS[nextHole].teePosition));
          setPlayers(prev => prev.map(p => ({ ...p, ballInHole: false })));
          setActiveBallIdx(0);
        }
      }, 1500);
      return;
    }

    // Find next player that still has a ball not in hole
    let next = activeBallIdx;
    for (let i = 1; i <= balls.length; i++) {
      const idx = (activeBallIdx + i) % balls.length;
      if (!balls[idx].isInHole) {
        next = idx;
        break;
      }
    }
    if (next !== activeBallIdx) {
      setActiveBallIdx(next);
    }
  }, [allBallsStopped]);

  const rotateLevel = useCallback(() => {
    setLevelRotation(r => (r + 1) % 4);
    setRotationText('ROTANDO +90°');
    setTimeout(() => setRotationText(null), 1800);
  }, []);

  const startGame = (playerCount: number, shading: ShadingMode) => {
    const newPlayers = initPlayers(playerCount);
    setShadingMode(shading);
    setPlayers(newPlayers);
    setCurrentHole(0);
    setLevelRotation(0);
    setBalls(initBalls(newPlayers, LEVELS[0].teePosition));
    setActiveBallIdx(0);
    setGameState('playing');
  };

  const restartGame = () => {
    setPlayers([]);
    setBalls([]);
    setCurrentHole(0);
    setLevelRotation(0);
    setGameState('menu');
  };

  if (gameState === 'menu') {
    return <StartScreen onStart={startGame} />;
  }

  if (gameState === 'scoreboard') {
    return <Scoreboard players={players} onRestart={restartGame} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#050510' }}>
      <GameScene
        level={level}
        balls={balls}
        players={players}
        activeBallIdx={activeBallIdx}
        shadingMode={shadingMode}
        aimAngle={aimAngle}
        aimPower={aimPower}
        isAiming={isAiming && allBallsStopped}
        levelRotation={levelRotation}
        onBallFinished={handleBallFinished}
        onBallFell={handleBallFell}
        onStroke={() => {}}
        onUpdateBalls={setBalls}
      />

      <HUD
        players={players}
        currentHole={currentHole}
        activeBallIdx={activeBallIdx}
        shadingMode={shadingMode}
        aimAngle={aimAngle}
        setAimAngle={setAimAngle}
        aimPower={aimPower}
        setAimPower={setAimPower}
        onShoot={shoot}
        onRotateLevel={rotateLevel}
        levelRotation={levelRotation}
        allBallsStopped={allBallsStopped}
        showRotateHint={false}
      />

      {rotationText && (
        <div className="rotation-indicator">{rotationText}</div>
      )}
    </div>
  );
}
