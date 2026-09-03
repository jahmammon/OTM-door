import React from 'react';
import { Lock, Plus, Bell, RefreshCw } from 'lucide-react';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallButton } from './PWAInstallButton';
import type { MainNavSection } from './Sidebar';

interface HeaderProps {
  currentSection: MainNavSection;
  subSection?: string;
  onNewOrder: () => void;
  onLock: () => void;
  onRefresh?: () => void;
  hasPassword?: boolean;
}

const SECTION_TITLES: Record<MainNavSection, { title: string; subtitle: string }> = {
  DASHBOARD: {
    title: 'Tableau de bord',
    subtitle: 'Vue synthétique globale de la production, des commandes et des stocks OTM DOOR'
  },
  STOCK: {
    title: 'Gestion des Stocks',
    subtitle: 'Suivi rigoureux des quantités physiques, réservées et disponibles (Panneaux, Portes finies, Accessoires)'
  },
  CATALOGUE: {
    title: 'Catalogue Usine',
    subtitle: 'Modèles de portes CNC, couleurs, cadres (F1, F2, F3), matières et quincaillerie'
  },
  ORDERS: {
    title: 'Gestion des Commandes',
    subtitle: 'Commandes multi-lignes, contrôle de réservation automatique et suivi du cycle de vie'
  },
  PRODUCTION: {
    title: 'Atelier de Production',
    subtitle: 'Ordres de fabrication, contrôle de coupe, usinage CNC et consommation des nomenclatures (BOM)'
  },
  CLIENTS: {
    title: 'Répertoire Clients',
    subtitle: 'Gestion des fiches clients, coordonnées wilaya, commandes passées et solde financier'
  },
  PRICING: {
    title: 'Matrice de Tarification',
    subtitle: 'Gestion manuelle des prix exacts par modèle, matière et dimensions sans formules opaques'
  },
  PAYMENTS: {
    title: 'Paiements & Encaissements',
    subtitle: 'Enregistrement des versements, génération des reçus certifiés et contrôle des impayés'
  },
  REPORTS: {
    title: 'Rapports & Statistiques',
    subtitle: 'Analyses des volumes produits, modèles les plus vendus et valorisation du stock'
  },
  SETTINGS: {
    title: 'Paramètres du Système',
    subtitle: 'Coordonnées de l’entreprise, logo, sécurité du poste, numérotation et seuils d’alerte'
  },
  BACKUP: {
    title: 'Sauvegarde & Restauration',
    subtitle: 'Protection complète des données avec chiffrement AES-GCM et format .otmbackup'
  },
  TESTS: {
    title: 'Banc d’Essai & Tests Automatiques',
    subtitle: 'Validation formelle des scénarios métier A, B, C, D, E et F du cahier des charges'
  }
};

export const Header: React.FC<HeaderProps> = ({
  currentSection,
  onNewOrder,
  onLock,
  onRefresh,
  hasPassword
}) => {
  const current = SECTION_TITLES[currentSection] || {
    title: 'OTM DOOR',
    subtitle: 'Système local de gestion'
  };

  return (
    <header className="h-16 shrink-0 bg-slate-900/60 border-b border-slate-800/80 px-6 flex items-center justify-between backdrop-blur-md">
      <div>
        <h2 className="text-base font-bold text-white tracking-tight">{current.title}</h2>
        <p className="text-[11px] text-slate-400 hidden md:block">{current.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <OfflineIndicator />
        <PWAInstallButton />

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Actualiser les données"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        <button
          id="btn-quick-new-order"
          onClick={onNewOrder}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer shadow-sm shadow-amber-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nouvelle Commande</span>
        </button>

        {hasPassword && (
          <button
            id="btn-lock-session"
            onClick={onLock}
            className="p-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition cursor-pointer"
            title="Verrouiller la session"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
