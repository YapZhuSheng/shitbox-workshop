export interface Checkpoint {
  x: number;
  y: number;
  radius: number;
}

export interface TrackData {
  pathPoints: { x: number; y: number; width: number }[];
  checkpoints: Checkpoint[];
  barriers: { x1: number; y1: number; x2: number; y2: number }[];
  tyreBarriers: { x: number; y: number }[];
  cones: { x: number; y: number }[];
}

// Autocross circuit - a fun layout with chicanes and sweepers
function generateTrackPath(): { x: number; y: number; width: number }[] {
  const points: { x: number; y: number; width: number }[] = [];
  const cx = 500;
  const cy = 400;
  
  // Create a circuit with interesting corners
  const waypoints = [
    // Start straight (going right)
    { x: cx - 200, y: cy + 150 },
    { x: cx - 100, y: cy + 150 },
    { x: cx, y: cy + 150 },
    { x: cx + 100, y: cy + 150 },
    { x: cx + 200, y: cy + 150 },
    // Right turn (going up)
    { x: cx + 280, y: cy + 120 },
    { x: cx + 320, y: cy + 60 },
    { x: cx + 320, y: cy },
    { x: cx + 320, y: cy - 60 },
    // Chicane (left-right)
    { x: cx + 300, y: cy - 120 },
    { x: cx + 250, y: cy - 160 },
    { x: cx + 200, y: cy - 180 },
    { x: cx + 150, y: cy - 170 },
    { x: cx + 100, y: cy - 140 },
    // Sweeping left
    { x: cx + 50, y: cy - 100 },
    { x: cx, y: cy - 80 },
    { x: cx - 60, y: cy - 80 },
    { x: cx - 120, y: cy - 100 },
    // Hairpin
    { x: cx - 180, y: cy - 140 },
    { x: cx - 220, y: cy - 180 },
    { x: cx - 260, y: cy - 200 },
    { x: cx - 300, y: cy - 190 },
    { x: cx - 320, y: cy - 160 },
    // Back straight (going down)
    { x: cx - 320, y: cy - 100 },
    { x: cx - 320, y: cy - 40 },
    { x: cx - 310, y: cy + 20 },
    // S-bend back to start
    { x: cx - 280, y: cy + 70 },
    { x: cx - 250, y: cy + 110 },
    { x: cx - 220, y: cy + 140 },
  ];
  
  // Interpolate between waypoints for smooth path
  for (let i = 0; i < waypoints.length; i++) {
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % waypoints.length];
    
    // Add intermediate points for smoother curves
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      points.push({
        x: curr.x + (next.x - curr.x) * t,
        y: curr.y + (next.y - curr.y) * t,
        width: 80
      });
    }
  }
  
  return points;
}

function generateCheckpoints(pathPoints: { x: number; y: number }[]): Checkpoint[] {
  // Place checkpoints at key positions around the track
  const totalPoints = pathPoints.length;
  const checkpointIndices = [
    Math.floor(totalPoints * 0.12),  // After first straight
    Math.floor(totalPoints * 0.25),  // After right turn
    Math.floor(totalPoints * 0.38),  // Through chicane
    Math.floor(totalPoints * 0.50),  // After sweeper
    Math.floor(totalPoints * 0.65),  // After hairpin
    Math.floor(totalPoints * 0.80),  // On back straight
    Math.floor(totalPoints * 0.92),  // Through S-bend
  ];
  
  return checkpointIndices.map(idx => ({
    x: pathPoints[idx].x,
    y: pathPoints[idx].y,
    radius: 35
  }));
}

function generateBarriers(pathPoints: { x: number; y: number }[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const barriers: { x1: number; y1: number; x2: number; y2: number }[] = [];
  
  // Place barriers at tight corners (outside edges)
  const cornerIndices = [
    { idx: Math.floor(pathPoints.length * 0.15), side: 1 },  // Right turn outside
    { idx: Math.floor(pathPoints.length * 0.35), side: -1 },  // Chicane
    { idx: Math.floor(pathPoints.length * 0.55), side: 1 },   // Hairpin outside
    { idx: Math.floor(pathPoints.length * 0.75), side: -1 },  // S-bend
  ];
  
  for (const c of cornerIndices) {
    const p = pathPoints[c.idx];
    const next = pathPoints[(c.idx + 1) % pathPoints.length];
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const nx = -dy / len * 50 * c.side;
    const ny = dx / len * 50 * c.side;
    
    barriers.push({
      x1: p.x + nx - dx / len * 20,
      y1: p.y + ny - dy / len * 20,
      x2: p.x + nx + dx / len * 20,
      y2: p.y + ny + dy / len * 20
    });
  }
  
  // Outer boundary barriers
  const bounds = [
    { x1: -50, y1: -50, x2: 1050, y2: -50 },
    { x1: 1050, y1: -50, x2: 1050, y2: 850 },
    { x1: 1050, y1: 850, x2: -50, y2: 850 },
    { x1: -50, y1: 850, x2: -50, y2: -50 },
  ];
  barriers.push(...bounds);
  
  return barriers;
}

function generateTyreBarriers(pathPoints: { x: number; y: number }[]): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const indices = [
    Math.floor(pathPoints.length * 0.15),
    Math.floor(pathPoints.length * 0.30),
    Math.floor(pathPoints.length * 0.55),
    Math.floor(pathPoints.length * 0.70),
    Math.floor(pathPoints.length * 0.85),
  ];
  
  for (const idx of indices) {
    const p = pathPoints[idx];
    const next = pathPoints[(idx + 1) % pathPoints.length];
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const nx = -dy / len * 48;
    const ny = dx / len * 48;
    positions.push({ x: p.x + nx, y: p.y + ny });
  }
  
  return positions;
}

function generateCones(pathPoints: { x: number; y: number }[]): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  
  // Cones marking the racing line through chicanes
  const indices = [
    Math.floor(pathPoints.length * 0.33),
    Math.floor(pathPoints.length * 0.36),
    Math.floor(pathPoints.length * 0.39),
    Math.floor(pathPoints.length * 0.78),
    Math.floor(pathPoints.length * 0.82),
  ];
  
  for (const idx of indices) {
    const p = pathPoints[idx];
    const next = pathPoints[(idx + 1) % pathPoints.length];
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    // Place cones on alternating sides
    const side = idx % 2 === 0 ? 1 : -1;
    const nx = -dy / len * 25 * side;
    const ny = dx / len * 25 * side;
    positions.push({ x: p.x + nx, y: p.y + ny });
  }
  
  return positions;
}

const pathPoints = generateTrackPath();

export const TRACK_DATA: TrackData = {
  pathPoints,
  checkpoints: generateCheckpoints(pathPoints),
  barriers: generateBarriers(pathPoints),
  tyreBarriers: generateTyreBarriers(pathPoints),
  cones: generateCones(pathPoints)
};

// Event configurations
export const EVENTS = {
  autocross: {
    name: 'KL Autocross Challenge',
    description: 'Navigate the autocross circuit as fast as possible. Hit all checkpoints in order!',
    entryFee: 100,
    bronzeTime: 65,
    silverTime: 50,
    goldTime: 40,
    bronzeReward: 200,
    silverReward: 400,
    goldReward: 700
  }
};

export const PRACTICE_CONFIG = {
  name: 'Free Practice',
  description: 'No entry fee, no rewards. Just practice the circuit.',
  entryFee: 0,
  reward: 0
};
