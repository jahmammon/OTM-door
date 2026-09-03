import React, { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Eye,
  FileText,
  CreditCard,
  CheckCircle,
  Clock,
  Hammer,
  Trash2,
  X,
  AlertCircle,
  Printer,
  ChevronRight
} from 'lucide-react';
import { db, recordAudit } from '../db';
import type {
  Order,
  OrderItem,
  Client,
  DoorModel,
  Colour,
  Frame,
  Material,
  Payment,
  ProductionOrder,
  OrderStatus
} from '../types';
import { createOrder, cancelOrder, recalculateOrderTotals } from '../services/orderService';
import { lookupPrice } from '../services/pricingService';
import { createPayment } from '../services/paymentService';
import { generateOrderPdf, generatePaymentReceiptPdf, formatCurrency, formatDateFr } from '../services/documentService';

interface OrdersViewProps {
  subSection?: string;
  onOpenNewOrderModal?: () => void;
}

interface NewOrderDraftItem {
  modelId: string;
  materialName: string;
  colourId: string;
  width: number;
  height: number;
  frameId?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ subSection = 'ALL' }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [doorModels, setDoorModels] = useState<DoorModel[]>([]);
  const [colours, setColours] = useState<Colour[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>(subSection);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showNewOrderModal, setShowNewOrderModal] = useState(subSection === 'NEW');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [selectedOrderPayments, setSelectedOrderPayments] = useState<Payment[]>([]);
  const [selectedOrderProds, setSelectedOrderProds] = useState<ProductionOrder[]>([]);

  // New Order Form state
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isNewClientMode, setIsNewClientMode] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientWilaya, setNewClientWilaya] = useState('Alger');
  const [newClientAddress, setNewClientAddress] = useState('');

  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [initialDeposit, setInitialDeposit] = useState(0);
  const [orderNotes, setOrderNotes] = useState('');

  // Draft Items in New Order
  const [draftItems, setDraftItems] = useState<NewOrderDraftItem[]>([
    {
      modelId: '',
      materialName: 'WPC',
      colourId: '',
      width: 80,
      height: 210,
      frameId: '',
      quantity: 1,
      unitPrice: 0
    }
  ]);
  const [creationError, setCreationError] = useState('');

  // Payment modal from order details
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'Espèces' | 'Virement' | 'CCP' | 'Autre'>('Espèces');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [allOrders, allClients, allModels, allColours, allFrames, allMats] = await Promise.all([
        db.orders.orderBy('createdAt').reverse().toArray(),
        db.clients.toArray(),
        db.doorModels.filter((m) => m.active).toArray(),
        db.colours.filter((c) => c.active).toArray(),
        db.frames.filter((f) => f.active).toArray(),
        db.materials.filter((m) => m.active).toArray()
      ]);
      setOrders(allOrders);
      setClients(allClients);
      setDoorModels(allModels);
      setColours(allColours);
      setFrames(allFrames);
      setMaterials(allMats);
    } catch (err) {
      console.error('Erreur chargement commandes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (subSection === 'NEW') {
      setShowNewOrderModal(true);
    } else if (subSection) {
      setStatusFilter(subSection);
    }
  }, [subSection]);

  // Open order details
  const handleOpenOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    const [items, payments, prods] = await Promise.all([
      db.orderItems.where('orderId').equals(order.id).toArray(),
      db.payments.where('orderId').equals(order.id).toArray(),
      db.productionOrders.where('orderId').equals(order.id).toArray()
    ]);
    setSelectedOrderItems(items);
    setSelectedOrderPayments(payments);
    setSelectedOrderProds(prods);
  };

  // Auto price lookup when draft item properties change
  const handleItemPropertyChange = async (index: number, field: keyof NewOrderDraftItem, value: any) => {
    const updated = [...draftItems];
    updated[index] = { ...updated[index], [field]: value };

    // If model, material, width, or height changed, trigger automatic price lookup
    if (['modelId', 'materialName', 'width', 'height'].includes(field)) {
      const item = updated[index];
      if (item.modelId && item.materialName && item.width && item.height) {
        try {
          const lookup = await lookupPrice({
            modelId: item.modelId,
            materialName: item.materialName,
            width: Number(item.width),
            height: Number(item.height)
          });
          if (lookup.price && lookup.price > 0) {
            updated[index].unitPrice = lookup.price;
          }
        } catch {
          // Keep current price
        }
      }
    }

    setDraftItems(updated);
  };

  const handleAddDraftItem = () => {
    setDraftItems([
      ...draftItems,
      {
        modelId: doorModels[0]?.id || '',
        materialName: 'WPC',
        colourId: colours[0]?.id || '',
        width: 80,
        height: 210,
        frameId: frames[0]?.id || '',
        quantity: 1,
        unitPrice: 0
      }
    ]);
  };

  const handleRemoveDraftItem = (index: number) => {
    if (draftItems.length > 1) {
      setDraftItems(draftItems.filter((_, i) => i !== index));
    }
  };

  // Calculate totals for new order
  const subtotal = draftItems.reduce((sum, it) => sum + (Number(it.unitPrice || 0) * Number(it.quantity || 1)), 0);
  const totalAmount = Math.max(0, subtotal - (discountAmount || 0));

  // Submit New Order
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreationError('');

    let clientId = selectedClientId;

    if (isNewClientMode) {
      if (!newClientName.trim() || !newClientPhone.trim()) {
        setCreationError('Le nom et le numéro de téléphone du client sont obligatoires.');
        return;
      }
      const newCli: Client = {
        id: `cli_${Date.now()}`,
        clientId: `CLI-${Date.now().toString().slice(-4)}`,
        name: newClientName.trim(),
        phone: newClientPhone.trim(),
        wilaya: newClientWilaya,
        commune: '',
        address: newClientAddress,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.clients.add(newCli);
      clientId = newCli.id;
    } else if (!clientId) {
      setCreationError('Veuillez sélectionner un client pour cette commande.');
      return;
    }

    // Validate items
    for (let i = 0; i < draftItems.length; i++) {
      const it = draftItems[i];
      if (!it.modelId) {
        setCreationError(`Veuillez sélectionner le modèle de porte pour la ligne ${i + 1}`);
        return;
      }
      if (!it.unitPrice || it.unitPrice <= 0) {
        setCreationError(`Veuillez renseigner un prix unitaire supérieur à zéro pour la ligne ${i + 1}`);
        return;
      }
    }

    try {
      const created = await createOrder({
        clientId,
        date: orderDate,
        expectedDate: expectedDate || undefined,
        discount: discountAmount,
        initialDeposit: initialDeposit > 0 ? initialDeposit : undefined,
        depositPaymentMethod: 'Espèces',
        notes: orderNotes,
        items: draftItems.map((it) => ({
          modelId: it.modelId,
          materialName: it.materialName,
          colourId: it.colourId || colours[0]?.id || '',
          width: Number(it.width),
          height: Number(it.height),
          frameId: it.frameId || undefined,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          notes: it.notes
        }))
      });

      setShowNewOrderModal(false);
      // Reset form
      setDraftItems([{ modelId: '', materialName: 'WPC', colourId: '', width: 80, height: 210, frameId: '', quantity: 1, unitPrice: 0 }]);
      setDiscountAmount(0);
      setInitialDeposit(0);
      setOrderNotes('');

      await loadData();
      await handleOpenOrderDetails(created);
    } catch (err: any) {
      setCreationError(err.message || 'Erreur lors de la création');
    }
  };

  // Add Payment to selected order
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (payAmount <= 0) return;

    try {
      const p = await createPayment({
        orderId: selectedOrder.id,
        amount: payAmount,
        paymentMethod: payMethod,
        reference: payRef,
        note: payNote
      });
      setShowPaymentModal(false);
      setPayAmount(0);
      setPayRef('');
      setPayNote('');

      const updatedOrder = await db.orders.get(selectedOrder.id);
      if (updatedOrder) {
        await handleOpenOrderDetails(updatedOrder);
      }
      await loadData();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // Status transitions
  const handleUpdateOrderStatus = async (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    await db.orders.update(selectedOrder.id, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    await recordAudit('Changement statut commande', 'orders', `Commande ${selectedOrder.orderNumber} passée à ${newStatus}`, selectedOrder.id);
    const updated = await db.orders.get(selectedOrder.id);
    if (updated) setSelectedOrder(updated);
    await loadData();
  };

  // Cancel order
  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    const reason = window.prompt('Motif obligatoire d’annulation de la commande :');
    if (!reason || !reason.trim()) return;

    try {
      await cancelOrder(selectedOrder.id, reason);
      const updated = await db.orders.get(selectedOrder.id);
      if (updated) setSelectedOrder(updated);
      await loadData();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'TO_PRODUCE') {
      if (o.status !== 'CONFIRMÉE' && o.status !== 'EN_PRODUCTION') return false;
    } else if (statusFilter === 'READY') {
      if (o.status !== 'PRÊTE' && o.status !== 'PARTIELLEMENT_PRÊTE') return false;
    } else if (statusFilter === 'CLOSED') {
      if (o.status !== 'CLÔTURÉE') return false;
    } else if (statusFilter !== 'ALL' && statusFilter !== 'NEW') {
      if (o.status !== statusFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchCli = o.clientNameSnapshot.toLowerCase().includes(q);
      const matchPhone = o.clientPhoneSnapshot?.toLowerCase().includes(q);
      return matchNum || matchCli || matchPhone;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Sub Header / Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Toutes ({orders.length})
          </button>
          <button
            onClick={() => setStatusFilter('TO_PRODUCE')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'TO_PRODUCE' ? 'bg-orange-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>À Produire</span>
          </button>
          <button
            onClick={() => setStatusFilter('READY')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'READY' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Prêtes</span>
          </button>
          <button
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'CLOSED' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Clôturées
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par N° commande, client, téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64 md:w-80"
            />
          </div>

          <button
            id="btn-create-order"
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer shadow-md shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Commande</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">N° Commande</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Délai Prévu</th>
                <th className="py-3 px-4 text-right">Montant Total</th>
                <th className="py-3 px-4 text-right">Encaissé</th>
                <th className="py-3 px-4 text-right">Reste à Payer</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Aucune commande trouvée. Cliquez sur "Nouvelle Commande" pour commencer.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const statusBadge: Record<string, { label: string; cls: string }> = {
                    'BROUILLON': { label: 'BROUILLON', cls: 'bg-slate-800 text-slate-300 border-slate-700' },
                    'CONFIRMÉE': { label: 'CONFIRMÉE', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
                    'EN_PRODUCTION': { label: 'EN FABRICATION', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
                    'PARTIELLEMENT_PRÊTE': { label: 'PARTIELLEMENT PRÊTE', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
                    'PRÊTE': { label: 'PRÊTE', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
                    'CLÔTURÉE': { label: 'CLÔTURÉE', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
                    'ANNULÉE': { label: 'ANNULÉE', cls: 'bg-red-500/10 text-red-400 border-red-500/30' }
                  };
                  const badge = statusBadge[order.status] || { label: order.status, cls: 'bg-slate-800 text-slate-300' };

                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleOpenOrderDetails(order)}
                      className="hover:bg-slate-800/40 transition cursor-pointer"
                    >
                      <td className="py-3 px-4 font-bold text-amber-400 font-mono">{order.orderNumber}</td>
                      <td className="py-3 px-4 text-slate-400">{formatDateFr(order.date)}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{order.clientNameSnapshot}</div>
                        <div className="text-[10px] text-slate-400">{order.clientPhoneSnapshot}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {order.expectedDate ? formatDateFr(order.expectedDate) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-200">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                        {formatCurrency(order.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {order.remainingAmount > 0 ? (
                          <span className="text-red-400">{formatCurrency(order.remainingAmount)}</span>
                        ) : (
                          <span className="text-emerald-400">Soldé</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOrderDetails(order);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          Détails
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NOUVELLE COMMANDE MULTI-LIGNES */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Nouveau Bon de Commande OTM DOOR</h3>
              </div>
              <button onClick={() => setShowNewOrderModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="mt-5 space-y-6 text-xs">
              {/* Client & Header info */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">1. Client & Dates de livraison</span>
                  <button
                    type="button"
                    onClick={() => setIsNewClientMode(!isNewClientMode)}
                    className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                  >
                    {isNewClientMode ? '← Choisir un client existant' : '+ Créer un nouveau client'}
                  </button>
                </div>

                {!isNewClientMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Sélectionner le Client *</label>
                      <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">-- Choisir un client --</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone}) - {c.wilaya}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Date de la commande</label>
                      <input
                        type="date"
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Délai / Date de livraison prévue</label>
                      <input
                        type="date"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Nom / Promoteur *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nom du client"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Téléphone *</label>
                      <input
                        type="text"
                        required
                        placeholder="0550..."
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Wilaya *</label>
                      <input
                        type="text"
                        placeholder="Wilaya"
                        value={newClientWilaya}
                        onChange={(e) => setNewClientWilaya(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Adresse</label>
                      <input
                        type="text"
                        placeholder="Chantier ou adresse"
                        value={newClientAddress}
                        onChange={(e) => setNewClientAddress(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-line Doors */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">2. Lignes de portes commandées</span>
                  <button
                    type="button"
                    onClick={handleAddDraftItem}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold border border-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter une porte
                  </button>
                </div>

                <div className="space-y-3">
                  {draftItems.map((item, index) => {
                    const selectedModel = doorModels.find((m) => m.id === item.modelId);
                    const selectedColour = colours.find((c) => c.id === item.colourId);

                    return (
                      <div key={index} className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 relative">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2">
                          <span className="font-bold text-amber-400 text-xs">Porte N° {index + 1}</span>
                          {draftItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftItem(index)}
                              className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                          {/* Modèle */}
                          <div className="col-span-2">
                            <label className="block text-slate-400 mb-1">Modèle de Porte *</label>
                            <select
                              value={item.modelId}
                              onChange={(e) => handleItemPropertyChange(index, 'modelId', e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white font-semibold focus:border-amber-500 focus:outline-none"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {doorModels.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.ref} - {m.name}
                                </option>
                              ))}
                            </select>
                            {selectedModel?.cncImage && (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-sky-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                <span>Dessin CNC associé</span>
                              </div>
                            )}
                          </div>

                          {/* Matière */}
                          <div>
                            <label className="block text-slate-400 mb-1">Matière *</label>
                            <select
                              value={item.materialName}
                              onChange={(e) => handleItemPropertyChange(index, 'materialName', e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                            >
                              {materials.map((m) => (
                                <option key={m.id} value={m.name}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Couleur */}
                          <div>
                            <label className="block text-slate-400 mb-1">Couleur</label>
                            <select
                              value={item.colourId}
                              onChange={(e) => handleItemPropertyChange(index, 'colourId', e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                            >
                              <option value="">Standard</option>
                              {colours.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Dimensions */}
                          <div>
                            <label className="block text-slate-400 mb-1">L x H (cm) *</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                placeholder="Larg."
                                value={item.width}
                                onChange={(e) => handleItemPropertyChange(index, 'width', parseInt(e.target.value) || 80)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white text-center"
                              />
                              <span className="text-slate-500">x</span>
                              <input
                                type="number"
                                placeholder="Haut."
                                value={item.height}
                                onChange={(e) => handleItemPropertyChange(index, 'height', parseInt(e.target.value) || 210)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white text-center"
                              />
                            </div>
                          </div>

                          {/* Cadre */}
                          <div>
                            <label className="block text-slate-400 mb-1">Cadre</label>
                            <select
                              value={item.frameId || ''}
                              onChange={(e) => handleItemPropertyChange(index, 'frameId', e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                            >
                              <option value="">Sans cadre</option>
                              {frames.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.ref} ({f.width})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantité & Prix */}
                          <div className="flex items-center gap-2">
                            <div className="w-16">
                              <label className="block text-slate-400 mb-1">Qté *</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemPropertyChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white text-center font-bold"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-slate-400 mb-1">P.U (DA) *</label>
                              <input
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => handleItemPropertyChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white font-bold text-amber-400"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex justify-end text-[11px] font-medium text-slate-400">
                          Total ligne : <strong className="text-white ml-1.5">{formatCurrency(item.unitPrice * item.quantity)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial calculations */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                <span className="font-bold text-slate-200">3. Règlement et Totaux</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1">Remise commerciale exceptionnelle (DA)</label>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Versement initial / Acompte (DA)</label>
                    <input
                      type="number"
                      min="0"
                      value={initialDeposit}
                      onChange={(e) => setInitialDeposit(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-emerald-400 font-bold focus:border-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Un reçu de caisse sera édité automatiquement</span>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Observations / Consignes atelier</label>
                    <input
                      type="text"
                      placeholder="Ex: Emballage renforcé pour transport..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-900 flex flex-wrap items-center justify-between text-xs">
                  <div className="text-slate-400">
                    Sous-total : <span className="font-semibold text-slate-200">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="text-base font-black text-amber-400">
                    TOTAL COMMANDE : <span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="text-xs font-bold text-red-400">
                    Reste à Payer : <span>{formatCurrency(Math.max(0, totalAmount - initialDeposit))}</span>
                  </div>
                </div>
              </div>

              {creationError && (
                <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{creationError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/15"
                >
                  Valider et Enregistrer la commande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DÉTAILS DE LA COMMANDE */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[95vh] overflow-y-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono text-amber-400 font-bold">{selectedOrder.orderNumber}</span>
                <h3 className="text-lg font-bold text-white">Commande de {selectedOrder.clientNameSnapshot}</h3>
                <p className="text-xs text-slate-400">Enregistrée le {formatDateFr(selectedOrder.date)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => generateOrderPdf(selectedOrder, selectedOrderItems)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer Bon de Commande (PDF)</span>
              </button>

              <button
                onClick={() => {
                  setPayAmount(selectedOrder.remainingAmount);
                  setShowPaymentModal(true);
                }}
                disabled={selectedOrder.remainingAmount <= 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Enregistrer un versement</span>
              </button>

              {/* Status triggers */}
              {selectedOrder.status !== 'PRÊTE' && selectedOrder.status !== 'CLÔTURÉE' && selectedOrder.status !== 'ANNULÉE' && (
                <button
                  onClick={() => handleUpdateOrderStatus('PRÊTE')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 hover:bg-slate-700"
                >
                  Marquer comme Prête
                </button>
              )}

              {selectedOrder.status === 'PRÊTE' && (
                <button
                  onClick={() => handleUpdateOrderStatus('CLÔTURÉE')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Clôturer / Livrer
                </button>
              )}

              {selectedOrder.status !== 'ANNULÉE' && selectedOrder.status !== 'CLÔTURÉE' && (
                <button
                  onClick={handleCancelOrder}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                >
                  Annuler la commande
                </button>
              )}
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                <span className="text-[10px] text-slate-400">Total Commande</span>
                <p className="text-sm font-black text-white">{formatCurrency(selectedOrder.totalAmount)}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                <span className="text-[10px] text-slate-400">Encaissé à ce jour</span>
                <p className="text-sm font-black text-emerald-400">{formatCurrency(selectedOrder.paidAmount)}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                <span className="text-[10px] text-slate-400">Reste à Payer</span>
                <p className="text-sm font-black text-red-400">{formatCurrency(selectedOrder.remainingAmount)}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                <span className="text-[10px] text-slate-400">Statut du dossier</span>
                <p className="text-xs font-bold text-amber-400 mt-1">{selectedOrder.status.replace(/_/g, ' ')}</p>
              </div>
            </div>

            {/* Door Items list with CNC preview */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300">Portes commandées ({selectedOrderItems.length})</h4>
              <div className="space-y-2">
                {selectedOrderItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-7 w-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-amber-400 text-xs">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-white text-xs">
                          {item.modelRefSnapshot} — {item.modelNameSnapshot}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{item.materialName}</span>
                          <span>•</span>
                          <span>{item.colourNameSnapshot}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-300">{item.width} x {item.height} cm</span>
                          <span>•</span>
                          <span className="text-amber-300">{item.frameNameSnapshot}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <span className="font-bold text-slate-200">
                        {item.quantity} unité(s) x {formatCurrency(item.unitPrice)}
                      </span>
                      <p className="text-amber-400 font-bold">{formatCurrency(item.totalPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked Production Orders */}
            {selectedOrderProds.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5" /> Ordres de fabrication atelier liés ({selectedOrderProds.length})
                </h4>
                <div className="space-y-1.5">
                  {selectedOrderProds.map((prod) => (
                    <div key={prod.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-amber-400">{prod.productionNumber}</span>
                        <span className="text-slate-300 ml-2">{prod.modelRefSnapshot} ({prod.width}x{prod.height} cm)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{prod.quantity} unité(s)</span>
                        <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[10px] font-bold border border-orange-500/20">
                          {prod.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payments History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Historique des règlements ({selectedOrderPayments.length})
              </h4>
              {selectedOrderPayments.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Aucun versement enregistré pour cette commande.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedOrderPayments.map((pay) => (
                    <div key={pay.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-emerald-400">{pay.receiptNumber}</span>
                        <span className="text-slate-400 ml-2">{formatDateFr(pay.date)}</span>
                        <span className="text-slate-500 ml-2">({pay.paymentMethod})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">{formatCurrency(pay.amount)}</span>
                        <button
                          onClick={() => generatePaymentReceiptPdf(pay, selectedOrder)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                        >
                          Reçu PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENREGISTRER UN VERSEMENT */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Enregistrer un versement
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block">Commande :</span>
                <span className="font-bold text-amber-400">{selectedOrder.orderNumber}</span> — {selectedOrder.clientNameSnapshot}
                <div className="mt-1 text-slate-300">
                  Reste à payer actuel : <strong className="text-red-400">{formatCurrency(selectedOrder.remainingAmount)}</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Montant du versement (DA) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-emerald-400 font-bold text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Mode de paiement *</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement bancaire</option>
                  <option value="CCP">Versement CCP</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">N° de chèque ou Référence virement</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Ex: CHQ-482910"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Remarques / Reçu</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Ex: Acompte 50%"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 cursor-pointer"
                >
                  Valider et émettre le reçu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
