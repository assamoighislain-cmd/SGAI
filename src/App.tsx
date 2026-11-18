/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Database,
  Download,
  LayoutDashboard,
  Menu,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { AccountingModule } from './components/AccountingModule';
import { AssetsModule } from './components/AssetsModule';
import { DashboardModule } from './components/DashboardModule';
import { FleetModule } from './components/FleetModule';
import { ProductionModule } from './components/ProductionModule';
import { SalesModule } from './components/SalesModule';
import { StocksModule } from './components/StocksModule';
import { ERPProvider, useERP } from './context/ERPContext';
import { ModuleId, UserRole } from './types/erp';
import { ROLE_LABELS } from './utils/formatters';

interface NavItemConfig {
  id: ModuleId;
  label: string;
  group: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Tableau de Bord Global',
    group: 'Direction & Pilotage',
    icon: LayoutDashboard,
  },
  {
    id: 'stocks',
    label: 'Stocks d’Intrants',
    group: 'Opérations Terrain',
    icon: Package,
  },
  {
    id: 'production',
    label: 'Production (4 Filières)',
    group: 'Opérations Terrain',
    icon: Sprout,
  },
  {
    id: 'sales',
    label: 'Produits Finis & Ventes',
    group: 'Commercial & Finance',
    icon: ShoppingBag,
  },
  {
    id: 'accounting',
    label: 'Comptabilité SYSCOHADA',
    group: 'Commercial & Finance',
    icon: BookOpenCheck,
  },
  {
    id: 'fleet',
    label: 'Parc Auto & Engins',
    group: 'Patrimoine & Logistique',
    icon: Truck,
  },
  {
    id: 'assets',
    label: 'Immobilisations & QR',
    group: 'Patrimoine & Logistique',
    icon: Building2,
  },
];

const ERPShell: React.FC = () => {
  const {
    role,
    setRole,
    activeModule,
    setActiveModule,
    allowedModules,
    alerts,
    resetDemoData,
    exportBackupJSON,
    importBackupJSON,
  } = useERP();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [systemFeedback, setSystemFeedback] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Comptage des alertes temps réel par module
  const alertCountsByModule = useMemo(() => {
    const counts: Record<ModuleId, number> = {
      dashboard: alerts.length,
      stocks: 0,
      production: 0,
      sales: 0,
      accounting: 0,
      fleet: 0,
      assets: 0,
    };
    for (const alt of alerts) {
      counts[alt.module] = (counts[alt.module] || 0) + 1;
    }
    return counts;
  }, [alerts]);

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => allowedModules.includes(item.id)),
    [allowedModules]
  );

  const groupedNav = useMemo(() => {
    const groups = new Map<string, NavItemConfig[]>();
    for (const item of visibleNavItems) {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group)!.push(item);
    }
    return Array.from(groups.entries());
  }, [visibleNavItems]);

  const currentModuleTitle =
    NAV_ITEMS.find((i) => i.id === activeModule)?.label || 'Exploitation';

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = await importBackupJSON(text);
    setSystemFeedback(res);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmReset = async () => {
    const res = await resetDemoData();
    setConfirmReset(false);
    setSystemFeedback(res);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 select-none">
      {/* Identité SGAI */}
      <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-bold tracking-tight text-white">
            SGAI Agropastoral
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            ERP Intégré · SYSCOHADA
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation par domaines avec indicateurs d'alertes temps réel */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groupedNav.map(([groupTitle, items]) => (
          <div key={groupTitle}>
            <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
              {groupTitle}
            </div>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                const count = item.id === 'dashboard' ? 0 : alertCountsByModule[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between gap-2 transition-colors ${
                      isActive
                        ? 'bg-emerald-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-emerald-200' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>

                    {count > 0 && (
                      <span
                        title={`${count} alerte(s) active(s)`}
                        className={`font-mono tabular-nums text-xs font-semibold shrink-0 ${
                          isActive ? 'text-amber-200' : 'text-amber-400'
                        }`}
                      >
                        {count}!
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pied de barre latérale : Résumé RBAC & Sauvegarde Hors-Ligne */}
      <div className="p-4 border-t border-slate-800 space-y-3 text-xs">
        <div className="text-slate-400">
          <div className="font-medium text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{ROLE_LABELS[role].label}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {ROLE_LABELS[role].description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            setSystemFeedback(null);
            setConfirmReset(false);
            setDataModalOpen(true);
          }}
          className="w-full min-h-[40px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Sauvegarde JSON & Démo</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-800 no-print">
        <div className="sticky top-0 h-screen">{renderSidebarContent()}</div>
      </aside>

      {/* Sidebar Mobile / Tablette Terrain */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Zone Principale */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract : Fil d'Ariane à gauche — Contrôle RBAC & Sauvegarde à droite */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 no-print">
          {/* Zone 1 : Menu mobile + Fil d'Ariane */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[42px] min-w-[42px] p-2 text-slate-700 hover:bg-slate-100 rounded-lg inline-flex items-center justify-center"
              aria-label="Ouvrir la navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 truncate flex items-center gap-2">
              <span className="font-semibold text-slate-900 hidden sm:inline">
                Domaine Agropastoral
              </span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-emerald-900 truncate">{currentModuleTitle}</span>
            </div>
          </div>

          {/* Zone 2 : Sélecteur de Rôle Simulé (RBAC) + Bouton Sauvegarde */}
          <div className="flex items-center gap-2.5 shrink-0">
            <label htmlFor="rbac-role-select" className="sr-only">
              Rôle utilisateur simulé
            </label>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs font-medium text-slate-500 whitespace-nowrap">
                Rôle actif :
              </span>
              <select
                id="rbac-role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="min-h-[40px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200/70 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((rKey) => (
                  <option key={rKey} value={rKey}>
                    {ROLE_LABELS[rKey].label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSystemFeedback(null);
                setConfirmReset(false);
                setDataModalOpen(true);
              }}
              className="hidden sm:inline-flex min-h-[40px] px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Sauvegarde / Démo</span>
            </button>
          </div>
        </header>

        {/* Contenu du Module Actif */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeModule === 'dashboard' && <DashboardModule />}
          {activeModule === 'stocks' && <StocksModule />}
          {activeModule === 'production' && <ProductionModule />}
          {activeModule === 'sales' && <SalesModule />}
          {activeModule === 'accounting' && <AccountingModule />}
          {activeModule === 'fleet' && <FleetModule />}
          {activeModule === 'assets' && <AssetsModule />}
        </main>
      </div>

      {/* Modale de Gestion Hors-Ligne (Export/Import JSON & Réinitialisation Démo) */}
      {dataModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 no-print">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Stockage Hors-Ligne & Sauvegarde JSON
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synchronisation automatique LocalStorage + IndexedDB sans perte de données
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDataModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {systemFeedback && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-center gap-2 ${
                  systemFeedback.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {systemFeedback.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                )}
                <span>{systemFeedback.message}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Exporter JSON */}
              <button
                type="button"
                onClick={() => {
                  exportBackupJSON();
                  setSystemFeedback({
                    ok: true,
                    message: 'Fichier de sauvegarde JSON téléchargé avec succès.',
                  });
                }}
                className="w-full min-h-[46px] px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Exporter la sauvegarde complète (.JSON)</span>
              </button>

              {/* Importer JSON */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[46px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer / Restaurer un fichier JSON</span>
                </button>
              </div>

              {/* Réinitialiser les données de démonstration */}
              <div className="pt-3 border-t border-slate-100">
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="w-full min-h-[44px] px-4 py-2 bg-red-50 hover:bg-red-100 text-red-800 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Réinitialiser les données de démo</span>
                  </button>
                ) : (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg space-y-3">
                    <p className="text-xs text-red-900 font-medium">
                      Confirmer la remise à zéro ? Toutes vos saisies locales seront remplacées par le jeu de démonstration initial en FCFA.
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-md"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmReset}
                        className="min-h-[36px] px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-md"
                      >
                        Oui, réinitialiser maintenant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ERPProvider>
      <ERPShell />
    </ERPProvider>
  );
}
