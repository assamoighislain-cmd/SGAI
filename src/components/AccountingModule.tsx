import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  Plus,
  Printer,
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { getAccountByCode, SYSCOHADA_ACCOUNTS } from '../data/syscohada';
import { Filiere, JournalLine } from '../types/erp';
import {
  computeAssetDepreciation,
  exportToCSV,
  FILIERE_LABELS,
  formatDateFR,
  formatFCFA,
  getTodayISO,
} from '../utils/formatters';

export const AccountingModule: React.FC = () => {
  const { state, canWrite, addManualJournalEntry, postAnnualDepreciations } = useERP();
  const writable = canWrite('accounting');

  const [tab, setTab] = useState<
    'journal' | 'analytique' | 'grandlivre' | 'balance' | 'tresorerie' | 'plan'
  >('journal');
  const [selectedFiliere, setSelectedFiliere] = useState<'ALL' | Filiere>('ALL');
  const [ledgerAccount, setLedgerAccount] = useState('411');
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Formulaire Écriture Comptable Manuelle (OD / Salaires / Charges)
  const [jeDate, setJeDate] = useState(getTodayISO());
  const [jeJournal, setJeJournal] = useState<'OD' | 'ACH' | 'TRE' | 'VTE'>('OD');
  const [jeDesc, setJeDesc] = useState('');
  const [jeFiliere, setJeFiliere] = useState<Filiere>('TRANSVERSAL');
  const [line1Code, setLine1Code] = useState('661');
  const [line1Debit, setLine1Debit] = useState(450000);
  const [line2Code, setLine2Code] = useState('521');
  const [line2Credit, setLine2Credit] = useState(450000);

  // Balance Générale SYSCOHADA calculée à partir des écritures
  const trialBalance = useMemo(() => {
    const map = new Map<
      string,
      { code: string; label: string; classe: number; debit: number; credit: number }
    >();

    for (const je of state.journalEntries) {
      for (const l of je.lines) {
        const acc = getAccountByCode(l.accountCode);
        if (!map.has(l.accountCode)) {
          map.set(l.accountCode, {
            code: l.accountCode,
            label: acc.label,
            classe: acc.classe,
            debit: 0,
            credit: 0,
          });
        }
        const row = map.get(l.accountCode)!;
        row.debit += l.debit;
        row.credit += l.credit;
      }
    }

    return Array.from(map.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((r) => ({
        ...r,
        soldeDebiteur: r.debit > r.credit ? r.debit - r.credit : 0,
        soldeCrediteur: r.credit > r.debit ? r.credit - r.debit : 0,
      }));
  }, [state.journalEntries]);

  // Grand Livre filtré par compte
  const ledgerMovements = useMemo(() => {
    const rows: {
      id: string;
      date: string;
      piece: string;
      description: string;
      filiere: Filiere;
      debit: number;
      credit: number;
    }[] = [];

    for (const je of state.journalEntries) {
      for (const l of je.lines) {
        if (l.accountCode === ledgerAccount) {
          rows.push({
            id: `${je.id}-${l.accountCode}-${l.debit}`,
            date: je.date,
            piece: je.pieceNumber,
            description: je.description,
            filiere: je.filiere,
            debit: l.debit,
            credit: l.credit,
          });
        }
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [state.journalEntries, ledgerAccount]);

  // Compte de Résultat Analytique par Filière (Charges directes + Dotations amortissements vs Produits)
  const analyticalReport = useMemo(() => {
    const sectors: Exclude<Filiere, 'TRANSVERSAL'>[] = [
      'AVICULTURE',
      'PORCICULTURE',
      'PISCICULTURE',
      'RIZICULTURE',
    ];
    const filteredSectors =
      selectedFiliere === 'ALL' || selectedFiliere === 'TRANSVERSAL'
        ? sectors
        : sectors.filter((s) => s === selectedFiliere);

    return filteredSectors.map((sec) => {
      let ventes = 0;
      let achatsIntrants = 0;
      let carburantEtParc = 0;
      let autresCharges = 0;

      for (const je of state.journalEntries) {
        if (je.filiere !== sec) continue;
        for (const l of je.lines) {
          if (l.accountCode.startsWith('70')) ventes += l.credit - l.debit;
          else if (l.accountCode.startsWith('602') || l.accountCode.startsWith('604'))
            achatsIntrants += l.debit - l.credit;
          else if (l.accountCode.startsWith('605') || l.accountCode.startsWith('624'))
            carburantEtParc += l.debit - l.credit;
          else if (l.accountCode.startsWith('6') && !l.accountCode.startsWith('68'))
            autresCharges += l.debit - l.credit;
        }
      }

      // Variation / Production stockée en produits finis
      const prodStockee = state.finishedProducts
        .filter((fp) => fp.filiere === sec)
        .reduce((s, fp) => s + fp.quantity * fp.costPrice, 0);

      // Dotations aux amortissements des actifs affectés à la filière
      const dotationsAmort = state.assets
        .filter((a) => a.filiere === sec && a.status === 'EN_SERVICE')
        .reduce((s, a) => s + Math.round(computeAssetDepreciation(a).annualDotation / 4), 0);

      const totalProduits = ventes + prodStockee;
      const totalCharges = achatsIntrants + carburantEtParc + autresCharges + dotationsAmort;
      const resultatAnalytique = totalProduits - totalCharges;

      return {
        filiere: sec,
        label: FILIERE_LABELS[sec],
        ventes,
        prodStockee,
        totalProduits,
        achatsIntrants,
        carburantEtParc,
        autresCharges,
        dotationsAmort,
        totalCharges,
        resultatAnalytique,
      };
    });
  }, [state, selectedFiliere]);

  const handleManualEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const acc1 = getAccountByCode(line1Code);
    const acc2 = getAccountByCode(line2Code);
    const lines: JournalLine[] = [
      { accountCode: acc1.code, accountLabel: acc1.label, debit: Number(line1Debit), credit: 0 },
      { accountCode: acc2.code, accountLabel: acc2.label, debit: 0, credit: Number(line2Credit) },
    ];
    const res = addManualJournalEntry({
      date: jeDate,
      journal: jeJournal,
      description: jeDesc,
      filiere: jeFiliere,
      lines,
    });
    setFeedback(res);
    if (res.ok) {
      setShowNewEntry(false);
      setJeDesc('');
    }
  };

  const handleExportCurrentStateCSV = () => {
    if (tab === 'balance') {
      exportToCSV(
        `balance-syscohada-${getTodayISO()}.csv`,
        ['Compte', 'Intitulé SYSCOHADA', 'Mvt Débit', 'Mvt Crédit', 'Solde Débiteur', 'Solde Créditeur'],
        trialBalance.map((r) => [
          r.code,
          r.label,
          r.debit,
          r.credit,
          r.soldeDebiteur,
          r.soldeCrediteur,
        ])
      );
      return;
    }
    if (tab === 'grandlivre') {
      exportToCSV(
        `grand-livre-${ledgerAccount}-${getTodayISO()}.csv`,
        ['Date', 'Pièce', 'Libellé', 'Filière', 'Débit', 'Crédit'],
        ledgerMovements.map((m) => [
          m.date,
          m.piece,
          m.description,
          m.filiere,
          m.debit,
          m.credit,
        ])
      );
      return;
    }
    // Par défaut : export du Journal Général
    const flatRows: (string | number)[][] = [];
    for (const je of state.journalEntries) {
      for (const l of je.lines) {
        flatRows.push([
          je.date,
          je.journal,
          je.pieceNumber,
          je.filiere,
          l.accountCode,
          l.accountLabel,
          je.description,
          l.debit,
          l.credit,
        ]);
      }
    }
    exportToCSV(
      `journal-syscohada-${getTodayISO()}.csv`,
      ['Date', 'Journal', 'Pièce', 'Filière', 'Compte', 'Intitulé', 'Libellé écriture', 'Débit', 'Crédit'],
      flatRows
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Comptabilité Générale & Analytique (SYSCOHADA Révisé)
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Génération automatique des écritures, multi-trésorerie et résultat analytique par filière
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {writable && (
            <>
              <button
                type="button"
                onClick={() => setShowNewEntry(!showNewEntry)}
                className="min-h-[42px] px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Saisir OD / Écriture</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = postAnnualDepreciations(2026);
                  setFeedback(res);
                }}
                className="min-h-[42px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Calculator className="w-4 h-4" />
                <span>Dotations Amort. 2026</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleExportCurrentStateCSV}
            className="min-h-[42px] px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Exporter CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[42px] px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer l’état</span>
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

      {/* Formulaire Saisie OD / Écriture manuelle */}
      {showNewEntry && writable && (
        <form
          onSubmit={handleManualEntrySubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print"
        >
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Saisie d’Écriture Comptable en Partie Double (SYSCOHADA)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={jeDate}
                onChange={(e) => setJeDate(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Code Journal</label>
              <select
                value={jeJournal}
                onChange={(e) => setJeJournal(e.target.value as typeof jeJournal)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="OD">OD — Opérations Diverses / Paie</option>
                <option value="ACH">ACH — Journal des Achats</option>
                <option value="TRE">TRE — Journal de Trésorerie</option>
                <option value="VTE">VTE — Journal des Ventes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Imputation Analytique
              </label>
              <select
                value={jeFiliere}
                onChange={(e) => setJeFiliere(e.target.value as Filiere)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="TRANSVERSAL">Transversal / Siège</option>
                <option value="AVICULTURE">Aviculture</option>
                <option value="PORCICULTURE">Porciculture</option>
                <option value="PISCICULTURE">Pisciculture</option>
                <option value="RIZICULTURE">Riziculture</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Libellé de la pièce
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Paie mensuelle ouvriers agricoles"
                value={jeDesc}
                onChange={(e) => setJeDesc(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-700">Ligne au DÉBIT</div>
              <select
                value={line1Code}
                onChange={(e) => setLine1Code(e.target.value)}
                className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              >
                {SYSCOHADA_ACCOUNTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                required
                value={line1Debit}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLine1Debit(v);
                  setLine2Credit(v);
                }}
                className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-700">Ligne au CRÉDIT</div>
              <select
                value={line2Code}
                onChange={(e) => setLine2Code(e.target.value)}
                className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              >
                {SYSCOHADA_ACCOUNTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                required
                value={line2Credit}
                onChange={(e) => setLine2Credit(Number(e.target.value))}
                className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg"
            >
              Comptabiliser l’écriture
            </button>
          </div>
        </form>
      )}

      {/* Onglets États SYSCOHADA */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit no-print">
        {[
          { id: 'journal', label: `Livre-Journal (${state.journalEntries.length})` },
          { id: 'analytique', label: 'Résultat Analytique (4 Filières)' },
          { id: 'tresorerie', label: 'Trésorerie & Banques' },
          { id: 'balance', label: 'Balance Générale' },
          { id: 'grandlivre', label: 'Grand Livre' },
          { id: 'plan', label: 'Plan SYSCOHADA (Cl. 1-8)' },
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

      {/* 1. LIVRE-JOURNAL */}
      {tab === 'journal' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date & Pièce</th>
                  <th className="py-3 px-4">Jnl</th>
                  <th className="py-3 px-4">Compte SYSCOHADA</th>
                  <th className="py-3 px-4">Libellé & Filière</th>
                  <th className="py-3 px-4 text-right">Débit</th>
                  <th className="py-3 px-4 text-right">Crédit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {state.journalEntries.map((je) =>
                  je.lines.map((line, idx) => (
                    <tr
                      key={`${je.id}-${idx}`}
                      className={idx === 0 ? 'border-t border-slate-200 bg-white' : 'bg-slate-50/30'}
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {idx === 0 ? (
                          <>
                            <div className="font-semibold text-slate-900">{je.pieceNumber}</div>
                            <div>{formatDateFR(je.date)}</div>
                          </>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                        {idx === 0 ? je.journal : ''}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono font-semibold text-emerald-900 mr-2">
                          {line.accountCode}
                        </span>
                        <span className="text-slate-700">{line.accountLabel}</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        {idx === 0 ? (
                          <div>
                            <span className="text-slate-900 font-medium">{je.description}</span>
                            <span className="text-slate-400"> · {FILIERE_LABELS[je.filiere]}</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {line.debit > 0 ? formatFCFA(line.debit) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {line.credit > 0 ? formatFCFA(line.credit) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. COMPTE DE RÉSULTAT ANALYTIQUE PAR FILIÈRE */}
      {tab === 'analytique' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Compte d’Exploitation Analytique par Filière Agropastorale
              </h2>
              <p className="text-xs text-slate-500">
                Imputation des ventes (702), production stockée (736), charges directes (60/62) et dotations aux amortissements (681)
              </p>
            </div>
            <select
              value={selectedFiliere}
              onChange={(e) => setSelectedFiliere(e.target.value as 'ALL' | Filiere)}
              className="min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium no-print"
            >
              <option value="ALL">Toutes les filières comparées</option>
              <option value="AVICULTURE">Aviculture (Poulets)</option>
              <option value="PORCICULTURE">Porciculture (Porcs)</option>
              <option value="PISCICULTURE">Pisciculture (Étangs)</option>
              <option value="RIZICULTURE">Riziculture (Parcelles)</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Filière</th>
                    <th className="py-3 px-4 text-right">Ventes Facturées (702)</th>
                    <th className="py-3 px-4 text-right">Stock Produits Finis</th>
                    <th className="py-3 px-4 text-right">Achats Intrants (602/604)</th>
                    <th className="py-3 px-4 text-right">Carburant & Parc</th>
                    <th className="py-3 px-4 text-right">Quote-part Amort. (681)</th>
                    <th className="py-3 px-4 text-right">Résultat Net Analytique</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {analyticalReport.map((row) => (
                    <tr key={row.filiere} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{row.label}</td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800">
                        {formatFCFA(row.ventes)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {formatFCFA(row.prodStockee)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        -{formatFCFA(row.achatsIntrants)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        -{formatFCFA(row.carburantEtParc)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        -{formatFCFA(row.dotationsAmort)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${
                          row.resultatAnalytique >= 0 ? 'text-emerald-800' : 'text-red-700'
                        }`}
                      >
                        {row.resultatAnalytique >= 0 ? '+' : ''}
                        {formatFCFA(row.resultatAnalytique)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. TRÉSORERIE MULTI-CAISSES & BANQUES */}
      {tab === 'tresorerie' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {state.treasury.map((tre) => (
            <div
              key={tre.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="text-xs font-mono text-emerald-800 font-semibold">
                  Compte SYSCOHADA {tre.code} · {tre.type}
                </div>
                <h3 className="text-base font-semibold text-slate-900 mt-1">{tre.name}</h3>
                {tre.accountNumber && (
                  <p className="text-xs font-mono text-slate-500 mt-1">{tre.accountNumber}</p>
                )}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500">Solde disponible temps réel</div>
                <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-0.5">
                  {formatFCFA(tre.balance)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. BALANCE GÉNÉRALE */}
      {tab === 'balance' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Compte</th>
                  <th className="py-3 px-4">Intitulé du Compte</th>
                  <th className="py-3 px-4 text-right">Mouvements Débit</th>
                  <th className="py-3 px-4 text-right">Mouvements Crédit</th>
                  <th className="py-3 px-4 text-right">Solde Débiteur</th>
                  <th className="py-3 px-4 text-right">Solde Créditeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {trialBalance.map((row) => (
                  <tr key={row.code} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-semibold text-emerald-900">
                      {row.code}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900">{row.label}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatFCFA(row.debit)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatFCFA(row.credit)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {row.soldeDebiteur > 0 ? formatFCFA(row.soldeDebiteur) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {row.soldeCrediteur > 0 ? formatFCFA(row.soldeCrediteur) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-sm">
                  <td colSpan={2} className="py-3 px-4 text-slate-900">
                    TOTAUX CONTRÔLE PARTIE DOUBLE
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-900">
                    {formatFCFA(trialBalance.reduce((s, r) => s + r.debit, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-900">
                    {formatFCFA(trialBalance.reduce((s, r) => s + r.credit, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                    {formatFCFA(trialBalance.reduce((s, r) => s + r.soldeDebiteur, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                    {formatFCFA(trialBalance.reduce((s, r) => s + r.soldeCrediteur, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 5. GRAND LIVRE PAR COMPTE */}
      {tab === 'grandlivre' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="text-sm font-semibold text-slate-900">
              Sélectionner un compte du Grand Livre :
            </label>
            <select
              value={ledgerAccount}
              onChange={(e) => setLedgerAccount(e.target.value)}
              className="min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
            >
              {SYSCOHADA_ACCOUNTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.label}
                </option>
              ))}
            </select>
          </div>
          {ledgerMovements.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Aucun mouvement enregistré sur le compte {ledgerAccount}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Pièce</th>
                    <th className="py-3 px-4">Libellé</th>
                    <th className="py-3 px-4 text-right">Débit</th>
                    <th className="py-3 px-4 text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {ledgerMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                        {formatDateFR(m.date)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900">
                        {m.piece}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">{m.description}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {m.debit > 0 ? formatFCFA(m.debit) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {m.credit > 0 ? formatFCFA(m.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. PLAN COMPTABLE SYSCOHADA INTÉGRÉ */}
      {tab === 'plan' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Numéro</th>
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4">Intitulé Officiel SYSCOHADA Révisé</th>
                  <th className="py-3 px-4">Nature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {SYSCOHADA_ACCOUNTS.map((acc) => (
                  <tr key={acc.code} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-semibold text-emerald-900">
                      {acc.code}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                      Classe {acc.classe}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900">{acc.label}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">{acc.nature}</td>
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
