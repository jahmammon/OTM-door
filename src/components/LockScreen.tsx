import React, { useState } from 'react';
import { Lock, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { verifyPassword } from '../services/securityService';
import type { AppSettings, CompanyInfo } from '../types';

interface LockScreenProps {
  settings?: AppSettings;
  company?: CompanyInfo;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ settings, company, onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Veuillez saisir votre mot de passe.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!settings?.passwordHash || !settings?.passwordSalt) {
        // No password configured
        onUnlock();
        return;
      }

      const isValid = await verifyPassword(password, settings.passwordHash, settings.passwordSalt);
      if (isValid) {
        onUnlock();
      } else {
        setError('Mot de passe incorrect. Veuillez réessayer.');
      }
    } catch {
      setError('Erreur lors de la vérification de sécurité.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 selection:bg-amber-500 selection:text-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 border border-amber-500/30 shadow-inner overflow-hidden p-2">
            <img
              src={company?.logo || '/otm-door-logo.png'}
              alt="OTM DOOR Logo"
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center -z-10 text-amber-500">
              <Lock className="w-8 h-8" />
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            {company?.name || 'OTM DOOR'}
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-amber-400">
            Poste Sécurisé & Autonome
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Session locale verrouillée. Saisissez votre mot de passe pour accéder à la gestion commerciale et usine.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="mt-6 space-y-4">
          <div>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                id="lock-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe d'accès..."
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                <span>⚠️</span> {error}
              </p>
            )}
          </div>

          <button
            id="btn-unlock-app"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Vérification...</span>
            ) : (
              <>
                <span>Déverrouiller l'application</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Sécurité locale PBKDF2
          </span>
          <span>100% Hors Ligne</span>
        </div>
      </div>
    </div>
  );
};
