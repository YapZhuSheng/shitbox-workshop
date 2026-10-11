import { Upgrade } from '../types';

export const UPGRADES: Upgrade[] = [
  // Repairs
  {
    id: 'repair_tyres',
    name: 'Replacement Tyres',
    description: 'New set of standard tyres. Restores full grip.',
    cost: 400,
    category: 'repair',
    effects: { grip: 0 }
  },
  {
    id: 'repair_brakes',
    name: 'Brake Service',
    description: 'New pads and machined discs. Restores braking power.',
    cost: 500,
    category: 'repair',
    effects: { braking: 0 }
  },
  {
    id: 'repair_gearbox',
    name: 'Gearbox Repair',
    description: 'Full gearbox overhaul. No more slipping.',
    cost: 1200,
    category: 'repair',
    effects: { power: 0 }
  },
  {
    id: 'repair_cooling',
    name: 'Cooling System Repair',
    description: 'New radiator, hoses, and thermostat. Engine stays cool.',
    cost: 600,
    category: 'repair',
    effects: {}
  },
  {
    id: 'repair_suspension',
    name: 'Suspension Repair',
    description: 'New shock absorbers and bushings. Stable cornering.',
    cost: 700,
    category: 'repair',
    effects: { handling: 0 }
  },
  // Performance upgrades
  {
    id: 'perf_tyres',
    name: 'Performance Tyres',
    description: 'Semi-slick tyres. Much better grip, but wear faster.',
    cost: 900,
    category: 'performance',
    effects: { grip: 20 },
    requires: ['repair_tyres'],
    tradeoff: 'Tyre condition drops faster during events'
  },
  {
    id: 'perf_brakes',
    name: 'Upgraded Brake Kit',
    description: 'Big brake kit with slotted discs. Superior stopping power.',
    cost: 1100,
    category: 'performance',
    effects: { braking: 25 },
    requires: ['repair_brakes'],
    tradeoff: 'Slightly heavier unsprung weight'
  },
  {
    id: 'perf_suspension',
    name: 'Sport Suspension',
    description: 'Coilover setup. Sharper handling, lower ride height.',
    cost: 1400,
    category: 'performance',
    effects: { handling: 25 },
    requires: ['repair_suspension'],
    tradeoff: 'Harsher ride, more sensitive to bumps'
  },
  {
    id: 'perf_engine',
    name: 'Engine Tune',
    description: 'ECU remap and intake upgrade. More power across the rev range.',
    cost: 1800,
    category: 'performance',
    effects: { power: 20 },
    tradeoff: 'Engine runs hotter, fuel consumption increases'
  },
  {
    id: 'perf_weight',
    name: 'Weight Reduction',
    description: 'Strip interior, carbon panels. Car feels much lighter.',
    cost: 1500,
    category: 'performance',
    effects: { weight: -120 },
    tradeoff: 'No sound deadening, stripped interior, noisy'
  }
];

export function getUpgrade(id: string): Upgrade | undefined {
  return UPGRADES.find(u => u.id === id);
}

export function canInstallUpgrade(upgrade: Upgrade, ownedCar: { faults: { id: string }[]; upgrades: string[] }): boolean {
  if (ownedCar.upgrades.includes(upgrade.id)) return false;
  if (upgrade.requires) {
    // Check that the corresponding repair has been done
    const repairId = upgrade.requires[0];
    // If the fault still exists, can't install the performance upgrade
    if (ownedCar.faults.some(f => f.id === repairId.replace('repair_', ''))) return false;
  }
  return true;
}
