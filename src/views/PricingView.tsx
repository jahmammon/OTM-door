import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Tag,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { db, recordAudit } from '../db';
import type { PriceEntry, DoorModel, Material } from '../types';
import { formatCurrency } from '../services/documentService';

export const PricingView: React.FC = () => {
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [doorModels, setDoorModels] = useState<DoorModel[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<Partial<PriceEntry> | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allPrices, allModels, allMats] = await Promise.all([
        db.priceEntries.toArray(),
        db.doorModels.toArray(),
        db.materials.toArray()
      ]);
      setPrices(allPrices);
      setDoorModels(allModels);
      setMaterials(allMats);
    } catch (err) {
      console.error('Erreur chargement tarifs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrice?.materialName || !editingPrice?.price) return;

    const id = editingPrice.id || `prc_${Date.now()}`;
    const model = doorModels.find((m) => m.id === editingPrice.modelId);

    const priceToSave: PriceEntry = {
      id,
      modelId: editingPrice.modelId || undefined,
      modelRef: model?.ref,
      materialName: editingPrice.materialName,
      width: editingPrice.width ? Number(editingPrice.width) : undefined,
      height: editingPrice.height ? Number(editingPrice.height) : undefined,
      price: Number(editingPrice.price),
      createdAt: editingPrice.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.priceEntries.put(priceToSave);
    await recordAudit('Tarif enregistré', 'priceEntries', `Tarif ${priceToSave.modelRef || 'Générique'} ${priceToSave.materialName}: ${priceToSave.price} DA`, priceToSave.id);
    setShowModal(false);
    setEditingPrice(null);
    await loadData();
  };

  const handleDeletePrice = async (id: string) => {
    if (!window.confirm('Supprimer cette règle tarifaire ?')) return;
    await db.priceEntries.delete(id);
    await recordAudit('Tarif supprimé', 'priceEntries', `ID: ${id}`, id);
    await loadData();
  };

  const filteredPrices = prices.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchModel = p.modelRef?.toLowerCase().includes(q);
    const matchMat = p.materialName.toLowerCase().includes(q);
    return matchModel || matchMat;
  });

  return (
    <div className="space-y-5">
      {/* Notice info */}
      <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs">
          <h4 className="font-bold text-white">Règle de Gestion Tarifaire OTM DOOR</h4>
          <p className="text-amber-200/80 mt-0.5">
            Conformément aux directives de gestion de l'entreprise, <strong>aucun prix n'est calculé dynamiquement par formule opaque de surface</strong>.
            Tous les prix unitaires sont directement extraits de cette matrice ou saisis manuellement par l'opérateur.
          </p>
        </div>
      </div>

      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrer par modèle ou matière..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64 md:w-80"
          />
        </div>

        <button
          onClick={() => {
            setEditingPrice({
              materialName: 'WPC',
              width: 80,
              height: 210,
              price: 32000
            });
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer shadow-md shadow-amber-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un Tarif</span>
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">Modèle</th>
              <th className="py-3 px-4">Matière</th>
              <th className="py-3 px-4 text-center">Dimensions Définies (L x H)</th>
              <th className="py-3 px-4 text-right">Prix Unitaire Garanti</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredPrices.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  Aucun tarif dans la matrice.
                </td>
              </tr>
            ) : (
              filteredPrices.map((prc) => (
                <tr key={prc.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-bold text-white">
                    {prc.modelRef ? (
                      <span className="text-amber-400 font-mono">{prc.modelRef}</span>
                    ) : (
                      <span className="text-slate-400 italic">Tous modèles (Standard)</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-200">
                      {prc.materialName}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-300">
                    {prc.width && prc.height ? `${prc.width} x ${prc.height} cm` : 'Toutes dimensions'}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-amber-400 text-sm">
                    {formatCurrency(prc.price)}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingPrice(prc);
                        setShowModal(true);
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5 inline" />
                    </button>
                    <button
                      onClick={() => handleDeletePrice(prc.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL AJOUT/EDITION TARIF */}
      {showModal && editingPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Tarification Fixe</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Modèle de porte</label>
                <select
                  value={editingPrice.modelId || ''}
                  onChange={(e) => setEditingPrice({ ...editingPrice, modelId: e.target.value || undefined })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Tarif générique pour la matière</option>
                  {doorModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ref} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Matière *</label>
                <select
                  value={editingPrice.materialName}
                  onChange={(e) => setEditingPrice({ ...editingPrice, materialName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Largeur (cm)</label>
                  <input
                    type="number"
                    value={editingPrice.width || ''}
                    onChange={(e) => setEditingPrice({ ...editingPrice, width: parseInt(e.target.value) || undefined })}
                    placeholder="Ex: 80"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white text-center focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Hauteur (cm)</label>
                  <input
                    type="number"
                    value={editingPrice.height || ''}
                    onChange={(e) => setEditingPrice({ ...editingPrice, height: parseInt(e.target.value) || undefined })}
                    placeholder="Ex: 210"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white text-center focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Prix unitaire fixe (DA) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editingPrice.price || ''}
                  onChange={(e) => setEditingPrice({ ...editingPrice, price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-amber-400 font-bold text-sm focus:border-amber-500 focus:outline-none"
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
