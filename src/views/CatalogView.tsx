import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Palette,
  Square,
  Package,
  Wrench,
  Search,
  CheckCircle2,
  X
} from 'lucide-react';
import { db, recordAudit } from '../db';
import type {
  DoorModel,
  Colour,
  Frame,
  Material,
  ComponentItem
} from '../types';
import { formatCurrency } from '../services/documentService';

interface CatalogViewProps {
  subSection?: string;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ subSection = 'MODELES' }) => {
  const [activeTab, setActiveTab] = useState<string>(subSection);
  const [doorModels, setDoorModels] = useState<DoorModel[]>([]);
  const [colours, setColours] = useState<Colour[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [search, setSearch] = useState('');

  // Modals
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<Partial<DoorModel> | null>(null);

  const [showColourModal, setShowColourModal] = useState(false);
  const [editingColour, setEditingColour] = useState<Partial<Colour> | null>(null);

  const [showFrameModal, setShowFrameModal] = useState(false);
  const [editingFrame, setEditingFrame] = useState<Partial<Frame> | null>(null);

  const loadData = async () => {
    const [allModels, allColours, allFrames, allMats, allComps] = await Promise.all([
      db.doorModels.toArray(),
      db.colours.toArray(),
      db.frames.toArray(),
      db.materials.toArray(),
      db.components.toArray()
    ]);
    setDoorModels(allModels);
    setColours(allColours);
    setFrames(allFrames);
    setMaterials(allMats);
    setComponents(allComps);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (subSection) {
      setActiveTab(subSection);
    }
  }, [subSection]);

  // Model Handlers
  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel?.ref || !editingModel?.name) return;

    const id = editingModel.id || `mod_${Date.now()}`;
    const modelToSave: DoorModel = {
      id,
      ref: editingModel.ref.toUpperCase(),
      name: editingModel.name,
      compatibleMaterials: editingModel.compatibleMaterials || ['WPC', 'MDF'],
      cncImage: editingModel.cncImage || '',
      description: editingModel.description || '',
      active: editingModel.active !== false,
      createdAt: editingModel.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.doorModels.put(modelToSave);
    await recordAudit('Modèle porte enregistré', 'doorModels', `Modèle ${modelToSave.ref} - ${modelToSave.name}`, modelToSave.id);
    setShowModelModal(false);
    setEditingModel(null);
    await loadData();
  };

  // Colour Handlers
  const handleSaveColour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingColour?.name) return;

    const id = editingColour.id || `col_${Date.now()}`;
    const colourToSave: Colour = {
      id,
      ref: editingColour.ref || `COL-${Date.now().toString().slice(-3)}`,
      name: editingColour.name,
      compatibleMaterials: editingColour.compatibleMaterials || ['WPC', 'MDF', 'PVC'],
      photo: editingColour.photo || '',
      description: editingColour.description || '',
      active: editingColour.active !== false,
      createdAt: editingColour.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.colours.put(colourToSave);
    await recordAudit('Couleur enregistrée', 'colours', `Couleur ${colourToSave.name}`, colourToSave.id);
    setShowColourModal(false);
    setEditingColour(null);
    await loadData();
  };

  // Frame Handlers
  const handleSaveFrame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFrame?.ref || !editingFrame?.name) return;

    const id = editingFrame.id || `frm_${Date.now()}`;
    const frameToSave: Frame = {
      id,
      ref: editingFrame.ref.toUpperCase(),
      name: editingFrame.name,
      width: editingFrame.width || '10 cm',
      price: Number(editingFrame.price || 0),
      description: editingFrame.description || '',
      active: editingFrame.active !== false,
      createdAt: editingFrame.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.frames.put(frameToSave);
    await recordAudit('Cadre enregistré', 'frames', `Cadre ${frameToSave.ref} - ${frameToSave.name}`, frameToSave.id);
    setShowFrameModal(false);
    setEditingFrame(null);
    await loadData();
  };

  return (
    <div className="space-y-5">
      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('MODELES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MODELES' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Modèles de Portes ({doorModels.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('COULEURS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COULEURS' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Couleurs & Finitions ({colours.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('CADRES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CADRES' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Cadres ({frames.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('MATIERES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MATIERES' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Matières ({materials.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('COMPOSANTS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COMPOSANTS' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Quincaillerie ({components.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('CNC')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CNC' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Galerie Dessins CNC</span>
          </button>
        </div>

        {/* Create Button depending on tab */}
        {activeTab === 'MODELES' && (
          <button
            onClick={() => {
              setEditingModel({ ref: `P-${String(doorModels.length + 1).padStart(3, '0')}`, compatibleMaterials: ['WPC', 'MDF'], active: true });
              setShowModelModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition cursor-pointer shadow-sm shadow-sky-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau modèle</span>
          </button>
        )}
        {activeTab === 'COULEURS' && (
          <button
            onClick={() => {
              setEditingColour({ compatibleMaterials: ['WPC', 'MDF', 'PVC'], active: true });
              setShowColourModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition cursor-pointer shadow-sm shadow-sky-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle couleur</span>
          </button>
        )}
        {activeTab === 'CADRES' && (
          <button
            onClick={() => {
              setEditingFrame({ ref: `F${frames.length + 1}`, price: 4000, active: true });
              setShowFrameModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition cursor-pointer shadow-sm shadow-sky-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau cadre</span>
          </button>
        )}
      </div>

      {/* TAB 1: MODÈLES DE PORTES */}
      {activeTab === 'MODELES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {doorModels.map((model) => (
            <div
              key={model.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700 transition flex flex-col justify-between"
            >
              <div>
                <div className="h-44 w-full rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden p-2 relative group">
                  {model.cncImage ? (
                    <img src={model.cncImage} alt={model.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-center text-slate-500 space-y-1">
                      <ImageIcon className="w-8 h-8 mx-auto opacity-40" />
                      <span className="text-[10px] block">Aucun dessin CNC</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 bg-slate-900/90 border border-slate-700 text-amber-400 font-black px-2 py-0.5 rounded text-xs">
                    {model.ref}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-bold text-white">{model.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{model.description || 'Modèle standard OTM DOOR.'}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {model.compatibleMaterials.map((mat) => (
                    <span key={mat} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-300">
                      {mat}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className={`inline-flex items-center gap-1 text-[11px] ${model.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${model.active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  {model.active ? 'Actif au catalogue' : 'Désactivé'}
                </span>

                <button
                  onClick={() => {
                    setEditingModel(model);
                    setShowModelModal(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Modifier"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: COULEURS */}
      {activeTab === 'COULEURS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {colours.map((colour) => (
            <div key={colour.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="h-24 w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                {colour.photo ? (
                  <img src={colour.photo} alt={colour.name} className="h-full w-full object-cover" />
                ) : (
                  <Palette className="w-8 h-8 text-slate-600" />
                )}
              </div>
              <div>
                <span className="text-[10px] text-amber-400 font-mono">{colour.ref}</span>
                <h4 className="text-sm font-bold text-white">{colour.name}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{colour.description || 'Finition satinée'}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {colour.compatibleMaterials.map((m) => (
                  <span key={m} className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300 font-medium">
                    {m}
                  </span>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    setEditingColour(colour);
                    setShowColourModal(true);
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Modifier
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: CADRES */}
      {activeTab === 'CADRES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {frames.map((frame) => (
            <div key={frame.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-xs">
                  {frame.ref}
                </span>
                <span className="text-sm font-bold text-white">{formatCurrency(frame.price)}</span>
              </div>
              <h4 className="text-base font-bold text-white">{frame.name}</h4>
              <p className="text-xs text-slate-400">Largeur : <strong className="text-slate-200">{frame.width}</strong></p>
              <p className="text-xs text-slate-400">{frame.description}</p>
              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    setEditingFrame(frame);
                    setShowFrameModal(true);
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Modifier le cadre
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: MATIERES */}
      {activeTab === 'MATIERES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {materials.map((mat) => (
            <div key={mat.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">{mat.ref}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                  {mat.active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <h4 className="text-lg font-black text-white">{mat.name}</h4>
              <p className="text-xs text-slate-400">{mat.description}</p>
              <div className="pt-2 text-xs text-slate-300 space-y-1">
                <p>Unité de mesure : <strong>{mat.unit}</strong></p>
                <p>Seuil minimum d'alerte : <strong className="text-amber-400">{mat.minThreshold} {mat.unit}(s)</strong></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: COMPOSANTS & QUINCAILLERIE */}
      {activeTab === 'COMPOSANTS' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Réf.</th>
                <th className="py-3 px-4">Désignation</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4 text-center">Stock disponible</th>
                <th className="py-3 px-4 text-center">Seuil alerte</th>
                <th className="py-3 px-4 text-right">Prix indicatif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {components.map((comp) => (
                <tr key={comp.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-mono text-amber-400">{comp.ref}</td>
                  <td className="py-3 px-4 font-bold text-white">{comp.name}</td>
                  <td className="py-3 px-4 text-slate-400">{comp.category}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-200">
                    {comp.stock} {comp.unit}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-400">
                    {comp.minStock} {comp.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-200">
                    {formatCurrency(comp.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 6: DESSINS CNC */}
      {activeTab === 'CNC' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Les fichiers et tracés vectoriels CNC permettent à l'atelier de découpe et de rainurage numérique de vérifier le motif exact de gravure.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {doorModels.filter((m) => m.cncImage).map((m) => (
              <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="h-64 w-full rounded-xl bg-slate-950 border border-slate-800 p-2 flex items-center justify-center">
                  <img src={m.cncImage} alt={m.name} className="h-full w-full object-contain" />
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-400">{m.ref}</span>
                  <h4 className="text-sm font-bold text-white">{m.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL MODÈLE */}
      {showModelModal && editingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingModel.id ? 'Modifier le modèle' : 'Nouveau modèle de porte'}
              </h3>
              <button onClick={() => setShowModelModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Référence (Ex: P-012) *</label>
                  <input
                    type="text"
                    required
                    value={editingModel.ref || ''}
                    onChange={(e) => setEditingModel({ ...editingModel, ref: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white uppercase focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Nom commercial *</label>
                  <input
                    type="text"
                    required
                    value={editingModel.name || ''}
                    onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  value={editingModel.description || ''}
                  onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Matières compatibles</label>
                <div className="flex items-center gap-4 mt-1">
                  {['WPC', 'MDF', 'PVC'].map((mat) => {
                    const current = editingModel.compatibleMaterials || [];
                    const isChecked = current.includes(mat);
                    return (
                      <label key={mat} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingModel({ ...editingModel, compatibleMaterials: [...current, mat] });
                            } else {
                              setEditingModel({ ...editingModel, compatibleMaterials: current.filter((m) => m !== mat) });
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-950 text-amber-500"
                        />
                        <span className="text-white">{mat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Image / Tracé CNC (Fichier SVG ou Image)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = () => setEditingModel({ ...editingModel, cncImage: reader.result as string });
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModelModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 cursor-pointer"
                >
                  Enregistrer le modèle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL COULEUR */}
      {showColourModal && editingColour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Couleur & Finition</h3>
              <button onClick={() => setShowColourModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveColour} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nom de la couleur (Ex: Gris Anthracite RAL 7016) *</label>
                <input
                  type="text"
                  required
                  value={editingColour.name || ''}
                  onChange={(e) => setEditingColour({ ...editingColour, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Référence code couleur</label>
                <input
                  type="text"
                  value={editingColour.ref || ''}
                  onChange={(e) => setEditingColour({ ...editingColour, ref: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Échantillon photo / Texture</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = () => setEditingColour({ ...editingColour, photo: reader.result as string });
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowColourModal(false)}
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

      {/* MODAL CADRE */}
      {showFrameModal && editingFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Cadre / Chambranle</h3>
              <button onClick={() => setShowFrameModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFrame} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Référence (Ex: F1, F2...) *</label>
                  <input
                    type="text"
                    required
                    value={editingFrame.ref || ''}
                    onChange={(e) => setEditingFrame({ ...editingFrame, ref: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white uppercase focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Largeur mur (Ex: 15 cm) *</label>
                  <input
                    type="text"
                    required
                    value={editingFrame.width || ''}
                    onChange={(e) => setEditingFrame({ ...editingFrame, width: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={editingFrame.name || ''}
                  onChange={(e) => setEditingFrame({ ...editingFrame, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Prix unitaire (DA)</label>
                <input
                  type="number"
                  value={editingFrame.price || 0}
                  onChange={(e) => setEditingFrame({ ...editingFrame, price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFrameModal(false)}
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
