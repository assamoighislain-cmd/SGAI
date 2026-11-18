import { Filiere, FixedAsset, UserRole } from '../types/erp';

export function formatFCFA(amount: number): string {
  const rounded = Math.round(amount || 0);
  return `${rounded.toLocaleString('fr-FR')} FCFA`;
}

export function formatNumber(val: number, decimals = 0): string {
  return (val || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDateFR(isoDate?: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysUntil(isoDate?: string): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate.split('T')[0]}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export const FILIERE_LABELS: Record<Filiere, string> = {
  AVICULTURE: 'Aviculture (Poulets)',
  PORCICULTURE: 'Porciculture (Porcs)',
  PISCICULTURE: 'Pisciculture (Étangs)',
  RIZICULTURE: 'Riziculture (Parcelles)',
  TRANSVERSAL: 'Transversal / Siège',
};

export const ROLE_LABELS: Record<UserRole, { label: string; description: string }> = {
  ADMIN: {
    label: 'Admin / Direction',
    description: 'Accès intégral tous modules, trésorerie et sauvegardes',
  },
  EXPLOITATION: {
    label: 'Resp. Exploitation',
    description: 'Pilotage technique des 4 filières, stocks, parc et actifs',
  },
  TECHNICIEN: {
    label: 'Technicien Terrain',
    description: 'Saisie quotidienne élevage/étangs/parcelles, sorties et pointage QR',
  },
  MAGASINIER: {
    label: 'Magasinier',
    description: 'Entrées/sorties d’intrants, contrôle des écarts et inventaires',
  },
  COMMERCIAL: {
    label: 'Commercial',
    description: 'Stocks produits finis, facturation, encours et relances clients',
  },
  COMPTABLE: {
    label: 'Comptable SYSCOHADA',
    description: 'Journal, Grand Livre, Balance, analytique, trésorerie et amortissements',
  },
  PARC: {
    label: 'Gestionnaire Parc',
    description: 'Flotte véhicules/engins, ravitaillements carburant et maintenance',
  },
};

export interface DepreciationRow {
  year: number;
  baseValue: number;
  annuity: number;
  cumulativeDepreciation: number;
  netBookValue: number;
}

/**
 * Calcule le tableau d'amortissement SYSCOHADA (Linéaire ou Dégressif)
 * et les valeurs actuelles (Dotation annuelle, Amortissements cumulés, VNC).
 */
export function computeAssetDepreciation(
  asset: FixedAsset,
  referenceYear?: number
): {
  annualDotation: number;
  cumulativeDepreciation: number;
  vnc: number;
  schedule: DepreciationRow[];
} {
  if (asset.usefulLifeYears <= 0 || asset.category === 'TERRAIN') {
    return {
      annualDotation: 0,
      cumulativeDepreciation: 0,
      vnc: asset.status === 'EN_SERVICE' ? asset.originalValue : 0,
      schedule: [],
    };
  }

  const acqDate = new Date(`${asset.acquisitionDate}T00:00:00`);
  const startYear = acqDate.getFullYear();
  const refYear = referenceYear ?? new Date().getFullYear();
  const n = asset.usefulLifeYears;
  const linearRate = 1 / n;

  // Coefficients dégressifs SYSCOHADA : 1.5 (3-4 ans), 2.0 (5-6 ans), 2.5 (>6 ans)
  const coeff = n <= 4 ? 1.5 : n <= 6 ? 2.0 : 2.5;
  const degressiveRate = linearRate * coeff;

  const schedule: DepreciationRow[] = [];
  let remainingBase = asset.originalValue;
  let cumulative = 0;

  for (let i = 0; i < n; i++) {
    const yr = startYear + i;
    const remainingYears = n - i;
    let annuity = 0;

    if (asset.method === 'LINEAIRE') {
      // Prorata temporis sur la 1ère année en base 360 jours simplifiée
      if (i === 0) {
        const monthsUsed = 12 - acqDate.getMonth();
        annuity = Math.round(asset.originalValue * linearRate * (monthsUsed / 12));
      } else {
        annuity = Math.round(asset.originalValue * linearRate);
      }
      if (cumulative + annuity > asset.originalValue) {
        annuity = asset.originalValue - cumulative;
      }
    } else {
      const linearEquivalentRate = 1 / remainingYears;
      const appliedRate = Math.max(degressiveRate, linearEquivalentRate);
      annuity = Math.round(remainingBase * appliedRate);
      if (i === n - 1 || cumulative + annuity > asset.originalValue) {
        annuity = asset.originalValue - cumulative;
      }
    }

    cumulative += annuity;
    const vncEnd = Math.max(0, asset.originalValue - cumulative);

    schedule.push({
      year: yr,
      baseValue: remainingBase,
      annuity,
      cumulativeDepreciation: cumulative,
      netBookValue: vncEnd,
    });

    remainingBase = vncEnd;
  }

  // Ajouter le reliquat prorata sur N+1 en linéaire si non totalement amorti
  if (asset.method === 'LINEAIRE' && cumulative < asset.originalValue) {
    const reliquat = asset.originalValue - cumulative;
    cumulative += reliquat;
    schedule.push({
      year: startYear + n,
      baseValue: reliquat,
      annuity: reliquat,
      cumulativeDepreciation: cumulative,
      netBookValue: 0,
    });
  }

  // Valeurs à l'année de référence
  let currentCumulative = 0;
  let currentAnnuity = 0;
  for (const row of schedule) {
    if (row.year <= refYear) {
      currentCumulative = row.cumulativeDepreciation;
    }
    if (row.year === refYear) {
      currentAnnuity = row.annuity;
    }
  }

  if (asset.status !== 'EN_SERVICE') {
    return {
      annualDotation: 0,
      cumulativeDepreciation: currentCumulative,
      vnc: 0,
      schedule,
    };
  }

  return {
    annualDotation: currentAnnuity,
    cumulativeDepreciation: currentCumulative,
    vnc: Math.max(0, asset.originalValue - currentCumulative),
    schedule,
  };
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const bom = '\uFEFF'; // UTF-8 BOM pour Excel français
  const csvContent =
    bom +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
