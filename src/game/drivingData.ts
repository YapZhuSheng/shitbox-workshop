import type { OwnedCar } from '../types';

// Shared state between React and Phaser
export const drivingData = {
  ownedCar: null as OwnedCar | null,
  onStatsUpdate: null as ((stats: any) => void) | null,
  onFinish: null as ((time: number, completed: boolean, checkpoints: number) => void) | null,
  isRaining: false,
  needsRestart: false
};
