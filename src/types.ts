export interface CarModel {
  id: string;
  name: string;
  fullName: string;
  type: 'hatchback' | 'sedan' | 'executive' | 'coupe' | 'mpv';
  basePrice: number;
  weight: number;
  power: number;
  grip: number;
  braking: number;
  color: string;
  description: string;
}

export interface Fault {
  id: 'tyres' | 'brakes' | 'gearbox' | 'cooling' | 'suspension';
  name: string;
  description: string;
  effect: string;
  repairCost: number;
}

export interface CarCondition {
  tyres: number; // 0-100
  brakes: number;
  gearbox: number;
  cooling: number;
  suspension: number;
  engine: number;
  body: number;
}

export interface OwnedCar {
  id: string;
  modelId: string;
  year: number;
  mileage: number;
  purchasePrice: number;
  condition: CarCondition;
  faults: Fault[];
  upgrades: string[];
  color: string;
  nickname?: string;
}

export interface MarketplaceListing {
  id: string;
  modelId: string;
  year: number;
  mileage: number;
  price: number;
  sellerDescription: string;
  visibleCondition: {
    body: number;
    interior: number;
    tyres: number;
  };
  hiddenFaults: string[]; // fault IDs
  hiddenCondition: CarCondition;
  sellerName: string;
  location: string;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'repair' | 'performance';
  effects: {
    grip?: number;
    braking?: number;
    power?: number;
    weight?: number;
    handling?: number;
  };
  requires?: string[]; // fault IDs that must be repaired first
  tradeoff?: string;
}

export interface GameState {
  money: number;
  ownedCars: OwnedCar[];
  activeCarId: string | null;
  marketplace: MarketplaceListing[];
  marketplaceRefreshDay: number;
  currentDay: number;
  bestTimes: Record<string, Record<string, number>>; // carId -> eventId -> time
  totalRaces: number;
  totalEarned: number;
  deliveryJobsCompleted: number;
  lastDeliveryDay: number;
}

export interface RaceResult {
  time: number;
  checkpoints: number;
  totalCheckpoints: number;
  completed: boolean;
  bronzeTime: number;
  silverTime: number;
  goldTime: number;
  reward: number;
  earnedReward: number;
  eventEntry: number;
}

export interface DrivingStats {
  speed: number;
  temperature: number;
  lapTime: number;
  checkpointIndex: number;
  totalCheckpoints: number;
  gearSlipping: boolean;
  overheating: boolean;
  lowGrip: boolean;
  weakBrakes: boolean;
  unstableCornering: boolean;
}

export type GameScreen = 'menu' | 'marketplace' | 'inspection' | 'garage' | 'driving' | 'results' | 'practice';
