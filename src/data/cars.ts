import { CarModel, MarketplaceListing, CarCondition, Fault } from '../types';

export const CAR_MODELS: CarModel[] = [
  {
    id: 'kancil',
    name: 'Kancil 660',
    fullName: 'Perodua Kancil 660 EZ',
    type: 'hatchback',
    basePrice: 4500,
    weight: 720,
    power: 31,
    grip: 65,
    braking: 55,
    color: '#e8e8e8',
    description: 'Lightweight hatchback. Nimble but basic.'
  },
  {
    id: 'saga',
    name: 'Saga 1.3',
    fullName: 'Proton Saga 1.3 Standard',
    type: 'sedan',
    basePrice: 7000,
    weight: 1050,
    power: 70,
    grip: 70,
    braking: 65,
    color: '#c41e3a',
    description: 'Balanced sedan. Good all-rounder.'
  },
  {
    id: 'preve',
    name: 'Preve 1.6T',
    fullName: 'Proton Preve 1.6 Turbo Executive',
    type: 'executive',
    basePrice: 15000,
    weight: 1380,
    power: 138,
    grip: 75,
    braking: 78,
    color: '#1a1a2e',
    description: 'Heavy executive sedan. Powerful but demanding.'
  },
  {
    id: 'waja',
    name: 'Waja CPS',
    fullName: 'Proton Waja 1.6 CPS',
    type: 'coupe',
    basePrice: 8500,
    weight: 1150,
    power: 110,
    grip: 68,
    braking: 62,
    color: '#2d5016',
    description: 'Old RWD coupe. Needs work but has character.'
  },
  {
    id: 'alza',
    name: 'Alza 1.5',
    fullName: 'Perodua Alza 1.5 AV (Modified)',
    type: 'mpv',
    basePrice: 6000,
    weight: 1200,
    power: 95,
    grip: 60,
    braking: 58,
    color: '#4a90d9',
    description: 'MPV with questionable modifications. Unique.'
  }
];

const SELLER_NAMES = [
  'Ah Kiang', 'Muthu', 'Ahmad', 'Siew Lan', 'Raju', 'Desmond',
  'Kumar', 'Wei Ming', 'Faizal', 'Boon', 'Ah Hock', 'Priya'
];

const LOCATIONS = [
  'Kepong', 'Cheras', 'Shah Alam', 'Subang Jaya', 'PJ',
  'Bangi', 'Klang', 'Ampang', 'Sungai Buloh', 'Puchong'
];

const SELLER_DESCRIPTIONS: Record<string, string[]> = {
  kancil: [
    'Aircond cold, buy and drive. Lady owner. Must sell quick.',
    'Original paint, never accident. Engine smooth like butter.',
    'Tax and insurance till December. One owner only. Trust me.',
    'Just serviced. Tyre still good. Come test drive confirm buy.',
    'Cheap cheap, student use only. Aircond freezing, window also cold.'
  ],
  saga: [
    'Gearbox smooth, trust me bro. Just changed engine oil.',
    'Boss car, office use only. Low mileage, genuine.',
    'Power window all working. Central lock ok. Very tiptop condition.',
    'Sell because upgrading. Car very well maintained, can check.',
    'No need to repair anything, buy and drive only. SPM graduate owner.'
  ],
  preve: [
    'Turbo still working perfectly. Power enough for you, boss.',
    'Executive car, boss use. Seat electric, everything automatic.',
    'Heavy and stable on highway. Very safe for family.',
    'Full service record. Can check at Proton service centre.',
    'Expensive car selling cheap. Must sell, going overseas.'
  ],
  waja: [
    'Classic car, collector item. Engine sound very nice, you listen.',
    'RWD, can drift lah. Young boy dream car. Modify already some.',
    'Body kit included. Spoiler, side skirt, all got. Racing feel.',
    'Old but gold. Engine strong, can climb Bukit Bintang no problem.',
    'CPS engine, very advanced for its time. Toyota also scared.'
  ],
  alza: [
    'Family car, very spacious. Got roof rack, can carry anything.',
    'Modified already, exhaust sound like Ferrari. Speaker also big.',
    'Seven seater, can bring whole kampung. Very practical.',
    'Owner modify a bit only, got LED lights under car, very steady.',
    'MPV but got power. Overtake lorry no problem. Trust me.'
  ]
};

export const FAULTS: Fault[] = [
  {
    id: 'tyres',
    name: 'Worn Tyres',
    description: 'Tyre tread below minimum. Dangerous in wet conditions.',
    effect: 'Reduced grip, especially when cornering',
    repairCost: 400
  },
  {
    id: 'brakes',
    name: 'Worn Brakes',
    description: 'Brake pads and discs worn thin.',
    effect: 'Longer stopping distance, brake fade',
    repairCost: 500
  },
  {
    id: 'gearbox',
    name: 'Slipping Gearbox',
    description: 'Transmission slipping under load.',
    effect: 'Reduced acceleration, power loss at high RPM',
    repairCost: 1200
  },
  {
    id: 'cooling',
    name: 'Cooling System Issues',
    description: 'Radiator and hoses need attention.',
    effect: 'Engine overheats, progressive power loss',
    repairCost: 600
  },
  {
    id: 'suspension',
    name: 'Worn Suspension',
    description: 'Shock absorbers and bushings worn out.',
    effect: 'Unstable cornering, bouncy ride',
    repairCost: 700
  }
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMarketplace(currentMoney: number, count: number = 8): MarketplaceListing[] {
  const listings: MarketplaceListing[] = [];
  
  // Ensure at least one affordable car (kancil or alza) with manageable faults
  const affordableModels = CAR_MODELS.filter(m => m.basePrice * 0.6 <= currentMoney * 0.7);
  
  for (let i = 0; i < count; i++) {
    const model = i === 0 && affordableModels.length > 0
      ? pickRandom(affordableModels)
      : pickRandom(CAR_MODELS);
    
    const year = randomInt(2008, 2018);
    const mileage = randomInt(40000, 220000);
    
    // Determine faults (1-3 faults, more faults = cheaper)
    const faultCount = randomInt(1, 3);
    const shuffledFaults = [...FAULTS].sort(() => Math.random() - 0.5);
    const hiddenFaults = shuffledFaults.slice(0, faultCount).map(f => f.id);
    
    // Generate condition based on faults
    const hiddenCondition: CarCondition = {
      tyres: hiddenFaults.includes('tyres') ? randomInt(15, 40) : randomInt(60, 100),
      brakes: hiddenFaults.includes('brakes') ? randomInt(15, 40) : randomInt(60, 100),
      gearbox: hiddenFaults.includes('gearbox') ? randomInt(15, 40) : randomInt(60, 100),
      cooling: hiddenFaults.includes('cooling') ? randomInt(15, 40) : randomInt(60, 100),
      suspension: hiddenFaults.includes('suspension') ? randomInt(15, 40) : randomInt(60, 100),
      engine: randomInt(50, 100),
      body: randomInt(30, 90)
    };
    
    // Calculate price based on model, year, mileage, and condition
    const ageFactor = (year - 2005) / 15;
    const mileageFactor = 1 - (mileage / 300000);
    const conditionFactor = (
      hiddenCondition.engine + hiddenCondition.gearbox + 
      hiddenCondition.tyres + hiddenCondition.brakes
    ) / 400;
    
    const fairPrice = model.basePrice * (0.4 + ageFactor * 0.4 + mileageFactor * 0.1 + conditionFactor * 0.1);
    
    // Add some variance - occasionally a bargain
    const isBargain = Math.random() < 0.15;
    const priceMultiplier = isBargain ? randomInt(55, 75) / 100 : randomInt(80, 120) / 100;
    const price = Math.round(fairPrice * priceMultiplier / 100) * 100;
    
    // Visible condition (what buyer can see without inspection)
    const visibleCondition = {
      body: hiddenCondition.body + randomInt(-10, 10),
      interior: randomInt(30, 85),
      tyres: hiddenFaults.includes('tyres') ? randomInt(20, 50) : randomInt(50, 90)
    };
    
    const description = pickRandom(SELLER_DESCRIPTIONS[model.id] || SELLER_DESCRIPTIONS.kancil);
    
    listings.push({
      id: `listing_${Date.now()}_${i}`,
      modelId: model.id,
      year,
      mileage,
      price: Math.max(price, 2000),
      sellerDescription: description,
      visibleCondition,
      hiddenFaults,
      hiddenCondition,
      sellerName: pickRandom(SELLER_NAMES),
      location: pickRandom(LOCATIONS)
    });
  }
  
  return listings;
}

export function getCarModel(id: string): CarModel {
  return CAR_MODELS.find(m => m.id === id) || CAR_MODELS[0];
}
