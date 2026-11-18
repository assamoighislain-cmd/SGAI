import { SyscohadaAccount } from '../types/erp';

export const SYSCOHADA_ACCOUNTS: SyscohadaAccount[] = [
  // CLASSE 1 : COMPTES DE RESSOURCES DURABLES
  { code: '101', label: 'Capital social', classe: 1, nature: 'PASSIF' },
  { code: '111', label: 'Réserve légale', classe: 1, nature: 'PASSIF' },
  { code: '131', label: 'Résultat net : Bénéfice', classe: 1, nature: 'PASSIF' },
  { code: '162', label: 'Emprunts et dettes auprès des établissements de crédit', classe: 1, nature: 'PASSIF' },

  // CLASSE 2 : COMPTES D'ACTIF IMMOBILISÉ
  { code: '221', label: 'Terrains agricoles et forestiers', classe: 2, nature: 'ACTIF' },
  { code: '231', label: 'Bâtiments agricoles et d’élevage sur sol propre', classe: 2, nature: 'ACTIF' },
  { code: '234', label: 'Ouvrages et aménagements piscicoles (Étangs)', classe: 2, nature: 'ACTIF' },
  { code: '241', label: 'Matériel et outillage agricole et industriel', classe: 2, nature: 'ACTIF' },
  { code: '245', label: 'Matériel de transport et engins roulants', classe: 2, nature: 'ACTIF' },
  { code: '246', label: 'Actifs biologiques - Cheptel reproducteur', classe: 2, nature: 'ACTIF' },
  { code: '283', label: 'Amortissements des bâtiments et ouvrages agricoles', classe: 2, nature: 'PASSIF' },
  { code: '284', label: 'Amortissements du matériel, transport et actifs biologiques', classe: 2, nature: 'PASSIF' },

  // CLASSE 3 : COMPTES DE STOCKS
  { code: '321', label: 'Stocks d’aliments bétail, volaille et poisson', classe: 3, nature: 'ACTIF' },
  { code: '322', label: 'Stocks de semences, engrais et produits vétérinaires/phytos', classe: 3, nature: 'ACTIF' },
  { code: '361', label: 'Stocks de produits finis agropastoraux', classe: 3, nature: 'ACTIF' },

  // CLASSE 4 : COMPTES DE TIERS
  { code: '401', label: 'Fournisseurs, dettes en compte', classe: 4, nature: 'PASSIF' },
  { code: '411', label: 'Clients', classe: 4, nature: 'ACTIF' },
  { code: '416', label: 'Créances clients litigieuses ou douteuses', classe: 4, nature: 'ACTIF' },
  { code: '422', label: 'Personnel, rémunérations dues', classe: 4, nature: 'PASSIF' },
  { code: '443', label: 'État, TVA facturée', classe: 4, nature: 'PASSIF' },

  // CLASSE 5 : COMPTES DE TRÉSORERIE
  { code: '521', label: 'Banques locales (Compte courant exploitation)', classe: 5, nature: 'ACTIF' },
  { code: '552', label: 'Instruments de monnaie électronique (Mobile Money)', classe: 5, nature: 'ACTIF' },
  { code: '571', label: 'Caisse siège et exploitation', classe: 5, nature: 'ACTIF' },

  // CLASSE 6 : COMPTES DE CHARGES DES ACTIVITÉS ORDINAIRES
  { code: '6021', label: 'Achats d’aliments d’élevage et piscicoles', classe: 6, nature: 'CHARGE' },
  { code: '6022', label: 'Achats de semences, engrais et intrants rizicoles', classe: 6, nature: 'CHARGE' },
  { code: '6023', label: 'Achats de produits vétérinaires et phytosanitaires', classe: 6, nature: 'CHARGE' },
  { code: '6041', label: 'Achats de poussins, porcelets et alevins', classe: 6, nature: 'CHARGE' },
  { code: '6052', label: 'Fournitures non stockables - Carburants et lubrifiants', classe: 6, nature: 'CHARGE' },
  { code: '6056', label: 'Achats de petit matériel et pièces détachées', classe: 6, nature: 'CHARGE' },
  { code: '624', label: 'Entretien, réparations et maintenance du parc', classe: 6, nature: 'CHARGE' },
  { code: '625', label: 'Primes d’assurances (Parc et Exploitation)', classe: 6, nature: 'CHARGE' },
  { code: '661', label: 'Rémunérations directes versées au personnel national', classe: 6, nature: 'CHARGE' },
  { code: '681', label: 'Dotations aux amortissements d’exploitation', classe: 6, nature: 'CHARGE' },

  // CLASSE 7 : COMPTES DE PRODUITS DES ACTIVITÉS ORDINAIRES
  { code: '7021', label: 'Ventes de produits avicoles (Poulets)', classe: 7, nature: 'PRODUIT' },
  { code: '7022', label: 'Ventes de produits porcins (Porcs vifs / carcasses)', classe: 7, nature: 'PRODUIT' },
  { code: '7023', label: 'Ventes de produits piscicoles (Tilapia / Silure)', classe: 7, nature: 'PRODUIT' },
  { code: '7024', label: 'Ventes de produits rizicoles (Riz paddy / blanchi)', classe: 7, nature: 'PRODUIT' },
  { code: '736', label: 'Variations des stocks de produits finis', classe: 7, nature: 'PRODUIT' },

  // CLASSE 8 : COMPTES DES AUTRES CHARGES ET DES AUTRES PRODUITS (HAO)
  { code: '812', label: 'Valeurs comptables des cessions d’immobilisations corporelles', classe: 8, nature: 'HAO' },
  { code: '822', label: 'Produits des cessions d’immobilisations corporelles', classe: 8, nature: 'HAO' },
];

export function getAccountByCode(code: string): SyscohadaAccount {
  const found = SYSCOHADA_ACCOUNTS.find((a) => a.code === code);
  return (
    found || {
      code,
      label: `Compte ${code}`,
      classe: (Number(code[0]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) || 6,
      nature: 'CHARGE',
    }
  );
}
