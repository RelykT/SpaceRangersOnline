export const SIM_HZ = 20;
export const SIM_DT = 1 / SIM_HZ;
export const SAVE_VERSION = 2;

export type FactionId = 'human' | 'kvissae' | 'zhargi' | 'taeyori' | 'virex' | 'omnir' | 'free' | 'pirate';
export type PlayableRace = 'human' | 'kvissae' | 'zhargi' | 'taeyori' | 'virex';
export type CareerId = 'trader' | 'soldier' | 'hunter' | 'explorer' | 'pirate';
export type GalaxySize = 'small' | 'medium' | 'large';
export type Difficulty = 'calm' | 'captain' | 'harsh';
export type InvaderMood = 'sleeping' | 'waking' | 'tide';
export type EconomyMood = 'flat' | 'live' | 'storm';
export type Slot = 'high' | 'mid' | 'low' | 'rig';
export type DamageType = 'em' | 'thermal' | 'kinetic' | 'explosive';
export type NavMode = 'approach' | 'orbit' | 'keep' | 'stop';
export type Role = 'trader' | 'hunter' | 'pirate' | 'defender' | 'explorer' | 'invader';
export type PlanetType = 'volcanic' | 'ocean' | 'barren' | 'ice' | 'gas' | 'garden' | 'hive';
export type StarKind = 'yellow' | 'red' | 'blue' | 'white' | 'orange';
export type AiState = 'dock' | 'travel' | 'patrol' | 'hunt' | 'flee' | 'explore' | 'invade' | 'escort';

export const LIVING_FACTIONS: FactionId[] = ['human', 'kvissae', 'zhargi', 'taeyori', 'virex'];
export const DAMAGE_TYPES: DamageType[] = ['em', 'thermal', 'kinetic', 'explosive'];

export interface Resists {
  em: number;
  thermal: number;
  kinetic: number;
  explosive: number;
}

export interface HullDef {
  id: string;
  name: string;
  cls: string;
  blurb: string;
  price: number;
  tech: number;
  high: number;
  mid: number;
  low: number;
  rig: number;
  pg: number;
  cpu: number;
  cal: number;
  shield: number;
  armor: number;
  hull: number;
  shieldRegen: number;
  armorRegen: number;
  cap: number;
  capRegen: number;
  speed: number;
  cargo: number;
  mass: number;
  sig: number;
  scanRes: number;
  lockRange: number;
  maxLocked: number;
  shieldResist: Resists;
  armorResist: Resists;
}

export interface WeaponSpec {
  dps: number;
  type: DamageType;
  optimal: number;
  falloff: number;
  tracking: number;
  cycle: number;
  cap: number;
}

export interface ModuleDef {
  id: string;
  name: string;
  blurb: string;
  slot: Slot;
  tech: number;
  cpu: number;
  pg: number;
  cal: number;
  price: number;
  weapon?: WeaponSpec;
  shieldHp?: number;
  armorHp?: number;
  shieldRegen?: number;
  armorRegen?: number;
  repairShield?: { hp: number; cycle: number; cap: number };
  repairArmor?: { hp: number; cycle: number; cap: number };
  speedMult?: number;
  sigMult?: number;
  capPerSec?: number;
  mwd?: boolean;
  web?: { amount: number; optimal: number; falloff: number; cycle: number; cap: number };
  scram?: { optimal: number; falloff: number; cycle: number; cap: number };
  painter?: { sig: number; optimal: number; falloff: number; cycle: number; cap: number };
  pgAdd?: number;
  cpuAdd?: number;
  capAdd?: number;
  capRegenAdd?: number;
  capRegenMult?: number;
  dmgMult?: number;
  cargoMult?: number;
  optMult?: number;
  fallMult?: number;
  shieldResistAll?: number;
  armorResistAll?: number;
}

export interface GoodDef {
  id: string;
  name: string;
  base: number;
}

export interface ShipInstance {
  hullId: string;
  modules: (string | null)[];
  online: boolean[];
  cycles: number[];
  shield: number;
  armor: number;
  hull: number;
  cap: number;
  /** Омнир копит сопротивление к типу урона, которым его уже били. */
  adapt?: Resists;
}

export interface Nav {
  mode: NavMode;
  x: number;
  y: number;
  range: number;
  followId: string | null;
}

export interface JumpState {
  to: string;
  from: string;
  progress: number;
  duration: number;
}

export interface WarpState {
  phase: 'align' | 'cruise';
  t: number;
  x: number;
  y: number;
}

export interface DockingState {
  stationId: string;
  t: number;
  duration: number;
}

export interface Body {
  id: string;
  name: string;
  faction: FactionId;
  systemId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  nav: Nav;
  jump: JumpState | null;
  warp: WarpState | null;
  docking: DockingState | null;
  dockedAt: string | null;
  ship: ShipInstance;
  cargo: Record<string, number>;
  combatTimer: number;
}

export interface Player extends Body {
  credits: number;
  locker: Record<string, number>;
  reputation: Record<FactionId, number>;
  route: string[] | null;
  routeIndex: number;
  autoJumpAt: number;
  lastStationId: string;
  selectedId: string | null;
  lock: { id: string; t: number; need: number } | null;
  locked: string[];
  kills: number;
  tradeScore: Record<string, number>;
  insuranceHull: string;
  /** Fly to this station, then dock. Cleared by stop, a new point, or success. */
  pendingDock: string | null;
  /** Fly to this gate's system id, then jump. */
  pendingJump: string | null;
  origin: CaptainOrigin;
  /** Live skill levels. Career only seeds these. */
  skills: SkillSet;
  xp: number;
  spent: number;
  proficiency: Record<string, number>;
  visited: string[];
}

export interface Personality {
  aggression: number;
  greed: number;
  caution: number;
  loyalty: number;
}

export interface PilotAI {
  state: AiState;
  targetId: string | null;
  destSystemId: string | null;
  stationId: string | null;
  goodId: string | null;
  qty: number;
  timer: number;
  route: string[];
  routeIndex: number;
  nextThink: number;
  fleeUntil: number;
  homeSystemId: string;
  homeStationId: string;
  visited: string[];
  escortMissionId: string | null;
  announced: boolean;
  /** Зхарги держат обидчика, пока не истечёт время. */
  grudgeId: string | null;
  grudgeUntil: number;
}

export interface Pilot extends Body {
  role: Role;
  personality: Personality;
  credits: number;
  tier: number;
  ai: PilotAI;
  destroyed: boolean;
  respawnAt: number;
  lastHitBy: string | null;
  hitByPlayer: boolean;
}

export interface MarketLot {
  stock: number;
  capacity: number;
  base: number;
  produce: number;
  consume: number;
}

export interface Station {
  id: string;
  name: string;
  systemId: string;
  planetId: string;
  owner: FactionId;
  angleOff: number;
  x: number;
  y: number;
  market: Record<string, MarketLot>;
}

export interface Planet {
  id: string;
  systemId: string;
  name: string;
  type: PlanetType;
  orbit: number;
  angle: number;
  angVel: number;
  radius: number;
  x: number;
  y: number;
  spin: number;
}

export interface Gate {
  to: string;
  x: number;
  y: number;
}

export interface StarSystem {
  id: string;
  name: string;
  x: number;
  y: number;
  star: StarKind;
  security: number;
  owner: FactionId;
  prevOwner: FactionId;
  home: FactionId | null;
  links: string[];
  planetIds: string[];
  stationIds: string[];
  gates: Gate[];
  warScore: number;
  challenger: FactionId | null;
  belt: number | null;
  hue: number;
}

export type EventKind = 'epidemic' | 'shortage' | 'boom' | 'raid' | 'incursion' | 'crisis';

export interface GameEvent {
  id: string;
  kind: EventKind;
  systemId: string;
  goodId: string | null;
  endsAt: number;
  text: string;
}

export type MissionType = 'deliver' | 'kill' | 'escort';
export type MissionStatus = 'offer' | 'active' | 'done' | 'failed';

export interface Mission {
  id: string;
  type: MissionType;
  status: MissionStatus;
  stationId: string;
  title: string;
  desc: string;
  reward: number;
  repFaction: FactionId;
  repAmount: number;
  expires: number;
  goodId: string | null;
  qty: number;
  destStationId: string | null;
  destSystemId: string | null;
  targetPilotId: string | null;
  escortPilotId: string | null;
  witnessed: boolean;
  minRank: number;
}

export interface Wreck {
  id: string;
  name: string;
  systemId: string;
  x: number;
  y: number;
  cargo: Record<string, number>;
  modules: string[];
  credits: number;
  expiresAt: number;
}

export interface Rumor {
  id: string;
  text: string;
  systemId: string;
  time: number;
}

export interface LogLine {
  time: number;
  text: string;
}

export interface Ping {
  time: number;
  systemId: string;
  x: number;
  y: number;
  text: string;
  color: string;
  kind: 'hit' | 'explode' | 'info';
  fromX?: number;
  fromY?: number;
  /** How the shot should be drawn: beam, bolt, slug, missile, spore. */
  fx?: 'laser' | 'plasma' | 'slug' | 'missile' | 'spore' | 'ion' | 'lance';
}

export type SkillId = 'aim' | 'helm' | 'engineering' | 'trade' | 'charm' | 'lead' | 'survey';

export interface SkillSet {
  aim: number;
  helm: number;
  engineering: number;
  trade: number;
  charm: number;
  lead: number;
  survey: number;
}

export interface CaptainOrigin {
  race: PlayableRace;
  career: CareerId;
  portrait: number;
  skills: SkillSet;
}

export interface GalaxySettings {
  size: GalaxySize;
  difficulty: Difficulty;
  invaders: InvaderMood;
  economy: EconomyMood;
}

export interface World {
  seed: number;
  settings: GalaxySettings;
  time: number;
  tick: number;
  nextId: number;
  lastEventWindow: number;
  lastReinforceWindow: number;
  systems: StarSystem[];
  planets: Planet[];
  stations: Station[];
  pilots: Pilot[];
  wrecks: Wreck[];
  events: GameEvent[];
  missions: Mission[];
  rumors: Rumor[];
  logs: LogLine[];
  pings: Ping[];
  player: Player;
  war: { a: FactionId; b: FactionId } | null;
}

export type Command =
  | { t: 'dest'; x: number; y: number; mode: NavMode; range: number; followId: string | null }
  | { t: 'stop' }
  | { t: 'select'; id: string | null }
  | { t: 'lock' }
  | { t: 'unlockAll' }
  | { t: 'toggleModule'; index: number }
  | { t: 'jump'; systemId: string }
  | { t: 'useGate'; systemId: string }
  | { t: 'setRoute'; systemId: string | null }
  | { t: 'cancelJump' }
  | { t: 'dock'; stationId: string }
  | { t: 'undock' }
  | { t: 'buy'; goodId: string; qty: number }
  | { t: 'sell'; goodId: string; qty: number }
  | { t: 'buyMod'; moduleId: string }
  | { t: 'sellMod'; moduleId: string }
  | { t: 'fit'; moduleId: string; index: number }
  | { t: 'unfit'; index: number }
  | { t: 'buyHull'; hullId: string }
  | { t: 'repair' }
  | { t: 'train'; skill: SkillId }
  | { t: 'acceptMission'; id: string }
  | { t: 'loot'; wreckId: string };

export interface FitStats {
  valid: boolean;
  reason: string;
  pgUsed: number;
  cpuUsed: number;
  calUsed: number;
  pg: number;
  cpu: number;
  cal: number;
  maxShield: number;
  maxArmor: number;
  maxHull: number;
  maxCap: number;
  shieldRegen: number;
  armorRegen: number;
  capRegen: number;
  speed: number;
  cargo: number;
  sig: number;
  scanRes: number;
  lockRange: number;
  maxLocked: number;
  mass: number;
  shieldResist: Resists;
  armorResist: Resists;
  dps: number;
  dpsByType: Record<DamageType, number>;
  passiveCap: number;
  weapons: ResolvedWeapon[];
  repairs: ResolvedRepair[];
  ewars: ResolvedEwar[];
  prop: { speedMult: number; sigMult: number; capPerSec: number; mwd: boolean } | null;
}

export interface ResolvedWeapon {
  index: number;
  name: string;
  dps: number;
  type: DamageType;
  optimal: number;
  falloff: number;
  tracking: number;
  cycle: number;
  cap: number;
  online: boolean;
}

export interface ResolvedRepair {
  index: number;
  layer: 'shield' | 'armor';
  hp: number;
  cycle: number;
  cap: number;
  online: boolean;
}

export interface ResolvedEwar {
  index: number;
  kind: 'web' | 'scram' | 'painter';
  amount: number;
  optimal: number;
  falloff: number;
  cycle: number;
  cap: number;
  online: boolean;
}
