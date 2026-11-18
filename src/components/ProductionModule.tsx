import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  PackagePlus,
  Plus,
  Scale,
  Sprout,
  Waves,
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { PaymentMode, RiceStage } from '../types/erp';
import { formatDateFR, formatFCFA, formatNumber, getTodayISO } from '../utils/formatters';

const RICE_STAGES: { id: RiceStage; label: string }[] = [
  { id: 'PREPARATION', label: '1. Labour & Planage' },
  { id: 'SEMIS', label: '2. Semis / Pépinière' },
  { id: 'REPIQUAGE', label: '3. Repiquage' },
  { id: 'FERTILISATION', label: '4. Fertilisation NPK/Urée' },
  { id: 'TRAITEMENT', label: '5. Sarclage & Phyto' },
  { id: 'RECOLTE', label: '6. Récolte Paddy' },
  { id: 'TRANSFORMATION', label: '7. Décorticage / Riz Blanchi' },
];

export const ProductionModule: React.FC = () => {
  const {
    state,
    canWrite,
    createLivestockBatch,
    logBatchDaily,
    harvestBatchToStock,
    createFishPond,
    logPondEvent,
    createRiceParcel,
    logParcelOperation,
  } = useERP();

  const writable = canWrite('production');
  const [sectorTab, setSectorTab] = useState<
    'AVICULTURE' | 'PORCICULTURE' | 'PISCICULTURE' | 'RIZICULTURE'
  >('AVICULTURE');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Modales/Formulaires
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeBatchLogId, setActiveBatchLogId] = useState<string | null>(null);
  const [activeHarvestBatchId, setActiveHarvestBatchId] = useState<string | null>(null);
  const [activePondLogId, setActivePondLogId] = useState<string | null>(null);
  const [activeParcelLogId, setActiveParcelLogId] = useState<string | null>(null);

  // Création Lot Avicole / Bande Porcine
  const [bCode, setBCode] = useState('');
  const [bName, setBName] = useState('');
  const [bBreed, setBBreed] = useState('Cobb 500');
  const [bBuilding, setBBuilding] = useState('Poulailler B1');
  const [bCount, setBCount] = useState(1500);
  const [bInitW, setBInitW] = useState(0.042);
  const [bTargetW, setBTargetW] = useState(2.3);
  const [bCost, setBCost] = useState(675000);
  const [bPayMode, setBPayMode] = useState<PaymentMode>('BANQUE');

  // Suivi quotidien Lot/Bande
  const [logMortality, setLogMortality] = useState(0);
  const [logFeedKg, setLogFeedKg] = useState(150);
  const [logAvgWeight, setLogAvgWeight] = useState(1.8);
  const [logVetCare, setLogVetCare] = useState('');
  const [logVetCost, setLogVetCost] = useState(0);

  // Transfert Récolte Élevage -> Stock Commercial
  const [harvProductId, setHarvProductId] = useState('');
  const [harvHeads, setHarvHeads] = useState(100);
  const [harvUnits, setHarvUnits] = useState(100);

  // Création Étang
  const [pCode, setPCode] = useState('');
  const [pName, setPName] = useState('');
  const [pSurface, setPSurface] = useState(1200);
  const [pSpecies, setPSpecies] = useState('Tilapia Niloticus');
  const [pCount, setPCount] = useState(5000);
  const [pCost, setPCost] = useState(350000);

  // Suivi Étang
  const [pondEventType, setPondEventType] = useState<
    'ALIMENTATION' | 'MORTALITE' | 'PECHE_CONTROLE' | 'RECOLTE_PARTIELLE' | 'RECOLTE_TOTALE'
  >('PECHE_CONTROLE');
  const [pondMort, setPondMort] = useState(0);
  const [pondFeed, setPondFeed] = useState(50);
  const [pondWeightG, setPondWeightG] = useState(380);
  const [pondHarvKg, setPondHarvKg] = useState(0);
  const [pondTargetProd, setPondTargetProd] = useState('fp-4');
  const [pondNotes, setPondNotes] = useState('');

  // Création Parcelle Riz
  const [rCode, setRCode] = useState('');
  const [rName, setRName] = useState('');
  const [rSurface, setRSurface] = useState(4.0);
  const [rVariety, setRVariety] = useState('WITA 9');

  // Opération Culturale Riz
  const [rStage, setRStage] = useState<RiceStage>('FERTILISATION');
  const [rDesc, setRDesc] = useState('');
  const [rPaddyHarv, setRPaddyHarv] = useState(0);
  const [rPaddyTrans, setRPaddyTrans] = useState(0);
  const [rWhiteObtained, setRWhiteObtained] = useState(0);
  const [rOpCost, setROpCost] = useState(0);

  const batchesForSector = state.batches.filter((b) => b.filiere === sectorTab);

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (sectorTab !== 'AVICULTURE' && sectorTab !== 'PORCICULTURE') return;
    const res = createLivestockBatch({
      filiere: sectorTab,
      code: bCode,
      name: bName,
      breed: bBreed,
      building: bBuilding,
      startDate: getTodayISO(),
      initialCount: Number(bCount),
      initialAvgWeightKg: Number(bInitW),
      targetWeightKg: Number(bTargetW),
      purchaseCost: Number(bCost),
      paymentMode: bPayMode,
    });
    setFeedback(res);
    if (res.ok) {
      setShowCreateForm(false);
      setBCode('');
      setBName('');
    }
  };

  const handleDailyLog = (e: React.FormEvent, batchId: string) => {
    e.preventDefault();
    const res = logBatchDaily({
      batchId,
      date: getTodayISO(),
      mortality: Number(logMortality),
      feedKg: Number(logFeedKg),
      avgWeightKg: Number(logAvgWeight),
      vetCare: logVetCare || undefined,
      vetCost: Number(logVetCost),
    });
    setFeedback(res);
    if (res.ok) {
      setActiveBatchLogId(null);
      setLogMortality(0);
      setLogVetCare('');
      setLogVetCost(0);
    }
  };

  const handleBatchHarvest = (e: React.FormEvent, batchId: string) => {
    e.preventDefault();
    const res = harvestBatchToStock({
      batchId,
      productId: harvProductId,
      headsHarvested: Number(harvHeads),
      stockUnitsProduced: Number(harvUnits),
    });
    setFeedback(res);
    if (res.ok) {
      setActiveHarvestBatchId(null);
    }
  };

  const handleCreatePond = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createFishPond({
      code: pCode,
      name: pName,
      surfaceM2: Number(pSurface),
      species: pSpecies,
      stockingDate: getTodayISO(),
      initialFingerlings: Number(pCount),
      directCost: Number(pCost),
    });
    setFeedback(res);
    if (res.ok) {
      setShowCreateForm(false);
      setPCode('');
      setPName('');
    }
  };

  const handlePondLog = (e: React.FormEvent, pondId: string) => {
    e.preventDefault();
    const res = logPondEvent({
      pondId,
      date: getTodayISO(),
      type: pondEventType,
      mortality: Number(pondMort),
      feedKg: Number(pondFeed),
      sampleAvgWeightG: Number(pondWeightG),
      harvestedKg: Number(pondHarvKg),
      targetProductId: pondHarvKg > 0 ? pondTargetProd : undefined,
      notes: pondNotes || 'Suivi technique étang',
    });
    setFeedback(res);
    if (res.ok) {
      setActivePondLogId(null);
      setPondHarvKg(0);
      setPondNotes('');
    }
  };

  const handleCreateParcel = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createRiceParcel({
      code: rCode,
      name: rName,
      surfaceHa: Number(rSurface),
      variety: rVariety,
      sowingDate: getTodayISO(),
    });
    setFeedback(res);
    if (res.ok) {
      setShowCreateForm(false);
      setRCode('');
      setRName('');
    }
  };

  const handleParcelOp = (e: React.FormEvent, parcelId: string) => {
    e.preventDefault();
    const res = logParcelOperation({
      parcelId,
      date: getTodayISO(),
      stage: rStage,
      description: rDesc || `Opération ${rStage.toLowerCase()}`,
      paddyHarvestedKg: Number(rPaddyHarv),
      paddyTransformedKg: Number(rPaddyTrans),
      whiteRiceObtainedKg: Number(rWhiteObtained),
      cost: Number(rOpCost),
    });
    setFeedback(res);
    if (res.ok) {
      setActiveParcelLogId(null);
      setRDesc('');
      setRPaddyHarv(0);
      setRPaddyTrans(0);
      setRWhiteObtained(0);
      setROpCost(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Traçabilité des Cycles de Production (4 Filières)
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Suivi zootechnique et agronomique, calcul d’Indice de Consommation (IC) et coûts de revient
          </p>
        </div>

        {writable && (
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setShowCreateForm(!showCreateForm);
            }}
            className="min-h-[44px] px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>
              {sectorTab === 'AVICULTURE'
                ? 'Nouveau Lot Poulets'
                : sectorTab === 'PORCICULTURE'
                ? 'Nouvelle Bande Porcs'
                : sectorTab === 'PISCICULTURE'
                ? 'Nouvel Étang'
                : 'Nouvelle Parcelle Riz'}
            </span>
          </button>
        )}
      </div>

      {/* Sélecteur des 4 Filières */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {[
          { id: 'AVICULTURE', label: '1. Aviculture (Poulets)' },
          { id: 'PORCICULTURE', label: '2. Porciculture (Porcs)' },
          { id: 'PISCICULTURE', label: '3. Pisciculture (Étangs)' },
          { id: 'RIZICULTURE', label: '4. Riziculture (Parcelles)' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSectorTab(t.id as typeof sectorTab);
              setShowCreateForm(false);
              setFeedback(null);
            }}
            className={`min-h-[40px] px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              sectorTab === t.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            feedback.ok
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-red-50/80 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* FORMULAIRE DE CRÉATION SELON LA FILIÈRE */}
      {showCreateForm && writable && (sectorTab === 'AVICULTURE' || sectorTab === 'PORCICULTURE') && (
        <form
          onSubmit={handleCreateBatch}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Mise en place {sectorTab === 'AVICULTURE' ? 'd’un Lot Avicole' : 'd’une Bande Porcine'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Code Lot/Bande</label>
              <input
                type="text"
                required
                placeholder={sectorTab === 'AVICULTURE' ? 'LOT-POU-2606' : 'BND-POR-2603'}
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Désignation</label>
              <input
                type="text"
                required
                placeholder="Ex: Lot Chair Bâtiment B2"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Souche / Race</label>
              <input
                type="text"
                required
                value={bBreed}
                onChange={(e) => setBBreed(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Effectif Initial</label>
              <input
                type="number"
                min={1}
                required
                value={bCount}
                onChange={(e) => setBCount(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Poids initial moyen (kg)
              </label>
              <input
                type="number"
                step="0.001"
                min={0.01}
                required
                value={bInitW}
                onChange={(e) => setBInitW(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Poids objectif vente (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min={0.5}
                required
                value={bTargetW}
                onChange={(e) => setBTargetW(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Coût achat sujets (FCFA)
              </label>
              <input
                type="number"
                min={0}
                required
                value={bCost}
                onChange={(e) => setBCost(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Règlement</label>
              <select
                value={bPayMode}
                onChange={(e) => setBPayMode(e.target.value as PaymentMode)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="BANQUE">Banque (521)</option>
                <option value="MOBILE_MONEY">Mobile Money (552)</option>
                <option value="CAISSE">Caisse (571)</option>
                <option value="CREDIT">Crédit Fournisseur (401)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="min-h-[44px] px-4 py-2 text-sm text-slate-600"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg"
            >
              Démarrer le cycle
            </button>
          </div>
        </form>
      )}

      {showCreateForm && writable && sectorTab === 'PISCICULTURE' && (
        <form
          onSubmit={handleCreatePond}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Nouvel Empoissonnement d’Étang Piscicole
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Code Étang</label>
              <input
                type="text"
                required
                placeholder="ETG-TIL-03"
                value={pCode}
                onChange={(e) => setPCode(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nom de l’étang</label>
              <input
                type="text"
                required
                placeholder="Étang Aval B3"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Surface (m²)</label>
              <input
                type="number"
                min={50}
                required
                value={pSurface}
                onChange={(e) => setPSurface(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Espèce</label>
              <input
                type="text"
                required
                value={pSpecies}
                onChange={(e) => setPSpecies(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nombre d’alevins introduits
              </label>
              <input
                type="number"
                min={100}
                required
                value={pCount}
                onChange={(e) => setPCount(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Coût alevins + préparation (FCFA)
              </label>
              <input
                type="number"
                min={0}
                required
                value={pCost}
                onChange={(e) => setPCost(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg"
            >
              Valider l’empoissonnement
            </button>
          </div>
        </form>
      )}

      {showCreateForm && writable && sectorTab === 'RIZICULTURE' && (
        <form
          onSubmit={handleCreateParcel}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Ouverture d’une Nouvelle Parcelle Rizicole
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Code Parcelle</label>
              <input
                type="text"
                required
                placeholder="PAR-RIZ-SUD"
                value={rCode}
                onChange={(e) => setRCode(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Désignation</label>
              <input
                type="text"
                required
                placeholder="Casier Irrigué Sud"
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Surface (ha)</label>
              <input
                type="number"
                step="0.1"
                min={0.2}
                required
                value={rSurface}
                onChange={(e) => setRSurface(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Variété</label>
              <input
                type="text"
                required
                value={rVariety}
                onChange={(e) => setRVariety(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg"
            >
              Créer la parcelle
            </button>
          </div>
        </form>
      )}

      {/* VUE 1 & 2 : AVICULTURE & PORCICULTURE */}
      {(sectorTab === 'AVICULTURE' || sectorTab === 'PORCICULTURE') && (
        <div className="space-y-5">
          {batchesForSector.map((batch) => {
            const deaths = batch.initialCount - batch.currentCount;
            const mortalityPct = batch.initialCount > 0 ? (deaths / batch.initialCount) * 100 : 0;
            const liveBiomassKg = batch.currentCount * batch.avgWeightKg;
            const initialBiomassKg = batch.initialCount * batch.initialAvgWeightKg;
            const weightGainKg = Math.max(1, liveBiomassKg - initialBiomassKg);
            const fcr = batch.totalFeedKg > 0 ? batch.totalFeedKg / weightGainKg : 0; // Indice de consommation (IC)
            const totalCost = batch.purchaseCost + batch.feedAndVetCost;
            const costPerHead = batch.currentCount > 0 ? Math.round(totalCost / batch.currentCount) : 0;
            const costPerKg = liveBiomassKg > 0 ? Math.round(totalCost / liveBiomassKg) : 0;

            const sectorProducts = state.finishedProducts.filter(
              (fp) => fp.filiere === batch.filiere
            );

            return (
              <div key={batch.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-emerald-800">{batch.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{batch.breed}</span>
                      <span aria-hidden="true">·</span>
                      <span>{batch.building}</span>
                      <span aria-hidden="true">·</span>
                      <span>Mis en place le {formatDateFR(batch.startDate)}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 mt-1">{batch.name}</h2>
                  </div>

                  {writable && batch.status === 'EN_COURS' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLogAvgWeight(batch.avgWeightKg);
                          setActiveHarvestBatchId(null);
                          setActiveBatchLogId(activeBatchLogId === batch.id ? null : batch.id);
                        }}
                        className="min-h-[40px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Saisie Quotidienne</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setHarvProductId(sectorProducts[0]?.id || '');
                          setActiveBatchLogId(null);
                          setActiveHarvestBatchId(
                            activeHarvestBatchId === batch.id ? null : batch.id
                          );
                        }}
                        className="min-h-[40px] px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>Récolte / Abattage vers Stock</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Indicateurs Zootechniques Calculés Automatiquement */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500">Effectif Actuel</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatNumber(batch.currentCount)} / {formatNumber(batch.initialCount)}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500">Taux de Mortalité</span>
                    <div
                      className={`font-mono tabular-nums font-semibold mt-0.5 ${
                        mortalityPct >= 5 ? 'text-red-700' : 'text-emerald-800'
                      }`}
                    >
                      {mortalityPct.toFixed(2)}% ({deaths} pertes)
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500">Poids Moyen / Cible</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {batch.avgWeightKg.toFixed(2)} kg / {batch.targetWeightKg.toFixed(1)} kg
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500">Indice Consommation (IC)</span>
                    <div
                      className={`font-mono tabular-nums font-semibold mt-0.5 ${
                        (batch.filiere === 'AVICULTURE' && fcr > 2.1) ||
                        (batch.filiere === 'PORCICULTURE' && fcr > 3.2)
                          ? 'text-amber-700'
                          : 'text-emerald-800'
                      }`}
                    >
                      {fcr.toFixed(2)} ({formatNumber(batch.totalFeedKg)} kg alim.)
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500">Coût Revient / Tête</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatFCFA(costPerHead)}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500">Coût Revient / kg Vif</span>
                    <div className="font-mono tabular-nums font-semibold text-emerald-800 mt-0.5">
                      {formatFCFA(costPerKg)} / kg
                    </div>
                  </div>
                </div>

                {/* Sous-formulaire : Saisie quotidienne */}
                {activeBatchLogId === batch.id && writable && (
                  <form
                    onSubmit={(e) => handleDailyLog(e, batch.id)}
                    className="pt-4 border-t border-slate-200 space-y-3"
                  >
                    <h3 className="text-sm font-semibold text-slate-900">
                      Relevé Journalier Terrain — {batch.code}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Mortalité du jour</label>
                        <input
                          type="number"
                          min={0}
                          max={batch.currentCount}
                          required
                          value={logMortality}
                          onChange={(e) => setLogMortality(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Aliment distribué (kg)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          required
                          value={logFeedKg}
                          onChange={(e) => setLogFeedKg(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Nouveau poids moyen (kg)
                        </label>
                        <input
                          type="number"
                          min={0.05}
                          step="0.01"
                          required
                          value={logAvgWeight}
                          onChange={(e) => setLogAvgWeight(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Vaccination / Soin vétérinaire
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Rappel vaccin / Vitamines"
                          value={logVetCare}
                          onChange={(e) => setLogVetCare(e.target.value)}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
                        >
                          Enregistrer le suivi
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Sous-formulaire : Transfert vers Stock Produits Finis */}
                {activeHarvestBatchId === batch.id && writable && (
                  <form
                    onSubmit={(e) => handleBatchHarvest(e, batch.id)}
                    className="pt-4 border-t border-slate-200 space-y-3"
                  >
                    <h3 className="text-sm font-semibold text-slate-900">
                      Sortie / Abattage vers le Magasin Commercial
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-600 mb-1">
                          Produit fini commercial récepteur
                        </label>
                        <select
                          value={harvProductId}
                          onChange={(e) => setHarvProductId(e.target.value)}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        >
                          {sectorProducts.map((fp) => (
                            <option key={fp.id} value={fp.id}>
                              {fp.name} (En stock : {fp.quantity} {fp.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Sujets prélevés du lot
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={batch.currentCount}
                          required
                          value={harvHeads}
                          onChange={(e) => setHarvHeads(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Unités/kg produits finis obtenus
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={harvUnits}
                          onChange={(e) => setHarvUnits(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="min-h-[42px] px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg"
                      >
                        Transférer au stock commercial
                      </button>
                    </div>
                  </form>
                )}

                {/* Journal récent du lot */}
                {batch.logs.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 mb-2">
                      Derniers relevés quotidiens
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      {batch.logs.slice(0, 3).map((lg) => (
                        <div key={lg.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-slate-700">
                            <span className="font-mono text-slate-500">{formatDateFR(lg.date)}</span>
                            <span className="mx-1.5">·</span>
                            <span>{lg.vetCare || 'Suivi courant'}</span>
                          </div>
                          <div className="font-mono tabular-nums text-slate-700 flex items-center gap-3">
                            <span>Mortalité : {lg.mortality}</span>
                            <span>Aliment : {lg.feedKg} kg</span>
                            <span>Poids : {lg.avgWeightKg} kg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VUE 3 : PISCICULTURE (ÉTANGS) */}
      {sectorTab === 'PISCICULTURE' && (
        <div className="space-y-5">
          {state.ponds.map((pond) => {
            const estBiomassKg = Math.round((pond.currentCount * pond.avgWeightG) / 1000);
            const mortCount = Math.max(
              0,
              pond.initialFingerlings -
                pond.currentCount -
                Math.round((pond.harvestedTotalKg * 1000) / Math.max(1, pond.avgWeightG))
            );
            const fishProducts = state.finishedProducts.filter(
              (fp) => fp.filiere === 'PISCICULTURE'
            );

            return (
              <div key={pond.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Waves className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="font-mono font-semibold text-emerald-800">{pond.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{pond.surfaceM2} m²</span>
                      <span aria-hidden="true">·</span>
                      <span>Empoissonné le {formatDateFR(pond.stockingDate)}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 mt-1">
                      {pond.name} — {pond.species}
                    </h2>
                  </div>

                  {writable && (
                    <button
                      type="button"
                      onClick={() => {
                        setPondWeightG(pond.avgWeightG);
                        setActivePondLogId(activePondLogId === pond.id ? null : pond.id);
                      }}
                      className="min-h-[40px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
                    >
                      Pêche de Contrôle / Récolte
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500">Poissons Estimés</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatNumber(pond.currentCount)} / {formatNumber(pond.initialFingerlings)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Poids Moyen Échantillon</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {pond.avgWeightG} g
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Biomasse Vivante Est.</span>
                    <div className="font-mono tabular-nums font-semibold text-emerald-800 mt-0.5">
                      {formatNumber(estBiomassKg)} kg
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Déjà Récolté</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatNumber(pond.harvestedTotalKg)} kg ({mortCount} pertes)
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Charges Imputées</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatFCFA(pond.directCost)}
                    </div>
                  </div>
                </div>

                {activePondLogId === pond.id && writable && (
                  <form
                    onSubmit={(e) => handlePondLog(e, pond.id)}
                    className="pt-4 border-t border-slate-200 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Type d’opération</label>
                        <select
                          value={pondEventType}
                          onChange={(e) =>
                            setPondEventType(e.target.value as typeof pondEventType)
                          }
                          className="w-full min-h-[42px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="PECHE_CONTROLE">Pêche de contrôle</option>
                          <option value="ALIMENTATION">Distribution aliment</option>
                          <option value="MORTALITE">Mortalité constatée</option>
                          <option value="RECOLTE_PARTIELLE">Récolte partielle</option>
                          <option value="RECOLTE_TOTALE">Vidange / Récolte totale</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Aliment (kg)</label>
                        <input
                          type="number"
                          min={0}
                          value={pondFeed}
                          onChange={(e) => setPondFeed(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Poids moyen (g)</label>
                        <input
                          type="number"
                          min={5}
                          value={pondWeightG}
                          onChange={(e) => setPondWeightG(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Mortalités</label>
                        <input
                          type="number"
                          min={0}
                          value={pondMort}
                          onChange={(e) => setPondMort(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Kg pêchés (vers vente)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={pondHarvKg}
                          onChange={(e) => setPondHarvKg(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Produit stocké</label>
                        <select
                          value={pondTargetProd}
                          onChange={(e) => setPondTargetProd(e.target.value)}
                          className="w-full min-h-[42px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        >
                          {fishProducts.map((fp) => (
                            <option key={fp.id} value={fp.id}>
                              {fp.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="Observations qualité eau, oxygène, calibrage..."
                        value={pondNotes}
                        onChange={(e) => setPondNotes(e.target.value)}
                        className="flex-1 min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                      <button
                        type="submit"
                        className="min-h-[42px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg shrink-0"
                      >
                        Valider le relevé piscicole
                      </button>
                    </div>
                  </form>
                )}

                {pond.logs.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 divide-y divide-slate-100 text-xs">
                    {pond.logs.slice(0, 3).map((lg) => (
                      <div key={lg.id} className="py-1.5 flex flex-wrap justify-between gap-2">
                        <span className="text-slate-700">
                          <span className="font-mono text-slate-500">{formatDateFR(lg.date)}</span> ·{' '}
                          <strong className="font-medium">{lg.type}</strong> — {lg.notes}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600">
                          Poids éch. {lg.sampleAvgWeightG}g · Récolte {lg.harvestedKg} kg
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VUE 4 : RIZICULTURE (PARCELLES & TRANSFORMATION) */}
      {sectorTab === 'RIZICULTURE' && (
        <div className="space-y-5">
          {state.parcels.map((parcel) => {
            const yieldTonPerHa =
              parcel.surfaceHa > 0 && parcel.harvestedPaddyKg > 0
                ? parcel.harvestedPaddyKg / 1000 / parcel.surfaceHa
                : 0;
            const millingRate =
              parcel.harvestedPaddyKg > 0 && parcel.milledWhiteRiceKg > 0
                ? (parcel.milledWhiteRiceKg / parcel.harvestedPaddyKg) * 100
                : 0;

            return (
              <div
                key={parcel.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Sprout className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="font-mono font-semibold text-emerald-800">{parcel.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{parcel.surfaceHa} hectares</span>
                      <span aria-hidden="true">·</span>
                      <span>Semis du {formatDateFR(parcel.sowingDate)}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 mt-1">
                      {parcel.name} — Variété {parcel.variety}
                    </h2>
                  </div>

                  {writable && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveParcelLogId(activeParcelLogId === parcel.id ? null : parcel.id)
                      }
                      className="min-h-[40px] px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
                    >
                      Saisir Étape / Récolte / Usinage
                    </button>
                  )}
                </div>

                {/* Frise Calendrier Cultural */}
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-1.5 text-xs">
                  {RICE_STAGES.map((st, idx) => {
                    const currentIdx = RICE_STAGES.findIndex((x) => x.id === parcel.currentStage);
                    const done = idx <= currentIdx;
                    return (
                      <div
                        key={st.id}
                        className={`px-2.5 py-2 rounded-md border text-center truncate ${
                          done
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        {st.label}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pt-1">
                  <div>
                    <span className="text-xs text-slate-500">Riz Paddy Récolté</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatNumber(parcel.harvestedPaddyKg)} kg (
                      {yieldTonPerHa > 0 ? `${yieldTonPerHa.toFixed(2)} T/ha` : 'En culture'})
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Riz Blanchi Usiné</span>
                    <div className="font-mono tabular-nums font-semibold text-emerald-800 mt-0.5">
                      {formatNumber(parcel.milledWhiteRiceKg)} kg (
                      {Math.floor(parcel.milledWhiteRiceKg / 50)} sacs 50kg)
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Taux Transformation</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {millingRate > 0 ? `${millingRate.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Coût Cultural Cumulé</span>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatFCFA(parcel.directCost)}
                    </div>
                  </div>
                </div>

                {activeParcelLogId === parcel.id && writable && (
                  <form
                    onSubmit={(e) => handleParcelOp(e, parcel.id)}
                    className="pt-4 border-t border-slate-200 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Stade cultural</label>
                        <select
                          value={rStage}
                          onChange={(e) => setRStage(e.target.value as RiceStage)}
                          className="w-full min-h-[42px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        >
                          {RICE_STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Paddy récolté (kg)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={rPaddyHarv}
                          onChange={(e) => setRPaddyHarv(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Paddy décortiqué (kg)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={rPaddyTrans}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setRPaddyTrans(val);
                            setRWhiteObtained(Math.round(val * 0.66));
                          }}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Riz blanchi obtenu (kg)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={rWhiteObtained}
                          onChange={(e) => setRWhiteObtained(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Coût main d’œuvre/op. (FCFA)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={rOpCost}
                          onChange={(e) => setROpCost(Number(e.target.value))}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Détail des travaux effectués sur la parcelle..."
                        value={rDesc}
                        onChange={(e) => setRDesc(e.target.value)}
                        className="flex-1 min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                      <button
                        type="submit"
                        className="min-h-[42px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg shrink-0"
                      >
                        Enregistrer l’opération
                      </button>
                    </div>
                  </form>
                )}

                {parcel.logs.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 divide-y divide-slate-100 text-xs">
                    {parcel.logs.slice(0, 3).map((lg) => (
                      <div key={lg.id} className="py-1.5 flex flex-wrap justify-between gap-2">
                        <span className="text-slate-700">
                          <span className="font-mono text-slate-500">{formatDateFR(lg.date)}</span> ·{' '}
                          <strong className="font-medium">{lg.stage}</strong> — {lg.description}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600">
                          Coût : {formatFCFA(lg.cost)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
