import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Fuel,
  Plus,
  Wrench,
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Filiere, PaymentMode, VehicleCategory } from '../types/erp';
import {
  daysUntil,
  FILIERE_LABELS,
  formatDateFR,
  formatFCFA,
  formatNumber,
  getTodayISO,
} from '../utils/formatters';

export const FleetModule: React.FC = () => {
  const {
    state,
    canWrite,
    addVehicle,
    recordFuelRefill,
    recordTripOrMaintenance,
  } = useERP();

  const writable = canWrite('fleet');
  const [tab, setTab] = useState<'parc' | 'carburant' | 'carnet'>('parc');
  const [activeForm, setActiveForm] = useState<'NONE' | 'FUEL' | 'TRIP' | 'VEHICLE'>('NONE');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Formulaire Ravitaillement Carburant
  const [fuelVehId, setFuelVehId] = useState(state.vehicles[0]?.id || '');
  const [fuelSource, setFuelSource] = useState<'CUVE_INTERNE' | 'STATION_EXTERNE'>('CUVE_INTERNE');
  const [fuelMeter, setFuelMeter] = useState((state.vehicles[0]?.currentMeter || 0) + 25);
  const [fuelLiters, setFuelLiters] = useState(40);
  const [fuelPrice, setFuelPrice] = useState(715);
  const [fuelFiliere, setFuelFiliere] = useState<Filiere>('RIZICULTURE');
  const [fuelPayment, setFuelPayment] = useState<Exclude<PaymentMode, 'CREDIT'>>('CAISSE');

  // Formulaire Carnet de bord & Maintenance
  const [tripVehId, setTripVehId] = useState(state.vehicles[0]?.id || '');
  const [tripDriver, setTripDriver] = useState('Coulibaly Drissa');
  const [tripFiliere, setTripFiliere] = useState<Filiere>('RIZICULTURE');
  const [tripMission, setTripMission] = useState('');
  const [tripDist, setTripDist] = useState(12);
  const [tripMaintDesc, setTripMaintDesc] = useState('');
  const [tripMaintCost, setTripMaintCost] = useState(0);
  const [tripNextService, setTripNextService] = useState(0);

  // Formulaire Nouvel Engin / Véhicule
  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [vCat, setVCat] = useState<VehicleCategory>('TRACTEUR');
  const [vReg, setVReg] = useState('');
  const [vMeterType, setVMeterType] = useState<'KM' | 'HEURES'>('HEURES');
  const [vMeter, setVMeter] = useState(0);
  const [vNextSrv, setVNextSrv] = useState(250);
  const [vStdCons, setVStdCons] = useState(7.0);
  const [vInsExp, setVInsExp] = useState('2027-11-17');
  const [vTechExp, setVTechExp] = useState('2027-11-17');

  const selectedFuelVehicle = useMemo(
    () => state.vehicles.find((v) => v.id === fuelVehId),
    [state.vehicles, fuelVehId]
  );

  const handleFuelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = recordFuelRefill({
      vehicleId: fuelVehId,
      date: getTodayISO(),
      source: fuelSource,
      currentMeter: Number(fuelMeter),
      liters: Number(fuelLiters),
      unitPrice: Number(fuelPrice),
      filiere: fuelFiliere,
      paymentMode: fuelPayment,
    });
    setFeedback(res);
    if (res.ok) {
      setActiveForm('NONE');
    }
  };

  const handleTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = recordTripOrMaintenance({
      vehicleId: tripVehId,
      date: getTodayISO(),
      driver: tripDriver,
      filiere: tripFiliere,
      mission: tripMission,
      distanceOrHours: Number(tripDist),
      maintenancePerformed: tripMaintDesc || undefined,
      maintenanceCost: Number(tripMaintCost) > 0 ? Number(tripMaintCost) : undefined,
      nextServiceMeter: Number(tripNextService) > 0 ? Number(tripNextService) : undefined,
    });
    setFeedback(res);
    if (res.ok) {
      setActiveForm('NONE');
      setTripMission('');
      setTripMaintDesc('');
      setTripMaintCost(0);
    }
  };

  const handleVehicleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addVehicle({
      code: vCode,
      name: vName,
      category: vCat,
      registration: vReg,
      meterType: vMeterType,
      currentMeter: Number(vMeter),
      nextServiceMeter: Number(vNextSrv),
      standardConsumption: Number(vStdCons),
      insuranceExpiry: vInsExp,
      techInspectionExpiry: vTechExp,
    });
    setFeedback(res);
    if (res.ok) {
      setActiveForm('NONE');
      setVCode('');
      setVName('');
      setVReg('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestion du Parc Automobile & Engins Agricoles
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Contrôle anti-fraude des compteurs carburant, alertes vidanges/assurances et carnet de bord par filière
          </p>
        </div>

        {writable && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                const first = state.vehicles.find((v) => v.id === fuelVehId) || state.vehicles[0];
                if (first) setFuelMeter(first.currentMeter + (first.meterType === 'KM' ? 250 : 15));
                setActiveForm(activeForm === 'FUEL' ? 'NONE' : 'FUEL');
              }}
              className="min-h-[44px] px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Fuel className="w-4 h-4" />
              <span>Ravitaillement Carburant</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveForm(activeForm === 'TRIP' ? 'NONE' : 'TRIP');
              }}
              className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Wrench className="w-4 h-4" />
              <span>Mission / Vidange</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveForm(activeForm === 'VEHICLE' ? 'NONE' : 'VEHICLE');
              }}
              className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter Engin</span>
            </button>
          </div>
        )}
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

      {/* FORMULAIRE RAVITAILLEMENT CARBURANT */}
      {activeForm === 'FUEL' && writable && (
        <form
          onSubmit={handleFuelSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Saisie de Ravitaillement Carburant (Validation stricte du compteur)
            </h2>
            <button
              type="button"
              onClick={() => setActiveForm('NONE')}
              className="text-xs text-slate-500"
            >
              Annuler
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Véhicule / Engin
              </label>
              <select
                value={fuelVehId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFuelVehId(id);
                  const v = state.vehicles.find((x) => x.id === id);
                  if (v) setFuelMeter(v.currentMeter + (v.meterType === 'KM' ? 200 : 12));
                }}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                {state.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (Dernier relevé : {v.currentMeter} {v.meterType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nouveau relevé compteur ({selectedFuelVehicle?.meterType || 'KM'}) —{' '}
                <span className="text-emerald-800 font-mono">
                  &gt; {selectedFuelVehicle?.currentMeter}
                </span>
              </label>
              <input
                type="number"
                required
                value={fuelMeter}
                onChange={(e) => setFuelMeter(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quantité ravitaillée (Litres)
              </label>
              <input
                type="number"
                min={1}
                step="0.5"
                required
                value={fuelLiters}
                onChange={(e) => setFuelLiters(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Origine carburant
              </label>
              <select
                value={fuelSource}
                onChange={(e) => setFuelSource(e.target.value as typeof fuelSource)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="CUVE_INTERNE">Cuve Gasoil Interne Exploitation</option>
                <option value="STATION_EXTERNE">Station-Service Externe</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Filière bénéficiaire
              </label>
              <select
                value={fuelFiliere}
                onChange={(e) => setFuelFiliere(e.target.value as Filiere)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="RIZICULTURE">Riziculture (Parcelles)</option>
                <option value="AVICULTURE">Aviculture (Poulets)</option>
                <option value="PORCICULTURE">Porciculture (Porcs)</option>
                <option value="PISCICULTURE">Pisciculture (Étangs)</option>
                <option value="TRANSVERSAL">Transversal / Livraisons</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prix / Litre (FCFA)
              </label>
              <input
                type="number"
                min={100}
                required
                value={fuelPrice}
                onChange={(e) => setFuelPrice(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-600">
              Coût total :{' '}
              <strong className="font-mono text-slate-900">
                {formatFCFA(fuelLiters * fuelPrice)}
              </strong>{' '}
              · Norme cible :{' '}
              <span className="font-mono">
                {selectedFuelVehicle?.standardConsumption}{' '}
                {selectedFuelVehicle?.meterType === 'KM' ? 'L/100km' : 'L/h'}
              </span>
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg"
            >
              Enregistrer et calculer la consommation
            </button>
          </div>
        </form>
      )}

      {/* FORMULAIRE MISSION / MAINTENANCE */}
      {activeForm === 'TRIP' && writable && (
        <form
          onSubmit={handleTripSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Carnet de Bord (Imputation Filière) & Entretien Préventif
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Engin</label>
              <select
                value={tripVehId}
                onChange={(e) => setTripVehId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                {state.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.registration})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Chauffeur / Conducteur
              </label>
              <input
                type="text"
                required
                value={tripDriver}
                onChange={(e) => setTripDriver(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Filière imputée
              </label>
              <select
                value={tripFiliere}
                onChange={(e) => setTripFiliere(e.target.value as Filiere)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="RIZICULTURE">Riziculture</option>
                <option value="AVICULTURE">Aviculture</option>
                <option value="PORCICULTURE">Porciculture</option>
                <option value="PISCICULTURE">Pisciculture</option>
                <option value="TRANSVERSAL">Transversal</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Travaux agricoles ou trajet effectué
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Labour parcelle Est 5ha / Livraison sacs riz..."
                value={tripMission}
                onChange={(e) => setTripMission(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Distance (km) ou Durée (h)
              </label>
              <input
                type="number"
                min={1}
                required
                value={tripDist}
                onChange={(e) => setTripDist(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Entretien / Vidange effectué (optionnel)
              </label>
              <input
                type="text"
                placeholder="Ex: Vidange moteur + filtre à huile"
                value={tripMaintDesc}
                onChange={(e) => setTripMaintDesc(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Coût maintenance (FCFA)
              </label>
              <input
                type="number"
                min={0}
                value={tripMaintCost}
                onChange={(e) => setTripMaintCost(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nouveau seuil prochaine vidange (optionnel)
              </label>
              <input
                type="number"
                min={0}
                value={tripNextService}
                onChange={(e) => setTripNextService(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg"
            >
              Enregistrer au carnet de bord
            </button>
          </div>
        </form>
      )}

      {/* FORMULAIRE NOUVEL ENGIN */}
      {activeForm === 'VEHICLE' && writable && (
        <form
          onSubmit={handleVehicleCreate}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Nouvelle Fiche Véhicule / Engin Agricole
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Code Parc</label>
              <input
                type="text"
                placeholder="VEH-CAM-02"
                value={vCode}
                onChange={(e) => setVCode(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Désignation</label>
              <input
                type="text"
                required
                placeholder="Ex: Tracteur Kubota M7040"
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Catégorie</label>
              <select
                value={vCat}
                onChange={(e) => {
                  const cat = e.target.value as VehicleCategory;
                  setVCat(cat);
                  setVMeterType(
                    cat === 'TRACTEUR' || cat === 'MOTOCULTEUR' ? 'HEURES' : 'KM'
                  );
                }}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="TRACTEUR">Tracteur</option>
                <option value="MOTOCULTEUR">Motoculteur</option>
                <option value="CAMION">Camion</option>
                <option value="PICKUP">Pick-up</option>
                <option value="MOTO">Moto / Tricycle</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Immatriculation
              </label>
              <input
                type="text"
                required
                value={vReg}
                onChange={(e) => setVReg(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Compteur initial ({vMeterType})
              </label>
              <input
                type="number"
                min={0}
                value={vMeter}
                onChange={(e) => setVMeter(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prochaine vidange ({vMeterType})
              </label>
              <input
                type="number"
                min={10}
                value={vNextSrv}
                onChange={(e) => setVNextSrv(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Conso norme ({vMeterType === 'KM' ? 'L/100km' : 'L/h'})
              </label>
              <input
                type="number"
                step="0.1"
                value={vStdCons}
                onChange={(e) => setVStdCons(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expiration Assurance
              </label>
              <input
                type="date"
                value={vInsExp}
                onChange={(e) => setVInsExp(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg"
            >
              Enregistrer dans la flotte
            </button>
          </div>
        </form>
      )}

      {/* Onglets Parc */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {[
          { id: 'parc', label: `Fiches Engins & Alertes (${state.vehicles.length})` },
          { id: 'carburant', label: `Suivi Carburant & Surconsommations (${state.fuelLogs.length})` },
          { id: 'carnet', label: `Carnet de Bord par Filière (${state.tripLogs.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. FICHES VÉHICULES & ALERTES DOCUMENTS/ENTRETIEN */}
      {tab === 'parc' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Engin & Immatriculation</th>
                  <th className="py-3 px-4 text-right">Compteur Actuel</th>
                  <th className="py-3 px-4 text-right">Prochaine Vidange</th>
                  <th className="py-3 px-4 text-right">Norme Conso</th>
                  <th className="py-3 px-4">Assurance & Visite Tech.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {state.vehicles.map((v) => {
                  const remService = v.nextServiceMeter - v.currentMeter;
                  const serviceSoon =
                    remService <= (v.meterType === 'HEURES' ? 25 : 800);
                  const insDays = daysUntil(v.insuranceExpiry);
                  const techDays = daysUntil(v.techInspectionExpiry);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{v.name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {v.code} · {v.registration}
                          {v.linkedAssetCode ? ` · Actif ${v.linkedAssetCode}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatNumber(v.currentMeter)} {v.meterType.toLowerCase()}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums text-xs ${
                          serviceSoon ? 'text-red-700 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          {formatNumber(v.nextServiceMeter)} {v.meterType.toLowerCase()}
                        </div>
                        <div>
                          {remService <= 0
                            ? `Dépassé de ${Math.abs(remService)} !`
                            : `Dans ${remService} ${v.meterType.toLowerCase()}`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {v.standardConsumption} {v.meterType === 'KM' ? 'L/100km' : 'L/h'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div
                          className={
                            insDays !== null && insDays <= 20
                              ? 'text-red-700 font-semibold'
                              : 'text-slate-600'
                          }
                        >
                          Assurance : {formatDateFR(v.insuranceExpiry)}
                        </div>
                        <div
                          className={
                            techDays !== null && techDays <= 20
                              ? 'text-amber-700 font-semibold'
                              : 'text-slate-600'
                          }
                        >
                          Visite tech. : {formatDateFR(v.techInspectionExpiry)}
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

      {/* 2. JOURNAL CARBURANT & SURCONSOMMATION */}
      {tab === 'carburant' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date & Source</th>
                  <th className="py-3 px-4">Véhicule & Filière</th>
                  <th className="py-3 px-4 text-right"> Progression Compteur</th>
                  <th className="py-3 px-4 text-right">Volume & Coût</th>
                  <th className="py-3 px-4 text-right">Conso Moyenne Calculée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {state.fuelLogs.map((fl) => {
                  const veh = state.vehicles.find((x) => x.id === fl.vehicleId);
                  const unitLabel = veh?.meterType === 'HEURES' ? 'L/h' : 'L/100km';
                  return (
                    <tr key={fl.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {formatDateFR(fl.date)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {fl.source === 'CUVE_INTERNE' ? 'Cuve interne' : 'Station externe'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{fl.vehicleName}</div>
                        <div className="text-xs text-slate-500">{FILIERE_LABELS[fl.filiere]}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                        {formatNumber(fl.previousMeter)} → {formatNumber(fl.currentMeter)} (
                        +{formatNumber(fl.currentMeter - fl.previousMeter)})
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">{fl.liters} L</div>
                        <div className="text-xs text-slate-500">{formatFCFA(fl.totalCost)}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {fl.isOverconsumption ? (
                          <div className="inline-flex items-center gap-1 text-red-700 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>
                              {fl.calculatedConsumption} {unitLabel} (Surconso)
                            </span>
                          </div>
                        ) : (
                          <span className="text-emerald-800 font-semibold">
                            {fl.calculatedConsumption} {unitLabel} (Normal)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CARNET DE BORD */}
      {tab === 'carnet' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Véhicule & Conducteur</th>
                  <th className="py-3 px-4">Filière Imputée</th>
                  <th className="py-3 px-4">Travaux / Trajet & Maintenance</th>
                  <th className="py-3 px-4 text-right">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {state.tripLogs.map((tl) => (
                  <tr key={tl.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {formatDateFR(tl.date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{tl.vehicleName}</div>
                      <div className="text-xs text-slate-500">{tl.driver}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {FILIERE_LABELS[tl.filiere]}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-900 flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{tl.mission}</span>
                      </div>
                      {tl.maintenancePerformed && (
                        <div className="text-xs text-emerald-800 font-medium mt-0.5">
                          Maintenance : {tl.maintenancePerformed}
                          {tl.maintenanceCost ? ` (${formatFCFA(tl.maintenanceCost)})` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {tl.distanceOrHours} u.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
