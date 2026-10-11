import { useState, useCallback, useEffect } from 'react';
import { GameState, OwnedCar, MarketplaceListing, RaceResult } from '../types';
import { generateMarketplace, getCarModel, FAULTS } from '../data/cars';
import { UPGRADES, canInstallUpgrade } from '../data/upgrades';

const SAVE_KEY = 'shitbox_workshop_save';
const STARTING_MONEY = 5000;

function createInitialState(): GameState {
  return {
    money: STARTING_MONEY,
    ownedCars: [],
    activeCarId: null,
    marketplace: [],
    marketplaceRefreshDay: 0,
    currentDay: 1,
    bestTimes: {},
    totalRaces: 0,
    totalEarned: 0,
    deliveryJobsCompleted: 0,
    lastDeliveryDay: 0
  };
}

function loadState(): GameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure marketplace exists
      if (!parsed.marketplace || parsed.marketplace.length === 0) {
        parsed.marketplace = generateMarketplace(parsed.money);
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load save:', e);
  }
  const state = createInitialState();
  state.marketplace = generateMarketplace(STARTING_MONEY);
  return state;
}

function saveState(state: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save:', e);
  }
}

export function useGameState() {
  const [state, setState] = useState<GameState>(loadState);

  // Auto-save on state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const refreshMarketplace = useCallback(() => {
    setState(prev => ({
      ...prev,
      marketplace: generateMarketplace(prev.money),
      marketplaceRefreshDay: prev.currentDay,
      currentDay: prev.currentDay + 1
    }));
  }, []);

  const buyCar = useCallback((listing: MarketplaceListing) => {
    setState(prev => {
      if (prev.money < listing.price) return prev;
      
      const model = getCarModel(listing.modelId);
      const ownedCar: OwnedCar = {
        id: `car_${Date.now()}`,
        modelId: listing.modelId,
        year: listing.year,
        mileage: listing.mileage,
        purchasePrice: listing.price,
        condition: { ...listing.hiddenCondition },
        faults: listing.hiddenFaults.map(fid => FAULTS.find(f => f.id === fid)!).filter(Boolean),
        upgrades: [],
        color: model.color,
        nickname: undefined
      };

      const newCars = [...prev.ownedCars, ownedCar];
      const newActiveId = prev.activeCarId || ownedCar.id;

      return {
        ...prev,
        money: prev.money - listing.price,
        ownedCars: newCars,
        activeCarId: newActiveId,
        marketplace: prev.marketplace.filter(l => l.id !== listing.id)
      };
    });
  }, []);

  const sellCar = useCallback((carId: string) => {
    setState(prev => {
      const car = prev.ownedCars.find(c => c.id === carId);
      if (!car) return prev;

      // Sale value based on purchase price, condition, and upgrades
      const avgCondition = (
        car.condition.tyres + car.condition.brakes + car.condition.gearbox +
        car.condition.cooling + car.condition.suspension + car.condition.engine
      ) / 600;

      const upgradeValue = car.upgrades.reduce((sum, uid) => {
        const up = UPGRADES.find(u => u.id === uid);
        return sum + (up ? up.cost * 0.4 : 0);
      }, 0);

      const saleValue = Math.round(
        (car.purchasePrice * 0.5 + car.purchasePrice * 0.5 * avgCondition + upgradeValue) / 100
      ) * 100;

      const newCars = prev.ownedCars.filter(c => c.id !== carId);
      let newActiveId = prev.activeCarId;
      if (newActiveId === carId) {
        newActiveId = newCars.length > 0 ? newCars[0].id : null;
      }

      return {
        ...prev,
        money: prev.money + saleValue,
        ownedCars: newCars,
        activeCarId: newActiveId,
        totalEarned: prev.totalEarned + saleValue
      };
    });
  }, []);

  const setActiveCar = useCallback((carId: string) => {
    setState(prev => ({ ...prev, activeCarId: carId }));
  }, []);

  const repairFault = useCallback((carId: string, faultId: string) => {
    setState(prev => {
      const car = prev.ownedCars.find(c => c.id === carId);
      if (!car) return prev;
      const fault = FAULTS.find(f => f.id === faultId);
      if (!fault) return prev;
      if (prev.money < fault.repairCost) return prev;
      if (!car.faults.find(f => f.id === faultId)) return prev;

      const newCondition = { ...car.condition };
      (newCondition as any)[faultId] = 100;

      const newCars = prev.ownedCars.map(c => {
        if (c.id !== carId) return c;
        return {
          ...c,
          condition: newCondition,
          faults: c.faults.filter(f => f.id !== faultId)
        };
      });

      return {
        ...prev,
        money: prev.money - fault.repairCost,
        ownedCars: newCars
      };
    });
  }, []);

  const installUpgrade = useCallback((carId: string, upgradeId: string) => {
    setState(prev => {
      const car = prev.ownedCars.find(c => c.id === carId);
      if (!car) return prev;
      const upgrade = UPGRADES.find(u => u.id === upgradeId);
      if (!upgrade) return prev;
      if (!canInstallUpgrade(upgrade, car)) return prev;
      if (prev.money < upgrade.cost) return prev;

      // Apply repair effects for repair upgrades
      let newCondition = { ...car.condition };
      if (upgrade.category === 'repair') {
        const faultKey = upgrade.id.replace('repair_', '');
        (newCondition as any)[faultKey] = 100;
      }

      const newCars = prev.ownedCars.map(c => {
        if (c.id !== carId) return c;
        const newCar = {
          ...c,
          condition: newCondition,
          upgrades: [...c.upgrades, upgradeId]
        };
        // Remove fault if it was a repair
        if (upgrade.category === 'repair') {
          const faultKey = upgrade.id.replace('repair_', '');
          newCar.faults = c.faults.filter(f => f.id !== faultKey);
        }
        return newCar;
      });

      return {
        ...prev,
        money: prev.money - upgrade.cost,
        ownedCars: newCars
      };
    });
  }, []);

  const applyRaceResult = useCallback((result: RaceResult) => {
    setState(prev => {
      const newBestTimes = { ...prev.bestTimes };
      const carId = prev.activeCarId || '';
      if (!newBestTimes[carId]) newBestTimes[carId] = {};
      
      const eventId = 'autocross';
      const currentBest = newBestTimes[carId][eventId];
      if (!currentBest || result.time < currentBest) {
        newBestTimes[carId][eventId] = result.time;
      }

      // Degrade car condition slightly after race
      const newCars = prev.ownedCars.map(c => {
        if (c.id !== carId) return c;
        const hasPerfTyres = c.upgrades.includes('perf_tyres');
        const tyreDeg = hasPerfTyres ? 5 : 3;
        return {
          ...c,
          condition: {
            ...c.condition,
            tyres: Math.max(0, c.condition.tyres - tyreDeg),
            brakes: Math.max(0, c.condition.brakes - 2),
            engine: Math.max(0, c.condition.engine - 1)
          }
        };
      });

      return {
        ...prev,
        money: prev.money + result.earnedReward - result.eventEntry,
        bestTimes: newBestTimes,
        totalRaces: prev.totalRaces + 1,
        totalEarned: prev.totalEarned + result.earnedReward,
        ownedCars: newCars
      };
    });
  }, []);

  const doDeliveryJob = useCallback(() => {
    setState(prev => {
      const reward = 150 + Math.floor(Math.random() * 100);
      return {
        ...prev,
        money: prev.money + reward,
        deliveryJobsCompleted: prev.deliveryJobsCompleted + 1,
        lastDeliveryDay: prev.currentDay,
        totalEarned: prev.totalEarned + reward
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    const fresh = createInitialState();
    fresh.marketplace = generateMarketplace(STARTING_MONEY);
    setState(fresh);
  }, []);

  const getActiveCar = useCallback((): OwnedCar | null => {
    if (!state.activeCarId) return null;
    return state.ownedCars.find(c => c.id === state.activeCarId) || null;
  }, [state.activeCarId, state.ownedCars]);

  return {
    state,
    refreshMarketplace,
    buyCar,
    sellCar,
    setActiveCar,
    repairFault,
    installUpgrade,
    applyRaceResult,
    doDeliveryJob,
    resetGame,
    getActiveCar
  };
}
