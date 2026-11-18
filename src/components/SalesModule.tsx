import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  FilePlus2,
  PhoneCall,
  UserPlus,
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { InvoiceItem, PaymentMode } from '../types/erp';
import {
  FILIERE_LABELS,
  formatDateFR,
  formatFCFA,
  formatNumber,
  getTodayISO,
} from '../utils/formatters';

export const SalesModule: React.FC = () => {
  const {
    state,
    canWrite,
    createCustomer,
    createInvoice,
    recordInvoicePayment,
    addInvoiceReminder,
  } = useERP();

  const writable = canWrite('sales');
  const [tab, setTab] = useState<'stocks' | 'factures' | 'clients'>('factures');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Formulaires ouverts
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [remindingInvoiceId, setRemindingInvoiceId] = useState<string | null>(null);

  // Nouvelle Facture
  const [invCustomerId, setInvCustomerId] = useState(state.customers[0]?.id || '');
  const [invDate, setInvDate] = useState(getTodayISO());
  const [invDueDate, setInvDueDate] = useState(getTodayISO());
  const [selectedProdId, setSelectedProdId] = useState(state.finishedProducts[0]?.id || '');
  const [selectedQty, setSelectedQty] = useState(10);
  const [draftLines, setDraftLines] = useState<InvoiceItem[]>([]);
  const [invPaid, setInvPaid] = useState(0);
  const [invPayMode, setInvPayMode] = useState<PaymentMode>('BANQUE');

  // Nouveau Client
  const [cliCode, setCliCode] = useState('');
  const [cliName, setCliName] = useState('');
  const [cliCat, setCliCat] = useState<
    'Grossiste' | 'Hôtel / Restaurant' | 'Supermarché' | 'Coopérative' | 'Particulier'
  >('Grossiste');
  const [cliPhone, setCliPhone] = useState('');
  const [cliCity, setCliCity] = useState('Abidjan');
  const [cliLimit, setCliLimit] = useState(3000000);

  // Règlement / Relance sur facture existante
  const [payAmount, setPayAmount] = useState(500000);
  const [payMethod, setPayMethod] = useState<Exclude<PaymentMode, 'CREDIT'>>('MOBILE_MONEY');
  const [remChannel, setRemChannel] = useState<'APPEL' | 'WHATSAPP' | 'SMS' | 'COURRIER'>('APPEL');
  const [remNote, setRemNote] = useState('');
  const [remAgent, setRemAgent] = useState('Service Commercial');

  const selectedCustomer = useMemo(
    () => state.customers.find((c) => c.id === invCustomerId),
    [state.customers, invCustomerId]
  );

  const draftTotal = useMemo(
    () => draftLines.reduce((sum, l) => sum + l.total, 0),
    [draftLines]
  );

  const projectedCreditNeeded = Math.max(0, draftTotal - invPaid);
  const willExceedCeiling =
    selectedCustomer !== undefined &&
    projectedCreditNeeded > 0 &&
    selectedCustomer.currentBalance + projectedCreditNeeded > selectedCustomer.creditLimit;

  const addLineToDraft = () => {
    const prod = state.finishedProducts.find((p) => p.id === selectedProdId);
    if (!prod || selectedQty <= 0) return;

    const existingQty = draftLines
      .filter((l) => l.productId === prod.id)
      .reduce((s, l) => s + l.quantity, 0);

    if (existingQty + selectedQty > prod.quantity) {
      setFeedback({
        ok: false,
        message: `Quantité supérieure au stock commercial disponible (${prod.quantity} ${prod.unit}).`,
      });
      return;
    }

    const updated = [...draftLines];
    const idx = updated.findIndex((l) => l.productId === prod.id);
    if (idx >= 0) {
      updated[idx].quantity += selectedQty;
      updated[idx].total = updated[idx].quantity * updated[idx].unitPrice;
    } else {
      updated.push({
        productId: prod.id,
        productName: prod.name,
        filiere: prod.filiere,
        unit: prod.unit,
        quantity: selectedQty,
        unitPrice: prod.unitPrice,
        total: selectedQty * prod.unitPrice,
      });
    }
    setDraftLines(updated);
    const newTotal = updated.reduce((s, x) => s + x.total, 0);
    setInvPaid(newTotal); // Par défaut comptant, modifiable en acompte/crédit
  };

  const handleSubmitInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createInvoice({
      customerId: invCustomerId,
      date: invDate,
      dueDate: invDueDate,
      items: draftLines,
      amountPaid: Number(invPaid),
      paymentMode: Number(invPaid) === 0 ? 'CREDIT' : invPayMode,
    });
    setFeedback(res);
    if (res.ok) {
      setDraftLines([]);
      setInvPaid(0);
      setShowNewInvoice(false);
    }
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createCustomer({
      code: cliCode,
      name: cliName,
      category: cliCat,
      phone: cliPhone,
      city: cliCity,
      creditLimit: Number(cliLimit),
    });
    setFeedback(res);
    if (res.ok) {
      setShowNewCustomer(false);
      setCliCode('');
      setCliName('');
      setCliPhone('');
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent, invoiceId: string) => {
    e.preventDefault();
    const res = recordInvoicePayment({
      invoiceId,
      amount: Number(payAmount),
      paymentMode: payMethod,
      date: getTodayISO(),
    });
    setFeedback(res);
    if (res.ok) {
      setPayingInvoiceId(null);
    }
  };

  const handleReminderSubmit = (e: React.FormEvent, invoiceId: string) => {
    e.preventDefault();
    const res = addInvoiceReminder({
      invoiceId,
      channel: remChannel,
      note: remNote,
      agent: remAgent,
    });
    setFeedback(res);
    if (res.ok) {
      setRemNote('');
      setRemindingInvoiceId(null);
    }
  };

  const commercialStockValue = state.finishedProducts.reduce(
    (s, p) => s + p.quantity * p.unitPrice,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Produits Finis, Ventes & Recouvrement Client
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Valeur marchande du stock prêt à vendre :{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {formatFCFA(commercialStockValue)}
            </span>{' '}
            · Contrôle strict des plafonds d’encours
          </p>
        </div>

        {writable && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setShowNewCustomer(false);
                setShowNewInvoice(!showNewInvoice);
              }}
              className="min-h-[44px] px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Nouvelle Facture / Vente</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setShowNewInvoice(false);
                setShowNewCustomer(!showNewCustomer);
              }}
              className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nouveau Client</span>
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

      {/* FORMULAIRE NOUVELLE FACTURE */}
      {showNewInvoice && writable && (
        <form
          onSubmit={handleSubmitInvoice}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Création de Commande / Facture Client (Comptant, Acompte ou Crédit)
            </h2>
            <button
              type="button"
              onClick={() => setShowNewInvoice(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Fermer
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Client</label>
              <select
                value={invCustomerId}
                onChange={(e) => setInvCustomerId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Dispo crédit :{' '}
                    {formatNumber(Math.max(0, c.creditLimit - c.currentBalance))} FCFA)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date facturation
              </label>
              <input
                type="date"
                required
                value={invDate}
                onChange={(e) => setInvDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date d’échéance règlement
              </label>
              <input
                type="date"
                required
                value={invDueDate}
                onChange={(e) => setInvDueDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          {/* Ajout de lignes produits finis */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-7">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Produit fini à facturer
                </label>
                <select
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                >
                  {state.finishedProducts.map((fp) => (
                    <option key={fp.id} value={fp.id}>
                      {fp.name} — {formatFCFA(fp.unitPrice)}/{fp.unit} (Dispo : {fp.quantity})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Quantité</label>
                <input
                  type="number"
                  min={1}
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={addLineToDraft}
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
                >
                  + Ajouter ligne
                </button>
              </div>
            </div>

            {draftLines.length > 0 && (
              <div className="divide-y divide-slate-200 pt-2 text-sm">
                {draftLines.map((line, i) => (
                  <div key={line.productId} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-900">{line.productName}</span>
                      <span className="text-xs text-slate-500 ml-2 font-mono">
                        {line.quantity} {line.unit} × {formatFCFA(line.unitPrice)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {formatFCFA(line.total)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDraftLines(draftLines.filter((_, idx) => idx !== i))}
                        className="text-xs text-red-700 hover:underline"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Règlement & Contrôle Plafond Crédit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Montant versé immédiatement (FCFA)
              </label>
              <input
                type="number"
                min={0}
                max={draftTotal}
                value={invPaid}
                onChange={(e) => setInvPaid(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Canal d’encaissement
              </label>
              <select
                value={invPayMode}
                onChange={(e) => setInvPayMode(e.target.value as PaymentMode)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="BANQUE">Banque / Chèque / Virement (521)</option>
                <option value="MOBILE_MONEY">Mobile Money (552)</option>
                <option value="CAISSE">Caisse Espèces (571)</option>
              </select>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Net à payer TTC</div>
              <div className="font-mono tabular-nums text-xl font-bold text-slate-900">
                {formatFCFA(draftTotal)}
              </div>
              <div className="text-xs font-mono text-slate-600">
                Reste en crédit : {formatFCFA(projectedCreditNeeded)}
              </div>
            </div>
          </div>

          {willExceedCeiling && selectedCustomer && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
              <span>
                <strong>Plafond d’encours dépassé :</strong> L’encours cumulé de{' '}
                {selectedCustomer.name} atteindrait{' '}
                {formatFCFA(selectedCustomer.currentBalance + projectedCreditNeeded)} pour un plafond
                autorisé de {formatFCFA(selectedCustomer.creditLimit)}. La validation sera bloquée tant
                que l’acompte est insuffisant.
              </span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={draftLines.length === 0}
              className="min-h-[44px] px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Émettre la facture et comptabiliser
            </button>
          </div>
        </form>
      )}

      {/* FORMULAIRE NOUVEAU CLIENT */}
      {showNewCustomer && writable && (
        <form
          onSubmit={handleCreateCustomer}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Création d’une Fiche Client & Plafond d’Encours Autorisé
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Code Client</label>
              <input
                type="text"
                placeholder="CLI-005"
                value={cliCode}
                onChange={(e) => setCliCode(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Raison sociale / Nom
              </label>
              <input
                type="text"
                required
                value={cliName}
                onChange={(e) => setCliName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Segment</label>
              <select
                value={cliCat}
                onChange={(e) => setCliCat(e.target.value as typeof cliCat)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              >
                <option value="Grossiste">Grossiste</option>
                <option value="Supermarché">Supermarché</option>
                <option value="Hôtel / Restaurant">Hôtel / Restaurant</option>
                <option value="Coopérative">Coopérative</option>
                <option value="Particulier">Particulier</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
              <input
                type="text"
                required
                placeholder="+225 07..."
                value={cliPhone}
                onChange={(e) => setCliPhone(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ville / Zone</label>
              <input
                type="text"
                required
                value={cliCity}
                onChange={(e) => setCliCity(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Plafond d’encours autorisé (FCFA)
              </label>
              <input
                type="number"
                min={0}
                step={50000}
                required
                value={cliLimit}
                onChange={(e) => setCliLimit(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-lg"
            >
              Enregistrer le client
            </button>
          </div>
        </form>
      )}

      {/* Navigation interne */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {[
          { id: 'factures', label: `Factures & Recouvrement (${state.invoices.length})` },
          { id: 'stocks', label: `Stocks Produits Finis (${state.finishedProducts.length})` },
          { id: 'clients', label: `Fiches Clients & Plafonds (${state.customers.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ONGLET FACTURES & JOURNAL DES RELANCES */}
      {tab === 'factures' && (
        <div className="space-y-4">
          {state.invoices.map((inv) => {
            const remaining = Math.max(0, inv.totalAmount - inv.amountPaid);
            return (
              <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">{inv.number}</span>
                      <span aria-hidden="true">·</span>
                      <span>Émise le {formatDateFR(inv.date)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Échéance {formatDateFR(inv.dueDate)}</span>
                      <span aria-hidden="true">·</span>
                      {inv.status === 'PAYE' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Payé intégralement
                        </span>
                      ) : inv.status === 'EN_RETARD' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> En retard de paiement
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <Clock className="w-3.5 h-3.5" /> Règlement partiel ({inv.paymentTerm})
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mt-1">
                      {inv.customerName}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono tabular-nums text-base font-bold text-slate-900">
                        Total : {formatFCFA(inv.totalAmount)}
                      </div>
                      <div className="font-mono tabular-nums text-xs text-slate-600">
                        Payé : {formatFCFA(inv.amountPaid)} · Reste :{' '}
                        <span className={remaining > 0 ? 'text-red-700 font-semibold' : ''}>
                          {formatFCFA(remaining)}
                        </span>
                      </div>
                    </div>

                    {writable && remaining > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPayAmount(remaining);
                            setRemindingInvoiceId(null);
                            setPayingInvoiceId(payingInvoiceId === inv.id ? null : inv.id);
                          }}
                          className="min-h-[38px] px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>Encaisser</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPayingInvoiceId(null);
                            setRemindingInvoiceId(remindingInvoiceId === inv.id ? null : inv.id);
                          }}
                          className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Relancer</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Détail lignes facture */}
                <div className="divide-y divide-slate-100 text-xs">
                  {inv.items.map((it) => (
                    <div key={it.productId} className="py-1.5 flex justify-between gap-2 text-slate-700">
                      <span>
                        {it.productName} ({FILIERE_LABELS[it.filiere].split(' ')[0]})
                      </span>
                      <span className="font-mono tabular-nums">
                        {it.quantity} {it.unit} × {formatFCFA(it.unitPrice)} ={' '}
                        <strong>{formatFCFA(it.total)}</strong>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Encaissement rapide */}
                {payingInvoiceId === inv.id && writable && (
                  <form
                    onSubmit={(e) => handlePaymentSubmit(e, inv.id)}
                    className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Montant encaissé (FCFA)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={remaining}
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(Number(e.target.value))}
                        className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Trésorerie</label>
                      <select
                        value={payMethod}
                        onChange={(e) =>
                          setPayMethod(e.target.value as Exclude<PaymentMode, 'CREDIT'>)
                        }
                        className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="MOBILE_MONEY">Mobile Money (552)</option>
                        <option value="BANQUE">Banque (521)</option>
                        <option value="CAISSE">Caisse (571)</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="min-h-[40px] px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-lg"
                    >
                      Valider l’encaissement
                    </button>
                  </form>
                )}

                {/* Ajout Relance */}
                {remindingInvoiceId === inv.id && writable && (
                  <form
                    onSubmit={(e) => handleReminderSubmit(e, inv.id)}
                    className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-xs text-slate-600 mb-1">Canal</label>
                      <select
                        value={remChannel}
                        onChange={(e) => setRemChannel(e.target.value as typeof remChannel)}
                        className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="APPEL">Appel téléphonique</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="SMS">SMS</option>
                        <option value="COURRIER">Courrier / Visite</option>
                      </select>
                    </div>
                    <div className="sm:col-span-6">
                      <label className="block text-xs text-slate-600 mb-1">
                        Compte-rendu de relance
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Promesse de règlement, date convenue..."
                        value={remNote}
                        onChange={(e) => setRemNote(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        className="w-full min-h-[40px] px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
                      >
                        Archiver la relance
                      </button>
                    </div>
                  </form>
                )}

                {/* Journal des relances */}
                {inv.reminders.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                    <div className="font-semibold text-slate-600">Journal des relances :</div>
                    {inv.reminders.map((r) => (
                      <div key={r.id} className="text-slate-600">
                        <span className="font-mono">{formatDateFR(r.date)}</span> · [{r.channel}]{' '}
                        {r.note} <span className="text-slate-400">({r.agent})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ONGLET STOCKS PRODUITS FINIS */}
      {tab === 'stocks' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Code & Produit Commercial</th>
                  <th className="py-3 px-4">Filière d’Origine</th>
                  <th className="py-3 px-4 text-right">Stock Disponible</th>
                  <th className="py-3 px-4 text-right">Coût de Revient</th>
                  <th className="py-3 px-4 text-right">Prix de Vente</th>
                  <th className="py-3 px-4 text-right">Marge Unitaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {state.finishedProducts.map((fp) => {
                  const margin = fp.unitPrice - fp.costPrice;
                  return (
                    <tr key={fp.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{fp.name}</div>
                        <div className="font-mono text-xs text-slate-500">{fp.code}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {FILIERE_LABELS[fp.filiere]}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatNumber(fp.quantity)} {fp.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {formatFCFA(fp.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatFCFA(fp.unitPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-800 font-semibold">
                        +{formatFCFA(margin)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET FICHES CLIENTS */}
      {tab === 'clients' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Client & Coordonnées</th>
                  <th className="py-3 px-4">Segment</th>
                  <th className="py-3 px-4 text-right">Encours Actuel</th>
                  <th className="py-3 px-4 text-right">Plafond Autorisé</th>
                  <th className="py-3 px-4 text-right">Crédit Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {state.customers.map((c) => {
                  const avail = Math.max(0, c.creditLimit - c.currentBalance);
                  const ratio = c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">{c.code}</span> · {c.phone} · {c.city}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{c.category}</td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                          ratio >= 85 ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {formatFCFA(c.currentBalance)} ({ratio.toFixed(0)}%)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatFCFA(c.creditLimit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-800">
                        {formatFCFA(avail)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
