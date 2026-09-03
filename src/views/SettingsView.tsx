import React, { useEffect, useState } from 'react';
import {
  Building,
  Hash,
  Lock,
  Database,
  Save,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { db, recordAudit, getCompanyInfo, getSettings } from '../db';
import type { CompanyInfo, AppSettings } from '../types';
import { hashPassword, verifyPassword } from '../services/securityService';
import { loadDemoData } from '../services/demoDataService';

export const SettingsView: React.FC = () => {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Security passwords
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMessage, setSecurityMessage] = useState({ text: '', isError: false });

  const loadData = async () => {
    const [c, s] = await Promise.all([getCompanyInfo(), getSettings()]);
    if (c) setCompany(c);
    if (s) setAppSettings(s);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCompanyInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    await db.company.put({
      ...company,
      updatedAt: new Date().toISOString()
    });

    if (appSettings) {
      await db.settings.put({
        ...appSettings,
        updatedAt: new Date().toISOString()
      });
    }

    await recordAudit('Paramètres société modifiés', 'settings', 'Mise à jour des coordonnées entreprise');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && company) {
      const reader = new FileReader();
      reader.onload = () => {
        setCompany({ ...company, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appSettings) return;

    if (newPassword.length < 4) {
      setSecurityMessage({ text: 'Le nouveau mot de passe doit comporter au moins 4 caractères', isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityMessage({ text: 'Les deux mots de passe ne correspondent pas', isError: true });
      return;
    }

    if (appSettings.passwordHash && appSettings.passwordSalt) {
      const isValid = await verifyPassword(currentPassword, appSettings.passwordHash, appSettings.passwordSalt);
      if (!isValid) {
        setSecurityMessage({ text: 'Mot de passe actuel incorrect', isError: true });
        return;
      }
    }

    const { hash, salt } = await hashPassword(newPassword);
    const updated: AppSettings = {
      ...appSettings,
      passwordHash: hash,
      passwordSalt: salt,
      updatedAt: new Date().toISOString()
    };
    await db.settings.put(updated);
    setAppSettings(updated);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSecurityMessage({ text: 'Mot de passe maître mis à jour avec succès !', isError: false });
    await recordAudit('Mot de passe modifié', 'settings', 'Changement du mot de passe maître');
  };

  const handleTogglePasswordProtection = async () => {
    if (!appSettings) return;
    const isProtected = Boolean(appSettings.passwordHash);

    if (isProtected) {
      const pwd = window.prompt('Entrez le mot de passe actuel pour désactiver la protection :');
      if (!pwd) return;
      if (appSettings.passwordHash && appSettings.passwordSalt) {
        const isValid = await verifyPassword(pwd, appSettings.passwordHash, appSettings.passwordSalt);
        if (!isValid) {
          alert('Mot de passe incorrect');
          return;
        }
      }
      const updated: AppSettings = {
        ...appSettings,
        passwordHash: undefined,
        passwordSalt: undefined,
        updatedAt: new Date().toISOString()
      };
      await db.settings.put(updated);
      setAppSettings(updated);
      alert('Protection par mot de passe désactivée.');
    } else {
      const pwd = window.prompt('Définissez un mot de passe de verrouillage (min 4 caractères) :');
      if (!pwd || pwd.length < 4) {
        alert('Mot de passe trop court');
        return;
      }
      const { hash, salt } = await hashPassword(pwd);
      const updated: AppSettings = {
        ...appSettings,
        passwordHash: hash,
        passwordSalt: salt,
        updatedAt: new Date().toISOString()
      };
      await db.settings.put(updated);
      setAppSettings(updated);
      alert('Protection par mot de passe activée !');
    }
  };

  const handleResetAndReloadDemo = async () => {
    if (!window.confirm('Voulez-vous charger les données de démonstration complètes OTM DOOR (Catalogue complet, Stock physique, Matières, Modèles CNC, Commandes) ?')) {
      return;
    }
    await loadDemoData();
    alert('Données de démonstration chargées avec succès !');
    window.location.reload();
  };

  if (!company || !appSettings) return null;

  const isPasswordProtected = Boolean(appSettings.passwordHash);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* SECTION 1: COORDONNÉES ENTREPRISE */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Identité de l'Entreprise OTM DOOR</h3>
          </div>
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
              <CheckCircle className="w-4 h-4" /> Enregistré
            </span>
          )}
        </div>

        <form onSubmit={handleSaveCompanyInfo} className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="h-24 w-24 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {company.logo ? (
                <img src={company.logo} alt="Logo" className="h-full w-full object-contain p-2" />
              ) : (
                <Building className="w-8 h-8 text-slate-600" />
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-slate-300 font-medium">Logo officiel pour les devis et factures</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Format PNG ou JPG. Conservé localement dans votre navigateur.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Raison Sociale</label>
              <input
                type="text"
                required
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-bold focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Téléphones de contact</label>
              <input
                type="text"
                value={company.phone1}
                onChange={(e) => setCompany({ ...company, phone1: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Wilaya</label>
              <input
                type="text"
                value={company.wilaya}
                onChange={(e) => setCompany({ ...company, wilaya: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1">Adresse complète / Atelier</label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Mentions légales (RC, NIF, NIS, etc.)</label>
            <input
              type="text"
              value={company.legalInfo || ''}
              onChange={(e) => setCompany({ ...company, legalInfo: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Pied de page des documents PDF (Mentions légales / Remerciements)</label>
            <input
              type="text"
              value={company.footerText || ''}
              onChange={(e) => setCompany({ ...company, footerText: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer transition shadow-md shadow-amber-500/10"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer les coordonnées</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: NUMÉROTATION DES DOCUMENTS */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Hash className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-bold text-white">Séquences & Préfixes des Documents</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Préfixe Commandes</label>
            <input
              type="text"
              value={appSettings.orderPrefix}
              onChange={(e) => setAppSettings({ ...appSettings, orderPrefix: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono font-bold"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Préfixe Ordres de Fabrication</label>
            <input
              type="text"
              value={appSettings.productionPrefix}
              onChange={(e) => setAppSettings({ ...appSettings, productionPrefix: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono font-bold"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Préfixe Reçus de Caisse</label>
            <input
              type="text"
              value={appSettings.receiptPrefix}
              onChange={(e) => setAppSettings({ ...appSettings, receiptPrefix: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono font-bold"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: SÉCURITÉ LOCALE & VERROUILLAGE */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Sécurité & Protection Locale de l'Atelier</h3>
          </div>
          <button
            onClick={handleTogglePasswordProtection}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              isPasswordProtected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
            }`}
          >
            {isPasswordProtected ? 'Protection ACTIVÉE' : 'Protection DÉSACTIVÉE'}
          </button>
        </div>

        {isPasswordProtected && (
          <form onSubmit={handleChangePassword} className="space-y-4 text-xs pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Confirmer nouveau</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                />
              </div>
            </div>

            {securityMessage.text && (
              <p className={`text-xs ${securityMessage.isError ? 'text-red-400' : 'text-emerald-400'}`}>
                {securityMessage.text}
              </p>
            )}

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-semibold cursor-pointer"
            >
              Changer le mot de passe
            </button>
          </form>
        )}
      </div>

      {/* SECTION 4: MAINTENANCE ET DONNÉES DE DÉMO */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">Maintenance de la Base de Données Locale</h3>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            <p className="font-semibold text-white">Recharger les Données Initiales de Démonstration</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Rétablit les modèles de portes standard, matières premières, couleurs, grilles tarifaires et clients exemples.
            </p>
          </div>

          <button
            onClick={handleResetAndReloadDemo}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400 hover:bg-slate-700 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Recharger Démo OTM DOOR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
