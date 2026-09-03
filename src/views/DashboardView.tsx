import React, { useEffect, useState } from 'react';
import {
  Boxes,
  ShoppingCart,
  Hammer,
  AlertTriangle,
  CreditCard,
  Plus,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { db } from '../db';
import type { Order, ProductionOrder, StockItem } from '../types';
import { formatCurrency, formatDateFr, generateStockReportPdf } from '../services/documentService';
import { loadDemoData } from '../services/demoDataService';
import type { MainNavSection } from '../components/Sidebar';

interface DashboardViewProps {
  onNavigate: (section: MainNavSection, subSection?: string) => void;
  onOpenNewOrder: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenNewOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [prodOrders, setProdOrders] = useState<ProductionOrder[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [allOrders, allProds, allStocks] = await Promise.all([
        db.orders.orderBy('createdAt').reverse().toArray(),
        db.productionOrders.toArray(),
        db.stockItems.toArray()
      ]);
      setOrders(allOrders);
      setProdOrders(allProds);
      setStockItems(allStocks);
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleLoadDemo = async () => {
    if (window.confirm('Voulez-vous charger les données de démonstration complètes OTM DOOR (Catalogue, Stock initial scénarios A/B, BOM, Tarifs) ?')) {
      setDemoLoading(true);
      try {
        await loadDemoData();
        await loadDashboardData();
      } catch (err: any) {
        alert(`Erreur: ${err.message}`);
      } finally {
        setDemoLoading(false);
      }
    }
  };

  // KPIs
  const activeOrdersCount = orders.filter((o) => o.status !== 'CLÔTURÉE').length;
  const toProduceCount = prodOrders.filter((p) => p.status === 'À PRODUIRE' || p.status === 'EN PRODUCTION').length;
  const readyOrdersCount = orders.filter((o) => o.status === 'PRÊTE').length;
  const alertStocks = stockItems.filter((s) => s.availableQuantity <= s.minAlertThreshold);
  const totalRemainingAmount = orders.reduce((sum, o) => sum + (o.remainingAmount || 0), 0);
  const totalPaidAmount = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner if no data */}
      {orders.length === 0 && stockItems.length === 0 && !loading && (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Application OTM DOOR prête à l'emploi</h3>
            </div>
            <p className="text-xs text-slate-300">
              Votre base de données locale est initialisée. Vous pouvez commencer à saisir votre catalogue réel ou charger les données types pour tester.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadDemo}
              disabled={demoLoading}
              className="px-4 py-2 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer transition shadow-md shadow-amber-500/10"
            >
              {demoLoading ? 'Chargement...' : 'Charger données de démo'}
            </button>
            <button
              onClick={onOpenNewOrder}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer transition"
            >
              Créer une commande
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Commandes Actives */}
        <div
          onClick={() => onNavigate('ORDERS', 'ALL')}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Commandes en cours</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{activeOrdersCount}</span>
            <span className="text-[11px] text-slate-400">dossiers actifs</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400/90 font-medium">
            {readyOrdersCount} commande(s) prête(s)
          </p>
        </div>

        {/* Portes à Produire */}
        <div
          onClick={() => onNavigate('PRODUCTION', 'TO_PRODUCE')}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Atelier de fabrication</span>
            <div className="h-8 w-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <Hammer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{toProduceCount}</span>
            <span className="text-[11px] text-slate-400">ordres de production</span>
          </div>
          <p className="mt-1 text-[11px] text-orange-400 font-medium">
            En attente d'usinage & assemblage
          </p>
        </div>

        {/* Alertes Ruptures de Stock */}
        <div
          onClick={() => onNavigate('STOCK', 'ALERTES')}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Alertes de stock</span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
              alertStocks.length > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{alertStocks.length}</span>
            <span className="text-[11px] text-slate-400">articles sous le seuil</span>
          </div>
          <p className={`mt-1 text-[11px] font-medium ${alertStocks.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {alertStocks.length > 0 ? 'Réapprovisionnement nécessaire' : 'Niveaux de stock satisfaisants'}
          </p>
        </div>

        {/* Créances & Reste à Payer */}
        <div
          onClick={() => onNavigate('PAYMENTS')}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Reste à recouvrer</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-white">{formatCurrency(totalRemainingAmount)}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Encaissé : <span className="text-emerald-400 font-semibold">{formatCurrency(totalPaidAmount)}</span>
          </p>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer transition shadow-md shadow-amber-500/15"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un bon de commande</span>
        </button>

        <button
          onClick={() => onNavigate('PRODUCTION', 'TO_PRODUCE')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer transition"
        >
          <Hammer className="w-4 h-4 text-orange-400" />
          <span>Atelier de fabrication</span>
        </button>

        <button
          onClick={() => onNavigate('STOCK', 'ACTUEL')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer transition"
        >
          <Boxes className="w-4 h-4 text-amber-400" />
          <span>Consulter le stock</span>
        </button>

        <button
          onClick={() => generateStockReportPdf(stockItems)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer transition"
        >
          <FileText className="w-4 h-4 text-sky-400" />
          <span>Imprimer état de stock (PDF)</span>
        </button>
      </div>

      {/* Main Split: Recent Orders & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders List (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" /> Dernières commandes enregistrées
            </h3>
            <button
              onClick={() => onNavigate('ORDERS', 'ALL')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              Voir tout <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Aucune commande enregistrée pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">N° Commande</th>
                    <th className="py-2.5 px-3 font-semibold">Client</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Montant Total</th>
                    <th className="py-2.5 px-3 font-semibold">Reste</th>
                    <th className="py-2.5 px-3 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.slice(0, 6).map((order) => {
                    const statusColors: Record<string, string> = {
                      'BROUILLON': 'bg-slate-800 text-slate-300 border-slate-700',
                      'CONFIRMÉE': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
                      'EN_PRODUCTION': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
                      'PARTIELLEMENT_PRÊTE': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                      'PRÊTE': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                      'CLÔTURÉE': 'bg-slate-800 text-slate-400 border-slate-700',
                      'ANNULÉE': 'bg-red-500/10 text-red-400 border-red-500/30'
                    };
                    return (
                      <tr
                        key={order.id}
                        onClick={() => onNavigate('ORDERS', 'ALL')}
                        className="hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-bold text-amber-400">{order.orderNumber}</td>
                        <td className="py-2.5 px-3 font-medium text-white">{order.clientNameSnapshot}</td>
                        <td className="py-2.5 px-3 text-slate-400">{formatDateFr(order.date)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{formatCurrency(order.totalAmount)}</td>
                        <td className="py-2.5 px-3 font-bold text-red-400">
                          {order.remainingAmount > 0 ? formatCurrency(order.remainingAmount) : <span className="text-emerald-400">Réglé</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusColors[order.status] || 'bg-slate-800 text-slate-300'}`}>
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stock Alerts Widget (1 Col) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Alertes de réapprovisionnement
            </h3>
            <button
              onClick={() => onNavigate('STOCK', 'ALERTES')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              Gérer
            </button>
          </div>

          {alertStocks.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Tous les stocks sont au-dessus des seuils d'alerte.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {alertStocks.slice(0, 5).map((item) => {
                const label = item.itemType === 'FINISHED_DOOR'
                  ? `${item.modelRef} (${item.width}x${item.height})`
                  : (item.materialName || item.componentName);
                return (
                  <div
                    key={item.id}
                    onClick={() => onNavigate('STOCK', 'ACTUEL')}
                    className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white truncate">{label}</p>
                      <p className="text-[10px] text-slate-400">
                        Physique : {item.physicalQuantity} {item.unit} — Réservé : {item.reservedQuantity} {item.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-red-400">
                        {item.availableQuantity} {item.unit}
                      </span>
                      <p className="text-[9px] text-slate-500">Seuil min : {item.minAlertThreshold}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
