import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createInitialDemoState } from '../data/demoData';
import { getAccountByCode } from '../data/syscohada';
import {
  Customer,
  ERPState,
  Filiere,
  FixedAsset,
  InputCategory,
  InvoiceItem,
  JournalEntry,
  JournalLine,
  ModuleId,
  PaymentMode,
  RiceStage,
  SystemAlert,
  UserRole,
  VehicleCategory,
} from '../types/erp';
import { computeAssetDepreciation, daysUntil, getTodayISO } from '../utils/formatters';
import { clearPersistedERPState, loadStateFromIDB, loadStateSync, persistERPState } from '../utils/storage';

interface ActionResult {
  ok: boolean;
  message: string;
}

interface ERPContextValue {
  state: ERPState;
  role: UserRole;
  setRole: (role: UserRole) => void;
  activeModule: ModuleId;
  setActiveModule: (m: ModuleId) => void;
  allowedModules: ModuleId[];
  canWrite: (module: ModuleId) => boolean;
  alerts: SystemAlert[];

  // Actions Stocks d'Intrants
  addInputCatalogItem: (payload: {
    code: string;
    name: string;
    category: InputCategory;
    unit: string;
    minThreshold: number;
    unitCost: number;
    expiryDate?: string;
    supplierName: string;
  }) => ActionResult;
  recordStockEntry: (payload: {
    itemId: string;
    quantity: number;
    unitCost: number;
    supplier: string;
    paymentMode: PaymentMode;
    date: string;
    notes?: string;
  }) => ActionResult;
  recordStockExit: (payload: {
    itemId: string;
    quantity: number;
    theoreticalQuantity: number;
    filiere: Filiere;
    targetLotCode: string;
    operator: string;
    date: string;
    notes?: string;
  }) => ActionResult;
  recordPhysicalInventory: (payload: {
    itemId: string;
    countedQty: number;
    justification: string;
    operator: string;
    date: string;
  }) => ActionResult;

  // Actions Production (4 Filières)
  createLivestockBatch: (payload: {
    filiere: 'AVICULTURE' | 'PORCICULTURE';
    code: string;
    name: string;
    breed: string;
    building: string;
    startDate: string;
    initialCount: number;
    initialAvgWeightKg: number;
    targetWeightKg: number;
    purchaseCost: number;
    paymentMode: PaymentMode;
  }) => ActionResult;
  logBatchDaily: (payload: {
    batchId: string;
    date: string;
    mortality: number;
    feedKg: number;
    avgWeightKg: number;
    vetCare?: string;
    vetCost?: number;
  }) => ActionResult;
  harvestBatchToStock: (payload: {
    batchId: string;
    productId: string;
    headsHarvested: number;
    stockUnitsProduced: number;
  }) => ActionResult;
  logPondEvent: (payload: {
    pondId: string;
    date: string;
    type: 'ALIMENTATION' | 'MORTALITE' | 'PECHE_CONTROLE' | 'RECOLTE_PARTIELLE' | 'RECOLTE_TOTALE';
    mortality: number;
    feedKg: number;
    sampleAvgWeightG: number;
    harvestedKg: number;
    targetProductId?: string;
    notes: string;
  }) => ActionResult;
  createFishPond: (payload: {
    code: string;
    name: string;
    surfaceM2: number;
    species: string;
    stockingDate: string;
    initialFingerlings: number;
    directCost: number;
  }) => ActionResult;
  logParcelOperation: (payload: {
    parcelId: string;
    date: string;
    stage: RiceStage;
    description: string;
    paddyHarvestedKg: number;
    paddyTransformedKg: number;
    whiteRiceObtainedKg: number;
    cost: number;
  }) => ActionResult;
  createRiceParcel: (payload: {
    code: string;
    name: string;
    surfaceHa: number;
    variety: string;
    sowingDate: string;
  }) => ActionResult;

  // Actions Produits Finis, Ventes & Recouvrement
  createCustomer: (payload: Omit<Customer, 'id' | 'currentBalance'>) => ActionResult;
  createInvoice: (payload: {
    customerId: string;
    date: string;
    dueDate: string;
    items: InvoiceItem[];
    amountPaid: number;
    paymentMode: PaymentMode;
  }) => ActionResult;
  recordInvoicePayment: (payload: {
    invoiceId: string;
    amount: number;
    paymentMode: Exclude<PaymentMode, 'CREDIT'>;
    date: string;
  }) => ActionResult;
  addInvoiceReminder: (payload: {
    invoiceId: string;
    channel: 'APPEL' | 'WHATSAPP' | 'SMS' | 'COURRIER';
    note: string;
    agent: string;
  }) => ActionResult;

  // Actions Comptabilité SYSCOHADA
  addManualJournalEntry: (payload: {
    date: string;
    journal: 'ACH' | 'VTE' | 'TRE' | 'OD';
    description: string;
    filiere: Filiere;
    lines: JournalLine[];
  }) => ActionResult;
  postAnnualDepreciations: (year: number) => ActionResult;

  // Actions Parc Automobile
  addVehicle: (payload: {
    code: string;
    name: string;
    category: VehicleCategory;
    registration: string;
    meterType: 'KM' | 'HEURES';
    currentMeter: number;
    nextServiceMeter: number;
    standardConsumption: number;
    insuranceExpiry: string;
    techInspectionExpiry: string;
  }) => ActionResult;
  recordFuelRefill: (payload: {
    vehicleId: string;
    date: string;
    source: 'CUVE_INTERNE' | 'STATION_EXTERNE';
    currentMeter: number;
    liters: number;
    unitPrice: number;
    filiere: Filiere;
    paymentMode: Exclude<PaymentMode, 'CREDIT'>;
  }) => ActionResult;
  recordTripOrMaintenance: (payload: {
    vehicleId: string;
    date: string;
    driver: string;
    filiere: Filiere;
    mission: string;
    distanceOrHours: number;
    maintenancePerformed?: string;
    maintenanceCost?: number;
    nextServiceMeter?: number;
  }) => ActionResult;

  // Actions Immobilisations
  addFixedAsset: (payload: Omit<FixedAsset, 'id' | 'status'>) => ActionResult;
  disposeFixedAsset: (payload: {
    assetId: string;
    type: 'CEDE' | 'REBUT';
    date: string;
    disposalPrice: number;
    paymentMode: Exclude<PaymentMode, 'CREDIT'>;
  }) => ActionResult;
  verifyAssetQR: (payload: {
    assetCode: string;
    physicalStatus: 'CONFORME' | 'A_REPARER' | 'MANQUANT';
  }) => ActionResult;

  // Sauvegarde / Restauration / Reset
  resetDemoData: () => Promise<ActionResult>;
  exportBackupJSON: () => void;
  importBackupJSON: (jsonText: string) => Promise<ActionResult>;
}

const ROLE_MODULES: Record<UserRole, ModuleId[]> = {
  ADMIN: ['dashboard', 'stocks', 'production', 'sales', 'accounting', 'fleet', 'assets'],
  EXPLOITATION: ['dashboard', 'stocks', 'production', 'sales', 'fleet', 'assets'],
  TECHNICIEN: ['production', 'stocks', 'fleet', 'assets'],
  MAGASINIER: ['stocks', 'sales'],
  COMMERCIAL: ['dashboard', 'sales'],
  COMPTABLE: ['dashboard', 'accounting', 'sales', 'assets'],
  PARC: ['fleet', 'stocks', 'assets'],
};

const ROLE_WRITE_PERMISSIONS: Record<UserRole, ModuleId[]> = {
  ADMIN: ['dashboard', 'stocks', 'production', 'sales', 'accounting', 'fleet', 'assets'],
  EXPLOITATION: ['stocks', 'production', 'fleet', 'assets'],
  TECHNICIEN: ['production', 'stocks', 'fleet', 'assets'],
  MAGASINIER: ['stocks'],
  COMMERCIAL: ['sales'],
  COMPTABLE: ['accounting', 'assets', 'sales'],
  PARC: ['fleet', 'assets'],
};

const ERPContext = createContext<ERPContextValue | null>(null);

function treasuryCodeFromMode(mode: PaymentMode): string {
  if (mode === 'BANQUE') return '521';
  if (mode === 'MOBILE_MONEY') return '552';
  if (mode === 'CAISSE') return '571';
  return '401';
}

function purchaseAccountFromCategory(cat: InputCategory): string {
  if (cat === 'ALIMENT_POULET' || cat === 'ALIMENT_PORC' || cat === 'ALIMENT_POISSON') return '6021';
  if (cat === 'SEMENCES' || cat === 'ENGRAIS') return '6022';
  if (cat === 'VETERINAIRE' || cat === 'PHYTOSANITAIRE') return '6023';
  return '6056';
}

function salesAccountFromFiliere(filiere: Exclude<Filiere, 'TRANSVERSAL'>): string {
  if (filiere === 'AVICULTURE') return '7021';
  if (filiere === 'PORCICULTURE') return '7022';
  if (filiere === 'PISCICULTURE') return '7023';
  return '7024';
}

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ERPState>(() => loadStateSync(createInitialDemoState()));
  const [role, setRoleState] = useState<UserRole>('ADMIN');
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');

  // Hydratation asynchrone depuis IndexedDB si disponible et plus récente
  useEffect(() => {
    let mounted = true;
    loadStateFromIDB().then((idbState) => {
      if (mounted && idbState && idbState.lastUpdated > state.lastUpdated) {
        setState(idbState);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persistance automatique Offline-First à chaque mutation
  useEffect(() => {
    persistERPState(state);
  }, [state]);

  const allowedModules = useMemo(() => ROLE_MODULES[role], [role]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    const nextAllowed = ROLE_MODULES[newRole];
    if (!nextAllowed.includes(activeModule)) {
      setActiveModule(nextAllowed[0]);
    }
  };

  const canWrite = (module: ModuleId) => ROLE_WRITE_PERMISSIONS[role].includes(module);

  // Calcul temps réel des alertes transversales
  const alerts = useMemo<SystemAlert[]>(() => {
    const list: SystemAlert[] = [];

    // 1. Ruptures et seuils critiques d'intrants + péremptions
    for (const item of state.inputs) {
      if (item.quantity <= item.minThreshold) {
        list.push({
          id: `alt-stk-${item.id}`,
          severity: item.quantity === 0 ? 'CRITIQUE' : 'ATTENTION',
          category: 'STOCK',
          title: `Stock critique : ${item.name}`,
          detail: `Disponible : ${item.quantity} ${item.unit} (Seuil min : ${item.minThreshold} ${item.unit})`,
          module: 'stocks',
        });
      }
      if (item.expiryDate) {
        const days = daysUntil(item.expiryDate);
        if (days !== null && days <= 30) {
          list.push({
            id: `alt-exp-${item.id}`,
            severity: days <= 7 ? 'CRITIQUE' : 'ATTENTION',
            category: 'PEREMPTION',
            title: days < 0 ? `Intrant périmé : ${item.name}` : `Péremption proche (${days} j) : ${item.name}`,
            detail: `Échéance lot : ${item.expiryDate} · Stock : ${item.quantity} ${item.unit}`,
            module: 'stocks',
          });
        }
      }
    }

    // 2. Mortalité anormale en élevage (> 5% volaille ou > 4% porc)
    for (const batch of state.batches) {
      if (batch.status !== 'EN_COURS') continue;
      const deaths = batch.initialCount - batch.currentCount;
      const mortalityRate = (deaths / batch.initialCount) * 100;
      const threshold = batch.filiere === 'AVICULTURE' ? 5 : 4;
      if (mortalityRate >= threshold) {
        list.push({
          id: `alt-bat-${batch.id}`,
          severity: mortalityRate >= threshold + 2 ? 'CRITIQUE' : 'ATTENTION',
          category: 'PRODUCTION',
          title: `Mortalité élevée (${mortalityRate.toFixed(1)}%) : ${batch.code}`,
          detail: `${deaths} pertes sur ${batch.initialCount} sujets (${batch.name})`,
          module: 'production',
        });
      }
    }

    // 3. Créances clients en retard
    for (const inv of state.invoices) {
      const remaining = inv.totalAmount - inv.amountPaid;
      const days = daysUntil(inv.dueDate);
      if (remaining > 0 && (inv.status === 'EN_RETARD' || (days !== null && days < 0))) {
        list.push({
          id: `alt-inv-${inv.id}`,
          severity: 'CRITIQUE',
          category: 'RECOUVREMENT',
          title: `Créance en retard : ${inv.number}`,
          detail: `${inv.customerName} · Reste dû : ${remaining.toLocaleString('fr-FR')} FCFA`,
          module: 'sales',
        });
      }
    }

    // 4. Maintenance véhicules, assurances et surconsommation
    for (const veh of state.vehicles) {
      const remainingMeter = veh.nextServiceMeter - veh.currentMeter;
      const warnMargin = veh.meterType === 'HEURES' ? 25 : 800;
      if (remainingMeter <= warnMargin) {
        list.push({
          id: `alt-srv-${veh.id}`,
          severity: remainingMeter <= 0 ? 'CRITIQUE' : 'ATTENTION',
          category: 'PARC',
          title: `Maintenance préventive : ${veh.name}`,
          detail:
            remainingMeter <= 0
              ? `Seuil vidange dépassé de ${Math.abs(remainingMeter)} ${veh.meterType.toLowerCase()}`
              : `Vidange/filtre dans ${remainingMeter} ${veh.meterType.toLowerCase()}`,
          module: 'fleet',
        });
      }

      const insDays = daysUntil(veh.insuranceExpiry);
      if (insDays !== null && insDays <= 20) {
        list.push({
          id: `alt-ins-${veh.id}`,
          severity: insDays <= 5 ? 'CRITIQUE' : 'ATTENTION',
          category: 'PARC',
          title: `Assurance à renouveler : ${veh.registration}`,
          detail: `${veh.name} · Expire dans ${insDays} jour(s) (${veh.insuranceExpiry})`,
          module: 'fleet',
        });
      }

      const techDays = daysUntil(veh.techInspectionExpiry);
      if (techDays !== null && techDays <= 20) {
        list.push({
          id: `alt-tec-${veh.id}`,
          severity: techDays <= 5 ? 'CRITIQUE' : 'ATTENTION',
          category: 'PARC',
          title: `Visite technique proche : ${veh.registration}`,
          detail: `${veh.name} · Expire dans ${techDays} jour(s) (${veh.techInspectionExpiry})`,
          module: 'fleet',
        });
      }
    }

    const recentOverFuel = state.fuelLogs.filter((f) => f.isOverconsumption).slice(-2);
    for (const fl of recentOverFuel) {
      list.push({
        id: `alt-fuel-${fl.id}`,
        severity: 'ATTENTION',
        category: 'PARC',
        title: `Surconsommation détectée : ${fl.vehicleName}`,
        detail: `Relevé du ${fl.date} : ${fl.calculatedConsumption.toFixed(2)} L (au-dessus de la norme constructeur)`,
        module: 'fleet',
      });
    }

    return list;
  }, [state]);

  const updateTreasuryBalance = (
    treasury: ERPState['treasury'],
    mode: PaymentMode,
    delta: number
  ): ERPState['treasury'] => {
    if (mode === 'CREDIT') return treasury;
    return treasury.map((t) => (t.type === mode ? { ...t, balance: t.balance + delta } : t));
  };

  // --- B. STOCKS D'INTRANTS ---

  const addInputCatalogItem: ERPContextValue['addInputCatalogItem'] = (payload) => {
    if (!payload.name.trim() || !payload.code.trim()) {
      return { ok: false, message: 'Le code et la désignation de l’intrant sont obligatoires.' };
    }
    if (state.inputs.some((i) => i.code.toLowerCase() === payload.code.trim().toLowerCase())) {
      return { ok: false, message: 'Ce code intrant existe déjà au catalogue.' };
    }
    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      inputs: [
        ...prev.inputs,
        {
          id: `inp-${Date.now()}`,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          category: payload.category,
          unit: payload.unit.trim() || 'unité',
          quantity: 0,
          minThreshold: Math.max(0, payload.minThreshold),
          unitCost: Math.max(0, payload.unitCost),
          expiryDate: payload.expiryDate || undefined,
          supplierName: payload.supplierName.trim() || 'Fournisseur divers',
        },
      ],
    }));
    return { ok: true, message: 'Intrant ajouté au catalogue avec succès.' };
  };

  const recordStockEntry: ERPContextValue['recordStockEntry'] = (payload) => {
    const item = state.inputs.find((i) => i.id === payload.itemId);
    if (!item) return { ok: false, message: 'Intrant introuvable.' };
    if (payload.quantity <= 0 || payload.unitCost <= 0) {
      return { ok: false, message: 'La quantité et le coût unitaire doivent être strictement positifs.' };
    }

    const totalAmount = Math.round(payload.quantity * payload.unitCost);
    if (payload.paymentMode !== 'CREDIT') {
      const treAcc = state.treasury.find((t) => t.type === payload.paymentMode);
      if (treAcc && treAcc.balance < totalAmount) {
        return {
          ok: false,
          message: `Solde insuffisant sur ${treAcc.name} (${treAcc.balance.toLocaleString('fr-FR')} FCFA disponible).`,
        };
      }
    }

    // Calcul du Coût Unitaire Moyen Pondéré (CUMP SYSCOHADA)
    const newQty = item.quantity + payload.quantity;
    const newCump = Math.round((item.quantity * item.unitCost + totalAmount) / newQty);

    const debitAcc = getAccountByCode(purchaseAccountFromCategory(item.category));
    const creditAcc = getAccountByCode(treasuryCodeFromMode(payload.paymentMode));

    const filiereMap: Filiere =
      item.category === 'ALIMENT_POULET'
        ? 'AVICULTURE'
        : item.category === 'ALIMENT_PORC'
        ? 'PORCICULTURE'
        : item.category === 'ALIMENT_POISSON'
        ? 'PISCICULTURE'
        : item.category === 'SEMENCES' || item.category === 'ENGRAIS' || item.category === 'PHYTOSANITAIRE'
        ? 'RIZICULTURE'
        : 'TRANSVERSAL';

    const refNum = `BE-2026-${String(state.stockMovements.length + 161).padStart(3, '0')}`;
    const entryPiece = `ACH-2026-${String(state.journalEntries.length + 120).padStart(3, '0')}`;

    const newJournalEntry: JournalEntry = {
      id: `je-${Date.now()}`,
      pieceNumber: entryPiece,
      date: payload.date,
      journal: 'ACH',
      description: `Bon d'entrée ${refNum} - ${payload.quantity} ${item.unit} ${item.name} (${payload.supplier})`,
      filiere: filiereMap,
      autoGenerated: true,
      lines: [
        { accountCode: debitAcc.code, accountLabel: debitAcc.label, debit: totalAmount, credit: 0 },
        { accountCode: creditAcc.code, accountLabel: creditAcc.label, debit: 0, credit: totalAmount },
      ],
    };

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      inputs: prev.inputs.map((i) =>
        i.id === item.id
          ? {
              ...i,
              quantity: newQty,
              unitCost: newCump,
              supplierName: payload.supplier || i.supplierName,
            }
          : i
      ),
      stockMovements: [
        {
          id: `mov-${Date.now()}`,
          reference: refNum,
          date: payload.date,
          type: 'ENTREE',
          itemId: item.id,
          itemName: item.name,
          quantity: payload.quantity,
          unitCost: payload.unitCost,
          totalAmount,
          filiere: filiereMap,
          supplierOrOperator: payload.supplier,
          paymentMode: payload.paymentMode,
          notes: payload.notes,
        },
        ...prev.stockMovements,
      ],
      treasury: updateTreasuryBalance(prev.treasury, payload.paymentMode, -totalAmount),
      journalEntries: [newJournalEntry, ...prev.journalEntries],
    }));

    return {
      ok: true,
      message: `Bon d'entrée ${refNum} validé et écriture SYSCOHADA ${entryPiece} générée (${totalAmount.toLocaleString('fr-FR')} FCFA).`,
    };
  };

  const recordStockExit: ERPContextValue['recordStockExit'] = (payload) => {
    const item = state.inputs.find((i) => i.id === payload.itemId);
    if (!item) return { ok: false, message: 'Intrant introuvable.' };
    if (payload.quantity <= 0) {
      return { ok: false, message: 'La quantité sortie doit être supérieure à zéro.' };
    }
    if (payload.quantity > item.quantity) {
      return {
        ok: false,
        message: `Sortie refusée : quantité demandée (${payload.quantity} ${item.unit}) supérieure au stock disponible (${item.quantity} ${item.unit}).`,
      };
    }
    if (!payload.targetLotCode.trim()) {
      return {
        ok: false,
        message: 'Imputation analytique obligatoire : veuillez sélectionner un lot, étang, parcelle ou engin.',
      };
    }

    const totalCost = Math.round(payload.quantity * item.unitCost);
    const refNum = `BS-2026-${String(state.stockMovements.length + 161).padStart(3, '0')}`;

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      inputs: prev.inputs.map((i) =>
        i.id === item.id ? { ...i, quantity: Number((i.quantity - payload.quantity).toFixed(2)) } : i
      ),
      stockMovements: [
        {
          id: `mov-${Date.now()}`,
          reference: refNum,
          date: payload.date,
          type: 'SORTIE',
          itemId: item.id,
          itemName: item.name,
          quantity: payload.quantity,
          theoreticalQuantity: payload.theoreticalQuantity > 0 ? payload.theoreticalQuantity : payload.quantity,
          unitCost: item.unitCost,
          totalAmount: totalCost,
          filiere: payload.filiere,
          targetLotCode: payload.targetLotCode,
          supplierOrOperator: payload.operator || 'Technicien exploitation',
          notes: payload.notes,
        },
        ...prev.stockMovements,
      ],
      // Imputation automatique du coût direct sur le lot/étang/parcelle correspondant
      batches: prev.batches.map((b) =>
        b.code === payload.targetLotCode ? { ...b, feedAndVetCost: b.feedAndVetCost + totalCost } : b
      ),
      ponds: prev.ponds.map((p) =>
        p.code === payload.targetLotCode ? { ...p, directCost: p.directCost + totalCost } : p
      ),
      parcels: prev.parcels.map((r) =>
        r.code === payload.targetLotCode ? { ...r, directCost: r.directCost + totalCost } : r
      ),
    }));

    return {
      ok: true,
      message: `Bon de sortie ${refNum} imputé à ${payload.targetLotCode} (${totalCost.toLocaleString('fr-FR')} FCFA).`,
    };
  };

  const recordPhysicalInventory: ERPContextValue['recordPhysicalInventory'] = (payload) => {
    const item = state.inputs.find((i) => i.id === payload.itemId);
    if (!item) return { ok: false, message: 'Intrant introuvable.' };
    if (payload.countedQty < 0) return { ok: false, message: 'Le stock compté ne peut pas être négatif.' };
    const variance = Number((payload.countedQty - item.quantity).toFixed(2));
    if (variance !== 0 && !payload.justification.trim()) {
      return { ok: false, message: 'Une justification écrite est obligatoire pour tout écart d’inventaire.' };
    }

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      inputs: prev.inputs.map((i) => (i.id === item.id ? { ...i, quantity: payload.countedQty } : i)),
      inventories: [
        {
          id: `invp-${Date.now()}`,
          date: payload.date,
          itemId: item.id,
          itemName: item.name,
          systemQty: item.quantity,
          countedQty: payload.countedQty,
          variance,
          justification: payload.justification.trim() || 'RAS - Stock physique conforme au théorique',
          operator: payload.operator || 'Magasinier',
        },
        ...prev.inventories,
      ],
    }));
    return {
      ok: true,
      message: `Inventaire physique validé pour ${item.name} (Écart : ${variance > 0 ? `+${variance}` : variance} ${item.unit}).`,
    };
  };

  // --- C. PRODUCTION (4 FILIÈRES) ---

  const createLivestockBatch: ERPContextValue['createLivestockBatch'] = (payload) => {
    if (!payload.code.trim() || !payload.name.trim() || payload.initialCount <= 0) {
      return { ok: false, message: 'Veuillez renseigner le code, le nom et un effectif initial valide.' };
    }
    if (state.batches.some((b) => b.code.toUpperCase() === payload.code.trim().toUpperCase())) {
      return { ok: false, message: 'Ce code de lot/bande existe déjà.' };
    }

    const creditAcc = getAccountByCode(treasuryCodeFromMode(payload.paymentMode));
    const debitAcc = getAccountByCode('6041');
    const piece = `ACH-2026-${String(state.journalEntries.length + 120).padStart(3, '0')}`;

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      batches: [
        {
          id: `bat-${Date.now()}`,
          code: payload.code.trim().toUpperCase(),
          filiere: payload.filiere,
          name: payload.name.trim(),
          breed: payload.breed.trim() || 'Standard',
          building: payload.building.trim() || 'Bâtiment principal',
          startDate: payload.startDate,
          initialCount: payload.initialCount,
          currentCount: payload.initialCount,
          initialAvgWeightKg: payload.initialAvgWeightKg,
          avgWeightKg: payload.initialAvgWeightKg,
          targetWeightKg: payload.targetWeightKg,
          totalFeedKg: 0,
          theoreticalFeedKg: 0,
          purchaseCost: payload.purchaseCost,
          feedAndVetCost: 0,
          status: 'EN_COURS',
          logs: [],
        },
        ...prev.batches,
      ],
      treasury:
        payload.purchaseCost > 0
          ? updateTreasuryBalance(prev.treasury, payload.paymentMode, -payload.purchaseCost)
          : prev.treasury,
      journalEntries:
        payload.purchaseCost > 0
          ? [
              {
                id: `je-${Date.now()}`,
                pieceNumber: piece,
                date: payload.startDate,
                journal: 'ACH',
                description: `Mise en place ${payload.code} (${payload.initialCount} sujets)`,
                filiere: payload.filiere,
                autoGenerated: true,
                lines: [
                  { accountCode: debitAcc.code, accountLabel: debitAcc.label, debit: payload.purchaseCost, credit: 0 },
                  { accountCode: creditAcc.code, accountLabel: creditAcc.label, debit: 0, credit: payload.purchaseCost },
                ],
              },
              ...prev.journalEntries,
            ]
          : prev.journalEntries,
    }));

    return { ok: true, message: `Lot ${payload.code.toUpperCase()} créé et initialisé.` };
  };

  const logBatchDaily: ERPContextValue['logBatchDaily'] = (payload) => {
    const batch = state.batches.find((b) => b.id === payload.batchId);
    if (!batch) return { ok: false, message: 'Lot introuvable.' };
    if (payload.mortality < 0 || payload.mortality > batch.currentCount) {
      return {
        ok: false,
        message: `Mortalité invalide (doit être comprise entre 0 et l’effectif restant de ${batch.currentCount}).`,
      };
    }
    if (payload.feedKg < 0 || payload.avgWeightKg <= 0) {
      return { ok: false, message: 'Veuillez saisir un poids moyen strictement positif et un aliment >= 0.' };
    }

    const estFeedUnitCost = batch.filiere === 'AVICULTURE' ? 350 : 310; // FCFA/kg moyen
    const addedCost = Math.round(payload.feedKg * estFeedUnitCost + (payload.vetCost || 0));

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      batches: prev.batches.map((b) =>
        b.id === batch.id
          ? {
              ...b,
              currentCount: b.currentCount - payload.mortality,
              avgWeightKg: payload.avgWeightKg,
              totalFeedKg: b.totalFeedKg + payload.feedKg,
              theoreticalFeedKg: b.theoreticalFeedKg + Math.round(payload.feedKg * 0.97),
              feedAndVetCost: b.feedAndVetCost + addedCost,
              logs: [
                {
                  id: `bl-${Date.now()}`,
                  date: payload.date,
                  mortality: payload.mortality,
                  feedKg: payload.feedKg,
                  avgWeightKg: payload.avgWeightKg,
                  vetCare: payload.vetCare,
                  costAdded: addedCost,
                },
                ...b.logs,
              ],
            }
          : b
      ),
    }));

    return { ok: true, message: `Suivi quotidien enregistré sur ${batch.code}.` };
  };

  const harvestBatchToStock: ERPContextValue['harvestBatchToStock'] = (payload) => {
    const batch = state.batches.find((b) => b.id === payload.batchId);
    const prod = state.finishedProducts.find((p) => p.id === payload.productId);
    if (!batch || !prod) return { ok: false, message: 'Lot ou produit fini introuvable.' };
    if (payload.headsHarvested <= 0 || payload.headsHarvested > batch.currentCount) {
      return { ok: false, message: `Effectif prélevé invalide (max disponible : ${batch.currentCount}).` };
    }
    if (payload.stockUnitsProduced <= 0) {
      return { ok: false, message: 'La quantité transférée au stock commercial doit être positive.' };
    }

    const remainingHeads = batch.currentCount - payload.headsHarvested;

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      batches: prev.batches.map((b) =>
        b.id === batch.id
          ? {
              ...b,
              currentCount: remainingHeads,
              status: remainingHeads === 0 ? 'CLOTURE' : b.status,
            }
          : b
      ),
      finishedProducts: prev.finishedProducts.map((fp) =>
        fp.id === prod.id ? { ...fp, quantity: fp.quantity + payload.stockUnitsProduced } : fp
      ),
    }));

    return {
      ok: true,
      message: `Transfert validé : +${payload.stockUnitsProduced} ${prod.unit} ajoutés au stock commercial "${prod.name}".`,
    };
  };

  const createFishPond: ERPContextValue['createFishPond'] = (payload) => {
    if (!payload.code.trim() || !payload.name.trim() || payload.initialFingerlings <= 0) {
      return { ok: false, message: 'Données d’empoissonnement incomplètes.' };
    }
    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      ponds: [
        {
          id: `pnd-${Date.now()}`,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          surfaceM2: payload.surfaceM2,
          species: payload.species,
          stockingDate: payload.stockingDate,
          initialFingerlings: payload.initialFingerlings,
          currentCount: payload.initialFingerlings,
          avgWeightG: 15,
          totalFeedKg: 0,
          harvestedTotalKg: 0,
          directCost: payload.directCost,
          status: 'ACTIF',
          logs: [],
        },
        ...prev.ponds,
      ],
    }));
    return { ok: true, message: `Étang ${payload.code.toUpperCase()} empoissonné avec succès.` };
  };

  const logPondEvent: ERPContextValue['logPondEvent'] = (payload) => {
    const pond = state.ponds.find((p) => p.id === payload.pondId);
    if (!pond) return { ok: false, message: 'Étang introuvable.' };
    if (payload.mortality < 0 || payload.mortality > pond.currentCount) {
      return { ok: false, message: 'Mortalité supérieure à l’effectif estimé dans l’étang.' };
    }

    const avgW = payload.sampleAvgWeightG > 0 ? payload.sampleAvgWeightG : pond.avgWeightG;
    const harvestedFishCount =
      payload.harvestedKg > 0 && avgW > 0 ? Math.min(pond.currentCount, Math.round((payload.harvestedKg * 1000) / avgW)) : 0;

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      ponds: prev.ponds.map((p) =>
        p.id === pond.id
          ? {
              ...p,
              currentCount: Math.max(0, p.currentCount - payload.mortality - harvestedFishCount),
              avgWeightG: avgW,
              totalFeedKg: p.totalFeedKg + payload.feedKg,
              harvestedTotalKg: p.harvestedTotalKg + payload.harvestedKg,
              directCost: p.directCost + Math.round(payload.feedKg * 840),
              status: payload.type === 'RECOLTE_TOTALE' ? 'VIDE_SANITAIRE' : p.status,
              logs: [
                {
                  id: `pl-${Date.now()}`,
                  date: payload.date,
                  type: payload.type,
                  mortality: payload.mortality,
                  feedKg: payload.feedKg,
                  sampleAvgWeightG: avgW,
                  harvestedKg: payload.harvestedKg,
                  notes: payload.notes,
                },
                ...p.logs,
              ],
            }
          : p
      ),
      finishedProducts:
        payload.harvestedKg > 0 && payload.targetProductId
          ? prev.finishedProducts.map((fp) =>
              fp.id === payload.targetProductId ? { ...fp, quantity: fp.quantity + payload.harvestedKg } : fp
            )
          : prev.finishedProducts,
    }));

    return {
      ok: true,
      message:
        payload.harvestedKg > 0
          ? `Récolte piscicole de ${payload.harvestedKg} kg transférée au stock commercial.`
          : `Opération enregistrée sur ${pond.code}.`,
    };
  };

  const createRiceParcel: ERPContextValue['createRiceParcel'] = (payload) => {
    if (!payload.code.trim() || !payload.name.trim() || payload.surfaceHa <= 0) {
      return { ok: false, message: 'Veuillez renseigner un code, un nom et une surface en hectares valide.' };
    }
    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      parcels: [
        {
          id: `par-${Date.now()}`,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          surfaceHa: payload.surfaceHa,
          variety: payload.variety,
          sowingDate: payload.sowingDate,
          currentStage: 'SEMIS',
          directCost: 0,
          harvestedPaddyKg: 0,
          milledWhiteRiceKg: 0,
          logs: [],
        },
        ...prev.parcels,
      ],
    }));
    return { ok: true, message: `Parcelle ${payload.code.toUpperCase()} enregistrée.` };
  };

  const logParcelOperation: ERPContextValue['logParcelOperation'] = (payload) => {
    const parcel = state.parcels.find((r) => r.id === payload.parcelId);
    if (!parcel) return { ok: false, message: 'Parcelle introuvable.' };

    // Si transformation de paddy en riz blanchi : vérifier disponibilité paddy récolté
    if (payload.stage === 'TRANSFORMATION' && payload.paddyTransformedKg <= 0) {
      return { ok: false, message: 'Indiquez le tonnage de riz paddy mis à l’usinage.' };
    }

    const paddyBagsAdded = payload.paddyHarvestedKg > 0 ? Math.floor(payload.paddyHarvestedKg / 50) : 0;
    const paddyBagsConsumed = payload.paddyTransformedKg > 0 ? Math.floor(payload.paddyTransformedKg / 50) : 0;
    const whiteBagsAdded = payload.whiteRiceObtainedKg > 0 ? Math.floor(payload.whiteRiceObtainedKg / 50) : 0;

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      parcels: prev.parcels.map((r) =>
        r.id === parcel.id
          ? {
              ...r,
              currentStage: payload.stage,
              directCost: r.directCost + Math.max(0, payload.cost),
              harvestedPaddyKg: r.harvestedPaddyKg + payload.paddyHarvestedKg,
              milledWhiteRiceKg: r.milledWhiteRiceKg + payload.whiteRiceObtainedKg,
              logs: [
                {
                  id: `rl-${Date.now()}`,
                  date: payload.date,
                  stage: payload.stage,
                  description: payload.description,
                  paddyHarvestedKg: payload.paddyHarvestedKg,
                  paddyTransformedKg: payload.paddyTransformedKg,
                  whiteRiceObtainedKg: payload.whiteRiceObtainedKg,
                  cost: payload.cost,
                },
                ...r.logs,
              ],
            }
          : r
      ),
      finishedProducts: prev.finishedProducts.map((fp) => {
        if (fp.code === 'PF-RIZ-PAD') {
          return { ...fp, quantity: Math.max(0, fp.quantity + paddyBagsAdded - paddyBagsConsumed) };
        }
        if (fp.code === 'PF-RIZ-BLA') {
          return { ...fp, quantity: fp.quantity + whiteBagsAdded };
        }
        return fp;
      }),
    }));

    return {
      ok: true,
      message:
        whiteBagsAdded > 0
          ? `Usinage enregistré : +${whiteBagsAdded} sacs (50 kg) de riz blanchi ajoutés au stock commercial.`
          : paddyBagsAdded > 0
          ? `Récolte enregistrée : +${paddyBagsAdded} sacs (50 kg) de riz paddy stockés.`
          : `Étape culturale enregistrée sur ${parcel.code}.`,
    };
  };

  // --- D. PRODUITS FINIS, VENTES & RECOUVREMENT ---

  const createCustomer: ERPContextValue['createCustomer'] = (payload) => {
    if (!payload.name.trim() || payload.creditLimit < 0) {
      return { ok: false, message: 'Nom du client et plafond d’encours requis.' };
    }
    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      customers: [
        ...prev.customers,
        {
          ...payload,
          id: `cli-${Date.now()}`,
          code: payload.code.trim().toUpperCase() || `CLI-00${prev.customers.length + 1}`,
          currentBalance: 0,
        },
      ],
    }));
    return { ok: true, message: `Fiche client "${payload.name}" créée.` };
  };

  const createInvoice: ERPContextValue['createInvoice'] = (payload) => {
    const customer = state.customers.find((c) => c.id === payload.customerId);
    if (!customer) return { ok: false, message: 'Client introuvable.' };
    if (payload.items.length === 0) return { ok: false, message: 'Ajoutez au moins une ligne de produit à facturer.' };

    // 1. Validation stricte des stocks produits finis
    for (const line of payload.items) {
      const fp = state.finishedProducts.find((p) => p.id === line.productId);
      if (!fp) return { ok: false, message: `Produit ${line.productName} introuvable.` };
      if (line.quantity <= 0) return { ok: false, message: 'Les quantités vendues doivent être positives.' };
      if (line.quantity > fp.quantity) {
        return {
          ok: false,
          message: `Stock insuffisant pour "${fp.name}" : demandé ${line.quantity} ${fp.unit}, disponible ${fp.quantity} ${fp.unit}.`,
        };
      }
    }

    const totalAmount = payload.items.reduce((acc, it) => acc + it.total, 0);
    const paid = Math.min(totalAmount, Math.max(0, Math.round(payload.amountPaid)));
    const unpaid = totalAmount - paid;

    // 2. Contrôle strict du plafond d'encours client (blocage automatique)
    if (unpaid > 0 && customer.currentBalance + unpaid > customer.creditLimit) {
      return {
        ok: false,
        message: `BLOCAGE PLAFOND CRÉDIT : Nouvel encours (${(customer.currentBalance + unpaid).toLocaleString('fr-FR')} FCFA) supérieur au plafond autorisé de ${customer.name} (${customer.creditLimit.toLocaleString('fr-FR')} FCFA). Exigez un règlement comptant ou un acompte supérieur.`,
      };
    }

    const invNumber = `FAC-2026-${String(state.invoices.length + 119).padStart(3, '0')}`;
    const paymentTerm = paid === totalAmount ? 'COMPTANT' : paid === 0 ? 'CREDIT' : 'ACOMPTE';
    const isOverdue = unpaid > 0 && (daysUntil(payload.dueDate) ?? 0) < 0;
    const status = unpaid === 0 ? 'PAYE' : isOverdue ? 'EN_RETARD' : 'PARTIEL';

    // 3. Génération automatique des écritures comptables SYSCOHADA (Journal VTE + Journal TRE si règlement)
    const byFiliere = new Map<Exclude<Filiere, 'TRANSVERSAL'>, number>();
    for (const it of payload.items) {
      byFiliere.set(it.filiere, (byFiliere.get(it.filiere) || 0) + it.total);
    }

    const vteLines: JournalLine[] = [
      { accountCode: '411', accountLabel: 'Clients', debit: totalAmount, credit: 0 },
    ];
    byFiliere.forEach((amt, fil) => {
      const acc = getAccountByCode(salesAccountFromFiliere(fil));
      vteLines.push({ accountCode: acc.code, accountLabel: acc.label, debit: 0, credit: amt });
    });

    const dominantFiliere = payload.items[0].filiere;
    const newEntries: JournalEntry[] = [
      {
        id: `je-vte-${Date.now()}`,
        pieceNumber: `VTE-${invNumber.replace('FAC-', '')}`,
        date: payload.date,
        journal: 'VTE',
        description: `Facture client ${invNumber} - ${customer.name}`,
        filiere: dominantFiliere,
        autoGenerated: true,
        lines: vteLines,
      },
    ];

    if (paid > 0 && payload.paymentMode !== 'CREDIT') {
      const treAcc = getAccountByCode(treasuryCodeFromMode(payload.paymentMode));
      newEntries.unshift({
        id: `je-tre-${Date.now() + 1}`,
        pieceNumber: `TRE-${invNumber.replace('FAC-', '')}`,
        date: payload.date,
        journal: 'TRE',
        description: `Encaissement ${paymentTerm.toLowerCase()} s/ ${invNumber} - ${customer.name}`,
        filiere: dominantFiliere,
        autoGenerated: true,
        lines: [
          { accountCode: treAcc.code, accountLabel: treAcc.label, debit: paid, credit: 0 },
          { accountCode: '411', accountLabel: 'Clients', debit: 0, credit: paid },
        ],
      });
    }

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      finishedProducts: prev.finishedProducts.map((fp) => {
        const sold = payload.items.find((i) => i.productId === fp.id);
        return sold ? { ...fp, quantity: Number((fp.quantity - sold.quantity).toFixed(2)) } : fp;
      }),
      customers: prev.customers.map((c) =>
        c.id === customer.id ? { ...c, currentBalance: c.currentBalance + unpaid } : c
      ),
      invoices: [
        {
          id: `inv-${Date.now()}`,
          number: invNumber,
          date: payload.date,
          dueDate: payload.dueDate,
          customerId: customer.id,
          customerName: customer.name,
          items: payload.items,
          totalAmount,
          amountPaid: paid,
          paymentTerm,
          paymentMode: payload.paymentMode,
          status,
          reminders: [],
        },
        ...prev.invoices,
      ],
      treasury: paid > 0 ? updateTreasuryBalance(prev.treasury, payload.paymentMode, paid) : prev.treasury,
      journalEntries: [...newEntries, ...prev.journalEntries],
    }));

    return {
      ok: true,
      message: `Facture ${invNumber} émise (${totalAmount.toLocaleString('fr-FR')} FCFA) et comptabilisée en SYSCOHADA.`,
    };
  };

  const recordInvoicePayment: ERPContextValue['recordInvoicePayment'] = (payload) => {
    const inv = state.invoices.find((i) => i.id === payload.invoiceId);
    if (!inv) return { ok: false, message: 'Facture introuvable.' };
    const remaining = inv.totalAmount - inv.amountPaid;
    if (payload.amount <= 0 || payload.amount > remaining) {
      return {
        ok: false,
        message: `Montant invalide : le reste à recouvrer est de ${remaining.toLocaleString('fr-FR')} FCFA.`,
      };
    }

    const newPaid = inv.amountPaid + payload.amount;
    const newRemaining = inv.totalAmount - newPaid;
    const isLate = newRemaining > 0 && (daysUntil(inv.dueDate) ?? 0) < 0;
    const treAcc = getAccountByCode(treasuryCodeFromMode(payload.paymentMode));
    const piece = `TRE-REC-${String(state.journalEntries.length + 120).padStart(3, '0')}`;

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      invoices: prev.invoices.map((i) =>
        i.id === inv.id
          ? {
              ...i,
              amountPaid: newPaid,
              status: newRemaining === 0 ? 'PAYE' : isLate ? 'EN_RETARD' : 'PARTIEL',
            }
          : i
      ),
      customers: prev.customers.map((c) =>
        c.id === inv.customerId ? { ...c, currentBalance: Math.max(0, c.currentBalance - payload.amount) } : c
      ),
      treasury: updateTreasuryBalance(prev.treasury, payload.paymentMode, payload.amount),
      journalEntries: [
        {
          id: `je-${Date.now()}`,
          pieceNumber: piece,
          date: payload.date,
          journal: 'TRE',
          description: `Règlement client s/ ${inv.number} - ${inv.customerName}`,
          filiere: inv.items[0]?.filiere || 'TRANSVERSAL',
          autoGenerated: true,
          lines: [
            { accountCode: treAcc.code, accountLabel: treAcc.label, debit: payload.amount, credit: 0 },
            { accountCode: '411', accountLabel: 'Clients', debit: 0, credit: payload.amount },
          ],
        },
        ...prev.journalEntries,
      ],
    }));

    return {
      ok: true,
      message: `Encaissement de ${payload.amount.toLocaleString('fr-FR')} FCFA enregistré (Pièce ${piece}).`,
    };
  };

  const addInvoiceReminder: ERPContextValue['addInvoiceReminder'] = (payload) => {
    if (!payload.note.trim()) return { ok: false, message: 'Veuillez saisir le compte-rendu de relance.' };
    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      invoices: prev.invoices.map((i) =>
        i.id === payload.invoiceId
          ? {
              ...i,
              reminders: [
                {
                  id: `rem-${Date.now()}`,
                  date: getTodayISO(),
                  channel: payload.channel,
                  note: payload.note.trim(),
                  agent: payload.agent.trim() || 'Service Recouvrement',
                },
                ...i.reminders,
              ],
            }
          : i
      ),
    }));
    return { ok: true, message: 'Relance inscrite au journal de recouvrement.' };
  };

  // --- E. COMPTABILITÉ SYSCOHADA ---

  const addManualJournalEntry: ERPContextValue['addManualJournalEntry'] = (payload) => {
    const validLines = payload.lines.filter((l) => l.debit > 0 || l.credit > 0);
    if (validLines.length < 2) {
      return { ok: false, message: 'Une écriture comptable doit comporter au moins deux lignes mouvementées.' };
    }
    const sumDebit = validLines.reduce((acc, l) => acc + Math.round(l.debit), 0);
    const sumCredit = validLines.reduce((acc, l) => acc + Math.round(l.credit), 0);
    if (sumDebit !== sumCredit || sumDebit === 0) {
      return {
        ok: false,
        message: `Partie double non équilibrée : Total Débit (${sumDebit.toLocaleString('fr-FR')}) ≠ Total Crédit (${sumCredit.toLocaleString('fr-FR')}).`,
      };
    }

    const piece = `${payload.journal}-2026-${String(state.journalEntries.length + 125).padStart(3, '0')}`;

    // Mise à jour éventuelle de la trésorerie si compte 521/552/571 mouvementé
    let updatedTreasury = [...state.treasury];
    for (const l of validLines) {
      if (l.accountCode === '521' || l.accountCode === '552' || l.accountCode === '571') {
        const delta = l.debit - l.credit;
        updatedTreasury = updatedTreasury.map((t) =>
          t.code === l.accountCode ? { ...t, balance: t.balance + delta } : t
        );
      }
    }

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      treasury: updatedTreasury,
      journalEntries: [
        {
          id: `je-${Date.now()}`,
          pieceNumber: piece,
          date: payload.date,
          journal: payload.journal,
          description: payload.description.trim() || 'Opération comptable manuelle',
          filiere: payload.filiere,
          lines: validLines,
          autoGenerated: false,
        },
        ...prev.journalEntries,
      ],
    }));

    return { ok: true, message: `Écriture ${piece} comptabilisée avec succès.` };
  };

  const postAnnualDepreciations: ERPContextValue['postAnnualDepreciations'] = (year) => {
    const tag = `DOT-AMORT-${year}`;
    if (state.journalEntries.some((j) => j.pieceNumber === tag)) {
      return { ok: false, message: `Les dotations aux amortissements de l’exercice ${year} ont déjà été comptabilisées.` };
    }

    const newEntries: JournalEntry[] = [];
    let totalPosted = 0;

    for (const asset of state.assets) {
      if (asset.status !== 'EN_SERVICE') continue;
      const { annualDotation } = computeAssetDepreciation(asset, year);
      if (annualDotation <= 0) continue;

      const amortCode = asset.category === 'BATIMENT' || asset.category === 'ETANG' ? '283' : '284';
      const amortAcc = getAccountByCode(amortCode);
      totalPosted += annualDotation;

      newEntries.push({
        id: `je-amo-${asset.id}-${year}`,
        pieceNumber: newEntries.length === 0 ? tag : `${tag}-${newEntries.length + 1}`,
        date: `${year}-12-31`,
        journal: 'OD',
        description: `Dotation amortissement ${year} - ${asset.name} (${asset.code})`,
        filiere: asset.filiere,
        autoGenerated: true,
        lines: [
          {
            accountCode: '681',
            accountLabel: 'Dotations aux amortissements d’exploitation',
            debit: annualDotation,
            credit: 0,
          },
          {
            accountCode: amortAcc.code,
            accountLabel: amortAcc.label,
            debit: 0,
            credit: annualDotation,
          },
        ],
      });
    }

    if (newEntries.length === 0) {
      return { ok: false, message: 'Aucune dotation amortissable trouvée pour cet exercice.' };
    }

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      journalEntries: [...newEntries, ...prev.journalEntries],
    }));

    return {
      ok: true,
      message: `${newEntries.length} écritures de dotations (${totalPosted.toLocaleString('fr-FR')} FCFA) générées par filière pour ${year}.`,
    };
  };

  // --- F. PARC AUTOMOBILE & ENGINS ---

  const addVehicle: ERPContextValue['addVehicle'] = (payload) => {
    if (!payload.name.trim() || !payload.registration.trim()) {
      return { ok: false, message: 'Désignation et immatriculation/identifiant obligatoires.' };
    }
    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      vehicles: [
        ...prev.vehicles,
        {
          id: `veh-${Date.now()}`,
          code: payload.code.trim().toUpperCase() || `VEH-0${prev.vehicles.length + 1}`,
          name: payload.name.trim(),
          category: payload.category,
          registration: payload.registration.trim().toUpperCase(),
          meterType: payload.meterType,
          currentMeter: payload.currentMeter,
          nextServiceMeter: payload.nextServiceMeter,
          standardConsumption: payload.standardConsumption,
          insuranceExpiry: payload.insuranceExpiry,
          techInspectionExpiry: payload.techInspectionExpiry,
          status: 'OPERATIONNEL',
        },
      ],
    }));
    return { ok: true, message: `Engin/Véhicule ${payload.name} ajouté au parc.` };
  };

  const recordFuelRefill: ERPContextValue['recordFuelRefill'] = (payload) => {
    const veh = state.vehicles.find((v) => v.id === payload.vehicleId);
    if (!veh) return { ok: false, message: 'Véhicule ou engin introuvable.' };

    // Validation stricte anti-fraude : compteur strictement supérieur au précédent relevé
    if (payload.currentMeter <= veh.currentMeter) {
      return {
        ok: false,
        message: `RELEVÉ COMPTEUR REJETÉ : Le nouveau compteur (${payload.currentMeter} ${veh.meterType}) doit être strictement supérieur au précédent relevé enregistré (${veh.currentMeter} ${veh.meterType}).`,
      };
    }
    if (payload.liters <= 0 || payload.unitPrice <= 0) {
      return { ok: false, message: 'Volume en litres et prix unitaire doivent être positifs.' };
    }

    const deltaMeter = payload.currentMeter - veh.currentMeter;
    const calcCons =
      veh.meterType === 'KM'
        ? Number(((payload.liters / deltaMeter) * 100).toFixed(2))
        : Number((payload.liters / deltaMeter).toFixed(2));

    const isOver = calcCons > veh.standardConsumption * 1.15;
    const totalCost = Math.round(payload.liters * payload.unitPrice);

    const treAcc = getAccountByCode(treasuryCodeFromMode(payload.paymentMode));
    const piece = `ACH-CARB-${String(state.fuelLogs.length + 20).padStart(3, '0')}`;

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      vehicles: prev.vehicles.map((v) =>
        v.id === veh.id ? { ...v, currentMeter: payload.currentMeter } : v
      ),
      fuelLogs: [
        {
          id: `fl-${Date.now()}`,
          date: payload.date,
          vehicleId: veh.id,
          vehicleName: veh.name,
          source: payload.source,
          previousMeter: veh.currentMeter,
          currentMeter: payload.currentMeter,
          liters: payload.liters,
          unitPrice: payload.unitPrice,
          totalCost,
          calculatedConsumption: calcCons,
          isOverconsumption: isOver,
          filiere: payload.filiere,
          paymentMode: payload.paymentMode,
        },
        ...prev.fuelLogs,
      ],
      treasury: updateTreasuryBalance(prev.treasury, payload.paymentMode, -totalCost),
      journalEntries: [
        {
          id: `je-fuel-${Date.now()}`,
          pieceNumber: piece,
          date: payload.date,
          journal: 'ACH',
          description: `Carburant ${payload.liters}L - ${veh.name} (${payload.source === 'CUVE_INTERNE' ? 'Cuve' : 'Station'})`,
          filiere: payload.filiere,
          autoGenerated: true,
          lines: [
            {
              accountCode: '6052',
              accountLabel: 'Fournitures non stockables - Carburants et lubrifiants',
              debit: totalCost,
              credit: 0,
            },
            { accountCode: treAcc.code, accountLabel: treAcc.label, debit: 0, credit: totalCost },
          ],
        },
        ...prev.journalEntries,
      ],
    }));

    const unitStr = veh.meterType === 'KM' ? 'L/100km' : 'L/h';
    return {
      ok: true,
      message: isOver
        ? `Ravitaillement enregistré. ALERTE SURCONSOMMATION : ${calcCons} ${unitStr} contre ${veh.standardConsumption} ${unitStr} attendu !`
        : `Ravitaillement validé (${calcCons} ${unitStr}) et imputé à la filière.`,
    };
  };

  const recordTripOrMaintenance: ERPContextValue['recordTripOrMaintenance'] = (payload) => {
    const veh = state.vehicles.find((v) => v.id === payload.vehicleId);
    if (!veh) return { ok: false, message: 'Véhicule introuvable.' };
    if (!payload.mission.trim()) return { ok: false, message: 'Décrivez les travaux ou le trajet effectué.' };

    const maintCost = Math.max(0, Math.round(payload.maintenanceCost || 0));

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      vehicles: prev.vehicles.map((v) =>
        v.id === veh.id
          ? {
              ...v,
              nextServiceMeter:
                payload.nextServiceMeter && payload.nextServiceMeter > v.currentMeter
                  ? payload.nextServiceMeter
                  : v.nextServiceMeter,
            }
          : v
      ),
      tripLogs: [
        {
          id: `tl-${Date.now()}`,
          date: payload.date,
          vehicleId: veh.id,
          vehicleName: veh.name,
          driver: payload.driver || 'Chauffeur exploitation',
          filiere: payload.filiere,
          mission: payload.mission.trim(),
          distanceOrHours: payload.distanceOrHours,
          maintenancePerformed: payload.maintenancePerformed,
          maintenanceCost: maintCost > 0 ? maintCost : undefined,
        },
        ...prev.tripLogs,
      ],
      treasury: maintCost > 0 ? updateTreasuryBalance(prev.treasury, 'CAISSE', -maintCost) : prev.treasury,
      journalEntries:
        maintCost > 0
          ? [
              {
                id: `je-mnt-${Date.now()}`,
                pieceNumber: `ACH-MNT-${Date.now().toString().slice(-4)}`,
                date: payload.date,
                journal: 'ACH',
                description: `Maintenance / Vidange ${veh.name} : ${payload.maintenancePerformed || payload.mission}`,
                filiere: payload.filiere,
                autoGenerated: true,
                lines: [
                  {
                    accountCode: '624',
                    accountLabel: 'Entretien, réparations et maintenance du parc',
                    debit: maintCost,
                    credit: 0,
                  },
                  {
                    accountCode: '571',
                    accountLabel: 'Caisse siège et exploitation',
                    debit: 0,
                    credit: maintCost,
                  },
                ],
              },
              ...prev.journalEntries,
            ]
          : prev.journalEntries,
    }));

    return { ok: true, message: 'Carnet de bord et maintenance mis à jour.' };
  };

  // --- G. IMMOBILISATIONS ---

  const addFixedAsset: ERPContextValue['addFixedAsset'] = (payload) => {
    if (!payload.name.trim() || payload.originalValue <= 0) {
      return { ok: false, message: 'Désignation et valeur d’origine positives requises.' };
    }

    const assetAccCode =
      payload.category === 'TERRAIN'
        ? '221'
        : payload.category === 'BATIMENT'
        ? '231'
        : payload.category === 'ETANG'
        ? '234'
        : payload.category === 'MACHINE'
        ? '241'
        : payload.category === 'VEHICULE'
        ? '245'
        : '246';
    const assetAcc = getAccountByCode(assetAccCode);

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      assets: [
        {
          ...payload,
          id: `ast-${Date.now()}`,
          code: payload.code.trim().toUpperCase() || `IMM-0${prev.assets.length + 1}`,
          status: 'EN_SERVICE',
          lastScannedAt: payload.acquisitionDate,
          physicalStatus: 'CONFORME',
        },
        ...prev.assets,
      ],
      treasury: updateTreasuryBalance(prev.treasury, 'BANQUE', -payload.originalValue),
      journalEntries: [
        {
          id: `je-imm-${Date.now()}`,
          pieceNumber: `IMM-ACQ-${Date.now().toString().slice(-4)}`,
          date: payload.acquisitionDate,
          journal: 'ACH',
          description: `Acquisition immobilisation ${payload.name}`,
          filiere: payload.filiere,
          autoGenerated: true,
          lines: [
            { accountCode: assetAcc.code, accountLabel: assetAcc.label, debit: payload.originalValue, credit: 0 },
            {
              accountCode: '521',
              accountLabel: 'Banques locales (Compte courant exploitation)',
              debit: 0,
              credit: payload.originalValue,
            },
          ],
        },
        ...prev.journalEntries,
      ],
    }));

    return { ok: true, message: `Immobilisation ${payload.name} inscrite au registre et comptabilisée.` };
  };

  const disposeFixedAsset: ERPContextValue['disposeFixedAsset'] = (payload) => {
    const asset = state.assets.find((a) => a.id === payload.assetId);
    if (!asset) return { ok: false, message: 'Immobilisation introuvable.' };
    if (asset.status !== 'EN_SERVICE') return { ok: false, message: 'Cet actif est déjà sorti du patrimoine.' };

    const { vnc } = computeAssetDepreciation(asset);
    const price = payload.type === 'REBUT' ? 0 : Math.max(0, Math.round(payload.disposalPrice));
    const gainOrLoss = price - vnc;

    const newEntries: JournalEntry[] = [
      {
        id: `je-ces-vnc-${Date.now()}`,
        pieceNumber: `OD-CES-${asset.code}`,
        date: payload.date,
        journal: 'OD',
        description: `${payload.type === 'CEDE' ? 'Cession' : 'Mise au rebut'} actif ${asset.name} - Sortie VNC`,
        filiere: asset.filiere,
        autoGenerated: true,
        lines: [
          {
            accountCode: '812',
            accountLabel: 'Valeurs comptables des cessions d’immobilisations corporelles',
            debit: vnc,
            credit: 0,
          },
          {
            accountCode: '241',
            accountLabel: `Sortie immobilisation (${asset.code})`,
            debit: 0,
            credit: vnc,
          },
        ],
      },
    ];

    if (price > 0) {
      const treAcc = getAccountByCode(treasuryCodeFromMode(payload.paymentMode));
      newEntries.unshift({
        id: `je-ces-px-${Date.now() + 1}`,
        pieceNumber: `TRE-CES-${asset.code}`,
        date: payload.date,
        journal: 'TRE',
        description: `Produit de cession ${asset.name}`,
        filiere: asset.filiere,
        autoGenerated: true,
        lines: [
          { accountCode: treAcc.code, accountLabel: treAcc.label, debit: price, credit: 0 },
          {
            accountCode: '822',
            accountLabel: 'Produits des cessions d’immobilisations corporelles',
            debit: 0,
            credit: price,
          },
        ],
      });
    }

    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      assets: prev.assets.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              status: payload.type,
              disposalDate: payload.date,
              disposalPrice: price,
            }
          : a
      ),
      treasury: price > 0 ? updateTreasuryBalance(prev.treasury, payload.paymentMode, price) : prev.treasury,
      journalEntries: [...newEntries, ...prev.journalEntries],
    }));

    return {
      ok: true,
      message: `Sortie d’actif enregistrée (${gainOrLoss >= 0 ? 'Plus-value' : 'Moins-value'} HAO : ${gainOrLoss.toLocaleString('fr-FR')} FCFA).`,
    };
  };

  const verifyAssetQR: ERPContextValue['verifyAssetQR'] = (payload) => {
    const cleanCode = payload.assetCode.trim().toUpperCase();
    const asset = state.assets.find((a) => a.code.toUpperCase() === cleanCode);
    if (!asset) {
      return { ok: false, message: `Aucun actif trouvé pour le code QR "${cleanCode}".` };
    }
    const today = getTodayISO();
    setState((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      assets: prev.assets.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              lastScannedAt: today,
              physicalStatus: payload.physicalStatus,
            }
          : a
      ),
    }));
    return {
      ok: true,
      message: `Pointage mobile validé pour ${asset.code} (${asset.name}) — État : ${payload.physicalStatus}.`,
    };
  };

  // --- SAUVEGARDE / RESTAURATION / RESET ---

  const resetDemoData: ERPContextValue['resetDemoData'] = async () => {
    await clearPersistedERPState();
    const fresh = createInitialDemoState();
    fresh.lastUpdated = new Date().toISOString();
    setState(fresh);
    return { ok: true, message: 'Les données de démonstration ont été réinitialisées.' };
  };

  const exportBackupJSON = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sgai-sauvegarde-${getTodayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importBackupJSON: ERPContextValue['importBackupJSON'] = async (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText) as ERPState;
      if (
        !parsed ||
        !Array.isArray(parsed.inputs) ||
        !Array.isArray(parsed.journalEntries) ||
        !Array.isArray(parsed.assets)
      ) {
        return { ok: false, message: 'Fichier JSON invalide : structure SGAI non reconnue.' };
      }
      parsed.lastUpdated = new Date().toISOString();
      setState(parsed);
      await persistERPState(parsed);
      return { ok: true, message: 'Sauvegarde JSON importée et restaurée avec succès.' };
    } catch {
      return { ok: false, message: 'Impossible de lire le fichier JSON fourni.' };
    }
  };

  return (
    <ERPContext.Provider
      value={{
        state,
        role,
        setRole,
        activeModule,
        setActiveModule,
        allowedModules,
        canWrite,
        alerts,
        addInputCatalogItem,
        recordStockEntry,
        recordStockExit,
        recordPhysicalInventory,
        createLivestockBatch,
        logBatchDaily,
        harvestBatchToStock,
        createFishPond,
        logPondEvent,
        createRiceParcel,
        logParcelOperation,
        createCustomer,
        createInvoice,
        recordInvoicePayment,
        addInvoiceReminder,
        addManualJournalEntry,
        postAnnualDepreciations,
        addVehicle,
        recordFuelRefill,
        recordTripOrMaintenance,
        addFixedAsset,
        disposeFixedAsset,
        verifyAssetQR,
        resetDemoData,
        exportBackupJSON,
        importBackupJSON,
      }}
    >
      {children}
    </ERPContext.Provider>
  );
};

export function useERP(): ERPContextValue {
  const ctx = useContext(ERPContext);
  if (!ctx) throw new Error('useERP doit être utilisé dans ERPProvider');
  return ctx;
}
