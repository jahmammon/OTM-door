import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  Layers,
  ShoppingCart,
  Hammer,
  Users,
  UserCheck,
  Tag,
  CreditCard,
  BarChart3,
  Settings,
  HardDriveDownload,
  ChevronDown,
  ChevronRight,
  TestTube2,
  PlusCircle,
  Clock,
  CheckCircle,
  Archive,
  AlertTriangle,
  History,
  ClipboardList
} from 'lucide-react';
import type { CompanyInfo } from '../types';

export type MainNavSection = 
  | 'DASHBOARD'
  | 'STOCK'
  | 'CATALOGUE'
  | 'ORDERS'
  | 'PRODUCTION'
  | 'CLIENTS'
  | 'WORKERS'
  | 'PRICING'
  | 'PAYMENTS'
  | 'REPORTS'
  | 'SETTINGS'
  | 'BACKUP'
  | 'TESTS';

interface SidebarProps {
  currentSection: MainNavSection;
  subSection: string;
  onNavigate: (section: MainNavSection, subSection?: string) => void;
  company?: CompanyInfo;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  subSection,
  onNavigate,
  company
}) => {
  const [stockOpen, setStockOpen] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(true);
  const [prodOpen, setProdOpen] = useState(true);

  return (
    <aside className="w-64 shrink-0 bg-slate-950 border-r border-slate-800/80 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-900 border border-amber-500/30 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
          <img
            src={company?.logo || '/otm-door-logo.png'}
            alt="OTM DOOR Logo"
            className="h-full w-full object-contain"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-black text-white tracking-wide truncate">
            {company?.name || 'OTM DOOR'}
          </h1>
          <p className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase truncate">
            Fabrication & Stock
          </p>
        </div>
      </div>

      {/* Navigation Links Scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 text-xs text-slate-300 font-medium custom-scrollbar">
        {/* TABLEAU DE BORD */}
        <button
          id="nav-dashboard"
          onClick={() => onNavigate('DASHBOARD')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
            currentSection === 'DASHBOARD'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
              : 'hover:bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Tableau de bord</span>
        </button>

        {/* STOCK */}
        <div>
          <button
            id="nav-stock-toggle"
            onClick={() => {
              setStockOpen(!stockOpen);
              if (currentSection !== 'STOCK') onNavigate('STOCK', 'ACTUEL');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer ${
              currentSection === 'STOCK'
                ? 'bg-slate-900 text-amber-400 font-semibold border border-slate-800'
                : 'hover:bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Boxes className="w-4 h-4 text-amber-400" />
              <span>Stock</span>
            </span>
            {stockOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          {stockOpen && (
            <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
              <button
                id="nav-stock-actuel"
                onClick={() => onNavigate('STOCK', 'ACTUEL')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'STOCK' && subSection === 'ACTUEL'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Stock actuel (Matières, Finies)
              </button>
              <button
                id="nav-stock-mouvements"
                onClick={() => onNavigate('STOCK', 'MOUVEMENTS')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'STOCK' && subSection === 'MOUVEMENTS'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mouvements & Historique
              </button>
              <button
                id="nav-stock-inventaire"
                onClick={() => onNavigate('STOCK', 'INVENTAIRE')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'STOCK' && subSection === 'INVENTAIRE'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Inventaire physique
              </button>
              <button
                id="nav-stock-alertes"
                onClick={() => onNavigate('STOCK', 'ALERTES')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition flex items-center justify-between ${
                  currentSection === 'STOCK' && subSection === 'ALERTES'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Alertes de rupture</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              </button>
            </div>
          )}
        </div>

        {/* CATALOGUE */}
        <div>
          <button
            id="nav-catalog-toggle"
            onClick={() => {
              setCatalogOpen(!catalogOpen);
              if (currentSection !== 'CATALOGUE') onNavigate('CATALOGUE', 'MODELES');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer ${
              currentSection === 'CATALOGUE'
                ? 'bg-slate-900 text-amber-400 font-semibold border border-slate-800'
                : 'hover:bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Catalogue</span>
            </span>
            {catalogOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          {catalogOpen && (
            <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
              <button
                id="nav-cat-modeles"
                onClick={() => onNavigate('CATALOGUE', 'MODELES')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'CATALOGUE' && subSection === 'MODELES'
                    ? 'text-sky-400 font-semibold bg-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Modèles de portes
              </button>
              <button
                id="nav-cat-couleurs"
                onClick={() => onNavigate('CATALOGUE', 'COULEURS')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'CATALOGUE' && subSection === 'COULEURS'
                    ? 'text-sky-400 font-semibold bg-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Couleurs & Finitions
              </button>
              <button
                id="nav-cat-cadres"
                onClick={() => onNavigate('CATALOGUE', 'CADRES')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'CATALOGUE' && subSection === 'CADRES'
                    ? 'text-sky-400 font-semibold bg-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cadres (F1, F2, F3...)
              </button>
              <button
                id="nav-cat-matieres"
                onClick={() => onNavigate('CATALOGUE', 'MATIERES')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'CATALOGUE' && subSection === 'MATIERES'
                    ? 'text-sky-400 font-semibold bg-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Matières (WPC, MDF, PVC)
              </button>
              <button
                id="nav-cat-composants"
                onClick={() => onNavigate('CATALOGUE', 'COMPOSANTS')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'CATALOGUE' && subSection === 'COMPOSANTS'
                    ? 'text-sky-400 font-semibold bg-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Composants & Quincaillerie
              </button>
              <button
                id="nav-cat-cnc"
                onClick={() => onNavigate('CATALOGUE', 'CNC')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'CATALOGUE' && subSection === 'CNC'
                    ? 'text-sky-400 font-semibold bg-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Dessins & Images CNC
              </button>
            </div>
          )}
        </div>

        {/* COMMANDES */}
        <div>
          <button
            id="nav-orders-toggle"
            onClick={() => {
              setOrdersOpen(!ordersOpen);
              if (currentSection !== 'ORDERS') onNavigate('ORDERS', 'ALL');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer ${
              currentSection === 'ORDERS'
                ? 'bg-slate-900 text-amber-400 font-semibold border border-slate-800'
                : 'hover:bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <span>Commandes</span>
            </span>
            {ordersOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          {ordersOpen && (
            <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
              <button
                id="nav-orders-new"
                onClick={() => onNavigate('ORDERS', 'NEW')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition flex items-center gap-1.5 ${
                  currentSection === 'ORDERS' && subSection === 'NEW'
                    ? 'text-emerald-400 font-semibold bg-emerald-500/10'
                    : 'text-emerald-400/80 hover:text-emerald-300'
                }`}
              >
                <PlusCircle className="w-3 h-3" />
                <span>Nouvelle commande</span>
              </button>
              <button
                id="nav-orders-all"
                onClick={() => onNavigate('ORDERS', 'ALL')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'ORDERS' && subSection === 'ALL'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Toutes les commandes
              </button>
              <button
                id="nav-orders-prod"
                onClick={() => onNavigate('ORDERS', 'TO_PRODUCE')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'ORDERS' && subSection === 'TO_PRODUCE'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                À produire
              </button>
              <button
                id="nav-orders-ready"
                onClick={() => onNavigate('ORDERS', 'READY')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'ORDERS' && subSection === 'READY'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Prêtes
              </button>
              <button
                id="nav-orders-closed"
                onClick={() => onNavigate('ORDERS', 'CLOSED')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'ORDERS' && subSection === 'CLOSED'
                    ? 'text-amber-400 font-semibold bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Clôturées
              </button>
            </div>
          )}
        </div>

        {/* PRODUCTION */}
        <div>
          <button
            id="nav-prod-toggle"
            onClick={() => {
              setProdOpen(!prodOpen);
              if (currentSection !== 'PRODUCTION') onNavigate('PRODUCTION', 'TO_PRODUCE');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer ${
              currentSection === 'PRODUCTION'
                ? 'bg-slate-900 text-amber-400 font-semibold border border-slate-800'
                : 'hover:bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Hammer className="w-4 h-4 text-orange-400" />
              <span>Production</span>
            </span>
            {prodOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          {prodOpen && (
            <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
              <button
                id="nav-prod-toprod"
                onClick={() => onNavigate('PRODUCTION', 'TO_PRODUCE')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'PRODUCTION' && subSection === 'TO_PRODUCE'
                    ? 'text-orange-400 font-semibold bg-orange-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                À produire (Atelier)
              </button>
              <button
                id="nav-prod-inprogress"
                onClick={() => onNavigate('PRODUCTION', 'IN_PROGRESS')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'PRODUCTION' && subSection === 'IN_PROGRESS'
                    ? 'text-orange-400 font-semibold bg-orange-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                En cours de fabrication
              </button>
              <button
                id="nav-prod-completed"
                onClick={() => onNavigate('PRODUCTION', 'COMPLETED')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'PRODUCTION' && subSection === 'COMPLETED'
                    ? 'text-orange-400 font-semibold bg-orange-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fabrications terminées
              </button>
              <button
                id="nav-prod-bom"
                onClick={() => onNavigate('PRODUCTION', 'BOM')}
                className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] transition ${
                  currentSection === 'PRODUCTION' && subSection === 'BOM'
                    ? 'text-orange-400 font-semibold bg-orange-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Nomenclatures / BOM
              </button>
            </div>
          )}
        </div>

        {/* CLIENTS */}
        <button
          id="nav-clients"
          onClick={() => onNavigate('CLIENTS')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
            currentSection === 'CLIENTS'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
              : 'hover:bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clients</span>
        </button>

        {/* OUVRIERS */}
        <button
          id="nav-workers"
          onClick={() => onNavigate('WORKERS')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
            currentSection === 'WORKERS'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
              : 'hover:bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Ouvriers</span>
        </button>

        {/* TARIFICATION */}
        <button
          id="nav-pricing"
          onClick={() => onNavigate('PRICING')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
            currentSection === 'PRICING'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
              : 'hover:bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Tarification</span>
        </button>

        {/* PAIEMENTS */}
        <button
          id="nav-payments"
          onClick={() => onNavigate('PAYMENTS')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
            currentSection === 'PAYMENTS'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
              : 'hover:bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Paiements & Reçus</span>
        </button>

        {/* RAPPORTS */}
        <button
          id="nav-reports"
          onClick={() => onNavigate('REPORTS')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
            currentSection === 'REPORTS'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
              : 'hover:bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Rapports & Stats</span>
        </button>

        {/* PARAMÈTRES */}
        <button
          id="nav-settings"
          onClick={() => onNavigate('SETTINGS')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
            currentSection === 'SETTINGS'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
              : 'hover:bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Paramètres</span>
        </button>

        {/* SAUVEGARDE */}
        <button
          id="nav-backup"
          onClick={() => onNavigate('BACKUP')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
            currentSection === 'BACKUP'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
              : 'hover:bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <HardDriveDownload className="w-4 h-4" />
          <span>Sauvegarde & Restauration</span>
        </button>

        {/* TESTS AUTOMATIQUES */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            id="nav-tests"
            onClick={() => onNavigate('TESTS')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              currentSection === 'TESTS'
                ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                : 'hover:bg-indigo-950/40 text-indigo-300 hover:text-indigo-200 border border-indigo-500/20'
            }`}
          >
            <TestTube2 className="w-4 h-4 text-indigo-400" />
            <span>Tests automatiques</span>
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="font-semibold text-slate-400">OTM DOOR v1.0</span>
        <span className="text-emerald-400">Autonome</span>
      </div>
    </aside>
  );
};
