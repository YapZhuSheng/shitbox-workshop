import { useState, useCallback, useRef, useEffect } from 'react';
import { GameScreen, DrivingStats, RaceResult, MarketplaceListing, OwnedCar } from './types';
import { useGameState } from './hooks/useGameState';
import { getCarModel, FAULTS } from './data/cars';
import { UPGRADES, canInstallUpgrade } from './data/upgrades';
import { EVENTS, PRACTICE_CONFIG } from './data/track';
import { DrivingGame } from './components/DrivingGame';
import './index.css';

// Car thumbnail SVG renderer
function CarThumbnail({ modelId, color, width = 100, height = 70 }: { modelId: string; color: string; width?: number; height?: number }) {
  const model = getCarModel(modelId);
  const shapes: Record<string, React.ReactNode> = {
    hatchback: (
      <g>
        <rect x="25" y="18" width="50" height="34" rx="8" fill={color} />
        <rect x="30" y="22" width="20" height="12" rx="3" fill="#88ccff" opacity="0.5" />
        <circle cx="32" cy="20" r="3" fill="#ffffcc" opacity="0.9" />
        <circle cx="68" cy="20" r="3" fill="#ffffcc" opacity="0.9" />
        <circle cx="32" cy="50" r="3" fill="#ff3333" opacity="0.8" />
        <circle cx="68" cy="50" r="3" fill="#ff3333" opacity="0.8" />
        <rect x="28" y="48" width="44" height="4" rx="2" fill="#333" />
      </g>
    ),
    sedan: (
      <g>
        <rect x="20" y="16" width="60" height="38" rx="8" fill={color} />
        <rect x="28" y="20" width="24" height="14" rx="3" fill="#88ccff" opacity="0.5" />
        <rect x="56" y="20" width="16" height="14" rx="3" fill="#88ccff" opacity="0.4" />
        <circle cx="28" cy="18" r="3" fill="#ffffcc" opacity="0.9" />
        <circle cx="72" cy="18" r="3" fill="#ffffcc" opacity="0.9" />
        <circle cx="28" cy="52" r="3" fill="#ff3333" opacity="0.8" />
        <circle cx="72" cy="52" r="3" fill="#ff3333" opacity="0.8" />
      </g>
    ),
    executive: (
      <g>
        <rect x="15" y="12" width="70" height="46" rx="10" fill={color} />
        <rect x="22" y="16" width="28" height="16" rx="4" fill="#88ccff" opacity="0.5" />
        <rect x="54" y="16" width="20" height="16" rx="4" fill="#88ccff" opacity="0.4" />
        <circle cx="24" cy="14" r="4" fill="#ffffcc" opacity="0.9" />
        <circle cx="76" cy="14" r="4" fill="#ffffcc" opacity="0.9" />
        <rect x="20" y="52" width="60" height="5" rx="2" fill="#333" />
      </g>
    ),
    coupe: (
      <g>
        <rect x="22" y="14" width="56" height="42" rx="10" fill={color} />
        <rect x="28" y="18" width="22" height="14" rx="4" fill="#88ccff" opacity="0.5" />
        <path d="M55 18 L72 18 L72 32 L55 32 Z" fill="#88ccff" opacity="0.3" rx="3" />
        <circle cx="30" cy="16" r="3" fill="#ffffcc" opacity="0.9" />
        <circle cx="70" cy="16" r="3" fill="#ffffcc" opacity="0.9" />
        <rect x="30" y="10" width="40" height="4" rx="2" fill={color} opacity="0.7" />
      </g>
    ),
    mpv: (
      <g>
        <rect x="18" y="10" width="64" height="50" rx="10" fill={color} />
        <rect x="24" y="14" width="24" height="18" rx="4" fill="#88ccff" opacity="0.5" />
        <rect x="52" y="14" width="20" height="18" rx="4" fill="#88ccff" opacity="0.4" />
        <rect x="14" y="8" width="72" height="6" rx="3" fill={color} opacity="0.6" />
        <circle cx="26" cy="12" r="3" fill="#ffffcc" opacity="0.9" />
        <circle cx="74" cy="12" r="3" fill="#ffffcc" opacity="0.9" />
        <rect x="18" y="54" width="64" height="5" rx="2" fill="#333" />
        {/* LED underglow for modified MPV */}
        <rect x="20" y="58" width="60" height="2" rx="1" fill="#00ffff" opacity="0.4" />
      </g>
    )
  };

  return (
    <svg width={width} height={height} viewBox="0 0 100 70">
      <rect width="100" height="70" fill="#1a1a1f" rx="8" />
      {shapes[model.type] || shapes.hatchback}
    </svg>
  );
}

function conditionColor(val: number): string {
  if (val >= 70) return 'good';
  if (val >= 40) return 'ok';
  return 'bad';
}

function formatMoney(amount: number): string {
  return `RM${amount.toLocaleString()}`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
}

// Mechanic flavor quotes
const MECHANIC_QUOTES = [
  '"All automatic gearbox oil same lah." - Your mechanic, probably wrong',
  '"This one already good, no need change." - Trust but verify',
  '"Boss, got special discount for you." - The real price is higher',
  '"Original part, not OEM." - Whatever that means',
  '"Warranty until you sell." - Technically true',
];

export default function App() {
  const { state, refreshMarketplace, buyCar, sellCar, setActiveCar, repairFault, installUpgrade, applyRaceResult, doDeliveryJob, resetGame, getActiveCar } = useGameState();
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [inspectingListing, setInspectingListing] = useState<MarketplaceListing | null>(null);
  const [inspectionLevel, setInspectionLevel] = useState<'basic' | 'full'>('basic');
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [isPractice, setIsPractice] = useState(false);
  const [isRaining, setIsRaining] = useState(false);
  const [mechanicQuote] = useState(() => MECHANIC_QUOTES[Math.floor(Math.random() * MECHANIC_QUOTES.length)]);
  const [lowballOffer, setLowballOffer] = useState<{ carId: string; offer: number } | null>(null);
  const [showControls, setShowControls] = useState(false);

  const activeCar = getActiveCar();

  // Random events
  useEffect(() => {
    if (screen === 'driving' && Math.random() < 0.2) {
      setIsRaining(true);
    } else {
      setIsRaining(false);
    }
  }, [screen]);

  // Random lowball offers
  useEffect(() => {
    if (state.ownedCars.length > 0 && Math.random() < 0.1 && screen !== 'driving') {
      const car = state.ownedCars[Math.floor(Math.random() * state.ownedCars.length)];
      const model = getCarModel(car.modelId);
      const offer = Math.round(model.basePrice * 0.3 / 100) * 100;
      setLowballOffer({ carId: car.id, offer });
    }
  }, [screen, state.ownedCars.length]);

  const handleBuyCar = useCallback((listing: MarketplaceListing) => {
    if (state.money >= listing.price) {
      buyCar(listing);
      setInspectingListing(null);
    }
  }, [state.money, buyCar]);

  const handleFinishRace = useCallback((time: number, completed: boolean, checkpoints: number) => {
    const event = EVENTS.autocross;
    let earnedReward = 0;
    if (completed) {
      if (time <= event.goldTime) earnedReward = event.goldReward;
      else if (time <= event.silverTime) earnedReward = event.silverReward;
      else if (time <= event.bronzeTime) earnedReward = event.bronzeReward;
    }

    const result: RaceResult = {
      time,
      checkpoints,
      totalCheckpoints: 7,
      completed,
      bronzeTime: event.bronzeTime,
      silverTime: event.silverTime,
      goldTime: event.goldTime,
      reward: earnedReward,
      earnedReward: isPractice ? 0 : earnedReward,
      eventEntry: isPractice ? 0 : event.entryFee
    };

    if (!isPractice) {
      applyRaceResult(result);
    }
    setRaceResult(result);
    setScreen('results');
  }, [isPractice, applyRaceResult]);

  // SCREENS
  if (screen === 'menu') {
    return (
      <div className="app-container">
        <div className="menu-screen">
          <div className="menu-title">SHITBOX WORKSHOP</div>
          <div className="menu-subtitle">
            Buy questionable used cars. Fix them up. Race them. Sell them. Repeat.
            Set in a fictional Malaysian used-car scene.
          </div>
          <div className="menu-actions">
            <button className="btn btn-primary btn-large" onClick={() => setScreen('marketplace')}>
              {state.ownedCars.length === 0 ? 'Start Game' : 'Continue'}
            </button>
            {state.ownedCars.length > 0 && (
              <>
                <button className="btn btn-secondary btn-large" onClick={() => setScreen('garage')}>
                  Garage ({state.ownedCars.length} cars)
                </button>
                <button className="btn btn-teal btn-large" onClick={() => { setIsPractice(false); setScreen('driving'); }} disabled={!activeCar}>
                  Race Event
                </button>
                <button className="btn btn-secondary btn-large" onClick={() => { setIsPractice(true); setScreen('driving'); }} disabled={!activeCar}>
                  Free Practice
                </button>
              </>
            )}
            {state.money < 100 && state.ownedCars.length === 0 && (
              <button className="btn btn-teal" onClick={() => { doDeliveryJob(); }}>
                Do Delivery Job (earn RM150-250)
              </button>
            )}
            <button className="btn btn-danger btn-small" onClick={() => { if (confirm('Reset all progress?')) resetGame(); }} style={{ marginTop: 20 }}>
              Reset Game
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 20 }}>
            {mechanicQuote}
          </div>
        </div>
      </div>
    );
  }

  const header = (
    <div className="header">
      <div className="header-left">
        <div>
          <h1>SHITBOX WORKSHOP</h1>
          <div className="subtitle">Day {state.currentDay}</div>
        </div>
        <div className="nav-bar">
          <button className={`nav-btn ${screen === 'marketplace' ? 'active' : ''}`} onClick={() => setScreen('marketplace')}>Market</button>
          <button className={`nav-btn ${screen === 'garage' ? 'active' : ''}`} onClick={() => setScreen('garage')}>Garage</button>
          <button className={`nav-btn ${screen === 'driving' ? 'active' : ''}`} onClick={() => { setIsPractice(false); setScreen('driving'); }} disabled={!activeCar}>Race</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="money-display">{formatMoney(state.money)}</div>
        <button className="btn btn-secondary btn-small" onClick={() => setScreen('menu')}>Menu</button>
      </div>
    </div>
  );

  // MARKETPLACE
  if (screen === 'marketplace') {
    return (
      <div className="app-container">
        {header}
        <div className="screen">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-title">
              <span className="accent">Used</span> Car Market
            </div>
            <button className="btn btn-secondary btn-small" onClick={refreshMarketplace}>
              Refresh Listings
            </button>
          </div>
          {state.marketplace.length === 0 ? (
            <div className="empty-state">
              <h3>No listings available</h3>
              <p>Refresh to see new cars.</p>
            </div>
          ) : (
            <div className="card-grid">
              {state.marketplace.map(listing => {
                const model = getCarModel(listing.modelId);
                const canAfford = state.money >= listing.price;
                return (
                  <div key={listing.id} className="card listing-card">
                    <div className="listing-header">
                      <div className="car-thumbnail">
                        <CarThumbnail modelId={listing.modelId} color={model.color} width={100} height={70} />
                      </div>
                      <div className="listing-info">
                        <h3>{model.fullName}</h3>
                        <div className="listing-meta">{listing.year} &middot; {listing.mileage.toLocaleString()} km &middot; {listing.location}</div>
                        <div className="listing-meta">Seller: {listing.sellerName}</div>
                        <div className="listing-price">{formatMoney(listing.price)}</div>
                      </div>
                    </div>
                    <div className="seller-quote">"{listing.sellerDescription}"</div>
                    <div className="condition-bars">
                      <div className="condition-bar">
                        <label>Body</label>
                        <div className="bar-track"><div className={`bar-fill ${conditionColor(listing.visibleCondition.body)}`} style={{ width: `${listing.visibleCondition.body}%` }} /></div>
                      </div>
                      <div className="condition-bar">
                        <label>Interior</label>
                        <div className="bar-track"><div className={`bar-fill ${conditionColor(listing.visibleCondition.interior)}`} style={{ width: `${listing.visibleCondition.interior}%` }} /></div>
                      </div>
                      <div className="condition-bar">
                        <label>Tyres</label>
                        <div className="bar-track"><div className={`bar-fill ${conditionColor(listing.visibleCondition.tyres)}`} style={{ width: `${listing.visibleCondition.tyres}%` }} /></div>
                      </div>
                    </div>
                    <div className="listing-actions">
                      <button className="btn btn-secondary btn-small" onClick={() => { setInspectingListing(listing); setInspectionLevel('basic'); }}>
                        Inspect
                      </button>
                      <button className="btn btn-primary btn-small" disabled={!canAfford} onClick={() => handleBuyCar(listing)}>
                        Buy {formatMoney(listing.price)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {state.money < 200 && state.ownedCars.length === 0 && (
            <div className="delivery-card" style={{ marginTop: 20 }}>
              <h3>Need cash?</h3>
              <p>Deliver spare parts around KL. No car needed.</p>
              <button className="btn btn-teal" onClick={doDeliveryJob}>Do Delivery Job (earn RM150-250)</button>
            </div>
          )}
        </div>

        {/* Inspection Modal */}
        {inspectingListing && (
          <div className="modal-overlay" onClick={() => setInspectingListing(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Inspection: {getCarModel(inspectingListing.modelId).fullName}</h2>
              
              <div className="inspection-detail">
                <label>Seller</label>
                <div className="value">{inspectingListing.sellerName} ({inspectingListing.location})</div>
              </div>
              <div className="inspection-detail">
                <label>Year / Mileage</label>
                <div className="value">{inspectingListing.year} / {inspectingListing.mileage.toLocaleString()} km</div>
              </div>
              <div className="inspection-detail">
                <label>Asking Price</label>
                <div className="value" style={{ color: 'var(--orange)', fontFamily: 'JetBrains Mono', fontSize: 20 }}>{formatMoney(inspectingListing.price)}</div>
              </div>

              {inspectionLevel === 'basic' ? (
                <>
                  <div style={{ margin: '16px 0', padding: 12, background: 'var(--bg-dark)', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, color: 'var(--cream-dim)', marginBottom: 8 }}>
                      Basic visual inspection shows:
                    </p>
                    <div className="condition-bars" style={{ marginBottom: 0 }}>
                      <div className="condition-bar">
                        <label>Body</label>
                        <div className="bar-track"><div className={`bar-fill ${conditionColor(inspectingListing.visibleCondition.body)}`} style={{ width: `${inspectingListing.visibleCondition.body}%` }} /></div>
                      </div>
                      <div className="condition-bar">
                        <label>Tyres</label>
                        <div className="bar-track"><div className={`bar-fill ${conditionColor(inspectingListing.visibleCondition.tyres)}`} style={{ width: `${inspectingListing.visibleCondition.tyres}%` }} /></div>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                      {inspectingListing.visibleCondition.tyres < 40 ? 'Tyres look quite bald...' : 'Tyres seem okay.'}
                      {inspectingListing.visibleCondition.body < 40 ? ' Body has some serious rust.' : ''}
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setInspectionLevel('full')} style={{ width: '100%', marginTop: 8 }}>
                    Full Mechanical Inspection (RM150)
                  </button>
                </>
              ) : (
                <div style={{ margin: '16px 0', padding: 12, background: 'var(--bg-dark)', borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: 'var(--cream-dim)', marginBottom: 8 }}>
                    Mechanic's report:
                  </p>
                  {FAULTS.map(fault => {
                    const hasFault = inspectingListing.hiddenFaults.includes(fault.id);
                    const condKey = fault.id as keyof typeof inspectingListing.hiddenCondition;
                    const condVal = inspectingListing.hiddenCondition[condKey];
                    return (
                      <div key={fault.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                        <span style={{ color: hasFault ? 'var(--red)' : 'var(--green)' }}>
                          {hasFault ? '!! ' : 'OK '}{fault.name}
                        </span>
                        <span style={{ fontFamily: 'JetBrains Mono', color: hasFault ? 'var(--red)' : 'var(--cream-dim)' }}>
                          {condVal}%
                        </span>
                      </div>
                    );
                  })}
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                    {inspectingListing.hiddenFaults.length === 0
                      ? 'This car is in surprisingly good condition!'
                      : `Found ${inspectingListing.hiddenFaults.length} issue(s). Repair cost: ${formatMoney(inspectingListing.hiddenFaults.reduce((sum, fid) => sum + (FAULTS.find(f => f.id === fid)?.repairCost || 0), 0))}`
                    }
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn btn-primary" disabled={state.money < inspectingListing.price} onClick={() => handleBuyCar(inspectingListing)} style={{ flex: 1 }}>
                  Buy for {formatMoney(inspectingListing.price)}
                </button>
                <button className="btn btn-secondary" onClick={() => setInspectingListing(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // GARAGE
  if (screen === 'garage') {
    return (
      <div className="app-container">
        {header}
        <div className="screen">
          <div className="section-title">
            <span className="accent">Your</span> Garage
          </div>

          {state.ownedCars.length === 0 ? (
            <div className="empty-state">
              <h3>No cars yet</h3>
              <p>Head to the market to buy your first shitbox.</p>
              <button className="btn btn-primary" onClick={() => setScreen('marketplace')}>Go to Market</button>
            </div>
          ) : (
            <>
              {/* Car selector */}
              <div style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="car-select-dropdown" value={state.activeCarId || ''} onChange={e => setActiveCar(e.target.value)}>
                  {state.ownedCars.map(car => {
                    const model = getCarModel(car.modelId);
                    return <option key={car.id} value={car.id}>{model.fullName} ({car.year})</option>;
                  })}
                </select>
                {activeCar && <span className="active-badge">Active Car</span>}
              </div>

              {activeCar && (
                <GarageView
                  car={activeCar}
                  money={state.money}
                  onRepair={(faultId) => repairFault(activeCar.id, faultId)}
                  onUpgrade={(upgradeId) => installUpgrade(activeCar.id, upgradeId)}
                  onSell={() => { if (confirm('Sell this car?')) sellCar(activeCar.id); }}
                  onSetPractice={() => { setIsPractice(true); setScreen('driving'); }}
                  onSetRace={() => { setIsPractice(false); setScreen('driving'); }}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // DRIVING
  if (screen === 'driving') {
    return (
      <div className="app-container">
        <div className="header">
          <div className="header-left">
            <div>
              <h1>{isPractice ? 'FREE PRACTICE' : 'KL AUTOCROSS CHALLENGE'}</h1>
              <div className="subtitle">{activeCar ? getCarModel(activeCar.modelId).fullName : 'No car'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-small" onClick={() => setShowControls(!showControls)}>Controls</button>
            <button className="btn btn-secondary btn-small" onClick={() => setScreen('garage')}>Exit</button>
          </div>
        </div>
        <div className="screen" style={{ padding: 0 }}>
          <div className="driving-container">
            <DrivingGame
              ownedCar={activeCar}
              onFinish={handleFinishRace}
              isPractice={isPractice}
              isRaining={isRaining}
            />
            {isRaining && <div className="rain-overlay" />}
            {showControls && (
              <div className="controls-help">
                <h3>Controls</h3>
                <div className="control-row"><span className="key">W / Up</span><span className="action">Accelerate</span></div>
                <div className="control-row"><span className="key">S / Down</span><span className="action">Brake / Reverse</span></div>
                <div className="control-row"><span className="key">A / Left</span><span className="action">Steer Left</span></div>
                <div className="control-row"><span className="key">D / Right</span><span className="action">Steer Right</span></div>
                <div className="control-row"><span className="key">Space</span><span className="action">Handbrake</span></div>
                <div className="control-row"><span className="key">Esc</span><span className="action">Pause</span></div>
                <div className="control-row"><span className="key">R</span><span className="action">Restart</span></div>
                <button className="btn btn-secondary btn-small" onClick={() => setShowControls(false)} style={{ marginTop: 12, width: '100%' }}>Close</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // RESULTS
  if (screen === 'results' && raceResult) {
    const event = EVENTS.autocross;
    const medal = raceResult.earnedReward >= event.goldReward ? '🥇' :
                  raceResult.earnedReward >= event.silverReward ? '🥈' :
                  raceResult.earnedReward >= event.bronzeReward ? '🥉' : '';
    const netGain = raceResult.earnedReward - raceResult.eventEntry;

    return (
      <div className="app-container">
        {header}
        <div className="screen">
          <div className="card results-card">
            <h2>{raceResult.completed ? 'Lap Complete!' : 'Did Not Finish'}</h2>
            {medal && <div className="results-medal">{medal}</div>}
            <div className="results-time">{formatTime(raceResult.time)}</div>
            
            <div className="targets-display">
              <div className="target-item">
                <div className="medal">🥉</div>
                <div className="time">{formatTime(event.bronzeTime)}</div>
              </div>
              <div className="target-item">
                <div className="medal">🥈</div>
                <div className="time">{formatTime(event.silverTime)}</div>
              </div>
              <div className="target-item">
                <div className="medal">🥇</div>
                <div className="time">{formatTime(event.goldTime)}</div>
              </div>
            </div>

            {!isPractice && (
              <div className="results-breakdown">
                <div className="result-item">
                  <label>Entry Fee</label>
                  <div className="value negative">-{formatMoney(raceResult.eventEntry)}</div>
                </div>
                <div className="result-item">
                  <label>Reward</label>
                  <div className="value positive">+{formatMoney(raceResult.earnedReward)}</div>
                </div>
                <div className="result-item">
                  <label>Net</label>
                  <div className={`value ${netGain >= 0 ? 'positive' : 'negative'}`}>{netGain >= 0 ? '+' : ''}{formatMoney(netGain)}</div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
              Checkpoints: {raceResult.checkpoints}/{raceResult.totalCheckpoints}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setScreen('driving')}>Race Again</button>
              <button className="btn btn-secondary" onClick={() => setScreen('garage')}>Back to Garage</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div className="app-container">{header}<div className="screen"><p>Unknown screen</p></div></div>;
}

// Garage sub-component
function GarageView({ car, money, onRepair, onUpgrade, onSell, onSetPractice, onSetRace }: {
  car: OwnedCar;
  money: number;
  onRepair: (faultId: string) => void;
  onUpgrade: (upgradeId: string) => void;
  onSell: () => void;
  onSetPractice: () => void;
  onSetRace: () => void;
}) {
  const model = getCarModel(car.modelId);

  // Calculate sale value estimate
  const avgCond = (car.condition.tyres + car.condition.brakes + car.condition.gearbox + car.condition.cooling + car.condition.suspension + car.condition.engine) / 600;
  const upgradeValue = car.upgrades.reduce((sum, uid) => {
    const up = UPGRADES.find(u => u.id === uid);
    return sum + (up ? up.cost * 0.4 : 0);
  }, 0);
  const saleEstimate = Math.round((car.purchasePrice * 0.5 + car.purchasePrice * 0.5 * avgCond + upgradeValue) / 100) * 100;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="car-detail-card">
          <div className="car-detail-visual">
            <div className="car-canvas">
              <CarThumbnail modelId={car.modelId} color={car.color} width={140} height={100} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
              {model.fullName}<br />
              {car.year} &middot; {car.mileage.toLocaleString()} km
            </div>
          </div>
          <div>
            <div className="car-stats">
              <div className="stat-item">
                <label>Power</label>
                <div className="value">{model.power} hp</div>
              </div>
              <div className="stat-item">
                <label>Weight</label>
                <div className="value">{model.weight} kg</div>
              </div>
              <div className="stat-item">
                <label>Engine</label>
                <div className="value">{car.condition.engine}%</div>
              </div>
              <div className="stat-item">
                <label>Est. Sale</label>
                <div className="value" style={{ color: 'var(--green)' }}>{formatMoney(saleEstimate)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-teal btn-small" onClick={onSetRace}>Race Event</button>
              <button className="btn btn-secondary btn-small" onClick={onSetPractice}>Practice</button>
              <button className="btn btn-danger btn-small" onClick={onSell}>Sell ({formatMoney(saleEstimate)})</button>
            </div>
          </div>
        </div>
      </div>

      {/* Condition overview */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {(['tyres', 'brakes', 'gearbox', 'cooling', 'suspension', 'engine'] as const).map(key => (
            <div key={key}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{key}</label>
              <div className="bar-track"><div className={`bar-fill ${conditionColor(car.condition[key])}`} style={{ width: `${car.condition[key]}%` }} /></div>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--cream-dim)', marginTop: 2 }}>{car.condition[key]}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Faults */}
      <div className="garage-section">
        <h2>Faults & Repairs</h2>
        <div className="fault-list">
          {FAULTS.map(fault => {
            const hasFault = car.faults.some(f => f.id === fault.id);
            const canAfford = money >= fault.repairCost;
            return (
              <div key={fault.id} className={`fault-item ${hasFault ? 'has-fault' : ''}`}>
                <div className="fault-info">
                  <h4>{fault.name}</h4>
                  <p>{hasFault ? fault.effect : 'OK'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`fault-status ${hasFault ? 'broken' : 'fixed'}`}>
                    {hasFault ? 'FAULT' : 'OK'}
                  </span>
                  {hasFault && (
                    <button className="btn btn-primary btn-small" disabled={!canAfford} onClick={() => onRepair(fault.id)}>
                      Repair {formatMoney(fault.repairCost)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrades */}
      <div className="garage-section">
        <h2>Performance Upgrades</h2>
        <div className="upgrade-list">
          {UPGRADES.filter(u => u.category === 'performance').map(upgrade => {
            const installed = car.upgrades.includes(upgrade.id);
            const canBuy = canInstallUpgrade(upgrade, car) && money >= upgrade.cost;
            return (
              <div key={upgrade.id} className={`upgrade-item ${installed ? 'installed' : ''}`}>
                <div className="upgrade-info">
                  <h4>{upgrade.name} {installed && <span style={{ color: 'var(--teal)', fontSize: 11 }}>(installed)</span>}</h4>
                  <p>{upgrade.description}</p>
                  {upgrade.tradeoff && <div className="upgrade-tradeoff">Tradeoff: {upgrade.tradeoff}</div>}
                </div>
                {!installed && (
                  <button className="btn btn-teal btn-small" disabled={!canBuy} onClick={() => onUpgrade(upgrade.id)}>
                    {formatMoney(upgrade.cost)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
