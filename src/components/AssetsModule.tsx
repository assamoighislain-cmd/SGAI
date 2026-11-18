import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  ArchiveX,
  CheckCircle2,
  Plus,
  Printer,
  QrCode,
  ScanLine,
  Table2,
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { AssetCategory, Filiere, PaymentMode } from '../types/erp';
import {
  computeAssetDepreciation,
  FILIERE_LABELS,
  formatDateFR,
  formatFCFA,
  getTodayISO,
} from '../utils/formatters';

const ASSET_CAT_LABELS: Record<AssetCategory, string> = {
  TERRAIN: 'Terrain agricole',
  BATIMENT: 'Bâtiment d’élevage',
  ETANG: 'Étang aménagé',
  MACHINE: 'Machine agricole',
  VEHICULE: 'Véhicule / Transport',
  CHEPTEL_REPRODUCTEUR: 'Cheptel reproducteur',
};

export const AssetsModule: React.FC = () => {
  const {
    state,
    canWrite,
    addFixedAsset,
    disposeFixedAsset,
    verifyAssetQR,
  } = useERP();

  const writable = canWrite('assets');
  const [tab, setTab] = useState<'registre' | 'etiquettes' | 'pointage'>('registre');
  const [selectedScheduleAssetId, setSelectedScheduleAssetId] = useState<string | null>(null);
  const [disposingAssetId, setDisposingAssetId] = useState<string | null>(null);
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Formulaire Nouvel Actif Immobilisé
  const [aCode, setACode] = useState('');
  const [aName, setAName] = useState('');
  const [aCat, setACat] = useState<AssetCategory>('MACHINE');
  const [aFiliere, setAFiliere] = useState<Filiere>('RIZICULTURE');
  const [aSite, setASite] = useState('Domaine Central');
  const [aDate, setADate] = useState(getTodayISO());
  const [aVal, setAVal] = useState(4500000);
  const [aLife, setALife] = useState(5);
  const [aMethod, setAMethod] = useState<'LINEAIRE' | 'DEGRESSIF'>('LINEAIRE');

  // Formulaire Cession / Mise au rebut
  const [dispType, setDispType] = useState<'CEDE' | 'REBUT'>('CEDE');
  const [dispPrice, setDispPrice] = useState(1500000);
  const [dispPayMode, setDispPayMode] = useState<Exclude<PaymentMode, 'CREDIT'>>('BANQUE');

  // Pointage Mobile QR Code
  const [qrInputCode, setQrInputCode] = useState(state.assets[0]?.code || 'IMM-MAT-004');
  const [qrStatus, setQrStatus] = useState<'CONFORME' | 'A_REPARER' | 'MANQUANT'>('CONFORME');

  const totals = useMemo(() => {
    let vo = 0;
    let cumul = 0;
    let vnc = 0;
    for (const a of state.assets) {
      if (a.status !== 'EN_SERVICE') continue;
      const calc = computeAssetDepreciation(a);
      vo += a.originalValue;
      cumul += calc.cumulativeDepreciation;
      vnc += calc.vnc;
    }
    return { vo, cumul, vnc };
  }, [state.assets]);

  const selectedAssetSchedule = useMemo(() => {
    if (!selectedScheduleAssetId) return null;
    const asset = state.assets.find((a) => a.id === selectedScheduleAssetId);
    if (!asset) return null;
    return {
      asset,
      calc: computeAssetDepreciation(asset),
    };
  }, [selectedScheduleAssetId, state.assets]);

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addFixedAsset({
      code: aCode,
      name: aName,
      category: aCat,
      filiere: aFiliere,
      site: aSite,
      acquisitionDate: aDate,
      originalValue: Number(aVal),
      usefulLifeYears: aCat === 'TERRAIN' ? 0 : Number(aLife),
      method: aMethod,
    });
    setFeedback(res);
    if (res.ok) {
      setShowNewAsset(false);
      setACode('');
      setAName('');
    }
  };

  const handleDisposeSubmit = (e: React.FormEvent, assetId: string) => {
    e.preventDefault();
    const res = disposeFixedAsset({
      assetId,
      type: dispType,
      date: getTodayISO(),
      disposalPrice: dispType === 'REBUT' ? 0 : Number(dispPrice),
      paymentMode: dispPayMode,
    });
    setFeedback(res);
    if (res.ok) {
      setDisposingAssetId(null);
    }
  };

  const handleQRScanVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const res = verifyAssetQR({
      assetCode: qrInputCode,
      physicalStatus: qrStatus,
    });
    setFeedback(res);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Registre des Immobilisations & Amortissements SYSCOHADA
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Valeur d’origine :{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {formatFCFA(totals.vo)}
            </span>{' '}
            · VNC nette :{' '}
            <span className="font-mono tabular-nums font-semibold text-emerald-800">
              {formatFCFA(totals.vnc)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          {writable && (
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setShowNewAsset(!showNewAsset);
              }}
              className="min-h-[44px] px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Immobilisation</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('pointage')}
            className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <ScanLine className="w-4 h-4" />
            <span>Pointage Mobile QR</span>
          </button>
        </div>
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

      {/* FORMULAIRE NOUVELLE IMMOBILISATION */}
      {showNewAsset && writable && (
        <form
          onSubmit={handleCreateAsset}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print"
        >
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Inscription d’un Nouvel Actif au Registre (Classe 2 SYSCOHADA)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Code Actif</label>
              <input
                type="text"
                placeholder="IMM-MAT-009"
                value={aCode}
                onChange={(e) => setACode(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Désignation complète du bien
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Groupe Électrogène Secours 45 kVA Couveuse"
                value={aName}
                onChange={(e) => setAName(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Catégorie</label>
              <select
                value={aCat}
                onChange={(e) => setACat(e.target.value as AssetCategory)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                {Object.entries(ASSET_CAT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Filière d’affectation
              </label>
              <select
                value={aFiliere}
                onChange={(e) => setAFiliere(e.target.value as Filiere)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="AVICULTURE">Aviculture</option>
                <option value="PORCICULTURE">Porciculture</option>
                <option value="PISCICULTURE">Pisciculture</option>
                <option value="RIZICULTURE">Riziculture</option>
                <option value="TRANSVERSAL">Transversal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Site géographique
              </label>
              <input
                type="text"
                required
                value={aSite}
                onChange={(e) => setASite(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Valeur d’Origine (FCFA)
              </label>
              <input
                type="number"
                min={10000}
                required
                value={aVal}
                onChange={(e) => setAVal(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Durée (ans) & Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  max={40}
                  disabled={aCat === 'TERRAIN'}
                  value={aCat === 'TERRAIN' ? 0 : aLife}
                  onChange={(e) => setALife(Number(e.target.value))}
                  className="w-full min-h-[42px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                />
                <select
                  value={aMethod}
                  onChange={(e) => setAMethod(e.target.value as 'LINEAIRE' | 'DEGRESSIF')}
                  className="w-full min-h-[42px] px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="LINEAIRE">Linéaire</option>
                  <option value="DEGRESSIF">Dégressif</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg"
            >
              Inscrire l’actif et comptabiliser
            </button>
          </div>
        </form>
      )}

      {/* Onglets */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit no-print">
        {[
          { id: 'registre', label: `Registre & Tableaux d’Amortissement (${state.assets.length})` },
          { id: 'etiquettes', label: 'Étiquettes QR Code (Impression)' },
          { id: 'pointage', label: 'Inventaire Physique Mobile (Scan QR)' },
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

      {/* 1. REGISTRE & TABLEAUX D'AMORTISSEMENT */}
      {tab === 'registre' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Actif & Site</th>
                    <th className="py-3 px-4">Filière & Mode</th>
                    <th className="py-3 px-4 text-right">Valeur d’Origine</th>
                    <th className="py-3 px-4 text-right">Dotation Annuelle</th>
                    <th className="py-3 px-4 text-right">Amort. Cumulés</th>
                    <th className="py-3 px-4 text-right">VNC Actuelle</th>
                    <th className="py-3 px-4 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {state.assets.map((asset) => {
                    const { annualDotation, cumulativeDepreciation, vnc } =
                      computeAssetDepreciation(asset);
                    return (
                      <React.Fragment key={asset.id}>
                        <tr className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{asset.name}</div>
                            <div className="text-xs text-slate-500">
                              <span className="font-mono font-semibold">{asset.code}</span> ·{' '}
                              {ASSET_CAT_LABELS[asset.category]} · {asset.site}
                              {asset.status !== 'EN_SERVICE' && (
                                <span className="text-red-700 font-semibold ml-1.5">
                                  [{asset.status}]
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            <div>{FILIERE_LABELS[asset.filiere]}</div>
                            <div className="text-slate-500">
                              {asset.usefulLifeYears > 0
                                ? `${asset.method} (${asset.usefulLifeYears} ans)`
                                : 'Non amortissable'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                            {formatFCFA(asset.originalValue)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {annualDotation > 0 ? formatFCFA(annualDotation) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                            {cumulativeDepreciation > 0
                              ? formatFCFA(cumulativeDepreciation)
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-900">
                            {formatFCFA(vnc)}
                          </td>
                          <td className="py-3 px-4 text-right no-print">
                            <div className="inline-flex items-center gap-1.5">
                              {asset.usefulLifeYears > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedScheduleAssetId(
                                      selectedScheduleAssetId === asset.id ? null : asset.id
                                    )
                                  }
                                  className="min-h-[34px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-md inline-flex items-center gap-1"
                                >
                                  <Table2 className="w-3.5 h-3.5" />
                                  <span>Tableau</span>
                                </button>
                              )}
                              {writable && asset.status === 'EN_SERVICE' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDisposingAssetId(
                                      disposingAssetId === asset.id ? null : asset.id
                                    )
                                  }
                                  className="min-h-[34px] px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-medium rounded-md inline-flex items-center gap-1"
                                >
                                  <ArchiveX className="w-3.5 h-3.5" />
                                  <span>Sortir</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Formulaire Cession / Mise au rebut en ligne */}
                        {disposingAssetId === asset.id && writable && (
                          <tr>
                            <td colSpan={7} className="p-4 bg-slate-50 border-t border-slate-200">
                              <form
                                onSubmit={(e) => handleDisposeSubmit(e, asset.id)}
                                className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Motif de sortie du patrimoine
                                    </label>
                                    <select
                                      value={dispType}
                                      onChange={(e) =>
                                        setDispType(e.target.value as 'CEDE' | 'REBUT')
                                      }
                                      className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                    >
                                      <option value="CEDE">Cession / Vente d’occasion (822/812)</option>
                                      <option value="REBUT">Mise au rebut / Destruction (812)</option>
                                    </select>
                                  </div>
                                  {dispType === 'CEDE' && (
                                    <>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                          Prix de cession (FCFA) — VNC: {formatFCFA(vnc)}
                                        </label>
                                        <input
                                          type="number"
                                          min={0}
                                          value={dispPrice}
                                          onChange={(e) => setDispPrice(Number(e.target.value))}
                                          className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                          Encaissement
                                        </label>
                                        <select
                                          value={dispPayMode}
                                          onChange={(e) =>
                                            setDispPayMode(
                                              e.target.value as Exclude<PaymentMode, 'CREDIT'>
                                            )
                                          }
                                          className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                        >
                                          <option value="BANQUE">Banque (521)</option>
                                          <option value="MOBILE_MONEY">Mobile Money (552)</option>
                                          <option value="CAISSE">Caisse (571)</option>
                                        </select>
                                      </div>
                                    </>
                                  )}
                                </div>
                                <button
                                  type="submit"
                                  className="min-h-[40px] px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-medium rounded-lg shrink-0"
                                >
                                  Confirmer la sortie HAO
                                </button>
                              </form>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tableau d'amortissement détaillé de l'actif sélectionné */}
          {selectedAssetSchedule && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Plan d’Amortissement {selectedAssetSchedule.asset.method} —{' '}
                    {selectedAssetSchedule.asset.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Acquis le {formatDateFR(selectedAssetSchedule.asset.acquisitionDate)} · Durée :{' '}
                    {selectedAssetSchedule.asset.usefulLifeYears} ans
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedScheduleAssetId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Fermer le tableau
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2 px-3">Exercice</th>
                      <th className="py-2 px-3 text-right">Base Amortissable</th>
                      <th className="py-2 px-3 text-right">Dotation de l’Exercice</th>
                      <th className="py-2 px-3 text-right">Amortissements Cumulés</th>
                      <th className="py-2 px-3 text-right">Valeur Nette Comptable (VNC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAssetSchedule.calc.schedule.map((row) => (
                      <tr key={row.year} className={row.year === 2026 ? 'bg-emerald-50/50' : ''}>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                          {row.year}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatFCFA(row.baseValue)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatFCFA(row.annuity)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                          {formatFCFA(row.cumulativeDepreciation)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-emerald-900">
                          {formatFCFA(row.netBookValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. GÉNÉRATION D'ÉTIQUETTES QR CODE PAR ACTIF */}
      {tab === 'etiquettes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 no-print">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Planche d’Étiquettes d’Inventaire QR Code
              </h2>
              <p className="text-xs text-slate-500">
                À apposer sur les bâtiments, machines, véhicules et équipements pour pointage terrain
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[40px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer les étiquettes</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.assets
              .filter((a) => a.status === 'EN_SERVICE')
              .map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white border border-slate-300 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="shrink-0 p-2 bg-white border border-slate-200 rounded-lg">
                    <QRCodeSVG
                      value={JSON.stringify({
                        app: 'SGAI',
                        code: asset.code,
                        site: asset.site,
                      })}
                      size={84}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold tracking-wider text-emerald-800">
                      SGAI PATRIMOINE
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                      {asset.code}
                    </div>
                    <div className="text-xs font-medium text-slate-800 line-clamp-2 mt-0.5">
                      {asset.name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 truncate">
                      {asset.site} · Acq. {asset.acquisitionDate.slice(0, 4)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 3. INTERFACE DE POINTAGE MOBILE QR CODE */}
      {tab === 'pointage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleQRScanVerify}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <QrCode className="w-5 h-5 text-emerald-800" />
              <h2 className="text-base font-semibold text-slate-900">
                Terminal Mobile de Pointage Physique
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Scannez avec une douchette/caméra ou sélectionnez rapidement l’étiquette QR de l’actif contrôlé sur le terrain :
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Code QR lu ou sélectionné
              </label>
              <input
                type="text"
                required
                value={qrInputCode}
                onChange={(e) => setQrInputCode(e.target.value)}
                placeholder="Ex: IMM-MAT-004"
                className="w-full min-h-[48px] px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-base font-mono font-semibold"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {state.assets
                  .filter((a) => a.status === 'EN_SERVICE')
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setQrInputCode(a.code)}
                      className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                        qrInputCode === a.code
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {a.code}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                État physique constaté sur site
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CONFORME', label: 'Présent & Bon' },
                  { id: 'A_REPARER', label: 'À réparer' },
                  { id: 'MANQUANT', label: 'Introuvable' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setQrStatus(st.id as typeof qrStatus)}
                    className={`min-h-[46px] px-2 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      qrStatus === st.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!writable}
              className="w-full min-h-[48px] px-4 py-3 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Valider la présence physique du bien
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                État d’Avancement du Pointage Physique
              </h3>
              <span className="font-mono text-xs text-emerald-800 font-semibold">
                {state.assets.filter((a) => a.lastScannedAt).length} /{' '}
                {state.assets.filter((a) => a.status === 'EN_SERVICE').length} pointés
              </span>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              {state.assets
                .filter((a) => a.status === 'EN_SERVICE')
                .map((a) => (
                  <div key={a.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{a.name}</div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono">{a.code}</span> · {a.site}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      {a.lastScannedAt ? (
                        <div>
                          <div
                            className={`font-semibold ${
                              a.physicalStatus === 'MANQUANT'
                                ? 'text-red-700'
                                : a.physicalStatus === 'A_REPARER'
                                ? 'text-amber-700'
                                : 'text-emerald-800'
                            }`}
                          >
                            {a.physicalStatus === 'CONFORME'
                              ? 'Vérifié conforme'
                              : a.physicalStatus === 'A_REPARER'
                              ? 'À réparer'
                              : 'Signalé manquant'}
                          </div>
                          <div className="font-mono text-slate-500">
                            Le {formatDateFR(a.lastScannedAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-medium">En attente de scan</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
