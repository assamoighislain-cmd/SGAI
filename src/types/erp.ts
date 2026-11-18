export type UserRole =
  | 'ADMIN'
  | 'EXPLOITATION'
  | 'TECHNICIEN'
  | 'MAGASINIER'
  | 'COMMERCIAL'
  | 'COMPTABLE'
  | 'PARC';

export type ModuleId =
  | 'dashboard'
  | 'stocks'
  | 'production'
  | 'sales'
  | 'accounting'
  | 'fleet'
  | 'assets';

export type Filiere =
  | 'AVICULTURE'
  | 'PORCICULTURE'
  | 'PISCICULTURE'
  | 'RIZICULTURE'
  | 'TRANSVERSAL';

export type InputCategory =
  | 'ALIMENT_POULET'
  | 'ALIMENT_PORC'
  | 'ALIMENT_POISSON'
  | 'SEMENCES'
  | 'ENGRAIS'
  | 'VETERINAIRE'
  | 'PHYTOSANITAIRE'
  | 'PIECES_DETACHEES';

export type PaymentMode = 'CAISSE' | 'MOBILE_MONEY' | 'BANQUE' | 'CREDIT';

export interface InputItem {
  id: string;
  code: string;
  name: string;
  category: InputCategory;
  unit: string;
  quantity: number;
  minThreshold: number;
  unitCost: number; // CUMP en FCFA
  expiryDate?: string;
  supplierName: string;
}

export interface StockMovement {
  id: string;
  reference: string;
  date: string;
  type: 'ENTREE' | 'SORTIE' | 'INVENTAIRE';
  itemId: string;
  itemName: string;
  quantity: number;
  theoreticalQuantity?: number; // Pour calcul écart théorique vs réel en sortie
  unitCost: number;
  totalAmount: number;
  filiere: Filiere;
  targetLotCode?: string; // Code lot/bande/étang/parcelle
  supplierOrOperator: string;
  paymentMode?: PaymentMode;
  notes?: string;
}

export interface PhysicalInventoryRecord {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  justification: string;
  operator: string;
}

// --- MODULE C : PRODUCTION ---

export interface BatchDailyLog {
  id: string;
  date: string;
  mortality: number;
  feedKg: number;
  avgWeightKg: number;
  vetCare?: string;
  costAdded: number;
}

export interface LivestockBatch {
  id: string;
  code: string;
  filiere: 'AVICULTURE' | 'PORCICULTURE';
  name: string;
  breed: string;
  building: string;
  startDate: string;
  initialCount: number;
  currentCount: number;
  initialAvgWeightKg: number;
  avgWeightKg: number;
  targetWeightKg: number;
  totalFeedKg: number;
  theoreticalFeedKg: number;
  purchaseCost: number; // Coût poussins / porcelets
  feedAndVetCost: number; // Charges directes cumulées
  status: 'EN_COURS' | 'CLOTURE';
  logs: BatchDailyLog[];
}

export interface PondLog {
  id: string;
  date: string;
  type: 'ALIMENTATION' | 'MORTALITE' | 'PECHE_CONTROLE' | 'RECOLTE_PARTIELLE' | 'RECOLTE_TOTALE';
  mortality: number;
  feedKg: number;
  sampleAvgWeightG: number;
  harvestedKg: number;
  notes: string;
}

export interface FishPond {
  id: string;
  code: string;
  name: string;
  surfaceM2: number;
  species: string;
  stockingDate: string;
  initialFingerlings: number;
  currentCount: number;
  avgWeightG: number;
  totalFeedKg: number;
  harvestedTotalKg: number;
  directCost: number;
  status: 'ACTIF' | 'VIDE_SANITAIRE';
  logs: PondLog[];
}

export type RiceStage =
  | 'PREPARATION'
  | 'SEMIS'
  | 'REPIQUAGE'
  | 'FERTILISATION'
  | 'TRAITEMENT'
  | 'RECOLTE'
  | 'TRANSFORMATION';

export interface ParcelOperation {
  id: string;
  date: string;
  stage: RiceStage;
  description: string;
  paddyHarvestedKg: number;
  paddyTransformedKg: number;
  whiteRiceObtainedKg: number;
  cost: number;
}

export interface RiceParcel {
  id: string;
  code: string;
  name: string;
  surfaceHa: number;
  variety: string;
  sowingDate: string;
  currentStage: RiceStage;
  directCost: number;
  harvestedPaddyKg: number;
  milledWhiteRiceKg: number;
  logs: ParcelOperation[];
}

// --- MODULE D : PRODUITS FINIS, VENTES & RECOUVREMENT ---

export interface FinishedProduct {
  id: string;
  code: string;
  name: string;
  filiere: Exclude<Filiere, 'TRANSVERSAL'>;
  unit: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  category: 'Grossiste' | 'Hôtel / Restaurant' | 'Supermarché' | 'Coopérative' | 'Particulier';
  phone: string;
  city: string;
  creditLimit: number;
  currentBalance: number;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  filiere: Exclude<Filiere, 'TRANSVERSAL'>;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceReminder {
  id: string;
  date: string;
  channel: 'APPEL' | 'WHATSAPP' | 'SMS' | 'COURRIER';
  note: string;
  agent: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  items: InvoiceItem[];
  totalAmount: number;
  amountPaid: number;
  paymentTerm: 'COMPTANT' | 'ACOMPTE' | 'CREDIT';
  paymentMode: PaymentMode;
  status: 'PAYE' | 'PARTIEL' | 'EN_RETARD';
  reminders: InvoiceReminder[];
}

// --- MODULE E : COMPTABILITE SYSCOHADA ---

export interface SyscohadaAccount {
  code: string;
  label: string;
  classe: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  nature: 'ACTIF' | 'PASSIF' | 'CHARGE' | 'PRODUIT' | 'HAO';
}

export interface TreasuryAccount {
  id: string;
  code: string; // 571, 552, 521
  type: 'CAISSE' | 'MOBILE_MONEY' | 'BANQUE';
  name: string;
  accountNumber?: string;
  balance: number;
}

export interface JournalLine {
  accountCode: string;
  accountLabel: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  pieceNumber: string;
  date: string;
  journal: 'ACH' | 'VTE' | 'TRE' | 'OD';
  description: string;
  filiere: Filiere;
  lines: JournalLine[];
  autoGenerated: boolean;
}

// --- MODULE F : PARC AUTOMOBILE & ENGINS ---

export type VehicleCategory = 'CAMION' | 'PICKUP' | 'TRACTEUR' | 'MOTOCULTEUR' | 'MOTO';

export interface Vehicle {
  id: string;
  code: string;
  name: string;
  category: VehicleCategory;
  registration: string;
  meterType: 'KM' | 'HEURES';
  currentMeter: number;
  nextServiceMeter: number;
  standardConsumption: number; // L/100km ou L/h
  insuranceExpiry: string;
  techInspectionExpiry: string;
  linkedAssetCode?: string;
  status: 'OPERATIONNEL' | 'EN_MAINTENANCE';
}

export interface FuelLog {
  id: string;
  date: string;
  vehicleId: string;
  vehicleName: string;
  source: 'CUVE_INTERNE' | 'STATION_EXTERNE';
  previousMeter: number;
  currentMeter: number;
  liters: number;
  unitPrice: number;
  totalCost: number;
  calculatedConsumption: number;
  isOverconsumption: boolean;
  filiere: Filiere;
  paymentMode: Exclude<PaymentMode, 'CREDIT'>;
}

export interface TripWorkLog {
  id: string;
  date: string;
  vehicleId: string;
  vehicleName: string;
  driver: string;
  filiere: Filiere;
  mission: string;
  distanceOrHours: number;
  maintenancePerformed?: string;
  maintenanceCost?: number;
}

// --- MODULE G : IMMOBILISATIONS ---

export type AssetCategory =
  | 'TERRAIN'
  | 'BATIMENT'
  | 'ETANG'
  | 'MACHINE'
  | 'VEHICULE'
  | 'CHEPTEL_REPRODUCTEUR';

export interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: AssetCategory;
  filiere: Filiere;
  site: string;
  acquisitionDate: string;
  originalValue: number;
  usefulLifeYears: number; // 0 pour Terrain non amortissable
  method: 'LINEAIRE' | 'DEGRESSIF';
  status: 'EN_SERVICE' | 'CEDE' | 'REBUT';
  disposalDate?: string;
  disposalPrice?: number;
  lastScannedAt?: string;
  physicalStatus?: 'CONFORME' | 'A_REPARER' | 'MANQUANT';
}

export interface ERPState {
  version: number;
  lastUpdated: string;
  inputs: InputItem[];
  stockMovements: StockMovement[];
  inventories: PhysicalInventoryRecord[];
  batches: LivestockBatch[];
  ponds: FishPond[];
  parcels: RiceParcel[];
  finishedProducts: FinishedProduct[];
  customers: Customer[];
  invoices: Invoice[];
  treasury: TreasuryAccount[];
  journalEntries: JournalEntry[];
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  tripLogs: TripWorkLog[];
  assets: FixedAsset[];
}

export interface SystemAlert {
  id: string;
  severity: 'CRITIQUE' | 'ATTENTION';
  category: 'STOCK' | 'PEREMPTION' | 'PRODUCTION' | 'RECOUVREMENT' | 'PARC';
  title: string;
  detail: string;
  module: ModuleId;
}
