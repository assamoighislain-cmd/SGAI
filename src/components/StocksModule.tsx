import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Search,
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Filiere, InputCategory, PaymentMode } from '../types/erp';
import {
  daysUntil,
  FILIERE_LABELS,
  formatDateFR,
  formatFCFA,
  formatNumber,
  getTodayISO,
} from '../utils/formatters';

const CATEGORY_LABELS: Record<InputCategory, string> = {
  ALIMENT_POULET: 'Aliment Poulet',
  ALIMENT_PORC: 'Aliment Porc',
  ALIMENT_POISSON: 'Aliment Poisson',
  SEMENCES: 'Semences',
  ENGRAIS: 'Engrais',
  VETERINAIRE: 'Produits Vétérinaires',
  PHYTOSANITAIRE: 'Phytosanitaires',
  PIECES_DETACHEES: 'Pièces Détachées',
};

export const StocksModule: React.FC = () => {
  const {
    state,
    canWrite,
    addInputCatalogItem,
    recordStockEntry,
    recordStockExit,
    recordPhysicalInventory,
  } = useERP();

  const writable = canWrite('stocks');
  const [activeTab, setActiveTab] = useState<'catalogue' | 'mouvements' | 'ecarts' | 'inventaire'>(
    'catalogue'
  );
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Modales / Formulaires actifs
  const [activeForm, setActiveForm] = useState<'NONE' | 'ENTREE' | 'SORTIE' | 'NEW_ITEM'>('NONE');

  // State Bon d'Entrée
  const [entryItemId, setEntryItemId] = useState(state.inputs[0]?.id || '');
  const [entryQty, setEntryQty] = useState(20);
  const [entryCost, setEntryCost] = useState(17500);
  const [entrySupplier, setEntrySupplier] = useState('IVOIRE PROVENDES SA');
  const [entryPayment, setEntryPayment] = useState<PaymentMode>('BANQUE');
  const [entryDate, setEntryDate] = useState(getTodayISO());
  const [entryNotes, setEntryNotes] = useState('');

  // State Bon de Sortie (imputation obligatoire filière + lot/parcelle)
  const [exitItemId, setExitItemId] = useState(state.inputs[0]?.id || '');
  const [exitQty, setExitQty] = useState(5);
  const [exitTheoreticalQty, setExitTheoreticalQty] = useState(5);
  const [exitFiliere, setExitFiliere] = useState<Filiere>('AVICULTURE');
  const [exitTargetLot, setExitTargetLot] = useState('LOT-POU-2604');
  const [exitOperator, setExitOperator] = useState('Kouamé Yao');
  const [exitDate, setExitDate] = useState(getTodayISO());
  const [exitNotes, setExitNotes] = useState('');

  // State Nouvel Intrant Catalogue
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<InputCategory>('ALIMENT_POULET');
  const [newUnit, setNewUnit] = useState('sac 50kg');
  const [newMin, setNewMin] = useState(15);
  const [newCost, setNewCost] = useState(16000);
  const [newExpiry, setNewExpiry] = useState('');
  const [newSupplier, setNewSupplier] = useState('');

  // State Inventaire Physique
  const [invItemId, setInvItemId] = useState(state.inputs[0]?.id || '');
  const [invCounted, setInvCounted] = useState<number>(state.inputs[0]?.quantity || 0);
  const [invJustification, setInvJustification] = useState('');
  const [invOperator, setInvOperator] = useState('Aka Solange (Magasinière)');

  // Cibles disponibles selon la filière sélectionnée pour le Bon de Sortie
  const availableTargets = useMemo(() => {
    if (exitFiliere === 'AVICULTURE' || exitFiliere === 'PORCICULTURE') {
      return state.batches
        .filter((b) => b.filiere === exitFiliere && b.status === 'EN_COURS')
        .map((b) => ({ code: b.code, label: `${b.code} — ${b.name}` }));
    }
    if (exitFiliere === 'PISCICULTURE') {
      return state.ponds
        .filter((p) => p.status === 'ACTIF')
        .map((p) => ({ code: p.code, label: `${p.code} — ${p.name}` }));
    }
    if (exitFiliere === 'RIZICULTURE') {
      return state.parcels.map((r) => ({ code: r.code, label: `${r.code} — ${r.name}` }));
    }
    return state.vehicles.map((v) => ({ code: v.code, label: `${v.code} — ${v.name}` }));
  }, [exitFiliere, state.batches, state.ponds, state.parcels, state.vehicles]);

  const handleFiliereChange = (f: Filiere) => {
    setExitFiliere(f);
    if (f === 'AVICULTURE' || f === 'PORCICULTURE') {
      const first = state.batches.find((b) => b.filiere === f && b.status === 'EN_COURS');
      setExitTargetLot(first?.code || '');
    } else if (f === 'PISCICULTURE') {
      setExitTargetLot(state.ponds[0]?.code || '');
    } else if (f === 'RIZICULTURE') {
      setExitTargetLot(state.parcels[0]?.code || '');
    } else {
      setExitTargetLot(state.vehicles[0]?.code || '');
    }
  };

  const filteredInputs = useMemo(() => {
    return state.inputs.filter((item) => {
      const matchesCat = catFilter === 'ALL' || item.category === catFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.supplierName.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [state.inputs, catFilter, search]);

  // Analyse des écarts Consommation Réelle vs Théorique sur les sorties
  const varianceAnalysis = useMemo(() => {
    return state.stockMovements
      .filter((m) => m.type === 'SORTIE')
      .map((m) => {
        const theo = m.theoreticalQuantity ?? m.quantity;
        const diff = Number((m.quantity - theo).toFixed(2));
        const pct = theo > 0 ? (diff / theo) * 100 : 0;
        const financialImpact = Math.round(diff * m.unitCost);
        return {
          ...m,
          theo,
          diff,
          pct,
          financialImpact,
        };
      });
  }, [state.stockMovements]);

  const submitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const res = recordStockEntry({
      itemId: entryItemId,
      quantity: Number(entryQty),
      unitCost: Number(entryCost),
      supplier: entrySupplier,
      paymentMode: entryPayment,
      date: entryDate,
      notes: entryNotes,
    });
    setFeedback(res);
    if (res.ok) {
      setActiveForm('NONE');
      setEntryNotes('');
    }
  };

  const submitExit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = recordStockExit({
      itemId: exitItemId,
      quantity: Number(exitQty),
      theoreticalQuantity: Number(exitTheoreticalQty),
      filiere: exitFiliere,
      targetLotCode: exitTargetLot,
      operator: exitOperator,
      date: exitDate,
      notes: exitNotes,
    });
    setFeedback(res);
    if (res.ok) {
      setActiveForm('NONE');
      setExitNotes('');
    }
  };

  const submitNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addInputCatalogItem({
      code: newCode,
      name: newName,
      category: newCat,
      unit: newUnit,
      minThreshold: Number(newMin),
      unitCost: Number(newCost),
      expiryDate: newExpiry || undefined,
      supplierName: newSupplier,
    });
    setFeedback(res);
    if (res.ok) {
      setActiveForm('NONE');
      setNewCode('');
      setNewName('');
    }
  };

  const submitInventory = (e: React.FormEvent) => {
    e.preventDefault();
    const res = recordPhysicalInventory({
      itemId: invItemId,
      countedQty: Number(invCounted),
      justification: invJustification,
      operator: invOperator,
      date: getTodayISO(),
    });
    setFeedback(res);
    if (res.ok) {
      setInvJustification('');
    }
  };

  const totalInputValuation = state.inputs.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  return (
    <div className="space-y-6">
      {/* Header & Actions Rapides Terrain */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestion des Stocks d’Intrants & Magasin
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Valorisation au CUMP SYSCOHADA :{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {formatFCFA(totalInputValuation)}
            </span>{' '}
            · Traçabilité par filière et détection des écarts
          </p>
        </div>

        {writable && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveForm(activeForm === 'ENTREE' ? 'NONE' : 'ENTREE');
              }}
              className="min-h-[44px] px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Bon d’Entrée (Achat)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveForm(activeForm === 'SORTIE' ? 'NONE' : 'SORTIE');
              }}
              className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Bon de Sortie Terrain</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveForm(activeForm === 'NEW_ITEM' ? 'NONE' : 'NEW_ITEM');
              }}
              className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel Intrant</span>
            </button>
          </div>
        )}
      </div>

      {/* Feedback Opération */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            feedback.ok
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-red-50/80 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
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
            className="text-xs font-medium underline shrink-0"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Formulaire Rapide : BON D'ENTRÉE */}
      {activeForm === 'ENTREE' && writable && (
        <form
          onSubmit={submitEntry}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Nouveau Bon d’Entrée Fournisseur (Génère l’écriture SYSCOHADA Classe 6)
            </h2>
            <button
              type="button"
              onClick={() => setActiveForm('NONE')}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Annuler
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Intrant réceptionné
              </label>
              <select
                value={entryItemId}
                onChange={(e) => {
                  const id = e.target.value;
                  setEntryItemId(id);
                  const found = state.inputs.find((i) => i.id === id);
                  if (found) {
                    setEntryCost(found.unitCost);
                    setEntrySupplier(found.supplierName);
                  }
                }}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                {state.inputs.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name} (Dispo: {i.quantity} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quantité entrée
              </label>
              <input
                type="number"
                min={0.1}
                step="any"
                required
                value={entryQty}
                onChange={(e) => setEntryQty(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prix d’achat unitaire (FCFA)
              </label>
              <input
                type="number"
                min={1}
                required
                value={entryCost}
                onChange={(e) => setEntryCost(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Fournisseur</label>
              <input
                type="text"
                required
                value={entrySupplier}
                onChange={(e) => setEntrySupplier(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mode de règlement
              </label>
              <select
                value={entryPayment}
                onChange={(e) => setEntryPayment(e.target.value as PaymentMode)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="BANQUE">Banque (Compte 521)</option>
                <option value="MOBILE_MONEY">Mobile Money (Compte 552)</option>
                <option value="CAISSE">Caisse Espèces (Compte 571)</option>
                <option value="CREDIT">Crédit Fournisseur (Compte 401)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date d’entrée</label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-sm text-slate-700">
              Montant total achat :{' '}
              <span className="font-mono tabular-nums font-bold text-slate-900">
                {formatFCFA(entryQty * entryCost)}
              </span>
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Valider l’entrée et comptabiliser
            </button>
          </div>
        </form>
      )}

      {/* Formulaire Rapide : BON DE SORTIE TERRAIN */}
      {activeForm === 'SORTIE' && writable && (
        <form
          onSubmit={submitExit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Bon de Sortie Magasin — Imputation Obligatoire Filière & Lot/Parcelle
            </h2>
            <button
              type="button"
              onClick={() => setActiveForm('NONE')}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Annuler
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Intrant à sortir
              </label>
              <select
                value={exitItemId}
                onChange={(e) => setExitItemId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                {state.inputs.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} — Stock dispo : {i.quantity} {i.unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quantité Réelle Sortie
              </label>
              <input
                type="number"
                min={0.1}
                step="any"
                required
                value={exitQty}
                onChange={(e) => setExitQty(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Norme Théorique Prévue (anti-gaspillage)
              </label>
              <input
                type="number"
                min={0.1}
                step="any"
                required
                value={exitTheoreticalQty}
                onChange={(e) => setExitTheoreticalQty(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Filière imputée
              </label>
              <select
                value={exitFiliere}
                onChange={(e) => handleFiliereChange(e.target.value as Filiere)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="AVICULTURE">Aviculture (Poulets)</option>
                <option value="PORCICULTURE">Porciculture (Porcs)</option>
                <option value="PISCICULTURE">Pisciculture (Étangs)</option>
                <option value="RIZICULTURE">Riziculture (Parcelles)</option>
                <option value="TRANSVERSAL">Parc Engins / Transversal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Lot / Bande / Étang / Parcelle cible
              </label>
              <select
                required
                value={exitTargetLot}
                onChange={(e) => setExitTargetLot(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                {availableTargets.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Demandeur / Technicien
              </label>
              <input
                type="text"
                required
                value={exitOperator}
                onChange={(e) => setExitOperator(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-600">
              Écart instantané :{' '}
              <span
                className={`font-mono tabular-nums font-semibold ${
                  exitQty > exitTheoreticalQty ? 'text-red-700' : 'text-emerald-800'
                }`}
              >
                {exitQty - exitTheoreticalQty > 0
                  ? `+${(exitQty - exitTheoreticalQty).toFixed(1)} (Surconsommation)`
                  : `${(exitQty - exitTheoreticalQty).toFixed(1)} (Conforme)`}
              </span>
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Valider la sortie de stock
            </button>
          </div>
        </form>
      )}

      {/* Formulaire : NOUVEL INTRANT */}
      {activeForm === 'NEW_ITEM' && writable && (
        <form
          onSubmit={submitNewItem}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Référencer un Nouvel Intrant au Catalogue
            </h2>
            <button
              type="button"
              onClick={() => setActiveForm('NONE')}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Annuler
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Code article</label>
              <input
                type="text"
                required
                placeholder="ex: INT-VET-009"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Désignation</label>
              <input
                type="text"
                required
                placeholder="ex: Urée Perlée 46% Azote (Sac 50 kg)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Catégorie</label>
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value as InputCategory)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unité</label>
              <input
                type="text"
                required
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Seuil d’alerte critique
              </label>
              <input
                type="number"
                min={0}
                required
                value={newMin}
                onChange={(e) => setNewMin(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Coût de référence (FCFA)
              </label>
              <input
                type="number"
                min={0}
                required
                value={newCost}
                onChange={(e) => setNewCost(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date péremption (optionnel)
              </label>
              <input
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg"
            >
              Enregistrer au catalogue
            </button>
          </div>
        </form>
      )}

      {/* Navigation par onglets fonctionnels */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {[
          { id: 'catalogue', label: `Catalogue & Alertes (${state.inputs.length})` },
          { id: 'mouvements', label: `Mouvements (${state.stockMovements.length})` },
          { id: 'ecarts', label: 'Contrôle Gaspillage (Théorique vs Réel)' },
          { id: 'inventaire', label: 'Inventaire Physique' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ONGLET 1 : CATALOGUE */}
      {activeTab === 'catalogue' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par code, aliment, engrais, fournisseur..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            >
              <option value="ALL">Toutes les familles d’intrants</option>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Code & Désignation</th>
                  <th className="py-3 px-4">Famille</th>
                  <th className="py-3 px-4 text-right">En Stock</th>
                  <th className="py-3 px-4 text-right">Seuil Min</th>
                  <th className="py-3 px-4 text-right">CUMP Unitaire</th>
                  <th className="py-3 px-4 text-right">Valeur Stock</th>
                  <th className="py-3 px-4">Péremption & État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredInputs.map((item) => {
                  const isLow = item.quantity <= item.minThreshold;
                  const expDays = daysUntil(item.expiryDate);
                  const isExpiring = expDays !== null && expDays <= 30;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{item.code}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.supplierName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {CATEGORY_LABELS[item.category]}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                          isLow ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {formatNumber(item.quantity, 1)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                        {item.minThreshold} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatFCFA(item.unitCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatFCFA(item.quantity * item.unitCost)}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="flex flex-col gap-0.5">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 font-medium text-red-700">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              Réapprovisionner
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-800 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Disponible
                            </span>
                          )}
                          {item.expiryDate && (
                            <span
                              className={`font-mono tabular-nums ${
                                isExpiring ? 'text-amber-700 font-semibold' : 'text-slate-500'
                              }`}
                            >
                              Exp: {formatDateFR(item.expiryDate)}
                              {isExpiring ? ` (${expDays}j)` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET 2 : HISTORIQUE DES MOUVEMENTS */}
      {activeTab === 'mouvements' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Référence & Date</th>
                  <th className="py-3 px-4">Nature</th>
                  <th className="py-3 px-4">Intrant</th>
                  <th className="py-3 px-4">Imputation Filière / Lot</th>
                  <th className="py-3 px-4 text-right">Quantité</th>
                  <th className="py-3 px-4 text-right">Montant Valorisé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {state.stockMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-slate-900">
                        {m.reference}
                      </div>
                      <div className="font-mono text-xs text-slate-500">{formatDateFR(m.date)}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {m.type === 'ENTREE' ? (
                        <span className="text-emerald-800">Entrée Fournisseur</span>
                      ) : (
                        <span className="text-slate-800">Sortie Exploitation</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{m.itemName}</div>
                      <div className="text-xs text-slate-500">{m.supplierOrOperator}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      <div>{FILIERE_LABELS[m.filiere]}</div>
                      {m.targetLotCode && (
                        <div className="font-mono text-slate-500">Lot : {m.targetLotCode}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {m.type === 'ENTREE' ? '+' : '-'}
                      {formatNumber(m.quantity, 1)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatFCFA(m.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET 3 : CONTRÔLE DES ÉCARTS THÉORIQUE VS RÉEL */}
      {activeTab === 'ecarts' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Détection Automatique du Gaspillage et des Pertes Anormales sur Sorties
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparaison systématique entre la ration/dose théorique programmée et la quantité réellement sortie du magasin
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Bon & Lot Cible</th>
                  <th className="py-3 px-4">Intrant & Opérateur</th>
                  <th className="py-3 px-4 text-right">Qté Théorique</th>
                  <th className="py-3 px-4 text-right">Qté Réelle</th>
                  <th className="py-3 px-4 text-right">Écart (%)</th>
                  <th className="py-3 px-4 text-right">Impact Financier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {varianceAnalysis.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-slate-900">
                        {row.reference} · {row.targetLotCode || '—'}
                      </div>
                      <div className="text-xs text-slate-500">{formatDateFR(row.date)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{row.itemName}</div>
                      <div className="text-xs text-slate-500">
                        {row.supplierOrOperator}
                        {row.notes ? ` · ${row.notes}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatNumber(row.theo, 1)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatNumber(row.quantity, 1)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                        row.diff > 0 ? 'text-red-700' : 'text-emerald-800'
                      }`}
                    >
                      {row.diff > 0 ? `+${row.diff}` : row.diff} ({row.pct > 0 ? `+${row.pct.toFixed(1)}%` : `${row.pct.toFixed(1)}%`})
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-medium ${
                        row.financialImpact > 0 ? 'text-red-700' : 'text-slate-700'
                      }`}
                    >
                      {row.financialImpact > 0
                        ? `Surcoût ${formatFCFA(row.financialImpact)}`
                        : 'Conforme'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET 4 : INVENTAIRE PHYSIQUE */}
      {activeTab === 'inventaire' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {writable && (
            <form
              onSubmit={submitInventory}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ClipboardCheck className="w-4 h-4 text-emerald-800" />
                <h2 className="text-base font-semibold text-slate-900">
                  Saisie de Comptage Physique
                </h2>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Article contrôlé
                </label>
                <select
                  value={invItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setInvItemId(id);
                    const found = state.inputs.find((i) => i.id === id);
                    if (found) setInvCounted(found.quantity);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                >
                  {state.inputs.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Théorique : {i.quantity} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Stock Système
                  </label>
                  <div className="min-h-[44px] px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono tabular-nums text-slate-700">
                    {state.inputs.find((i) => i.id === invItemId)?.quantity ?? 0}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Quantité Comptée
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={invCounted}
                    onChange={(e) => setInvCounted(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Justification de l’écart (obligatoire si écart ≠ 0)
                </label>
                <textarea
                  rows={2}
                  value={invJustification}
                  onChange={(e) => setInvJustification(e.target.value)}
                  placeholder="Ex: Sacs éventrés, humidité, erreur de pesée..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contrôleur / Magasinier
                </label>
                <input
                  type="text"
                  required
                  value={invOperator}
                  onChange={(e) => setInvOperator(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Ajuster le stock et archiver le PV
              </button>
            </form>
          )}

          <div
            className={`${
              writable ? 'lg:col-span-7' : 'lg:col-span-12'
            } bg-white border border-slate-200 rounded-xl overflow-hidden`}
          >
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Procès-Verbaux d’Inventaires Physiques
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Article & Justification</th>
                    <th className="py-3 px-4 text-right">Système</th>
                    <th className="py-3 px-4 text-right">Compté</th>
                    <th className="py-3 px-4 text-right">Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {state.inventories.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {formatDateFR(inv.date)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{inv.itemName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {inv.justification} · Par {inv.operator}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {inv.systemQty}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {inv.countedQty}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                          inv.variance < 0
                            ? 'text-red-700'
                            : inv.variance > 0
                            ? 'text-emerald-800'
                            : 'text-slate-600'
                        }`}
                      >
                        {inv.variance > 0 ? `+${inv.variance}` : inv.variance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
