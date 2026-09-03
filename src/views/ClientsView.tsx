import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  Edit2,
  X,
  ChevronRight
} from 'lucide-react';
import { db, recordAudit } from '../db';
import type { Client, Order } from '../types';
import { formatCurrency, formatDateFr } from '../services/documentService';

export const ClientsView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allClients, allOrders] = await Promise.all([
        db.clients.orderBy('name').toArray(),
        db.orders.toArray()
      ]);
      setClients(allClients);
      setOrders(allOrders);
    } catch (err) {
      console.error('Erreur chargement clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.name || !editingClient?.phone) return;

    const id = editingClient.id || `cli_${Date.now()}`;
    const clientToSave: Client = {
      id,
      clientId: editingClient.clientId || `CLI-${Date.now().toString().slice(-4)}`,
      name: editingClient.name.trim(),
      phone: editingClient.phone.trim(),
      phoneSecondary: editingClient.phoneSecondary?.trim(),
      wilaya: editingClient.wilaya || 'Alger',
      commune: editingClient.commune || '',
      address: editingClient.address || '',
      notes: editingClient.notes || '',
      createdAt: editingClient.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.clients.put(clientToSave);
    await recordAudit('Client enregistré', 'clients', `Client ${clientToSave.name} (${clientToSave.phone})`, clientToSave.id);
    setShowClientModal(false);
    setEditingClient(null);
    await loadData();
  };

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.wilaya?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, wilaya..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64 md:w-80"
          />
        </div>

        <button
          onClick={() => {
            setEditingClient({ wilaya: 'Alger' });
            setShowClientModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer shadow-md shadow-amber-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const clientOrders = orders.filter((o) => o.clientId === client.id);
          const totalInvoiced = clientOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          const totalRemaining = clientOrders.reduce((sum, o) => sum + (o.remainingAmount || 0), 0);

          return (
            <div
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {client.clientId}
                  </span>
                  <span className="text-[11px] text-slate-400">{clientOrders.length} commande(s)</span>
                </div>

                <h3 className="text-base font-bold text-white mt-2">{client.name}</h3>

                <div className="mt-3 space-y-1 text-xs text-slate-300">
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{client.phone}</span>
                    {client.phoneSecondary && <span className="text-slate-500">/ {client.phoneSecondary}</span>}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{[client.commune, client.wilaya].filter(Boolean).join(', ')}</span>
                  </p>
                </div>
              </div>

              {/* Financial summary */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">Total facturé</span>
                  <p className="font-semibold text-slate-200">{formatCurrency(totalInvoiced)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400">Solde débiteur</span>
                  <p className={`font-bold ${totalRemaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatCurrency(totalRemaining)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CLIENT DETAILS DRAWER/MODAL */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold">{selectedClient.clientId}</span>
                <h3 className="text-lg font-bold text-white">{selectedClient.name}</h3>
                <p className="text-xs text-slate-400">{selectedClient.phone} • {selectedClient.wilaya}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingClient(selectedClient);
                    setShowClientModal(true);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Orders list for client */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-400" /> Historique des commandes passées
              </h4>
              {orders.filter((o) => o.clientId === selectedClient.id).length === 0 ? (
                <p className="text-xs text-slate-500 italic">Aucune commande pour ce client.</p>
              ) : (
                <div className="space-y-2">
                  {orders.filter((o) => o.clientId === selectedClient.id).map((ord) => (
                    <div key={ord.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-amber-400">{ord.orderNumber}</span>
                        <span className="text-slate-400 ml-2">{formatDateFr(ord.date)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-white">{formatCurrency(ord.totalAmount)}</span>
                        <p className="text-[10px] text-red-400">Reste: {formatCurrency(ord.remainingAmount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW/EDIT CLIENT MODAL */}
      {showClientModal && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingClient.id ? 'Modifier la fiche client' : 'Nouveau Client'}
              </h3>
              <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nom / Raison Sociale *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Promotion Immobilière El Bahia"
                  value={editingClient.name || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Téléphone principal *</label>
                  <input
                    type="text"
                    required
                    placeholder="0550..."
                    value={editingClient.phone || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Téléphone 2</label>
                  <input
                    type="text"
                    placeholder="0661..."
                    value={editingClient.phoneSecondary || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, phoneSecondary: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Wilaya *</label>
                  <input
                    type="text"
                    placeholder="Alger, Oran, Blida..."
                    value={editingClient.wilaya || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, wilaya: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Commune</label>
                  <input
                    type="text"
                    placeholder="Commune"
                    value={editingClient.commune || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, commune: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Adresse / Chantier</label>
                <input
                  type="text"
                  placeholder="Adresse précise"
                  value={editingClient.address || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
