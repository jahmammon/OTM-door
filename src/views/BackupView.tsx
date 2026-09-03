import React, { useEffect, useState } from 'react';
import {
  Save,
  Download,
  Upload,
  ShieldCheck,
  History,
  FileCheck,
  AlertTriangle,
  Lock,
  Clock,
  CheckCircle,
  FileText
} from 'lucide-react';
import { db } from '../db';
import type { AuditLog } from '../types';
import { exportEncryptedBackup, restoreFromEncryptedBackup, getDatabaseStats } from '../services/backupService';
import { formatDateFr } from '../services/documentService';

export const BackupView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BACKUP' | 'AUDIT'>('BACKUP');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Backup form
  const [backupPassword, setBackupPassword] = useState('');
  const [backupSuccess, setBackupSuccess] = useState(false);

  // Restore form
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<{ msg: string; isError: boolean } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [auditLogs, dbStats] = await Promise.all([
        db.auditLogs.orderBy('createdAt').reverse().limit(100).toArray(),
        getDatabaseStats()
      ]);
      setLogs(auditLogs);
      setStats(dbStats);
    } catch (err) {
      console.error('Erreur chargement backup/audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupPassword || backupPassword.length < 4) {
      alert('Veuillez saisir une clé ou un mot de passe d’au moins 4 caractères pour chiffrer la sauvegarde.');
      return;
    }

    try {
      await exportEncryptedBackup(backupPassword);
      setBackupSuccess(true);
      setBackupPassword('');
      setTimeout(() => setBackupSuccess(false), 5000);
      await loadData();
    } catch (err: any) {
      alert(`Erreur lors de l’export : ${err.message}`);
    }
  };

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) {
      setRestoreStatus({ msg: 'Veuillez sélectionner un fichier .otmbackup', isError: true });
      return;
    }
    if (!restorePassword) {
      setRestoreStatus({ msg: 'Veuillez entrer le mot de passe de déchiffrement', isError: true });
      return;
    }

    if (!window.confirm('ATTENTION : La restauration remplacera l’ensemble des données actuelles de l’application par celles du fichier de sauvegarde. Voulez-vous continuer ?')) {
      return;
    }

    setIsRestoring(true);
    setRestoreStatus(null);

    try {
      await restoreFromEncryptedBackup(restoreFile, restorePassword);
      setRestoreStatus({ msg: 'Restauration réussie ! L’application va recharger les données.', isError: false });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setRestoreStatus({ msg: `Échec de la restauration : ${err.message}`, isError: true });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold w-fit">
        <button
          onClick={() => setActiveTab('BACKUP')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'BACKUP' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Sauvegarde & Restauration Locale</span>
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'AUDIT' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Journal d'Audit & Sécurité ({logs.length})</span>
        </button>
      </div>

      {activeTab === 'BACKUP' && (
        <div className="space-y-6">
          {/* Security Notice */}
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-bold text-white">Sécurité Chiffrée AES-GCM 256 bits</h4>
              <p className="text-emerald-200/80 mt-0.5">
                Les sauvegardes sont entièrement autonomes, hors ligne et chiffrées selon la norme militaire AES-GCM avec dérivation de clé PBKDF2 (100 000 itérations).
                Aucune donnée n'est envoyée vers un serveur externe.
              </p>
            </div>
          </div>

          {/* Database stats banner */}
          <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Volume des données stockées dans cette instance locale
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Commandes</span>
                <span className="font-bold text-amber-400 text-sm">{stats.orders || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Articles Stock</span>
                <span className="font-bold text-sky-400 text-sm">{stats.stockItems || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Mouvements</span>
                <span className="font-bold text-emerald-400 text-sm">{stats.stockMovements || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Fabrications</span>
                <span className="font-bold text-orange-400 text-sm">{stats.productionOrders || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Clients</span>
                <span className="font-bold text-white text-sm">{stats.clients || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Paiements</span>
                <span className="font-bold text-emerald-400 text-sm">{stats.payments || 0}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EXPORT FORM */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Download className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold text-white">Générer une Sauvegarde Complète</h4>
              </div>

              <p className="text-xs text-slate-400">
                Crée un fichier archive sécurisé <strong>.otmbackup</strong> téléchargeable sur votre ordinateur ou clé USB.
              </p>

              <form onSubmit={handleExportBackup} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Mot de passe ou Clé de chiffrement *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="Mot de passe secret pour ce fichier"
                      value={backupPassword}
                      onChange={(e) => setBackupPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Retenez bien ce mot de passe, il sera indispensable pour déchiffrer la sauvegarde.
                  </span>
                </div>

                {backupSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Sauvegarde générée et téléchargée avec succès !</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shadow-md shadow-amber-500/10"
                >
                  <Download className="w-4 h-4" />
                  <span>Exporter le fichier .otmbackup</span>
                </button>
              </form>
            </div>

            {/* RESTORE FORM */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Upload className="w-5 h-5 text-sky-400" />
                <h4 className="text-sm font-bold text-white">Restaurer depuis un Fichier</h4>
              </div>

              <p className="text-xs text-slate-400">
                Sélectionnez une sauvegarde précédente <strong>.otmbackup</strong> et saisissez son mot de passe de chiffrement.
              </p>

              <form onSubmit={handleRestoreBackup} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Sélectionner le fichier .otmbackup *</label>
                  <input
                    type="file"
                    accept=".otmbackup"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Mot de passe de déchiffrement *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="Mot de passe utilisé lors de l'export"
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {restoreStatus && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    restoreStatus.isError
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {restoreStatus.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                    <span>{restoreStatus.msg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isRestoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs hover:bg-slate-700 hover:text-white transition cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 text-sky-400" />
                  <span>{isRestoring ? 'Déchiffrement en cours...' : 'Déchiffrer et Restaurer la Base'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Horodatage</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Détails de l'opération</th>
                  <th className="py-3 px-4">Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                      Aucun événement d'audit enregistré.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 text-slate-400">
                        {formatDateFr(log.date)} {log.time}
                      </td>
                      <td className="py-2.5 px-4 text-amber-400 font-semibold font-sans">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {log.entity}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 font-sans">
                        {log.details}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-sans">
                        {log.user}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
