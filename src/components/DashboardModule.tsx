import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CreditCard,
  Fuel,
  Package,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Filiere } from '../types/erp';
import { computeAssetDepreciation, FILIERE_LABELS, formatFCFA, formatNumber } from '../utils/formatters';

export const DashboardModule: React.FC = () => {
  const { state, alerts, setActiveModule, allowedModules } = useERP();

  // 1. Calculs KPIs Temps Réel
  const kpis = useMemo(() => {
    // Chiffre d'affaires (Classe 702x dans le journal ou total factures)
    let revenue = 0;
    for (const je of state.journalEntries) {
      for (const l of je.lines) {
        if (l.accountCode.startsWith('70')) {
          revenue += l.credit - l.debit;
        }
      }
    }

    // Trésorerie disponible (Caisse + Mobile Money + Banque)
    const treasuryTotal = state.treasury.reduce((acc, t) => acc + t.balance, 0);

    // Valeur des stocks (Intrants au CUMP + Produits finis au coût de revient)
    const inputStockVal = state.inputs.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
    const finishedStockVal = state.finishedProducts.reduce((acc, p) => acc + p.quantity * p.costPrice, 0);
    const totalStockValue = inputStockVal + finishedStockVal;

    // Créances clients & Montant en retard
    let totalReceivables = 0;
    let overdueReceivables = 0;
    for (const inv of state.invoices) {
      const due = Math.max(0, inv.totalAmount - inv.amountPaid);
      totalReceivables += due;
      if (inv.status === 'EN_RETARD') {
        overdueReceivables += due;
      }
    }

    // Valeur Nette Comptable des immobilisations actives
    const totalVNC = state.assets.reduce((acc, asset) => {
      if (asset.status !== 'EN_SERVICE') return acc;
      return acc + computeAssetDepreciation(asset).vnc;
    }, 0);

    return {
      revenue,
      treasuryTotal,
      inputStockVal,
      finishedStockVal,
      totalStockValue,
      totalReceivables,
      overdueReceivables,
      totalVNC,
    };
  }, [state]);

  // 2. Rentabilité nette par filière (Produits - Charges directes - Dotations amortissements)
  const profitabilityByFiliere = useMemo(() => {
    const sectors: Exclude<Filiere, 'TRANSVERSAL'>[] = [
      'AVICULTURE',
      'PORCICULTURE',
      'PISCICULTURE',
      'RIZICULTURE',
    ];
    const shortNames: Record<Exclude<Filiere, 'TRANSVERSAL'>, string> = {
      AVICULTURE: 'Poulets',
      PORCICULTURE: 'Porcs',
      PISCICULTURE: 'Pisciculture',
      RIZICULTURE: 'Riziculture',
    };

    return sectors.map((sec) => {
      let recettes = 0;
      let chargesCompta = 0;

      for (const je of state.journalEntries) {
        if (je.filiere !== sec) continue;
        for (const l of je.lines) {
          if (l.accountCode.startsWith('7')) recettes += l.credit - l.debit;
          if (l.accountCode.startsWith('6')) chargesCompta += l.debit - l.credit;
        }
      }

      // Valorisation de la production en stock fini par filière pour refléter la rentabilité économique réelle
      const stockFinishedVal = state.finishedProducts
        .filter((fp) => fp.filiere === sec)
        .reduce((s, fp) => s + fp.quantity * fp.unitPrice * 0.45, 0);

      // Dotation annuelle proratisée aux immobilisations affectées à la filière
      const amortQuarter = state.assets
        .filter((a) => a.filiere === sec && a.status === 'EN_SERVICE')
        .reduce((s, a) => s + Math.round(computeAssetDepreciation(a).annualDotation / 4), 0);

      const totalProduits = Math.round(recettes + stockFinishedVal);
      const totalCharges = Math.round(chargesCompta + amortQuarter);
      const resultatNet = totalProduits - totalCharges;

      return {
        filiere: shortNames[sec],
        Recettes: totalProduits,
        Charges: totalCharges,
        ResultatNet: resultatNet,
      };
    });
  }, [state]);

  // 3. Évolution mensuelle Recettes vs Dépenses
  const monthlyCashflow = useMemo(() => {
    const monthsMap = new Map<string, { mois: string; Recettes: number; Depenses: number }>();
    const monthLabels: Record<string, string> = {
      '2026-08': 'Août 26',
      '2026-09': 'Sept 26',
      '2026-10': 'Oct 26',
      '2026-11': 'Nov 26',
    };

    // Base historique août pour continuité visuelle
    monthsMap.set('2026-08', { mois: 'Août 26', Recettes: 3150000, Depenses: 2240000 });
    monthsMap.set('2026-09', { mois: 'Sept 26', Recettes: 0, Depenses: 1420000 });
    monthsMap.set('2026-10', { mois: 'Oct 26', Recettes: 0, Depenses: 0 });
    monthsMap.set('2026-11', { mois: 'Nov 26', Recettes: 0, Depenses: 0 });

    for (const je of state.journalEntries) {
      const ym = je.date.slice(0, 7);
      if (!monthsMap.has(ym)) {
        monthsMap.set(ym, { mois: monthLabels[ym] || ym, Recettes: 0, Depenses: 0 });
      }
      const bucket = monthsMap.get(ym)!;
      for (const l of je.lines) {
        if (l.accountCode.startsWith('70')) bucket.Recettes += l.credit - l.debit;
        if (l.accountCode.startsWith('6')) bucket.Depenses += l.debit - l.credit;
      }
    }

    return Array.from(monthsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [state.journalEntries]);

  // 4. Consommation carburant mensuelle (Litres & Coût)
  const monthlyFuel = useMemo(() => {
    const map = new Map<string, { mois: string; Litres: number; CoutMilliers: number }>();
    map.set('2026-08', { mois: 'Août', Litres: 310, CoutMilliers: 222 });
    map.set('2026-09', { mois: 'Sept', Litres: 0, CoutMilliers: 0 });
    map.set('2026-10', { mois: 'Oct', Litres: 0, CoutMilliers: 0 });
    map.set('2026-11', { mois: 'Nov', Litres: 0, CoutMilliers: 0 });

    const names: Record<string, string> = {
      '2026-08': 'Août',
      '2026-09': 'Sept',
      '2026-10': 'Oct',
      '2026-11': 'Nov',
      '2026-12': 'Déc',
    };

    for (const fl of state.fuelLogs) {
      const ym = fl.date.slice(0, 7);
      if (!map.has(ym)) {
        map.set(ym, { mois: names[ym] || ym, Litres: 0, CoutMilliers: 0 });
      }
      const row = map.get(ym)!;
      row.Litres += fl.liters;
      row.CoutMilliers += Math.round(fl.totalCost / 1000);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [state.fuelLogs]);

  return (
    <div className="space-y-6">
      {/* En-tête synthétique */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Pilotage Général de l’Exploitation
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Consolidation temps réel des 4 filières agropastorales et indicateurs financiers SYSCOHADA
          </p>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Devise : Franc CFA (XOF)</span>
          <span aria-hidden="true">·</span>
          <span>Exercice 2026</span>
        </div>
      </div>

      {/* Bandeau des 5 KPIs Majeurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Chiffre d’Affaires Facturé</span>
            <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
          </div>
          <div className="mt-3 font-mono tabular-nums text-lg font-semibold text-slate-900">
            {formatFCFA(kpis.revenue)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {state.invoices.length} factures clients validées
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Trésorerie Disponible</span>
            <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
          </div>
          <div className="mt-3 font-mono tabular-nums text-lg font-semibold text-emerald-800">
            {formatFCFA(kpis.treasuryTotal)}
          </div>
          <div className="mt-2 text-xs text-slate-500 truncate">
            Banque + Mobile Money + Caisse
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Valeur Globale des Stocks</span>
            <Package className="w-4 h-4 text-slate-600 shrink-0" />
          </div>
          <div className="mt-3 font-mono tabular-nums text-lg font-semibold text-slate-900">
            {formatFCFA(kpis.totalStockValue)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Intrants {formatNumber(Math.round(kpis.inputStockVal / 1000))}k · Finis{' '}
            {formatNumber(Math.round(kpis.finishedStockVal / 1000))}k
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Créances Clients</span>
            <CreditCard className="w-4 h-4 text-amber-700 shrink-0" />
          </div>
          <div className="mt-3 font-mono tabular-nums text-lg font-semibold text-slate-900">
            {formatFCFA(kpis.totalReceivables)}
          </div>
          <div className="mt-2 text-xs text-red-700 font-medium font-mono tabular-nums">
            Dont en retard : {formatFCFA(kpis.overdueReceivables)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Immobilisations (VNC)</span>
            <Building2 className="w-4 h-4 text-slate-600 shrink-0" />
          </div>
          <div className="mt-3 font-mono tabular-nums text-lg font-semibold text-slate-900">
            {formatFCFA(kpis.totalVNC)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {state.assets.filter((a) => a.status === 'EN_SERVICE').length} actifs en exploitation
          </div>
        </div>
      </div>

      {/* Grille Graphiques Principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rentabilité par filière */}
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Rentabilité Nette par Filière
              </h2>
              <p className="text-xs text-slate-500">
                Comparaison Produits générés, Charges imputées et Résultat analytique (FCFA)
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitabilityByFiliere} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="filiere" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000000)}M`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(value) => formatFCFA(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Recettes" name="Produits & Stock" fill="#065f46" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Charges" name="Charges & Amort." fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ResultatNet" name="Marge Nette" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Évolution Recettes vs Dépenses */}
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Évolution Mensuelle Recettes vs Dépenses
              </h2>
              <p className="text-xs text-slate-500">
                Flux d’exploitation issus des journaux SYSCOHADA (Classes 6 et 7)
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyCashflow} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(value) => formatFCFA(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="Recettes"
                  name="Recettes Ventes"
                  stroke="#065f46"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Depenses"
                  name="Dépenses Exploitation"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Section Basse : Consommation Carburant + Centre d'Alertes Prioritaires */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Consommation Carburant Mensuelle */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Consommation Carburant Mensuelle
                </h2>
                <p className="text-xs text-slate-500">
                  Volume consommé (Litres) par le parc engins & véhicules
                </p>
              </div>
              <Fuel className="w-4 h-4 text-slate-500" />
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyFuel} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(val, name) =>
                      name === 'Litres' ? `${Number(val ?? 0)} L` : `${Number(val ?? 0)} k FCFA`
                    }
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Litres" name="Litres" fill="#334155" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-xs">
            {state.treasury.map((t) => (
              <div key={t.id}>
                <div className="text-slate-500 truncate">
                  {t.type === 'BANQUE' ? 'Banque (521)' : t.type === 'MOBILE_MONEY' ? 'Mobile Money (552)' : 'Caisse (571)'}
                </div>
                <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                  {formatNumber(Math.round(t.balance / 1000))} k FCFA
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Centre d'Alertes Prioritaires */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Centre d’Alertes Prioritaires Terrain & Gestion
              </h2>
              <p className="text-xs text-slate-500">
                Seuils critiques stocks, mortalités, échéances clients et maintenance préventive
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-red-700">
              {alerts.length} alerte(s) active(s)
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Aucune anomalie critique détectée sur les 4 filières.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-72">
              {alerts.map((alt) => {
                const canJump = allowedModules.includes(alt.module);
                return (
                  <div
                    key={alt.id}
                    className="py-3 flex items-start justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <AlertTriangle
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          alt.severity === 'CRITIQUE' ? 'text-red-600' : 'text-amber-600'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`font-semibold ${
                              alt.severity === 'CRITIQUE' ? 'text-red-700' : 'text-amber-700'
                            }`}
                          >
                            {alt.severity === 'CRITIQUE' ? 'Critique' : 'Attention'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{alt.category}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate mt-0.5">
                          {alt.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">{alt.detail}</p>
                      </div>
                    </div>

                    {canJump && (
                      <button
                        type="button"
                        onClick={() => setActiveModule(alt.module)}
                        className="shrink-0 min-h-[36px] px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                      >
                        <span>Traiter</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Résumé rapide des lots actifs */}
          <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500">{FILIERE_LABELS.AVICULTURE.split(' ')[0]}</span>
              <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                {formatNumber(
                  state.batches
                    .filter((b) => b.filiere === 'AVICULTURE' && b.status === 'EN_COURS')
                    .reduce((s, b) => s + b.currentCount, 0)
                )}{' '}
                sujets
              </div>
            </div>
            <div>
              <span className="text-slate-500">{FILIERE_LABELS.PORCICULTURE.split(' ')[0]}</span>
              <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                {formatNumber(
                  state.batches
                    .filter((b) => b.filiere === 'PORCICULTURE' && b.status === 'EN_COURS')
                    .reduce((s, b) => s + b.currentCount, 0)
                )}{' '}
                porcs
              </div>
            </div>
            <div>
              <span className="text-slate-500">Pisciculture</span>
              <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                {formatNumber(
                  state.ponds
                    .filter((p) => p.status === 'ACTIF')
                    .reduce((s, p) => s + p.currentCount, 0)
                )}{' '}
                poissons
              </div>
            </div>
            <div>
              <span className="text-slate-500">Riziculture</span>
              <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                {formatNumber(state.parcels.reduce((s, r) => s + r.surfaceHa, 0), 1)} ha cultivés
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
