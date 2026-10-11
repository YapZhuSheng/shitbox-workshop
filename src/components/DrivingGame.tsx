import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { DrivingScene } from '../game/DrivingScene';
import { drivingData } from '../game/drivingData';
import type { OwnedCar, DrivingStats } from '../types';

interface DrivingGameProps {
  ownedCar: OwnedCar | null;
  onFinish: (time: number, completed: boolean, checkpoints: number) => void;
  isPractice: boolean;
  isRaining: boolean;
}

export function DrivingGame({ ownedCar, onFinish, isPractice, isRaining }: DrivingGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DrivingScene | null>(null);
  const [stats, setStats] = useState<DrivingStats>({
    speed: 0,
    temperature: 40,
    lapTime: 0,
    checkpointIndex: 0,
    totalCheckpoints: 7,
    gearSlipping: false,
    overheating: false,
    lowGrip: false,
    weakBrakes: false,
    unstableCornering: false
  });
  const [paused, setPaused] = useState(false);
  const finishedRef = useRef(false);

  const handleStatsUpdate = useCallback((newStats: any) => {
    setStats(prev => ({ ...prev, ...newStats }));
    if (newStats.paused !== undefined) setPaused(newStats.paused);
  }, []);

  const handleFinish = useCallback((time: number, completed: boolean, checkpoints: number) => {
    if (!finishedRef.current) {
      finishedRef.current = true;
      onFinish(time, completed, checkpoints);
    }
  }, [onFinish]);

  // Set driving data before creating game
  useEffect(() => {
    drivingData.ownedCar = ownedCar;
    drivingData.onStatsUpdate = handleStatsUpdate;
    drivingData.onFinish = handleFinish;
    drivingData.isRaining = isRaining;
  }, [ownedCar, handleStatsUpdate, handleFinish, isRaining]);

  useEffect(() => {
    if (!containerRef.current) return;
    finishedRef.current = false;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: '#1a2a1a',
      scene: DrivingScene,
      fps: { target: 60, forceSetTimeOut: false },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      input: {
        keyboard: true,
        touch: true
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Get scene reference once game is ready
    game.events.once('ready', () => {
      const scene = game.scene.getScene('DrivingScene') as DrivingScene;
      sceneRef.current = scene;
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Handle R key for restart
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (sceneRef.current && !paused) {
          sceneRef.current.restart();
          finishedRef.current = false;
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [paused]);

  const handleRestart = () => {
    if (sceneRef.current) {
      sceneRef.current.restart();
      finishedRef.current = false;
    }
  };

  const handleRecover = () => {
    if (sceneRef.current) {
      sceneRef.current.recoverCar();
    }
  };

  const handlePause = () => {
    if (sceneRef.current) {
      sceneRef.current.isPaused = !sceneRef.current.isPaused;
      setPaused(sceneRef.current.isPaused);
    }
  };

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* HUD */}
      <div className="hud">
        <div className="hud-left">
          <div className="hud-item">
            <label>Speed</label>
            <div className="value">{stats.speed} km/h</div>
          </div>
          <div className={`hud-item ${stats.overheating ? 'warning' : ''}`}>
            <label>Temp</label>
            <div className="value">{stats.temperature}°C</div>
          </div>
          <div className="hud-item">
            <label>Time</label>
            <div className="value">{formatTime(stats.lapTime)}</div>
          </div>
        </div>
        <div className="hud-right">
          <div className="hud-item">
            <label>Checkpoint</label>
            <div className="value">{stats.checkpointIndex}/{stats.totalCheckpoints}</div>
          </div>
          {isPractice && (
            <div className="hud-item">
              <label>Mode</label>
              <div className="value" style={{ color: 'var(--teal)', fontSize: 12 }}>PRACTICE</div>
            </div>
          )}
          {isRaining && (
            <div className="hud-item warning">
              <label>Weather</label>
              <div className="value" style={{ fontSize: 12 }}>RAIN</div>
            </div>
          )}
        </div>
      </div>

      {/* Fault warnings */}
      <div className="fault-warnings">
        {stats.gearSlipping && <div className="fault-warning">GEARBOX SLIPPING</div>}
        {stats.overheating && <div className="fault-warning">ENGINE OVERHEATING</div>}
        {stats.lowGrip && <div className="fault-warning">LOW TYRE GRIP</div>}
        {stats.weakBrakes && <div className="fault-warning">WEAK BRAKES</div>}
        {stats.unstableCornering && <div className="fault-warning">UNSTABLE CORNERING</div>}
      </div>

      {/* Controls */}
      <div className="driving-controls">
        <button className="btn btn-secondary btn-small" onClick={handleRestart}>Restart</button>
        <button className="btn btn-secondary btn-small" onClick={handleRecover}>Recover</button>
        <button className="btn btn-secondary btn-small" onClick={handlePause}>{paused ? 'Resume' : 'Pause'}</button>
      </div>

      {/* Touch controls for mobile */}
      <div className="touch-controls visible" style={{ display: 'flex' }}>
        <div className="touch-group">
          <TouchButton label="L" control="left" sceneRef={sceneRef} />
          <TouchButton label="R" control="right" sceneRef={sceneRef} />
        </div>
        <div className="touch-group">
          <TouchButton label="HB" control="handbrake" sceneRef={sceneRef} />
          <TouchButton label="G" control="gas" sceneRef={sceneRef} />
          <TouchButton label="B" control="brake" sceneRef={sceneRef} />
        </div>
      </div>

      {/* Pause overlay */}
      {paused && (
        <div className="pause-overlay">
          <h2>PAUSED</h2>
          <button className="btn btn-primary btn-large" onClick={handlePause}>Resume</button>
          <button className="btn btn-secondary" onClick={handleRestart}>Restart</button>
          <div style={{ marginTop: 16 }}>
            <div className="control-row"><span className="key">W/Up</span><span className="action">Accelerate</span></div>
            <div className="control-row"><span className="key">S/Down</span><span className="action">Brake</span></div>
            <div className="control-row"><span className="key">A/D</span><span className="action">Steer</span></div>
            <div className="control-row"><span className="key">Space</span><span className="action">Handbrake</span></div>
            <div className="control-row"><span className="key">R</span><span className="action">Restart</span></div>
            <div className="control-row"><span className="key">Esc</span><span className="action">Pause</span></div>
          </div>
        </div>
      )}
    </>
  );
}

function TouchButton({ label, control, sceneRef }: { label: string; control: string; sceneRef: React.RefObject<DrivingScene | null> }) {
  const [active, setActive] = useState(false);

  const handleStart = () => {
    setActive(true);
    sceneRef.current?.setTouchControl(control, true);
  };

  const handleEnd = () => {
    setActive(false);
    sceneRef.current?.setTouchControl(control, false);
  };

  return (
    <div
      className={`touch-btn ${active ? 'active' : ''}`}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      {label}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
}
