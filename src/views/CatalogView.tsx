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
  X,
  AlertTriangle,
  ZoomIn,
  Check,
  Filter,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';
import { db, recordAudit } from '../db';
import { ensureCatalogueSeeded } from '../services/demoDataService';
import type {
  DoorModel,
  Colour,
  Frame,
  Material,
  ComponentItem,
  StockItem
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
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterMaterial, setFilterMaterial] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals for CRUD
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<Partial<DoorModel> | null>(null);

  const [showColourModal, setShowColourModal] = useState(false);
  const [editingColour, setEditingColour] = useState<Partial<Colour> | null>(null);

  const [showFrameModal, setShowFrameModal] = useState(false);
  const [editingFrame, setEditingFrame] = useState<Partial<Frame> | null>(null);

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Partial<Material> | null>(null);

  const [showComponentModal, setShowComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Partial<ComponentItem> & { currentStock?: number } | null>(null);

  // CNC Zoom Modal
  const [zoomedCnc, setZoomedCnc] = useState<{ image: string; title: string; ref: string } | null>(null);

  // Delete & Relational Conflict Modal
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    entityType: 'MODEL' | 'COLOUR' | 'FRAME' | 'MATERIAL' | 'COMPONENT';
    id: string;
    title: string;
    isReferenced: boolean;
    reason: string;
  } | null>(null);

  const loadData = async () => {
    try {
      // 1. Ensure IndexedDB has initial catalogue records seeded
      await ensureCatalogueSeeded();

      // 2. Fetch all tables from IndexedDB
      const [allModels, allColours, allFrames, allMats, allComps, allStocks] = await Promise.all([
        db.doorModels.toArray(),
        db.colours.toArray(),
        db.frames.toArray(),
        db.materials.toArray(),
        db.components.toArray(),
        db.stockItems.toArray()
      ]);

      setDoorModels(allModels);
      setColours(allColours);
      setFrames(allFrames);
      setMaterials(allMats);
      setComponents(allComps);
      setStockItems(allStocks);
    } catch (err) {
      console.error('Erreur chargement catalogue:', err);
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

  // Reset search and filters when changing tab
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearch('');
    setFilterMaterial('ALL');
    setFilterCategory('ALL');
  };

  // ==========================================
  // MODEL CRUD HANDLERS
  // ==========================================
  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel?.ref || !editingModel?.name) return;

    const id = editingModel.id || `mod_${Date.now()}`;
    const standardWidth = Number(editingModel.standardWidth || 80);
    const standardHeight = Number(editingModel.standardHeight || 210);
    const defaultDimensions = editingModel.defaultDimensions || `${standardWidth} x ${standardHeight} cm`;

    const modelToSave: DoorModel = {
      id,
      ref: editingModel.ref.trim().toUpperCase(),
      name: editingModel.name.trim(),
      standardWidth,
      standardHeight,
      defaultDimensions,
      compatibleMaterials: editingModel.compatibleMaterials && editingModel.compatibleMaterials.length > 0
        ? editingModel.compatibleMaterials
        : ['WPC', 'MDF'],
      compatibleColours: editingModel.compatibleColours || colours.map(c => c.id),
      defaultFrameId: editingModel.defaultFrameId || frames[0]?.id || '',
      cncImage: editingModel.cncImage || '',
      description: editingModel.description?.trim() || '',
      active: editingModel.active !== false,
      createdAt: editingModel.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.doorModels.put(modelToSave);
    await recordAudit('Enregistrement modèle', 'doorModels', `Modèle ${modelToSave.ref} - ${modelToSave.name}`, modelToSave.id);
    setShowModelModal(false);
    setEditingModel(null);
    await loadData();
  };

  const initiateDeleteModel = async (model: DoorModel) => {
    // Relational check against orderItems and productionOrders
    const orderItemsCount = await db.orderItems.where('modelId').equals(model.id).count();
    const productionCount = await db.productionOrders.where('modelId').equals(model.id).count();

    if (orderItemsCount > 0 || productionCount > 0) {
      setDeleteConfirmation({
        entityType: 'MODEL',
        id: model.id,
        title: `${model.ref} — ${model.name}`,
        isReferenced: true,
        reason: `Ce modèle est utilisé dans ${orderItemsCount} ligne(s) de commande et ${productionCount} ordre(s) de fabrication. La suppression physique corromprait l'historique comptable. Vous pouvez le désactiver pour qu'il n'apparaisse plus lors des nouvelles commandes.`
      });
    } else {
      setDeleteConfirmation({
        entityType: 'MODEL',
        id: model.id,
        title: `${model.ref} — ${model.name}`,
        isReferenced: false,
        reason: 'Aucune commande ni fabrication ne référence ce modèle. Il peut être supprimé définitivement du catalogue.'
      });
    }
  };

  // ==========================================
  // COLOUR CRUD HANDLERS
  // ==========================================
  const handleSaveColour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingColour?.name) return;

    const id = editingColour.id || `col_${Date.now()}`;
    const colourToSave: Colour = {
      id,
      ref: editingColour.ref?.trim().toUpperCase() || `COL-${Date.now().toString().slice(-3)}`,
      name: editingColour.name.trim(),
      compatibleMaterials: editingColour.compatibleMaterials && editingColour.compatibleMaterials.length > 0
        ? editingColour.compatibleMaterials
        : ['WPC', 'MDF', 'PVC'],
      photo: editingColour.photo || '',
      description: editingColour.description?.trim() || '',
      active: editingColour.active !== false,
      createdAt: editingColour.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.colours.put(colourToSave);
    await recordAudit('Enregistrement couleur', 'colours', `Couleur ${colourToSave.ref} - ${colourToSave.name}`, colourToSave.id);
    setShowColourModal(false);
    setEditingColour(null);
    await loadData();
  };

  const initiateDeleteColour = async (colour: Colour) => {
    const orderItemsCount = await db.orderItems.where('colourId').equals(colour.id).count();
    if (orderItemsCount > 0) {
      setDeleteConfirmation({
        entityType: 'COLOUR',
        id: colour.id,
        title: `${colour.ref} — ${colour.name}`,
        isReferenced: true,
        reason: `Cette couleur est présente dans ${orderItemsCount} ligne(s) de commande. Vous devez la désactiver plutôt que de la supprimer afin de conserver les spécifications d'historique.`
      });
    } else {
      setDeleteConfirmation({
        entityType: 'COLOUR',
        id: colour.id,
        title: `${colour.ref} — ${colour.name}`,
        isReferenced: false,
        reason: 'Aucune commande ne fait référence à cette couleur. Elle sera supprimée définitivement de la base de données.'
      });
    }
  };

  // ==========================================
  // FRAME CRUD HANDLERS
  // ==========================================
  const handleSaveFrame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFrame?.ref || !editingFrame?.name) return;

    const id = editingFrame.id || `frm_${Date.now()}`;
    const frameToSave: Frame = {
      id,
      ref: editingFrame.ref.trim().toUpperCase(),
      name: editingFrame.name.trim(),
      width: editingFrame.width?.trim() || '10 cm',
      price: Math.max(0, Number(editingFrame.price || 0)),
      description: editingFrame.description?.trim() || '',
      active: editingFrame.active !== false,
      createdAt: editingFrame.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.frames.put(frameToSave);
    await recordAudit('Enregistrement cadre', 'frames', `Cadre ${frameToSave.ref} - ${frameToSave.name}`, frameToSave.id);
    setShowFrameModal(false);
    setEditingFrame(null);
    await loadData();
  };

  const initiateDeleteFrame = async (frame: Frame) => {
    const orderItemsCount = await db.orderItems.where('frameId').equals(frame.id).count();
    if (orderItemsCount > 0) {
      setDeleteConfirmation({
        entityType: 'FRAME',
        id: frame.id,
        title: `${frame.ref} — ${frame.name}`,
        isReferenced: true,
        reason: `Ce cadre est lié à ${orderItemsCount} ligne(s) de commande enregistrée(s). Il est recommandé de le désactiver pour bloquer les nouvelles commandes tout en gardant l'historique.`
      });
    } else {
      setDeleteConfirmation({
        entityType: 'FRAME',
        id: frame.id,
        title: `${frame.ref} — ${frame.name}`,
        isReferenced: false,
        reason: 'Aucune commande ne référence ce modèle de cadre. Il peut être supprimé en toute sécurité.'
      });
    }
  };

  // ==========================================
  // MATERIAL CRUD HANDLERS
  // ==========================================
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial?.ref || !editingMaterial?.name) return;

    const id = editingMaterial.id || `mat_${Date.now()}`;
    const materialToSave: Material = {
      id,
      ref: editingMaterial.ref.trim().toUpperCase(),
      name: editingMaterial.name.trim().toUpperCase(),
      unit: editingMaterial.unit?.trim() || 'panneau',
      description: editingMaterial.description?.trim() || '',
      minThreshold: Math.max(0, Number(editingMaterial.minThreshold || 10)),
      active: editingMaterial.active !== false,
      createdAt: editingMaterial.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Ensure raw material stock item exists or is created/updated
    const stkId = `stk_raw_${materialToSave.name.toLowerCase()}`;
    const existingStk = await db.stockItems.get(stkId);
    if (!existingStk) {
      await db.stockItems.put({
        id: stkId,
        itemType: 'RAW_MATERIAL',
        materialId: materialToSave.id,
        materialName: materialToSave.name,
        physicalQuantity: 50,
        reservedQuantity: 0,
        availableQuantity: 50,
        minAlertThreshold: materialToSave.minThreshold,
        unit: materialToSave.unit,
        location: 'Zone Brute Hangar 1',
        updatedAt: new Date().toISOString()
      });
    } else {
      await db.stockItems.update(stkId, {
        materialName: materialToSave.name,
        minAlertThreshold: materialToSave.minThreshold,
        unit: materialToSave.unit,
        updatedAt: new Date().toISOString()
      });
    }

    await db.materials.put(materialToSave);
    await recordAudit('Enregistrement matière', 'materials', `Matière ${materialToSave.ref} - ${materialToSave.name}`, materialToSave.id);
    setShowMaterialModal(false);
    setEditingMaterial(null);
    await loadData();
  };

  const initiateDeleteMaterial = async (material: Material) => {
    // Check if any door models rely on this material
    const usedInModels = doorModels.filter(m => m.compatibleMaterials.includes(material.name));
    if (usedInModels.length > 0) {
      setDeleteConfirmation({
        entityType: 'MATERIAL',
        id: material.id,
        title: `${material.ref} — ${material.name}`,
        isReferenced: true,
        reason: `Cette matière est configurée comme compatible avec ${usedInModels.length} modèle(s) de porte (${usedInModels.map(m => m.ref).slice(0, 3).join(', ')}...). Désactivez-la plutôt que de la supprimer.`
      });
    } else {
      setDeleteConfirmation({
        entityType: 'MATERIAL',
        id: material.id,
        title: `${material.ref} — ${material.name}`,
        isReferenced: false,
        reason: 'Cette matière n’est pas rattachée aux modèles actuels. Elle peut être supprimée.'
      });
    }
  };

  // ==========================================
  // COMPONENT CRUD HANDLERS
  // ==========================================
  const handleSaveComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComponent?.ref || !editingComponent?.name) return;

    const id = editingComponent.id || `cmp_${Date.now()}`;
    const minStock = Math.max(0, Number(editingComponent.minStock || 10));
    const price = Math.max(0, Number(editingComponent.price || 0));
    const physicalQty = Math.max(0, Number(editingComponent.currentStock !== undefined ? editingComponent.currentStock : (editingComponent.stock || 100)));

    const componentToSave: ComponentItem = {
      id,
      ref: editingComponent.ref.trim().toUpperCase(),
      name: editingComponent.name.trim(),
      category: editingComponent.category?.trim() || 'Accessoires',
      unit: editingComponent.unit?.trim() || 'pièce',
      stock: physicalQty,
      minStock,
      price,
      description: editingComponent.description?.trim() || '',
      active: editingComponent.active !== false,
      createdAt: editingComponent.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Keep authoritative single stock item synchronized
    const stkId = `stk_comp_${componentToSave.id}`;
    const existingStk = await db.stockItems.get(stkId);
    if (!existingStk) {
      await db.stockItems.put({
        id: stkId,
        itemType: 'COMPONENT',
        componentId: componentToSave.id,
        componentRef: componentToSave.ref,
        componentName: componentToSave.name,
        physicalQuantity: physicalQty,
        reservedQuantity: 0,
        availableQuantity: physicalQty,
        minAlertThreshold: minStock,
        unit: componentToSave.unit,
        location: 'Magasin Accessoires',
        updatedAt: new Date().toISOString()
      });
    } else {
      const reserved = existingStk.reservedQuantity || 0;
      const newAvailable = Math.max(0, physicalQty - reserved);
      await db.stockItems.update(stkId, {
        componentRef: componentToSave.ref,
        componentName: componentToSave.name,
        physicalQuantity: physicalQty,
        availableQuantity: newAvailable,
        minAlertThreshold: minStock,
        unit: componentToSave.unit,
        updatedAt: new Date().toISOString()
      });
    }

    await db.components.put(componentToSave);
    await recordAudit('Enregistrement composant', 'components', `Composant ${componentToSave.ref} - ${componentToSave.name}`, componentToSave.id);
    setShowComponentModal(false);
    setEditingComponent(null);
    await loadData();
  };

  const initiateDeleteComponent = async (comp: ComponentItem) => {
    // Check BOMs
    const allBoms = await db.bom.toArray();
    const usedInBoms = allBoms.filter(b => b.items.some(it => it.componentId === comp.id));

    if (usedInBoms.length > 0) {
      setDeleteConfirmation({
        entityType: 'COMPONENT',
        id: comp.id,
        title: `${comp.ref} — ${comp.name}`,
        isReferenced: true,
        reason: `Ce composant fait partie de ${usedInBoms.length} nomenclature(s) BOM active(s). Sa suppression briserait le calcul automatique de production. Désactivez-le à la place.`
      });
    } else {
      setDeleteConfirmation({
        entityType: 'COMPONENT',
        id: comp.id,
        title: `${comp.ref} — ${comp.name}`,
        isReferenced: false,
        reason: 'Ce composant n’est rattaché à aucune nomenclature BOM. Il peut être supprimé avec son enregistrement de stock.'
      });
    }
  };

  // ==========================================
  // CONFIRM DELETION OR DEACTIVATION
  // ==========================================
  const handleExecuteDelete = async (action: 'DELETE' | 'DEACTIVATE') => {
    if (!deleteConfirmation) return;
    const { entityType, id, title } = deleteConfirmation;

    if (action === 'DEACTIVATE') {
      if (entityType === 'MODEL') await db.doorModels.update(id, { active: false, updatedAt: new Date().toISOString() });
      if (entityType === 'COLOUR') await db.colours.update(id, { active: false, updatedAt: new Date().toISOString() });
      if (entityType === 'FRAME') await db.frames.update(id, { active: false, updatedAt: new Date().toISOString() });
      if (entityType === 'MATERIAL') await db.materials.update(id, { active: false, updatedAt: new Date().toISOString() });
      if (entityType === 'COMPONENT') await db.components.update(id, { active: false, updatedAt: new Date().toISOString() });

      await recordAudit('Désactivation catalogue', entityType.toLowerCase(), `Désactivation de ${title}`, id);
    } else {
      if (entityType === 'MODEL') await db.doorModels.delete(id);
      if (entityType === 'COLOUR') await db.colours.delete(id);
      if (entityType === 'FRAME') await db.frames.delete(id);
      if (entityType === 'MATERIAL') await db.materials.delete(id);
      if (entityType === 'COMPONENT') {
        await db.components.delete(id);
        await db.stockItems.delete(`stk_comp_${id}`);
      }

      await recordAudit('Suppression catalogue', entityType.toLowerCase(), `Suppression définitive de ${title}`, id);
    }

    setDeleteConfirmation(null);
    await loadData();
  };

  // ==========================================
  // FILTERED DATA SETS
  // ==========================================
  const s = search.toLowerCase().trim();

  const filteredDoorModels = doorModels.filter((m) => {
    const matchSearch =
      !s ||
      m.ref.toLowerCase().includes(s) ||
      m.name.toLowerCase().includes(s) ||
      (m.description && m.description.toLowerCase().includes(s));
    const matchMat = filterMaterial === 'ALL' || m.compatibleMaterials.includes(filterMaterial);
    return matchSearch && matchMat;
  });

  const filteredColours = colours.filter((c) => {
    const matchSearch =
      !s ||
      c.ref.toLowerCase().includes(s) ||
      c.name.toLowerCase().includes(s) ||
      (c.description && c.description.toLowerCase().includes(s));
    const matchMat = filterMaterial === 'ALL' || c.compatibleMaterials.includes(filterMaterial);
    return matchSearch && matchMat;
  });

  const filteredFrames = frames.filter((f) => {
    return (
      !s ||
      f.ref.toLowerCase().includes(s) ||
      f.name.toLowerCase().includes(s) ||
      f.width.toLowerCase().includes(s) ||
      (f.description && f.description.toLowerCase().includes(s))
    );
  });

  const filteredMaterials = materials.filter((m) => {
    return (
      !s ||
      m.ref.toLowerCase().includes(s) ||
      m.name.toLowerCase().includes(s) ||
      (m.description && m.description.toLowerCase().includes(s))
    );
  });

  const categories = Array.from(new Set(components.map((c) => c.category || 'Accessoires'))).filter(Boolean);

  const filteredComponents = components.filter((comp) => {
    const matchSearch =
      !s ||
      comp.ref.toLowerCase().includes(s) ||
      comp.name.toLowerCase().includes(s) ||
      comp.category.toLowerCase().includes(s) ||
      (comp.description && comp.description.toLowerCase().includes(s));
    const matchCat = filterCategory === 'ALL' || comp.category === filterCategory;
    return matchSearch && matchCat;
  });

  const cncModels = doorModels.filter((m) => m.cncImage && (!s || m.ref.toLowerCase().includes(s) || m.name.toLowerCase().includes(s)));

  return (
    <div className="space-y-5">
      {/* Header & Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-sky-400" />
            <span>Catalogue Produits OTM DOOR</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestion complète des modèles de portes, finitions, cadres, matières et quincaillerie en IndexedDB.
          </p>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-2">
          {activeTab === 'MODELES' && (
            <button
              onClick={() => {
                setEditingModel({
                  ref: `P-${String(doorModels.length + 1).padStart(3, '0')}`,
                  name: '',
                  standardWidth: 80,
                  standardHeight: 210,
                  defaultDimensions: '80 x 210 cm',
                  compatibleMaterials: ['WPC', 'MDF'],
                  compatibleColours: colours.map(c => c.id),
                  defaultFrameId: frames[0]?.id || '',
                  active: true
                });
                setShowModelModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition cursor-pointer shadow-sm shadow-sky-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau modèle</span>
            </button>
          )}

          {activeTab === 'COULEURS' && (
            <button
              onClick={() => {
                setEditingColour({
                  ref: `COL-${String(colours.length + 1).padStart(2, '0')}`,
                  name: '',
                  compatibleMaterials: ['WPC', 'MDF', 'PVC'],
                  active: true
                });
                setShowColourModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition cursor-pointer shadow-sm shadow-sky-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle couleur</span>
            </button>
          )}

          {activeTab === 'CADRES' && (
            <button
              onClick={() => {
                setEditingFrame({
                  ref: `F${frames.length + 1}`,
                  name: '',
                  width: '12 cm',
                  price: 4000,
                  active: true
                });
                setShowFrameModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition cursor-pointer shadow-sm shadow-sky-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau cadre</span>
            </button>
          )}

          {activeTab === 'MATIERES' && (
            <button
              onClick={() => {
                setEditingMaterial({
                  ref: `MAT-${Date.now().toString().slice(-4)}`,
                  name: '',
                  unit: 'panneau',
                  minThreshold: 10,
                  active: true
                });
                setShowMaterialModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition cursor-pointer shadow-sm shadow-sky-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle matière</span>
            </button>
          )}

          {activeTab === 'COMPOSANTS' && (
            <button
              onClick={() => {
                setEditingComponent({
                  ref: `CMP-${Date.now().toString().slice(-4)}`,
                  name: '',
                  category: 'Accessoires',
                  unit: 'pièce',
                  currentStock: 100,
                  minStock: 20,
                  price: 500,
                  active: true
                });
                setShowComponentModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition cursor-pointer shadow-sm shadow-sky-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau composant</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => handleTabChange('MODELES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MODELES' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Modèles ({doorModels.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('COULEURS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COULEURS' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Couleurs ({colours.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('CADRES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CADRES' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Cadres ({frames.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('MATIERES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MATIERES' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Matières ({materials.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('COMPOSANTS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COMPOSANTS' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Quincaillerie ({components.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('CNC')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CNC' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Galerie CNC ({cncModels.length})</span>
          </button>
        </div>

        {/* Search Input and Contextual Filter */}
        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
          <div className="relative flex-grow sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={`Rechercher ${activeTab.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Contextual filter for Models & Colours */}
          {(activeTab === 'MODELES' || activeTab === 'COULEURS') && (
            <select
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Toutes matières</option>
              {materials.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          )}

          {/* Contextual filter for Components */}
          {activeTab === 'COMPOSANTS' && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Toutes catégories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div className="p-8 text-center text-slate-400 text-xs">
          Chargement du catalogue IndexedDB...
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: MODÈLES DE PORTES */}
      {/* ========================================================= */}
      {activeTab === 'MODELES' && !loading && (
        <>
          {filteredDoorModels.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">Aucun modèle de porte trouvé</p>
              <p className="text-xs text-slate-500 mt-1">
                {search ? 'Modifiez vos critères de recherche.' : 'Ajoutez un nouveau modèle pour démarrer.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDoorModels.map((model) => {
                const defaultFrame = frames.find((f) => f.id === model.defaultFrameId);

                return (
                  <div
                    key={model.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700 transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Preview / CNC */}
                      <div className="h-48 w-full rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden p-2 relative group">
                        {model.cncImage ? (
                          <img src={model.cncImage} alt={model.name} className="h-full w-full object-contain" />
                        ) : (
                          <div className="text-center text-slate-600 space-y-1">
                            <ImageIcon className="w-8 h-8 mx-auto opacity-30" />
                            <span className="text-[10px] block">Aucun dessin CNC</span>
                          </div>
                        )}

                        <span className="absolute top-2.5 left-2.5 bg-slate-900/90 border border-slate-700 text-amber-400 font-mono font-black px-2 py-0.5 rounded text-xs">
                          {model.ref}
                        </span>

                        {model.cncImage && (
                          <button
                            type="button"
                            onClick={() => setZoomedCnc({ image: model.cncImage!, title: model.name, ref: model.ref })}
                            className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Agrandir tracé CNC"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Header Info */}
                      <div className="mt-3.5 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-white leading-tight">{model.name}</h3>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              model.active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}
                          >
                            {model.active ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {model.description || 'Modèle standard certifié OTM DOOR.'}
                        </p>
                      </div>

                      {/* Dimensions & Defaults */}
                      <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Dimensions standard</span>
                          <span className="font-semibold text-slate-200">
                            {model.standardWidth || 80} × {model.standardHeight || 210} cm
                          </span>
                        </div>
                        <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Cadre par défaut</span>
                          <span className="font-semibold text-amber-400 truncate block">
                            {defaultFrame ? `${defaultFrame.ref} (${defaultFrame.width})` : 'F1 (10 cm)'}
                          </span>
                        </div>
                      </div>

                      {/* Compatible Materials */}
                      <div className="mt-3">
                        <span className="text-[10px] font-semibold text-slate-400 block mb-1">Matières compatibles</span>
                        <div className="flex flex-wrap gap-1">
                          {model.compatibleMaterials.map((mat) => (
                            <span
                              key={mat}
                              className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-300"
                            >
                              {mat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions bar */}
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingModel(model);
                          setShowModelModal(true);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Modifier</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => initiateDeleteModel(model)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Supprimer ou désactiver"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 2: COULEURS ET FINITIONS */}
      {/* ========================================================= */}
      {activeTab === 'COULEURS' && !loading && (
        <>
          {filteredColours.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Palette className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">Aucune couleur trouvée</p>
              <p className="text-xs text-slate-500 mt-1">Créez une couleur pour alimenter le configurateur de commandes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredColours.map((colour) => (
                <div
                  key={colour.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="h-28 w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center relative">
                      {colour.photo ? (
                        <img src={colour.photo} alt={colour.name} className="h-full w-full object-cover" />
                      ) : (
                        <Palette className="w-8 h-8 text-slate-600" />
                      )}
                      <span className="absolute top-2 left-2 bg-slate-900/90 text-amber-400 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700">
                        {colour.ref}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-sm font-bold text-white">{colour.name}</h4>
                        <span
                          className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                            colour.active ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'
                          }`}
                        >
                          {colour.active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {colour.description || 'Finition standard OTM DOOR'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {colour.compatibleMaterials.map((m) => (
                        <span key={m} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-medium">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingColour(colour);
                        setShowColourModal(true);
                      }}
                      className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3 text-sky-400" />
                      <span>Modifier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => initiateDeleteColour(colour)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CADRES & CHAMBRANLES */}
      {/* ========================================================= */}
      {activeTab === 'CADRES' && !loading && (
        <>
          {filteredFrames.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Square className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">Aucun cadre trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredFrames.map((frame) => (
                <div
                  key={frame.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-xs font-mono">
                        {frame.ref}
                      </span>
                      <span className="text-base font-bold text-white">{formatCurrency(frame.price)}</span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white">{frame.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Largeur de mur : <strong className="text-slate-200">{frame.width}</strong>
                      </p>
                    </div>

                    <p className="text-xs text-slate-400">{frame.description || 'Cadre d’usine de haute précision'}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className={`text-[10px] font-bold ${frame.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {frame.active ? '• Actif au catalogue' : '• Désactivé'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFrame(frame);
                          setShowFrameModal(true);
                        }}
                        className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-sky-400" />
                        <span>Modifier</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => initiateDeleteFrame(frame)}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 4: MATIERES PREMIERES */}
      {/* ========================================================= */}
      {activeTab === 'MATIERES' && !loading && (
        <>
          {filteredMaterials.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">Aucune matière trouvée</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredMaterials.map((mat) => {
                const linkedStock = stockItems.find(
                  (s) => s.itemType === 'RAW_MATERIAL' && (s.materialName === mat.name || s.materialId === mat.id)
                );

                return (
                  <div
                    key={mat.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-amber-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {mat.ref}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            mat.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {mat.active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>

                      <h4 className="text-lg font-black text-white">{mat.name}</h4>
                      <p className="text-xs text-slate-400">{mat.description || 'Matière première brute'}</p>

                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Unité :</span>
                          <span className="font-semibold text-slate-200">{mat.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Seuil alerte :</span>
                          <span className="font-semibold text-amber-400">
                            {mat.minThreshold} {mat.unit}(s)
                          </span>
                        </div>
                        {linkedStock && (
                          <div className="flex justify-between pt-1 border-t border-slate-800/80">
                            <span className="text-slate-400">Stock disponible :</span>
                            <span
                              className={`font-bold ${
                                linkedStock.availableQuantity <= mat.minThreshold ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              {linkedStock.availableQuantity} {mat.unit}(s)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMaterial(mat);
                          setShowMaterialModal(true);
                        }}
                        className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-sky-400" />
                        <span>Modifier</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => initiateDeleteMaterial(mat)}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 5: COMPOSANTS & QUINCAILLERIE */}
      {/* ========================================================= */}
      {activeTab === 'COMPOSANTS' && !loading && (
        <>
          {filteredComponents.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Wrench className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">Aucun composant ou quincaillerie trouvé</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Réf.</th>
                    <th className="py-3 px-4">Désignation</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4 text-center">Stock disponible</th>
                    <th className="py-3 px-4 text-center">Seuil alerte</th>
                    <th className="py-3 px-4 text-right">Prix indicatif</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredComponents.map((comp) => {
                    const linkedStock = stockItems.find(
                      (s) => s.itemType === 'COMPONENT' && s.componentId === comp.id
                    );
                    const available = linkedStock !== undefined ? linkedStock.availableQuantity : (comp.stock || 0);
                    const physical = linkedStock !== undefined ? linkedStock.physicalQuantity : (comp.stock || 0);

                    return (
                      <tr key={comp.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">{comp.ref}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{comp.name}</span>
                          {comp.description && (
                            <span className="text-[11px] text-slate-400 truncate max-w-xs block">
                              {comp.description}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                            {comp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          <span className={available <= comp.minStock ? 'text-amber-400' : 'text-slate-100'}>
                            {available} {comp.unit}
                          </span>
                          {physical !== available && (
                            <span className="block text-[10px] text-slate-500 font-normal">
                              (physique : {physical})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400">
                          {comp.minStock} {comp.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-200">
                          {formatCurrency(comp.price || 0)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              comp.active ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'
                            }`}
                          >
                            {comp.active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingComponent({
                                  ...comp,
                                  currentStock: physical
                                });
                                setShowComponentModal(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                              title="Modifier le composant"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => initiateDeleteComponent(comp)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Supprimer le composant"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 6: GALERIE DESSINS CNC */}
      {/* ========================================================= */}
      {activeTab === 'CNC' && !loading && (
        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <p className="text-xs text-slate-300">
              Les tracés vectoriels CNC permettent au centre d’usinage numérique de valider les motifs de rainurage et fraisage pour chaque modèle OTM DOOR.
            </p>
            <span className="text-xs font-bold text-amber-400 shrink-0">
              {cncModels.length} tracé(s) actif(s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {cncModels.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-64 w-full rounded-xl bg-slate-950 border border-slate-800 p-2 flex items-center justify-center relative group">
                    <img src={m.cncImage} alt={m.name} className="h-full w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setZoomedCnc({ image: m.cncImage!, title: m.name, ref: m.ref })}
                      className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-xl"
                    >
                      <ZoomIn className="w-8 h-8 text-amber-400" />
                    </button>
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-amber-400">{m.ref}</span>
                    <h4 className="text-sm font-bold text-white">{m.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{m.description || 'Finition CNC certifiée'}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingModel(m);
                      setShowModelModal(true);
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Modifier le tracé CNC</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CRÉER / MODIFIER MODÈLE */}
      {/* ========================================================= */}
      {showModelModal && editingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>{editingModel.id ? `Modifier le modèle ${editingModel.ref}` : 'Nouveau modèle de porte'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModelModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Référence (Ex: P-001) *</label>
                  <input
                    type="text"
                    required
                    value={editingModel.ref || ''}
                    onChange={(e) => setEditingModel({ ...editingModel, ref: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white uppercase font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Nom commercial *</label>
                  <input
                    type="text"
                    required
                    value={editingModel.name || ''}
                    onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dimensions standard */}
              <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Largeur standard (cm)</label>
                  <input
                    type="number"
                    value={editingModel.standardWidth || 80}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      const h = editingModel.standardHeight || 210;
                      setEditingModel({
                        ...editingModel,
                        standardWidth: w,
                        defaultDimensions: `${w} x ${h} cm`
                      });
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Hauteur standard (cm)</label>
                  <input
                    type="number"
                    value={editingModel.standardHeight || 210}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      const w = editingModel.standardWidth || 80;
                      setEditingModel({
                        ...editingModel,
                        standardHeight: h,
                        defaultDimensions: `${w} x ${h} cm`
                      });
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Libellé dimensions</label>
                  <input
                    type="text"
                    value={editingModel.defaultDimensions || '80 x 210 cm'}
                    onChange={(e) => setEditingModel({ ...editingModel, defaultDimensions: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cadre par défaut */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Cadre recommandé par défaut</label>
                <select
                  value={editingModel.defaultFrameId || ''}
                  onChange={(e) => setEditingModel({ ...editingModel, defaultFrameId: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="">Sélectionner un cadre...</option>
                  {frames.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.ref} — {f.name} ({f.width}) - {formatCurrency(f.price)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Matières compatibles */}
              <div>
                <label className="block text-slate-300 mb-1.5 font-medium">Matières compatibles</label>
                <div className="flex flex-wrap items-center gap-3">
                  {materials.map((mat) => {
                    const current = editingModel.compatibleMaterials || [];
                    const isChecked = current.includes(mat.name);
                    return (
                      <label key={mat.id} className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingModel({ ...editingModel, compatibleMaterials: [...current, mat.name] });
                            } else {
                              setEditingModel({ ...editingModel, compatibleMaterials: current.filter((m) => m !== mat.name) });
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-sky-500"
                        />
                        <span className="text-white font-medium">{mat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description commerciale & technique</label>
                <textarea
                  rows={2}
                  value={editingModel.description || ''}
                  onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                  placeholder="Caractéristiques du modèle, usinage CNC, rainures..."
                />
              </div>

              {/* Tracé CNC */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Tracé / Fichier CNC (SVG ou Image)</label>
                <div className="flex items-center gap-3">
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
                  {editingModel.cncImage && (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-950 border border-slate-700 overflow-hidden p-0.5">
                      <img src={editingModel.cncImage} alt="Preview" className="h-full w-full object-contain" />
                    </div>
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="modelActive"
                  checked={editingModel.active !== false}
                  onChange={(e) => setEditingModel({ ...editingModel, active: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-sky-500"
                />
                <label htmlFor="modelActive" className="text-slate-300 font-medium cursor-pointer">
                  Actif et sélectionnable dans les devis et commandes
                </label>
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModelModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 cursor-pointer shadow"
                >
                  Enregistrer le modèle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CRÉER / MODIFIER COULEUR */}
      {/* ========================================================= */}
      {showColourModal && editingColour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-sky-400" />
                <span>{editingColour.id ? `Modifier la couleur ${editingColour.name}` : 'Nouvelle couleur'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowColourModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveColour} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Référence (Ex: COL-01) *</label>
                  <input
                    type="text"
                    required
                    value={editingColour.ref || ''}
                    onChange={(e) => setEditingColour({ ...editingColour, ref: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white uppercase font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Nom de la couleur *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Blanc Brillant"
                    value={editingColour.name || ''}
                    onChange={(e) => setEditingColour({ ...editingColour, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Matières compatibles */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Matières compatibles</label>
                <div className="flex flex-wrap gap-2">
                  {['WPC', 'MDF', 'PVC'].map((mat) => {
                    const current = editingColour.compatibleMaterials || [];
                    const isChecked = current.includes(mat);
                    return (
                      <label key={mat} className="flex items-center gap-1.5 cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingColour({ ...editingColour, compatibleMaterials: [...current, mat] });
                            } else {
                              setEditingColour({ ...editingColour, compatibleMaterials: current.filter((m) => m !== mat) });
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-sky-500"
                        />
                        <span className="text-white font-medium">{mat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description / Finition</label>
                <input
                  type="text"
                  placeholder="Ex: Laquage satiné anti-traces de doigts"
                  value={editingColour.description || ''}
                  onChange={(e) => setEditingColour({ ...editingColour, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Échantillon photo / Texture</label>
                <div className="flex items-center gap-3">
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
                  {editingColour.photo && (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-950 border border-slate-700 overflow-hidden">
                      <img src={editingColour.photo} alt="Texture" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="colourActive"
                  checked={editingColour.active !== false}
                  onChange={(e) => setEditingColour({ ...editingColour, active: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-sky-500"
                />
                <label htmlFor="colourActive" className="text-slate-300 font-medium cursor-pointer">
                  Actif au catalogue
                </label>
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

      {/* ========================================================= */}
      {/* MODAL 3: CRÉER / MODIFIER CADRE */}
      {/* ========================================================= */}
      {showFrameModal && editingFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Square className="w-4 h-4 text-sky-400" />
                <span>{editingFrame.id ? `Modifier le cadre ${editingFrame.ref}` : 'Nouveau cadre'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFrameModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
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
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white uppercase font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Largeur mur (Ex: 10 cm, 15 cm) *</label>
                  <input
                    type="text"
                    required
                    value={editingFrame.width || ''}
                    onChange={(e) => setEditingFrame({ ...editingFrame, width: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Désignation complète *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cadre Standard 10 cm"
                  value={editingFrame.name || ''}
                  onChange={(e) => setEditingFrame({ ...editingFrame, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Prix unitaire (DA)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={editingFrame.price || 0}
                  onChange={(e) => setEditingFrame({ ...editingFrame, price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  value={editingFrame.description || ''}
                  onChange={(e) => setEditingFrame({ ...editingFrame, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="frameActive"
                  checked={editingFrame.active !== false}
                  onChange={(e) => setEditingFrame({ ...editingFrame, active: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-sky-500"
                />
                <label htmlFor="frameActive" className="text-slate-300 font-medium cursor-pointer">
                  Actif au catalogue
                </label>
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

      {/* ========================================================= */}
      {/* MODAL 4: CRÉER / MODIFIER MATIÈRE */}
      {/* ========================================================= */}
      {showMaterialModal && editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-400" />
                <span>{editingMaterial.id ? `Modifier la matière ${editingMaterial.name}` : 'Nouvelle matière première'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Référence (Ex: MAT-WPC) *</label>
                  <input
                    type="text"
                    required
                    value={editingMaterial.ref || ''}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, ref: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white uppercase font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Nom de la matière *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: WPC, MDF, PVC, ALU..."
                    value={editingMaterial.name || ''}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white uppercase focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Unité de mesure *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: panneau, m², barre"
                    value={editingMaterial.unit || 'panneau'}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Seuil minimum d’alerte</label>
                  <input
                    type="number"
                    min="0"
                    value={editingMaterial.minThreshold || 10}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, minThreshold: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  value={editingMaterial.description || ''}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                  placeholder="Propriétés physiques, isolation, résistance à l'eau..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="matActive"
                  checked={editingMaterial.active !== false}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, active: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-sky-500"
                />
                <label htmlFor="matActive" className="text-slate-300 font-medium cursor-pointer">
                  Actif au catalogue
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
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

      {/* ========================================================= */}
      {/* MODAL 5: CRÉER / MODIFIER COMPOSANT QUINCAILLERIE */}
      {/* ========================================================= */}
      {showComponentModal && editingComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-sky-400" />
                <span>{editingComponent.id ? `Modifier ${editingComponent.name}` : 'Nouveau composant'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowComponentModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveComponent} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Référence (Ex: CMP-CH304) *</label>
                  <input
                    type="text"
                    required
                    value={editingComponent.ref || ''}
                    onChange={(e) => setEditingComponent({ ...editingComponent, ref: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white uppercase font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Catégorie *</label>
                  <input
                    type="text"
                    required
                    placeholder="Charnières, Serrure, Poignée..."
                    value={editingComponent.category || ''}
                    onChange={(e) => setEditingComponent({ ...editingComponent, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Désignation *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Charnière Inox 304 4 pouces"
                  value={editingComponent.name || ''}
                  onChange={(e) => setEditingComponent({ ...editingComponent, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Stock actuel</label>
                  <input
                    type="number"
                    min="0"
                    value={editingComponent.currentStock !== undefined ? editingComponent.currentStock : (editingComponent.stock || 0)}
                    onChange={(e) => setEditingComponent({ ...editingComponent, currentStock: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Seuil alerte</label>
                  <input
                    type="number"
                    min="0"
                    value={editingComponent.minStock || 10}
                    onChange={(e) => setEditingComponent({ ...editingComponent, minStock: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Unité</label>
                  <input
                    type="text"
                    value={editingComponent.unit || 'pièce'}
                    onChange={(e) => setEditingComponent({ ...editingComponent, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Prix d’achat / indicatif (DA)</label>
                <input
                  type="number"
                  min="0"
                  value={editingComponent.price || 0}
                  onChange={(e) => setEditingComponent({ ...editingComponent, price: Number(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  value={editingComponent.description || ''}
                  onChange={(e) => setEditingComponent({ ...editingComponent, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="compActive"
                  checked={editingComponent.active !== false}
                  onChange={(e) => setEditingComponent({ ...editingComponent, active: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-sky-500"
                />
                <label htmlFor="compActive" className="text-slate-300 font-medium cursor-pointer">
                  Actif au catalogue
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowComponentModal(false)}
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

      {/* ========================================================= */}
      {/* MODAL 6: ZOOM CNC HIGH RESOLUTION */}
      {/* ========================================================= */}
      {zoomedCnc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 flex flex-col items-center">
            <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400">{zoomedCnc.ref}</span>
                <h3 className="text-base font-bold text-white">{zoomedCnc.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setZoomedCnc(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="w-full max-h-[70vh] bg-slate-950 rounded-xl p-4 flex items-center justify-center overflow-auto border border-slate-800">
              <img src={zoomedCnc.image} alt={zoomedCnc.title} className="max-h-[60vh] object-contain" />
            </div>

            <div className="w-full mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setZoomedCnc(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white cursor-pointer font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: CONFIRMATION SUPPRESSION OU DÉSACTIVATION SÉCURISÉE */}
      {/* ========================================================= */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Vérification de suppression</h3>
            </div>

            <p className="text-xs text-slate-300 mb-3 font-semibold">
              Élément sélectionné : <span className="text-amber-400 font-bold">{deleteConfirmation.title}</span>
            </p>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed mb-5">
              {deleteConfirmation.reason}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Annuler
              </button>

              {deleteConfirmation.isReferenced ? (
                <button
                  type="button"
                  onClick={() => handleExecuteDelete('DEACTIVATE')}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-xs cursor-pointer shadow"
                >
                  Désactiver au catalogue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleExecuteDelete('DELETE')}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-500 text-xs cursor-pointer shadow"
                >
                  Supprimer définitivement
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
