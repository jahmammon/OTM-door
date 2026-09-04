import React, { useEffect, useState } from 'react';
import {
  Hammer,
  Clock,
  CheckCircle,
  FileText,
  Layers,
  AlertCircle,
  AlertTriangle,
  Play,
  Check,
  Search,
  Plus,
  Wrench,
  X
} from 'lucide-react';
import { db, recordAudit } from '../db';
import type {
  ProductionOrder,
  ProductionStatus,
  BillOfMaterials,
  DoorModel,
  Material,
  Frame,
  ComponentItem
} from '../types';
import { validateAndExecuteProduction, checkProductionMaterials } from '../services/productionService';
import { generateProductionPdf, formatDateFr } from '../services/documentService';

interface ProductionViewProps {
  subSection?: string;
}

export const ProductionView: React.FC<ProductionViewProps> = ({ subSection = 'TO_PRODUCE' }) => {
  const [activeTab, setActiveTab] = useState<string>(subSection);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [doorModels, setDoorModels] = useState<DoorModel[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New BOM modal
  const [showBomModal, setShowBomModal] = useState(false);
  const [bomName, setBomName] = useState('');
  const [bomModelId, setBomModelId] = useState('');
  const [bomMaterial, setBomMaterial] = useState('WPC');
  const [bomFrameId, setBomFrameId] = useState('');
  const [bomItems, setBomItems] = useState<{ componentId: string; quantity: number }[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allProds, allBoms, allModels, allMats, allFrames, allComps] = await Promise.all([
        db.productionOrders.orderBy('createdAt').reverse().toArray(),
        db.bom.toArray(),
        db.doorModels.toArray(),
        db.materials.toArray(),
        db.frames.toArray(),
        db.components.toArray()
      ]);
      setProductionOrders(allProds);
      setBoms(allBoms);
      setDoorModels(allModels);
      setMaterials(allMats);
      setFrames(allFrames);
      setComponents(allComps);
    } catch (err) {
      console.error('Erreur chargement production:', err);
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

  // Execute Production & Consume BOM
  const handleValidateProduction = async (prodOrder: ProductionOrder) => {
    if (prodOrder.status === 'ANNULÉE') {
      alert(`Impossible de fabriquer : L'ordre de production ${prodOrder.productionNumber} est annulé.`);
      return;
    }

    if (!window.confirm(`Confirmer le lancement et l'achèvement de la production pour l'ordre ${prodOrder.productionNumber} (${prodOrder.quantity} porte(s)) ? Cette action consommera les composants de la BOM et créditera le stock de portes finies.`)) {
      return;
    }

    try {
      await validateAndExecuteProduction(prodOrder.id);
      alert(`Production validée avec succès ! ${prodOrder.quantity} porte(s) ajoutée(s) au stock fini.`);
      await loadData();
    } catch (err: any) {
      alert(`Erreur de production: ${err.message}`);
    }
  };

  // Change status to EN PRODUCTION
  const handleSetInProgress = async (prodId: string) => {
    const p = await db.productionOrders.get(prodId);
    if (p?.status === 'ANNULÉE') {
      alert(`Impossible de démarrer l'usinage : L'ordre de production ${p.productionNumber} est annulé.`);
      return;
    }

    await db.productionOrders.update(prodId, {
      status: 'EN PRODUCTION',
      updatedAt: new Date().toISOString()
    });
    await recordAudit('Statut production', 'productionOrders', `Ordre ${prodId} passé EN PRODUCTION`, prodId);
    await loadData();
  };

  // Add BOM
  const handleSaveBom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomName.trim()) return;

    const newBom: BillOfMaterials = {
      id: `bom_${Date.now()}`,
      name: bomName,
      modelId: bomModelId || undefined,
      materialName: bomMaterial,
      frameId: bomFrameId || undefined,
      items: bomItems.map((bi) => {
        const comp = components.find((c) => c.id === bi.componentId);
        return {
          componentId: bi.componentId,
          componentName: comp?.name || 'Composant',
          quantity: Number(bi.quantity),
          unit: comp?.unit || 'pièce'
        };
      }),
      rawMaterialUnitsNeeded: 1,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.bom.add(newBom);
    await recordAudit('Création nomenclature', 'bom', `BOM ${newBom.name} créée`, newBom.id);
    setShowBomModal(false);
    setBomName('');
    setBomItems([]);
    await loadData();
  };

  // Filter orders by tab
  const filteredOrders = productionOrders.filter((p) => {
    if (activeTab === 'TO_PRODUCE') return p.status === 'À PRODUIRE';
    if (activeTab === 'AWAITING_MATERIALS') return p.status === 'EN ATTENTE DE MATIÈRES';
    if (activeTab === 'IN_PROGRESS') return p.status === 'EN PRODUCTION';
    if (activeTab === 'COMPLETED') return p.status === 'TERMINÉE';
    return true;
  });

  const handleCheckMaterials = async (order: ProductionOrder) => {
    try {
      const check = await checkProductionMaterials(order);
      if (check.canProduce) {
        await db.productionOrders.update(order.id, {
          status: 'À PRODUIRE',
          notes: 'Matières disponibles en stock',
          updatedAt: new Date().toISOString()
        });
        alert(`Matières premières et composants disponibles en stock ! L'ordre ${order.productionNumber} est passé au statut "À PRODUIRE".`);
        await loadData();
      } else {
        const missingSummary = check.missingItems.map(m => `${m.name} (besoin: ${m.needed} ${m.unit}, dispo: ${m.available} ${m.unit})`).join(' ; ');
        await db.productionOrders.update(order.id, {
          notes: `En attente de matières : ${missingSummary}`,
          updatedAt: new Date().toISOString()
        });
        alert(`Matières insuffisantes pour l'ordre ${order.productionNumber} :\n\n${check.missingItems.map(m => `• ${m.name} (Manquant: ${Math.max(0, m.needed - m.available)} ${m.unit})`).join('\n')}`);
        await loadData();
      }
    } catch (err: any) {
      alert(`Erreur vérification: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub Header Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('TO_PRODUCE')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'TO_PRODUCE' ? 'bg-orange-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>À Produire ({productionOrders.filter((p) => p.status === 'À PRODUIRE').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('AWAITING_MATERIALS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'AWAITING_MATERIALS' ? 'bg-rose-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>En attente de matières ({productionOrders.filter((p) => p.status === 'EN ATTENTE DE MATIÈRES').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'IN_PROGRESS' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>En Fabrication ({productionOrders.filter((p) => p.status === 'EN PRODUCTION').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COMPLETED' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Terminées ({productionOrders.filter((p) => p.status === 'TERMINÉE').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('BOM')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BOM' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Nomenclatures / BOM ({boms.length})</span>
          </button>
        </div>

        {activeTab === 'BOM' && (
          <button
            onClick={() => setShowBomModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Nomenclature</span>
          </button>
        )}
      </div>

      {/* TABS: PRODUCTION ORDERS LIST */}
      {activeTab !== 'BOM' && (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/30 text-center text-slate-500 text-xs">
              Aucun ordre de production dans cet état.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((order) => {
                const model = doorModels.find((m) => m.id === order.modelId);

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition space-y-4"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <span className="font-mono font-bold text-amber-400 text-xs">
                          {order.productionNumber}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Commande N° {order.orderNumberSnapshot}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.status === 'ANNULÉE'
                          ? 'bg-slate-800 text-rose-400 border border-rose-500/30 line-through'
                          : order.status === 'EN ATTENTE DE MATIÈRES'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : order.status === 'À PRODUIRE'
                          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          : order.status === 'EN PRODUCTION'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {order.status}
                      </span>
                    </div>

                    {/* BOM missing warning banner */}
                    {!order.bomSnapshot && !boms.some((b) => b.active && b.modelId === order.modelId) && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>Nomenclature manquante — veuillez configurer le BOM avant de lancer la fabrication.</span>
                      </div>
                    )}

                    {/* Awaiting materials alert box */}
                    {order.status === 'EN ATTENTE DE MATIÈRES' && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>Matières ou composants insuffisants</span>
                          </div>
                          <button
                            onClick={() => handleCheckMaterials(order)}
                            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-bold border border-rose-500/30 transition cursor-pointer"
                          >
                            Re-vérifier stock
                          </button>
                        </div>
                        {order.notes && (
                          <p className="text-[11px] text-rose-200/80 pl-6">{order.notes}</p>
                        )}
                      </div>
                    )}

                    {/* Door Specs */}
                    <div className="flex gap-4">
                      {/* CNC Miniature */}
                      <div className="h-24 w-16 shrink-0 rounded-lg bg-slate-950 border border-slate-800 p-1 flex items-center justify-center">
                        {model?.cncImage ? (
                          <img src={model.cncImage} alt={order.modelNameSnapshot} className="h-full w-full object-contain" />
                        ) : (
                          <Hammer className="w-5 h-5 text-slate-600" />
                        )}
                      </div>

                      <div className="space-y-1 text-xs">
                        <h4 className="font-bold text-white text-sm">
                          {order.modelRefSnapshot} — {order.modelNameSnapshot}
                        </h4>
                        <p className="text-slate-300">
                          Matière : <strong className="text-amber-400">{order.materialName}</strong> • Couleur : <strong className="text-slate-200">{order.colourNameSnapshot}</strong>
                        </p>
                        <p className="text-sm font-black text-amber-300">
                          Dimensions : {order.width} cm (L) x {order.height} cm (H)
                        </p>
                        <p className="text-slate-400">
                          Cadre associé : {order.frameNameSnapshot}
                        </p>
                        <p className="font-bold text-white pt-1">
                          Quantité à fabriquer : <span className="text-emerald-400">{order.quantity} unité(s)</span>
                        </p>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        onClick={() => generateProductionPdf(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-sky-400" />
                        <span>Fiche d'atelier PDF</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {order.status === 'À PRODUIRE' && (
                          <button
                            onClick={() => handleSetInProgress(order.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-semibold cursor-pointer"
                          >
                            Démarrer usinage
                          </button>
                        )}

                        {order.status !== 'TERMINÉE' && order.status !== 'ANNULÉE' && (
                          <button
                            onClick={() => handleValidateProduction(order)}
                            className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition cursor-pointer shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Valider & Finir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: NOMENCLATURES / BOM */}
      {activeTab === 'BOM' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Les nomenclatures (BOM) définissent la liste exacte des matières premières et accessoires de quincaillerie consommés lors de la fabrication d'une porte.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {boms.map((bom) => (
              <div key={bom.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-sm font-bold text-white">{bom.name}</h4>
                  <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-bold border border-sky-500/20">
                    {bom.materialName}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1">
                  <p>Consommation matière brute : <strong>{bom.rawMaterialUnitsNeeded} panneau(x)</strong></p>
                  {bom.notes && <p className="italic text-[11px] text-slate-500">{bom.notes}</p>}
                </div>

                <div className="pt-2 border-t border-slate-900">
                  <span className="text-[11px] font-bold text-slate-300 block mb-1">Composants requis par porte :</span>
                  <ul className="space-y-1 text-xs">
                    {bom.items.map((it, idx) => (
                      <li key={idx} className="flex items-center justify-between text-slate-400">
                        <span>• {it.componentName}</span>
                        <strong className="text-slate-200">{it.quantity} {it.unit}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL NOUVELLE BOM */}
      {showBomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Nouvelle Nomenclature (BOM)</h3>
              <button onClick={() => setShowBomModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBom} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nom de la nomenclature *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: BOM Standard Porte WPC avec Cadre F2"
                  value={bomName}
                  onChange={(e) => setBomName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Matière</label>
                  <select
                    value={bomMaterial}
                    onChange={(e) => setBomMaterial(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Modèle de porte (Optionnel)</label>
                  <select
                    value={bomModelId}
                    onChange={(e) => setBomModelId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Tous les modèles (Générique)</option>
                    {doorModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.ref} - {m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Composants quincaillerie à déduire</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                  {components.map((comp) => {
                    const existing = bomItems.find((b) => b.componentId === comp.id);
                    return (
                      <div key={comp.id} className="flex items-center justify-between text-xs py-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!existing}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBomItems([...bomItems, { componentId: comp.id, quantity: 1 }]);
                              } else {
                                setBomItems(bomItems.filter((b) => b.componentId !== comp.id));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-sky-500"
                          />
                          <span>{comp.name}</span>
                        </label>
                        {existing && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={existing.quantity}
                              onChange={(e) => {
                                const q = parseInt(e.target.value) || 1;
                                setBomItems(bomItems.map((b) => b.componentId === comp.id ? { ...b, quantity: q } : b));
                              }}
                              className="w-14 rounded border border-slate-700 bg-slate-900 p-1 text-center text-white"
                            />
                            <span className="text-[10px] text-slate-400">{comp.unit}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBomModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 cursor-pointer"
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
