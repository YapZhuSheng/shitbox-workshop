import Phaser from 'phaser';
import { getCarModel } from '../data/cars';
import { TRACK_DATA, Checkpoint } from '../data/track';
import { drivingData } from './drivingData';

// Physics constants
const MAX_SPEED = 320;
const ACCELERATION = 280;
const BRAKE_FORCE = 400;
const DRAG = 0.98;
const OFF_TRACK_DRAG = 0.92;
const TURN_SPEED = 3.2;
const HANDBRAKE_TURN_MULTIPLIER = 1.8;
const LATERAL_GRIP = 0.88;
const HANDBRAKE_GRIP = 0.65;
const BARRIER_BOUNCE = 0.4;

interface CarPhysics {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  speed: number;
  angularVel: number;
}

interface DrivingParams {
  maxSpeed: number;
  acceleration: number;
  brakeForce: number;
  grip: number;
  braking: number;
  handling: number;
  weight: number;
  power: number;
}

export class DrivingScene extends Phaser.Scene {
  private car!: Phaser.GameObjects.Container;
  private carBody!: Phaser.GameObjects.Graphics;
  private carPhysics!: CarPhysics;
  private drivingParams!: DrivingParams;
  private camera!: Phaser.Cameras.Scene2D.Camera;
  
  private trackGraphics!: Phaser.GameObjects.Graphics;
  private checkpointMarkers: Phaser.GameObjects.Graphics[] = [];
  private barrierLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  private trackPathPoints: { x: number; y: number; width: number }[] = [];
  
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  
  private currentCheckpoint = 0;
  private checkpoints: Checkpoint[] = [];
  private lapStartTime = 0;
  private lapTime = 0;
  private isFinished = false;
  public isPaused = false;
  
  private engineTemp = 40;
  private maxTemp = 120;
  private overheating = false;
  
  private ownedCar = drivingData.ownedCar;
  private onStatsUpdate = drivingData.onStatsUpdate;
  private onFinish = drivingData.onFinish;
  
  private handbraking = false;
  private slipAngle = 0;
  
  // Touch controls
  private touchControls: { left: boolean; right: boolean; gas: boolean; brake: boolean; handbrake: boolean } = {
    left: false, right: false, gas: false, brake: false, handbrake: false
  };

  constructor() {
    super({ key: 'DrivingScene' });
  }

  init() {
    this.ownedCar = drivingData.ownedCar;
    this.onStatsUpdate = drivingData.onStatsUpdate;
    this.onFinish = drivingData.onFinish;
    this.currentCheckpoint = 0;
    this.lapTime = 0;
    this.isFinished = false;
    this.isPaused = false;
    this.engineTemp = 40;
    this.overheating = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a2a1a');
    
    this.setupTrack();
    this.setupCar();
    this.setupInput();
    this.setupCamera();
    
    this.lapStartTime = this.time.now;
    
    // Draw checkpoint indicators
    this.drawCheckpointMarkers();
  }

  private setupTrack() {
    this.trackGraphics = this.add.graphics();
    this.checkpoints = TRACK_DATA.checkpoints;
    this.trackPathPoints = TRACK_DATA.pathPoints;
    this.barrierLines = TRACK_DATA.barriers || [];
    
    // Draw track surface
    this.drawTrack();
    // Draw decorations
    this.drawDecorations();
    // Draw barriers
    this.drawBarriers();
    // Draw start/finish line
    this.drawStartFinish();
  }

  private drawTrack() {
    const g = this.trackGraphics;
    const points = this.trackPathPoints;
    
    if (points.length < 2) return;
    
    // Draw track as thick path
    g.lineStyle(80, 0x333333, 1);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    // Close the loop
    g.lineTo(points[0].x, points[0].y);
    g.strokePath();
    
    // Draw track edges (white lines)
    g.lineStyle(2, 0xffffff, 0.5);
    // We'll approximate edges by offsetting the path
    this.drawTrackEdge(g, points, 40);
    this.drawTrackEdge(g, points, -40);
    
    // Draw center dashes
    g.lineStyle(1, 0xffff00, 0.3);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.lineTo(points[0].x, points[0].y);
    g.strokePath();
    
    // Parking lot markings in the start area
    this.drawParkingMarkings(g);
  }

  private drawTrackEdge(g: Phaser.GameObjects.Graphics, points: { x: number; y: number }[], offset: number) {
    g.beginPath();
    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const nx = -dy / len * offset;
      const ny = dx / len * offset;
      if (i === 0) g.moveTo(curr.x + nx, curr.y + ny);
      else g.lineTo(curr.x + nx, curr.y + ny);
    }
    g.strokePath();
  }

  private drawParkingMarkings(g: Phaser.GameObjects.Graphics) {
    // Some parking lot style markings near start
    g.lineStyle(2, 0xffffff, 0.3);
    const startX = this.trackPathPoints[0].x;
    const startY = this.trackPathPoints[0].y;
    for (let i = 0; i < 4; i++) {
      g.strokeRect(startX + 60 + i * 30, startY + 50, 25, 45);
    }
  }

  private drawDecorations() {
    const g = this.add.graphics();
    
    // Trees scattered around
    const treePositions = [
      { x: 100, y: 100 }, { x: 700, y: 80 }, { x: 900, y: 500 },
      { x: 50, y: 600 }, { x: 850, y: 150 }, { x: 200, y: 750 },
      { x: 950, y: 700 }, { x: 400, y: 50 }, { x: 750, y: 800 },
      { x: 150, y: 400 }, { x: 600, y: 750 }, { x: 500, y: 150 }
    ];
    
    for (const pos of treePositions) {
      // Tree trunk
      g.fillStyle(0x4a3520, 1);
      g.fillRect(pos.x - 3, pos.y - 3, 6, 12);
      // Tree canopy
      g.fillStyle(0x2d5a1e, 0.8);
      g.fillCircle(pos.x, pos.y - 8, 15);
      g.fillStyle(0x1e4a12, 0.6);
      g.fillCircle(pos.x + 5, pos.y - 5, 10);
    }
    
    // Workshop buildings
    g.fillStyle(0x3a3a3a, 1);
    g.fillRect(30, 30, 80, 60);
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(35, 35, 70, 50);
    // Sign
    g.fillStyle(0xff6600, 1);
    g.fillRect(45, 40, 50, 15);
    
    // Tyre barriers at some corners
    const tyrePositions = TRACK_DATA.tyreBarriers || [];
    for (const tp of tyrePositions) {
      g.fillStyle(0x222222, 1);
      for (let i = 0; i < 3; i++) {
        g.fillCircle(tp.x + i * 10, tp.y, 6);
      }
      g.fillStyle(0xff4400, 0.5);
      g.fillCircle(tp.x + 10, tp.y, 4);
    }
    
    // Cones
    const conePositions = TRACK_DATA.cones || [];
    for (const cp of conePositions) {
      g.fillStyle(0xff6600, 1);
      g.fillTriangle(cp.x, cp.y - 8, cp.x - 5, cp.y + 4, cp.x + 5, cp.y + 4);
      g.fillStyle(0xffffff, 0.8);
      g.fillRect(cp.x - 3, cp.y - 3, 6, 2);
    }
  }

  private drawBarriers() {
    const g = this.add.graphics();
    g.lineStyle(4, 0xff0000, 0.6);
    for (const b of this.barrierLines) {
      g.lineBetween(b.x1, b.y1, b.x2, b.y2);
    }
  }

  private drawStartFinish() {
    const g = this.add.graphics();
    const p0 = this.trackPathPoints[0];
    const p1 = this.trackPathPoints[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    
    // Checkered pattern
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const x = p0.x + nx * 40 * (t * 2 - 1);
      const y = p0.y + ny * 40 * (t * 2 - 1);
      g.fillStyle(i % 2 === 0 ? 0xffffff : 0x000000, 1);
      g.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  private drawCheckpointMarkers() {
    // Clear old markers
    this.checkpointMarkers.forEach(m => m.destroy());
    this.checkpointMarkers = [];
    
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      const g = this.add.graphics();
      const isNext = i === this.currentCheckpoint;
      const color = isNext ? 0x00ff00 : (i < this.currentCheckpoint ? 0x888888 : 0xffff00);
      
      g.fillStyle(color, 0.4);
      g.fillCircle(cp.x, cp.y, 20);
      g.lineStyle(2, color, 0.8);
      g.strokeCircle(cp.x, cp.y, 20);
      
      // Number label
      this.add.text(cp.x, cp.y, `${i + 1}`, {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      
      this.checkpointMarkers.push(g);
    }
  }

  private setupCar() {
    this.car = this.add.container(0, 0);
    this.carBody = this.add.graphics();
    this.car.add(this.carBody);
    
    // Calculate driving params from car model and condition
    const model = this.ownedCar ? getCarModel(this.ownedCar.modelId) : getCarModel('kancil');
    const cond = this.ownedCar?.condition;
    const upgrades = this.ownedCar?.upgrades || [];
    
    let gripMod = 0;
    let brakingMod = 0;
    let powerMod = 0;
    let weightMod = 0;
    let handlingMod = 0;
    
    if (upgrades.includes('perf_tyres')) gripMod += 20;
    if (upgrades.includes('perf_brakes')) brakingMod += 25;
    if (upgrades.includes('perf_suspension')) handlingMod += 25;
    if (upgrades.includes('perf_engine')) powerMod += 20;
    if (upgrades.includes('perf_weight')) weightMod -= 120;
    
    // Condition effects
    const tyreFactor = cond ? cond.tyres / 100 : 1;
    const brakeFactor = cond ? cond.brakes / 100 : 1;
    const gearboxFactor = cond ? cond.gearbox / 100 : 1;
    const suspensionFactor = cond ? cond.suspension / 100 : 1;
    
    this.drivingParams = {
      maxSpeed: MAX_SPEED * (1 + powerMod / 100) * (0.5 + gearboxFactor * 0.5),
      acceleration: ACCELERATION * (1 + powerMod / 100) * (0.4 + gearboxFactor * 0.6),
      brakeForce: BRAKE_FORCE * (0.4 + brakeFactor * 0.6) * (1 + brakingMod / 100),
      grip: (LATERAL_GRIP + gripMod / 200) * (0.5 + tyreFactor * 0.5),
      braking: brakeFactor * (1 + brakingMod / 100),
      handling: (1 + handlingMod / 100) * (0.6 + suspensionFactor * 0.4),
      weight: model.weight + weightMod,
      power: model.power * (1 + powerMod / 100)
    };
    
    // Start position
    const startPos = this.trackPathPoints[0];
    const nextPos = this.trackPathPoints[1];
    const startAngle = Math.atan2(nextPos.y - startPos.y, nextPos.x - startPos.x);
    
    this.carPhysics = {
      x: startPos.x,
      y: startPos.y,
      angle: startAngle,
      vx: 0,
      vy: 0,
      speed: 0,
      angularVel: 0
    };
    
    this.drawCar();
  }

  private drawCar() {
    const g = this.carBody;
    g.clear();
    
    const model = this.ownedCar ? getCarModel(this.ownedCar.modelId) : getCarModel('kancil');
    const color = parseInt(model.color.replace('#', ''), 16);
    
    // Car body based on type
    const w = model.type === 'mpv' ? 22 : model.type === 'executive' ? 24 : 18;
    const h = model.type === 'hatchback' ? 32 : model.type === 'executive' ? 42 : 36;
    
    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(-w / 2 + 2, -h / 2 + 2, w, h);
    
    // Body
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    
    // Roof / windshield
    g.fillStyle(0x88ccff, 0.5);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w - 6, h * 0.3, 2);
    
    // Headlights
    g.fillStyle(0xffffcc, 0.9);
    g.fillCircle(-w / 2 + 4, -h / 2 + 2, 2);
    g.fillCircle(w / 2 - 4, -h / 2 + 2, 2);
    
    // Taillights
    g.fillStyle(0xff0000, 0.8);
    g.fillCircle(-w / 2 + 4, h / 2 - 2, 2);
    g.fillCircle(w / 2 - 4, h / 2 - 2, 2);
    
    // Outline
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
  }

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyW = this.input.keyboard.addKey('W');
      this.keyS = this.input.keyboard.addKey('S');
      this.keyA = this.input.keyboard.addKey('A');
      this.keyD = this.input.keyboard.addKey('D');
      this.keySpace = this.input.keyboard.addKey('SPACE');
      this.keyEsc = this.input.keyboard.addKey('ESC');
      
      this.keyEsc.on('down', () => {
        this.isPaused = !this.isPaused;
        if (this.onStatsUpdate) {
          this.onStatsUpdate({ paused: this.isPaused });
        }
      });
    }
  }

  private setupCamera() {
    this.camera = this.cameras.main;
    this.camera.setZoom(1.5);
  }

  update(time: number, delta: number) {
    if (this.isPaused || this.isFinished) return;
    
    const dt = delta / 1000;
    
    // Input
    const gas = this.isKeyDown('gas');
    const brake = this.isKeyDown('brake');
    const left = this.isKeyDown('left');
    const right = this.isKeyDown('right');
    this.handbraking = this.isKeyDown('handbrake');
    
    // Update physics
    this.updateCarPhysics(dt, gas, brake, left, right);
    
    // Check if on track
    const onTrack = this.isOnTrack(this.carPhysics.x, this.carPhysics.y);
    
    // Apply drag (more if off-track)
    const drag = onTrack ? DRAG : OFF_TRACK_DRAG;
    this.carPhysics.vx *= drag;
    this.carPhysics.vy *= drag;
    
    // Check barrier collisions
    this.checkBarrierCollisions();
    
    // Update position
    this.carPhysics.x += this.carPhysics.vx * dt;
    this.carPhysics.y += this.carPhysics.vy * dt;
    
    // Update car visual
    this.car.setPosition(this.carPhysics.x, this.carPhysics.y);
    this.car.setRotation(this.carPhysics.angle + Math.PI / 2);
    
    // Camera follow
    this.camera.scrollX = this.carPhysics.x - this.camera.width / (2 * this.camera.zoom);
    this.camera.scrollY = this.carPhysics.y - this.camera.height / (2 * this.camera.zoom);
    
    // Check checkpoints
    this.checkCheckpoints();
    
    // Update engine temperature
    this.updateTemperature(dt, gas);
    
    // Update lap time
    this.lapTime = (time - this.lapStartTime) / 1000;
    
    // Update stats for HUD
    this.updateStats();
    
    // Update checkpoint markers
    this.updateCheckpointMarkers();
  }

  private isKeyDown(action: string): boolean {
    switch (action) {
      case 'gas': return (this.keyW?.isDown || this.cursors?.up?.isDown || this.touchControls.gas) ?? false;
      case 'brake': return (this.keyS?.isDown || this.cursors?.down?.isDown || this.touchControls.brake) ?? false;
      case 'left': return (this.keyA?.isDown || this.cursors?.left?.isDown || this.touchControls.left) ?? false;
      case 'right': return (this.keyD?.isDown || this.cursors?.right?.isDown || this.touchControls.right) ?? false;
      case 'handbrake': return (this.keySpace?.isDown || this.touchControls.handbrake) ?? false;
      default: return false;
    }
  }

  private updateCarPhysics(dt: number, gas: boolean, brake: boolean, left: boolean, right: boolean) {
    const p = this.carPhysics;
    const params = this.drivingParams;
    
    // Calculate forward direction
    const forwardX = Math.cos(p.angle);
    const forwardY = Math.sin(p.angle);
    
    // Speed along forward axis
    p.speed = p.vx * forwardX + p.vy * forwardY;
    
    // Acceleration / braking
    if (gas) {
      const accelForce = params.acceleration * dt;
      p.vx += forwardX * accelForce;
      p.vy += forwardY * accelForce;
    }
    if (brake) {
      if (p.speed > 10) {
        // Braking
        const brakeForce = params.brakeForce * dt;
        p.vx -= forwardX * brakeForce;
        p.vy -= forwardY * brakeForce;
      } else {
        // Reverse
        const reverseForce = params.acceleration * 0.4 * dt;
        p.vx -= forwardX * reverseForce;
        p.vy -= forwardY * reverseForce;
      }
    }
    
    // Speed cap
    const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (currentSpeed > params.maxSpeed) {
      const scale = params.maxSpeed / currentSpeed;
      p.vx *= scale;
      p.vy *= scale;
    }
    
    // Steering (speed-dependent)
    const speedFactor = Math.min(Math.abs(p.speed) / 100, 1);
    const turnRate = TURN_SPEED * params.handling * speedFactor;
    const handbrakeTurnMult = this.handbraking ? HANDBRAKE_TURN_MULTIPLIER : 1;
    
    if (left) p.angle -= turnRate * handbrakeTurnMult * dt;
    if (right) p.angle += turnRate * handbrakeTurnMult * dt;
    
    // Lateral grip - reduce sideways velocity
    const rightX = Math.cos(p.angle + Math.PI / 2);
    const rightY = Math.sin(p.angle + Math.PI / 2);
    const lateralSpeed = p.vx * rightX + p.vy * rightY;
    
    const gripFactor = this.handbraking ? HANDBRAKE_GRIP : params.grip;
    const gripReduction = 1 - gripFactor;
    
    p.vx -= rightX * lateralSpeed * gripReduction;
    p.vy -= rightY * lateralSpeed * gripReduction;
    
    // Store slip angle for visual feedback
    this.slipAngle = lateralSpeed / Math.max(Math.abs(p.speed), 1);
  }

  private isOnTrack(x: number, y: number): boolean {
    // Check distance to nearest track segment
    const points = this.trackPathPoints;
    let minDist = Infinity;
    
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dist = this.pointToSegmentDist(x, y, a.x, a.y, b.x, b.y);
      minDist = Math.min(minDist, dist);
    }
    
    return minDist < 45; // Track half-width
  }

  private pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  private checkBarrierCollisions() {
    const p = this.carPhysics;
    const carRadius = 15;
    
    for (const b of this.barrierLines) {
      const dist = this.pointToSegmentDist(p.x, p.y, b.x1, b.y1, b.x2, b.y2);
      if (dist < carRadius) {
        // Push car away from barrier
        const bx = b.x2 - b.x1;
        const by = b.y2 - b.y1;
        const len = Math.sqrt(bx * bx + by * by);
        const nx = -by / len;
        const ny = bx / len;
        
        // Reflect velocity
        const dot = p.vx * nx + p.vy * ny;
        p.vx -= 2 * dot * nx * BARRIER_BOUNCE;
        p.vy -= 2 * dot * ny * BARRIER_BOUNCE;
        
        // Reduce speed
        p.vx *= 0.7;
        p.vy *= 0.7;
        
        // Push out
        p.x += nx * (carRadius - dist + 2);
        p.y += ny * (carRadius - dist + 2);
      }
    }
  }

  private checkCheckpoints() {
    if (this.currentCheckpoint >= this.checkpoints.length) return;
    
    const cp = this.checkpoints[this.currentCheckpoint];
    const dx = this.carPhysics.x - cp.x;
    const dy = this.carPhysics.y - cp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < cp.radius) {
      this.currentCheckpoint++;
      
      if (this.currentCheckpoint >= this.checkpoints.length) {
        // Lap complete!
        this.isFinished = true;
        if (this.onFinish) {
          this.onFinish(this.lapTime, true, this.currentCheckpoint);
        }
      }
    }
  }

  private updateTemperature(dt: number, gas: boolean) {
    const hasCoolingFault = this.ownedCar?.faults.some(f => f.id === 'cooling') ?? false;
    
    if (gas) {
      const heatRate = hasCoolingFault ? 12 : 3;
      this.engineTemp += heatRate * dt;
    } else {
      this.engineTemp -= 5 * dt;
    }
    
    this.engineTemp = Math.max(30, Math.min(this.maxTemp, this.engineTemp));
    this.overheating = this.engineTemp > 100;
    
    // Overheating reduces power
    if (this.overheating) {
      const powerLoss = (this.engineTemp - 100) / 20; // Up to 50% power loss at max temp
      this.drivingParams.acceleration = ACCELERATION * (1 - powerLoss * 0.5);
    }
  }

  private updateStats() {
    if (!this.onStatsUpdate) return;
    
    const speed = Math.sqrt(this.carPhysics.vx ** 2 + this.carPhysics.vy ** 2);
    const hasTyreFault = this.ownedCar?.faults.some(f => f.id === 'tyres') ?? false;
    const hasBrakeFault = this.ownedCar?.faults.some(f => f.id === 'brakes') ?? false;
    const hasGearboxFault = this.ownedCar?.faults.some(f => f.id === 'gearbox') ?? false;
    const hasSuspFault = this.ownedCar?.faults.some(f => f.id === 'suspension') ?? false;
    
    this.onStatsUpdate({
      speed: Math.round(speed * 0.6), // Convert to km/h-ish
      temperature: Math.round(this.engineTemp),
      lapTime: this.lapTime,
      checkpointIndex: this.currentCheckpoint,
      totalCheckpoints: this.checkpoints.length,
      gearSlipping: hasGearboxFault && speed > 150,
      overheating: this.overheating,
      lowGrip: hasTyreFault,
      weakBrakes: hasBrakeFault,
      unstableCornering: hasSuspFault && Math.abs(this.slipAngle) > 0.3,
      paused: this.isPaused,
      finished: this.isFinished,
      slipAngle: this.slipAngle
    });
  }

  private updateCheckpointMarkers() {
    // Refresh checkpoint colors based on progress
    this.checkpointMarkers.forEach((g, i) => {
      g.clear();
      const cp = this.checkpoints[i];
      const isNext = i === this.currentCheckpoint;
      const isPassed = i < this.currentCheckpoint;
      const color = isNext ? 0x00ff00 : (isPassed ? 0x888888 : 0xffff00);
      
      g.fillStyle(color, isNext ? 0.5 : 0.2);
      g.fillCircle(cp.x, cp.y, cp.radius);
      g.lineStyle(2, color, 0.8);
      g.strokeCircle(cp.x, cp.y, cp.radius);
    });
  }

  restart() {
    this.carPhysics.x = this.trackPathPoints[0].x;
    this.carPhysics.y = this.trackPathPoints[0].y;
    const nextPos = this.trackPathPoints[1];
    this.carPhysics.angle = Math.atan2(nextPos.y - this.carPhysics.y, nextPos.x - this.carPhysics.x);
    this.carPhysics.vx = 0;
    this.carPhysics.vy = 0;
    this.carPhysics.speed = 0;
    this.currentCheckpoint = 0;
    this.lapStartTime = this.time.now;
    this.lapTime = 0;
    this.isFinished = false;
    this.engineTemp = 40;
    this.overheating = false;
  }

  setTouchControl(control: string, active: boolean) {
    (this.touchControls as any)[control] = active;
  }

  recoverCar() {
    // Stuck recovery - move to nearest track point
    let nearestDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < this.trackPathPoints.length; i++) {
      const p = this.trackPathPoints[i];
      const d = Math.sqrt((this.carPhysics.x - p.x) ** 2 + (this.carPhysics.y - p.y) ** 2);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const target = this.trackPathPoints[nearestIdx];
    this.carPhysics.x = target.x;
    this.carPhysics.y = target.y;
    this.carPhysics.vx = 0;
    this.carPhysics.vy = 0;
    const next = this.trackPathPoints[(nearestIdx + 1) % this.trackPathPoints.length];
    this.carPhysics.angle = Math.atan2(next.y - target.y, next.x - target.x);
  }
}
