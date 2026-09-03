import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Layers,
  Search,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  History,
  FileText,
  SlidersHorizontal,
  Package,
  X
} from 'lucide-react';
import { db } from '../db';
import type { StockItem, StockMovement, StockItemType } from '../types';
import { adjustStockItemQuantity } from '../services/stockService';
import { generateStockReportPdf, formatDateFr } from '../services/documentService';

interface StockViewProps {
  subSection?: string;
  onNavigateSubSection?: (sub: string) => void;
}

export const StockView: React.FC<StockViewProps> = ({ subSection = 'ACTUEL' }) => {
  const [activeTab, setActiveTab] = useState<string>(subSection);
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<'ALL' | StockItemType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustDirection, setAdjustDirection] = useState<'IN' | 'OUT'>('IN');
  const [adjustMotif, setAdjustMotif] = useState('');
  const [adjustError, setAdjustError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [allStock, allMvts] = await Promise.all([
        db.stockItems.toArray(),
        db.stockMovements.orderBy('createdAt').reverse().toArray()
      ]);
      setItems(allStock);
      setMovements(allMvts);
    } catch (err) {
      console.error('Erreur chargement stock:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (subSection) {
      setActiveTab(subSection);
    }
  }, [subSection]);

  const handleOpenAdjust = (item: StockItem) => {
    setSelectedItem(item);
    setAdjustQty(1);
    setAdjustDirection('IN');
    setAdjustMotif('');
    setAdjustError('');
    setShowAdjustModal(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (adjustQty <= 0) {
      setAdjustError('La quantité doit être supérieure à zéro');
      return;
    }
    if (!adjustMotif.trim()) {
      setAdjustError('Le motif est obligatoire pour toute modification manuelle');
      return;
    }

    try {
      const qtyChange = adjustDirection === 'IN' ? adjustQty : -adjustQty;
      await adjustStockItemQuantity(
        selectedItem.id,
        qtyChange,
        adjustDirection === 'IN' ? 'CORRECTION' : 'CORRECTION',
        undefined,
        adjustMotif
      );
      setShowAdjustModal(false);
      await loadData();
    } catch (err: any) {
      setAdjustError(err.message || 'Erreur lors de l’ajustement');
    }
  };

  // Filtered Items
  const filteredItems = items.filter((item) => {
    if (filterType !== 'ALL' && item.itemType !== filterType) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchModel = item.modelRef?.toLowerCase().includes(query) || item.modelName?.toLowerCase().includes(query);
      const matchMat = item.materialName?.toLowerCase().includes(query) || item.materialNameForDoor?.toLowerCase().includes(query);
      const matchColour = item.colourName?.toLowerCase().includes(query);
      const matchComp = item.componentName?.toLowerCase().includes(query) || item.componentRef?.toLowerCase().includes(query);
      const matchLoc = item.location?.toLowerCase().includes(query);
      return matchModel || matchMat || matchColour || matchComp || matchLoc;
    }
    return true;
  });

  const alertItems = items.filter((i) => i.availableQuantity <= i.minAlertThreshold);

  return (
    <div className="space-y-5">
      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('ACTUEL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'ACTUEL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Stock Actuel ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('MOUVEMENTS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'MOUVEMENTS' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mouvements & Historique ({movements.length})
          </button>
          <button
            onClick={() => setActiveTab('ALERTES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ALERTES' ? 'bg-red-500 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Alertes de Rupture ({alertItems.length})</span>
          </button>
        </div>

        <button
          onClick={() => generateStockReportPdf(items)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span>Exporter rapport PDF</span>
        </button>
      </div>

      {/* TAB 1: STOCK ACTUEL */}
      {activeTab === 'ACTUEL' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher modèle, matière, couleur, composant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64 md:w-80"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-2.5 py-1 rounded-lg ${filterType === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setFilterType('FINISHED_DOOR')}
                  className={`px-2.5 py-1 rounded-lg ${filterType === 'FINISHED_DOOR' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Portes Finies
                </button>
                <button
                  onClick={() => setFilterType('RAW_MATERIAL')}
                  className={`px-2.5 py-1 rounded-lg ${filterType === 'RAW_MATERIAL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Matières Brutes
                </button>
                <button
                  onClick={() => setFilterType('COMPONENT')}
                  className={`px-2.5 py-1 rounded-lg ${filterType === 'COMPONENT' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Quincaillerie
                </button>
              </div>
            </div>

            <span className="text-xs text-slate-400">
              {filteredItems.length} article(s) affiché(s)
            </span>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Article / Spécifications</th>
                    <th className="py-3 px-4">Emplacement</th>
                    <th className="py-3 px-4 text-center">Stock Physique</th>
                    <th className="py-3 px-4 text-center">Stock Réservé</th>
                    <th className="py-3 px-4 text-center">Stock Disponible</th>
                    <th className="py-3 px-4 text-center">Seuil Alerte</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Aucun article correspondant aux critères de recherche.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isLow = item.availableQuantity <= item.minAlertThreshold;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.itemType === 'FINISHED_DOOR'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : item.itemType === 'RAW_MATERIAL'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            }`}>
                              {item.itemType === 'FINISHED_DOOR' ? 'PORTE FINIE' : item.itemType === 'RAW_MATERIAL' ? 'MATIÈRE' : 'COMPOSANT'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-white">
                            {item.itemType === 'FINISHED_DOOR' ? (
                              <div>
                                <span className="font-bold text-amber-400">{item.modelRef}</span> — {item.modelName}
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>{item.materialNameForDoor}</span>
                                  <span>•</span>
                                  <span>{item.colourName}</span>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-300">{item.width} x {item.height} cm</span>
                                  <span>•</span>
                                  <span className="text-amber-300">Cadre {item.frameRef || item.frameName}</span>
                                </div>
                              </div>
                            ) : item.itemType === 'RAW_MATERIAL' ? (
                              <div>
                                <span className="font-bold text-white">Panneau Brut {item.materialName}</span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold text-white">{item.componentName}</span>
                                <span className="text-slate-500 text-[10px] ml-2">({item.componentRef})</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {item.location || 'Atelier'}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-200">
                            {item.physicalQuantity} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-amber-400">
                            {item.reservedQuantity} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-center font-bold">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${
                              isLow
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {item.availableQuantity} {item.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400">
                            {item.minAlertThreshold} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenAdjust(item)}
                              className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-[11px] font-medium text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer"
                            >
                              Ajuster
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
        </div>
      )}

      {/* TAB 2: MOUVEMENTS & HISTORIQUE */}
      {activeTab === 'MOUVEMENTS' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date & Heure</th>
                    <th className="py-3 px-4">Sens</th>
                    <th className="py-3 px-4">Article</th>
                    <th className="py-3 px-4 text-center">Quantité</th>
                    <th className="py-3 px-4">Type d'opération</th>
                    <th className="py-3 px-4">Réf. Document / Commande</th>
                    <th className="py-3 px-4">Motif & Justificatif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Aucun mouvement enregistré.
                      </td>
                    </tr>
                  ) : (
                    movements.map((mvt) => (
                      <tr key={mvt.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {formatDateFr(mvt.date)} à {mvt.time}
                        </td>
                        <td className="py-3 px-4">
                          {mvt.direction === 'IN' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <ArrowDownRight className="w-3 h-3" /> ENTRÉE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              <ArrowUpRight className="w-3 h-3" /> SORTIE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {mvt.articleSnapshot}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-200">
                          {mvt.direction === 'IN' ? `+${mvt.quantity}` : `-${mvt.quantity}`}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-medium border border-slate-700">
                            {mvt.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400">
                          {mvt.documentNumber || mvt.orderNumber || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic text-[11px]">
                          {mvt.motif}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ALERTES */}
      {activeTab === 'ALERTES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">Articles sous le seuil critique de sécurité</h4>
              <p className="text-xs text-red-300/80">
                Ces articles ont un stock disponible inférieur ou égal au stock minimal d'alerte configuré.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Article</th>
                  <th className="py-3 px-4 text-center">Physique</th>
                  <th className="py-3 px-4 text-center">Réservé</th>
                  <th className="py-3 px-4 text-center">Disponible</th>
                  <th className="py-3 px-4 text-center">Seuil Minimum</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {alertItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-emerald-400 font-medium">
                      Aucune rupture constatée. Tous les stocks sont au-dessus de leur seuil de sécurité.
                    </td>
                  </tr>
                ) : (
                  alertItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-bold text-white">
                        {item.itemType === 'FINISHED_DOOR'
                          ? `${item.modelRef} (${item.width}x${item.height} cm) - ${item.colourName}`
                          : (item.materialName || item.componentName)}
                      </td>
                      <td className="py-3 px-4 text-center">{item.physicalQuantity} {item.unit}</td>
                      <td className="py-3 px-4 text-center text-amber-400">{item.reservedQuantity} {item.unit}</td>
                      <td className="py-3 px-4 text-center font-bold text-red-400">{item.availableQuantity} {item.unit}</td>
                      <td className="py-3 px-4 text-center text-slate-400">{item.minAlertThreshold} {item.unit}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenAdjust(item)}
                          className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
                        >
                          Réapprovisionner
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL AJUSTEMENT STOCK */}
      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-400" /> Ajuster le Stock
              </h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 block">Article concerné :</span>
              <span className="font-bold text-amber-400 text-sm">
                {selectedItem.itemType === 'FINISHED_DOOR'
                  ? `${selectedItem.modelRef} (${selectedItem.width}x${selectedItem.height} cm) - ${selectedItem.colourName}`
                  : (selectedItem.materialName || selectedItem.componentName)}
              </span>
              <div className="flex items-center gap-4 mt-2 text-slate-300">
                <span>Physique : <strong>{selectedItem.physicalQuantity}</strong></span>
                <span>Réservé : <strong>{selectedItem.reservedQuantity}</strong></span>
                <span>Disponible : <strong className="text-emerald-400">{selectedItem.availableQuantity}</strong></span>
              </div>
            </div>

            <form onSubmit={handleSaveAdjust} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Sens du mouvement *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('IN')}
                    className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      adjustDirection === 'IN'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" /> Entrée (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('OUT')}
                    className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      adjustDirection === 'OUT'
                        ? 'bg-orange-500 text-slate-950'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Sortie (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Quantité ({selectedItem.unit}) *</label>
                <input
                  type="number"
                  min="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Motif obligatoire du mouvement *</label>
                <textarea
                  rows={2}
                  value={adjustMotif}
                  onChange={(e) => setAdjustMotif(e.target.value)}
                  placeholder="Ex: Réception livraison fournisseur BL-9872, Casse atelier, Rectification inventaire..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {adjustError && (
                <p className="text-red-400 text-xs">⚠️ {adjustError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 cursor-pointer transition shadow-md shadow-amber-500/10"
                >
                  Confirmer le mouvement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
