import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Search,
  Plus,
  FileText,
  Printer,
  Calendar,
  X
} from 'lucide-react';
import { db } from '../db';
import type { Payment, Order } from '../types';
import { createPayment } from '../services/paymentService';
import { generatePaymentReceiptPdf, formatCurrency, formatDateFr } from '../services/documentService';

export const PaymentsView: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'Espèces' | 'Virement' | 'CCP' | 'Autre'>('Espèces');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [allPayments, allOrders] = await Promise.all([
        db.payments.orderBy('createdAt').reverse().toArray(),
        db.orders.filter((o) => o.remainingAmount > 0).toArray()
      ]);
      setPayments(allPayments);
      setOrders(allOrders);
    } catch (err) {
      console.error('Erreur chargement paiements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || amount <= 0) return;

    try {
      const pay = await createPayment({
        orderId: selectedOrderId,
        amount,
        paymentMethod: method,
        reference,
        note
      });
      setShowModal(false);
      setSelectedOrderId('');
      setAmount(0);
      setReference('');
      setNote('');
      await loadData();

      const relatedOrder = await db.orders.get(selectedOrderId);
      if (relatedOrder) {
        generatePaymentReceiptPdf(pay, relatedOrder);
      }
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const filteredPayments = payments.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.receiptNumber.toLowerCase().includes(q) ||
      p.orderNumberSnapshot?.toLowerCase().includes(q) ||
      p.clientNameSnapshot?.toLowerCase().includes(q) ||
      p.paymentMethod.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* KPI banner */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs text-slate-400">Total Encaissé en Caisse (Tous modes)</span>
          <p className="text-2xl font-black text-emerald-400 mt-0.5">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par N° reçu, client, commande..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64 md:w-80"
            />
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition cursor-pointer shadow-md shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Versement</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">N° Reçu</th>
              <th className="py-3 px-4">Date & Heure</th>
              <th className="py-3 px-4">Commande</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Mode</th>
              <th className="py-3 px-4 text-right">Montant Encaissé</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  Aucun versement enregistré.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">{p.receiptNumber}</td>
                  <td className="py-3 px-4 text-slate-400">{formatDateFr(p.date)} à {p.time}</td>
                  <td className="py-3 px-4 font-mono text-amber-400">{p.orderNumberSnapshot}</td>
                  <td className="py-3 px-4 font-semibold text-white">{p.clientNameSnapshot}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
                      {p.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-black text-white text-sm">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={async () => {
                        const ord = await db.orders.get(p.orderId);
                        if (ord) generatePaymentReceiptPdf(p, ord);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-[11px] font-medium text-slate-300 hover:text-white"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Reçu PDF</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL NOUVEAU PAIEMENT */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Enregistrer un versement
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Sélectionner la commande en cours *</label>
                <select
                  required
                  value={selectedOrderId}
                  onChange={(e) => {
                    setSelectedOrderId(e.target.value);
                    const ord = orders.find((o) => o.id === e.target.value);
                    if (ord) setAmount(ord.remainingAmount);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Choisir une commande --</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} - {o.clientNameSnapshot} (Reste: {formatCurrency(o.remainingAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Montant versé (DA) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-emerald-400 font-bold text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Mode de paiement *</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement bancaire</option>
                  <option value="CCP">Versement CCP</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">N° de chèque ou Référence</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex: REF-9281"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Notes / Remarques</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex: Règlement solde de livraison"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 cursor-pointer"
                >
                  Valider et imprimer le reçu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
