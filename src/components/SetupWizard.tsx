import React, { useState } from 'react';
import {
  Building2,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Square,
  Hash,
  CheckCircle2,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { initializeCleanSetup } from '../services/demoDataService';
import type { CompanyInfo, AppSettings } from '../types';

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form states
  const [companyName, setCompanyName] = useState('OTM DOOR');
  const [address, setAddress] = useState('Zone Industrielle Oued Smar, Lot N° 45');
  const [wilaya, setWilaya] = useState('Alger');
  const [commune, setCommune] = useState('Oued Smar');
  const [phone1, setPhone1] = useState('0550 12 34 56');
  const [phone2, setPhone2] = useState('0661 98 76 54');
  const [email, setEmail] = useState('contact@otmdoor.dz');
  const [legalInfo, setLegalInfo] = useState('RC: 16/00-1234567B22 — NIF: 002216012345678');
  const [logoUrl, setLogoUrl] = useState('/otm-door-logo.png');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [orderPrefix, setOrderPrefix] = useState('OTM-2026-');
  const [receiptPrefix, setReceiptPrefix] = useState('REC-2026-');
  const [prodPrefix, setProdPrefix] = useState('PROD-2026-');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (currentStep === 3) {
      if (password && password !== passwordConfirm) {
        setPasswordError('Les mots de passe ne correspondent pas.');
        return;
      }
      setPasswordError('');
    }
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinalize = async () => {
    // Validate password if provided
    if (password && password !== passwordConfirm) {
      setCurrentStep(3);
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      console.log('[OTM DOOR] Finalisation du setup...');

      // Mandatory fields have safe fallbacks; optional fields remain empty if not filled
      const companyData: Partial<CompanyInfo> = {
        name: companyName.trim() || 'OTM DOOR',
        address: address.trim() || 'Zone Industrielle Oued Smar, Lot N° 45',
        wilaya: wilaya.trim() || 'Alger',
        commune: commune.trim() || 'Oued Smar',
        phone1: phone1.trim() || '0550 12 34 56',
        phone2: phone2.trim(),
        email: email.trim(),
        legalInfo: legalInfo.trim(),
        logo: logoUrl || '/otm-door-logo.png'
      };

      const settingsData: Partial<AppSettings> = {
        orderPrefix: orderPrefix.trim() || 'OTM-2026-',
        receiptPrefix: receiptPrefix.trim() || 'REC-2026-',
        productionPrefix: prodPrefix.trim() || 'PROD-2026-'
      };

      await initializeCleanSetup(companyData, password, settingsData);
      console.log('[OTM DOOR] Setup sauvegardé');
      console.log('[OTM DOOR] setupCompleted = true');

      // Ensure current session is unlocked so admin enters directly without an immediate lock prompt
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('otm_unlocked', 'true');
      }

      onComplete();
    } catch (err: any) {
      console.error('[OTM DOOR] Échec de finalisation du setup:', err);
      alert(`Erreur lors de l'initialisation: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, title: 'Entreprise', icon: Building2 },
    { num: 2, title: 'Logo', icon: ImageIcon },
    { num: 3, title: 'Sécurité', icon: KeyRound },
    { num: 4, title: 'Matières', icon: Layers },
    { num: 5, title: 'Cadres', icon: Square },
    { num: 6, title: 'Numérotation', icon: Hash }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-slate-800 border border-amber-500/40 p-1.5 flex items-center justify-center overflow-hidden">
              <img src={logoUrl} alt="OTM DOOR" className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">OTM DOOR</h1>
              <p className="text-xs text-amber-400 font-medium">Assistant de premier lancement (Offline-First)</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
            Étape {currentStep} sur 6
          </span>
        </div>

        {/* Stepper Progress */}
        <div className="grid grid-cols-6 gap-2 my-6">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <div
                key={s.num}
                className={`flex flex-col items-center p-2 rounded-lg border text-center transition ${
                  isCurrent
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : isCompleted
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-800 bg-slate-950/40 text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span className="text-[10px] font-semibold truncate w-full">{s.title}</span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Entreprise */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" /> Étape 1 : Coordonnées de l'entreprise
            </h2>
            <p className="text-xs text-slate-400">
              Ces informations apparaîtront automatiquement sur tous vos bons de commande, reçus et documents officiels.
            </p>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="col-span-2">
                <label className="block text-slate-300 mb-1 font-medium">Raison sociale / Nom commercial *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-300 mb-1 font-medium">Adresse de l'usine / Atelier *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Wilaya *</label>
                <input
                  type="text"
                  value={wilaya}
                  onChange={(e) => setWilaya(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Commune *</label>
                <input
                  type="text"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Téléphone principal *</label>
                <input
                  type="text"
                  value={phone1}
                  onChange={(e) => setPhone1(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Téléphone secondaire</label>
                <input
                  type="text"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-300 mb-1 font-medium">Informations légales (RC, NIF, NIS...)</label>
                <input
                  type="text"
                  value={legalInfo}
                  onChange={(e) => setLegalInfo(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Logo */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" /> Étape 2 : Logo officiel OTM DOOR
            </h2>
            <p className="text-xs text-slate-400">
              Le logo est stocké localement et sera imprimé automatiquement en en-tête de chaque bon de commande et devis sans jamais vous le redemander.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-slate-800 bg-slate-950">
              <div className="h-32 w-32 rounded-xl bg-slate-900 border border-slate-700 p-2 flex items-center justify-center overflow-hidden shrink-0">
                <img src={logoUrl} alt="Logo Preview" className="h-full w-full object-contain" />
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  Logo officiel chargé par défaut. Vous pouvez également importer un nouveau fichier PNG ou JPG depuis votre ordinateur :
                </p>
                <input
                  id="logo-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Sécurité */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" /> Étape 3 : Sécurité locale du poste
            </h2>
            <p className="text-xs text-slate-400">
              Définissez un mot de passe local pour verrouiller l'application lorsque vous quittez votre ordinateur portable. Les données sont hachées avec PBKDF2 (SHA-256).
            </p>
            <div className="space-y-3 text-xs max-w-md">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Mot de passe de sécurité (Optionnel)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Laissez vide pour un accès direct sans mot de passe"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              {password && (
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Confirmer le mot de passe *</label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              )}
              {passwordError && (
                <p className="text-xs text-red-400">⚠️ {passwordError}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Matières */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" /> Étape 4 : Matières premières initiales
            </h2>
            <p className="text-xs text-slate-400">
              Les trois matières fondamentales de fabrication OTM DOOR sont préconfigurées :
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5">
                <span className="text-xs font-bold text-amber-300">WPC</span>
                <p className="text-[11px] text-slate-400 mt-1">Wood Plastic Composite imputrescible et hydrofuge</p>
              </div>
              <div className="p-3.5 rounded-xl border border-sky-500/40 bg-sky-500/5">
                <span className="text-xs font-bold text-sky-300">MDF</span>
                <p className="text-[11px] text-slate-400 mt-1">Fibre à moyenne densité pour gravure CNC de précision</p>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5">
                <span className="text-xs font-bold text-emerald-300">PVC</span>
                <p className="text-[11px] text-slate-400 mt-1">Alvéolaire léger, robuste et insonorisant</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              * Vous pourrez ajouter d'autres matières ou ajuster les seuils d'alerte à tout moment dans le catalogue.
            </p>
          </div>
        )}

        {/* Step 5: Cadres */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Square className="w-4 h-4 text-amber-400" /> Étape 5 : Les 3 modèles de cadres initiaux
            </h2>
            <p className="text-xs text-slate-400">
              Configuration des 3 cadres standards OTM DOOR :
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">Cadre F1 — 10 cm</span>
                  <p className="text-[11px] text-slate-400">Pour cloisons standard 10 cm</p>
                </div>
                <span className="text-amber-400 font-semibold">3 500 DA</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">Cadre F2 — 15 cm</span>
                  <p className="text-[11px] text-slate-400">Pour cloisons standard 15 cm</p>
                </div>
                <span className="text-amber-400 font-semibold">4 500 DA</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">Cadre F3 — 20 cm</span>
                  <p className="text-[11px] text-slate-400">Pour murs épais et enveloppants</p>
                </div>
                <span className="text-amber-400 font-semibold">5 500 DA</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Numérotation */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-400" /> Étape 6 : Préfixes et numérotation séquentielle
            </h2>
            <p className="text-xs text-slate-400">
              Personnalisez les préfixes des pièces comptables et ordres de fabrication :
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Préfixe Commandes</label>
                <input
                  type="text"
                  value={orderPrefix}
                  onChange={(e) => setOrderPrefix(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">Ex: {orderPrefix}0001</span>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Préfixe Reçus</label>
                <input
                  type="text"
                  value={receiptPrefix}
                  onChange={(e) => setReceiptPrefix(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">Ex: {receiptPrefix}0001</span>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Préfixe Production</label>
                <input
                  type="text"
                  value={prodPrefix}
                  onChange={(e) => setProdPrefix(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">Ex: {prodPrefix}0001</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Votre environnement local est prêt. Toutes les données resteront stockées en toute sécurité sur votre PC.</span>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Précédent
          </button>

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer shadow-lg shadow-amber-500/10"
            >
              Suivant <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={loading}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              {loading ? 'Configuration en cours...' : 'Terminer & Ouvrir le tableau de bord'} <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
