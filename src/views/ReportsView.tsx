import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Boxes,
  Users,
  FileText,
  AlertTriangle,
  Layers,
  ArrowDownRight
} from 'lucide-react';
import { db } from '../db';
import type { Order, StockItem, Client, Payment } from '../types';
import { generateStockReportPdf, formatCurrency } from '../services/documentService';

export const ReportsView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [allOrders, allStock, allClients, allPayments] = await Promise.all([
        db.orders.toArray(),
        db.stockItems.toArray(),
        db.clients.toArray(),
        db.payments.toArray()
      ]);
      setOrders(allOrders);
      setStockItems(allStock);
      setClients(allClients);
      setPayments(allPayments);
      setLoading(false);
    };
    load();
  }, []);

  // Calculations
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalDebt = orders.reduce((sum, o) => sum + (o.remainingAmount || 0), 0);

  // Unpaid clients list
  const debtorClients = clients.map((client) => {
    const clientOrders = orders.filter((o) => o.clientId === client.id);
    const debt = clientOrders.reduce((sum, o) => sum + (o.remainingAmount || 0), 0);
    return { client, debt, orderCount: clientOrders.length };
  }).filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt);

  // Finished doors count
  const finishedDoorsCount = stockItems
    .filter((i) => i.itemType === 'FINISHED_DOOR')
    .reduce((sum, i) => sum + i.physicalQuantity, 0);

  // Raw materials count
  const rawMaterialsCount = stockItems
    .filter((i) => i.itemType === 'RAW_MATERIAL')
    .reduce((sum, i) => sum + i.physicalQuantity, 0);

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white">Rapports Financiers & Indicateurs d'Activité</h3>
          <p className="text-xs text-slate-400">Synthèse consolidée des ventes, créances et stocks OTM DOOR</p>
        </div>

        <button
          onClick={() => generateStockReportPdf(stockItems)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer shadow-md shadow-amber-500/10"
        >
          <FileText className="w-4 h-4" />
          <span>Exporter Rapport Stock PDF</span>
        </button>
      </div>

      {/* Global KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Chiffre d'Affaires Global</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(totalRevenue)}</p>
          <span className="text-[10px] text-slate-500">{orders.length} commande(s) au total</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Encaissé Réel en Caisse</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{formatCurrency(totalCollected)}</p>
          <span className="text-[10px] text-slate-500">{payments.length} versement(s)</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Créances Clients (Impayés)</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black text-red-400">{formatCurrency(totalDebt)}</p>
          <span className="text-[10px] text-slate-500">{debtorClients.length} client(s) débiteur(s)</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Portes Finies en Dépôt</span>
            <Boxes className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-black text-sky-400">{finishedDoorsCount} unité(s)</p>
          <span className="text-[10px] text-slate-500">{rawMaterialsCount} panneaux de matières</span>
        </div>
      </div>

      {/* Two columns: Debtor clients & Stock breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Debtor clients table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-red-400" /> Suivi des Débiteurs & Restes à Payer
            </h4>
            <span className="text-xs text-red-400 font-bold">{debtorClients.length} débiteur(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Téléphone</th>
                  <th className="py-2.5 px-3 text-right">Reste Dû (DA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {debtorClients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-emerald-400">
                      Toutes les commandes sont intégralement soldées ! Aucune créance.
                    </td>
                  </tr>
                ) : (
                  debtorClients.map(({ client, debt }) => (
                    <tr key={client.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-white">{client.name}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{client.phone}</td>
                      <td className="py-2.5 px-3 text-right font-black text-red-400 text-sm">
                        {formatCurrency(debt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Boxes className="w-4 h-4 text-amber-400" /> Synthèse des Stocks Physiques
          </h4>

          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs">Portes Finies Usinées</span>
                <p className="text-[11px] text-slate-400">Stock disponible pour enlèvement immédiat</p>
              </div>
              <span className="text-lg font-black text-emerald-400">{finishedDoorsCount} unité(s)</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs">Matières Brutes (WPC, MDF, PVC)</span>
                <p className="text-[11px] text-slate-400">Panneaux disponibles pour l'atelier CNC</p>
              </div>
              <span className="text-lg font-black text-amber-400">{rawMaterialsCount} panneau(x)</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs">Articles en Alerte / Rupture</span>
                <p className="text-[11px] text-slate-400">Sous le seuil de sécurité défini</p>
              </div>
              <span className="text-lg font-black text-red-400">
                {stockItems.filter((i) => i.availableQuantity <= i.minAlertThreshold).length} article(s)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
