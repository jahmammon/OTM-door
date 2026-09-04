import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Briefcase,
  DollarSign,
  Calendar,
  CreditCard,
  Edit2,
  Trash2,
  X,
  Clock,
  TrendingDown,
  TrendingUp,
  Award
} from 'lucide-react';
import { db, recordAudit } from '../db';
import type { Worker, WorkerAdvance, WorkerBonus } from '../types';
import { formatCurrency, formatDateFr } from '../services/documentService';

export const WorkersView: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [advances, setWorkerAdvances] = useState<WorkerAdvance[]>([]);
  const [bonuses, setWorkerBonuses] = useState<WorkerBonus[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modals & Selection
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Partial<Worker> | null>(null);

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<{
    workerId: string;
    amount: number | '';
    date: string;
    note: string;
  }>({
    workerId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  const [showBonusModal, setShowBonusModal] = useState(false);
  const [editingBonus, setEditingBonus] = useState<{
    workerId: string;
    amount: number | '';
    date: string;
    motif: string;
  }>({
    workerId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    motif: ''
  });

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [dossierTab, setDossierTab] = useState<'ALL' | 'ADVANCES' | 'BONUSES'>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [allWorkers, allAdvances, allBonuses] = await Promise.all([
        db.workers.orderBy('name').toArray(),
        db.workerAdvances.toArray(),
        db.workerBonuses.toArray()
      ]);
      setWorkers(allWorkers);
      setWorkerAdvances(allAdvances);
      setWorkerBonuses(allBonuses);
    } catch (err) {
      console.error('Erreur chargement ouvriers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save worker
  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker?.name?.trim() || !editingWorker?.fonction?.trim()) return;

    const salary = Number(editingWorker.salary) || 0;
    const now = new Date().toISOString();
    const id = editingWorker.id || `wrk_${Date.now()}`;

    const workerToSave: Worker = {
      id,
      name: editingWorker.name.trim(),
      fonction: editingWorker.fonction.trim(),
      salary,
      active: editingWorker.active ?? true,
      createdAt: editingWorker.createdAt || now,
      updatedAt: now
    };

    await db.workers.put(workerToSave);
    await recordAudit(
      editingWorker.id ? 'Modification ouvrier' : 'Création ouvrier',
      'workers',
      `Ouvrier ${workerToSave.name} (${workerToSave.fonction}) - Salaire: ${workerToSave.salary} DA`,
      workerToSave.id
    );

    setShowWorkerModal(false);
    setEditingWorker(null);
    await loadData();
  };

  // Save advance
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(editingAdvance.amount);
    if (!editingAdvance.workerId || !amount || amount <= 0) return;

    const worker = workers.find((w) => w.id === editingAdvance.workerId);
    const now = new Date().toISOString();
    const newAdvance: WorkerAdvance = {
      id: `adv_${Date.now()}`,
      workerId: editingAdvance.workerId,
      date: editingAdvance.date || now.split('T')[0],
      amount,
      note: editingAdvance.note.trim() || undefined,
      createdAt: now
    };

    await db.workerAdvances.put(newAdvance);
    await recordAudit(
      'Avance sur salaire',
      'workerAdvances',
      `Avance de ${amount} DA versée à ${worker?.name || editingAdvance.workerId} (${editingAdvance.note || 'Sans motif'})`,
      newAdvance.id
    );

    setShowAdvanceModal(false);
    setEditingAdvance({
      workerId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });
    await loadData();
  };

  // Save bonus
  const handleSaveBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(editingBonus.amount);
    if (!editingBonus.workerId || !amount || amount <= 0) return;

    const worker = workers.find((w) => w.id === editingBonus.workerId);
    const now = new Date().toISOString();
    const newBonus: WorkerBonus = {
      id: `bon_${Date.now()}`,
      workerId: editingBonus.workerId,
      date: editingBonus.date || now.split('T')[0],
      amount,
      motif: editingBonus.motif.trim() || undefined,
      createdAt: now
    };

    await db.workerBonuses.put(newBonus);
    await recordAudit(
      'Prime ouvrier',
      'workerBonuses',
      `Prime/Bonus de ${amount} DA attribué à ${worker?.name || editingBonus.workerId} (${editingBonus.motif || 'Prime de rendement'})`,
      newBonus.id
    );

    setShowBonusModal(false);
    setEditingBonus({
      workerId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      motif: ''
    });
    await loadData();
  };

  // Delete advance
  const handleDeleteAdvance = async (advId: string) => {
    const adv = advances.find((a) => a.id === advId);
    if (!adv) return;
    if (!window.confirm(`Confirmer la suppression de cette avance de ${formatCurrency(adv.amount)} ?`)) return;

    await db.workerAdvances.delete(advId);
    await recordAudit(
      'Annulation avance',
      'workerAdvances',
      `Suppression avance de ${adv.amount} DA du ${adv.date}`,
      advId
    );
    await loadData();
  };

  // Delete bonus
  const handleDeleteBonus = async (bonId: string) => {
    const bon = bonuses.find((b) => b.id === bonId);
    if (!bon) return;
    if (!window.confirm(`Confirmer la suppression de cette prime de ${formatCurrency(bon.amount)} ?`)) return;

    await db.workerBonuses.delete(bonId);
    await recordAudit(
      'Annulation prime',
      'workerBonuses',
      `Suppression prime de ${bon.amount} DA du ${bon.date}`,
      bonId
    );
    await loadData();
  };

  // Delete worker
  const handleDeleteWorker = async (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return;
    if (!window.confirm(`Supprimer définitivement l'ouvrier ${worker.name} et l'ensemble de ses avances et primes associées ?`)) return;

    await db.transaction('rw', [db.workers, db.workerAdvances, db.workerBonuses], async () => {
      const advs = await db.workerAdvances.where('workerId').equals(workerId).toArray();
      await db.workerAdvances.bulkDelete(advs.map((a) => a.id));

      const bons = await db.workerBonuses.where('workerId').equals(workerId).toArray();
      await db.workerBonuses.bulkDelete(bons.map((b) => b.id));

      await db.workers.delete(workerId);
    });

    await recordAudit('Suppression ouvrier', 'workers', `Suppression ouvrier ${worker.name}`, workerId);
    if (selectedWorkerId === workerId) setSelectedWorkerId(null);
    await loadData();
  };

  // Metrics calculation based on selected month
  const activeWorkers = workers.filter((w) => w.active);
  const totalBaseSalary = activeWorkers.reduce((sum, w) => sum + (w.salary || 0), 0);

  // Advances in the selected month
  const advancesThisMonth = advances.filter((a) => a.date.startsWith(selectedMonth));
  const totalAdvancesThisMonth = advancesThisMonth.reduce((sum, a) => sum + (a.amount || 0), 0);

  // Bonuses in the selected month
  const bonusesThisMonth = bonuses.filter((b) => b.date.startsWith(selectedMonth));
  const totalBonusesThisMonth = bonusesThisMonth.reduce((sum, b) => sum + (b.amount || 0), 0);

  // Remaining net pay formula: Base Salary + Bonuses - Advances
  const remainingNetPayThisMonth = Math.max(0, totalBaseSalary + totalBonusesThisMonth - totalAdvancesThisMonth);

  // Compute for a specific worker
  const getWorkerMonthAdvances = (workerId: string) => {
    return advances
      .filter((a) => a.workerId === workerId && a.date.startsWith(selectedMonth))
      .reduce((sum, a) => sum + (a.amount || 0), 0);
  };

  const getWorkerMonthBonuses = (workerId: string) => {
    return bonuses
      .filter((b) => b.workerId === workerId && b.date.startsWith(selectedMonth))
      .reduce((sum, b) => sum + (b.amount || 0), 0);
  };

  // Filtered workers list
  const filteredWorkers = workers.filter((w) => {
    if (filterActiveOnly && !w.active) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.fonction.toLowerCase().includes(q)
    );
  });

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);
  const selectedWorkerAdvances = selectedWorker
    ? advances.filter((a) => a.workerId === selectedWorker.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const selectedWorkerBonuses = selectedWorker
    ? bonuses.filter((b) => b.workerId === selectedWorker.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <div className="space-y-6">
      {/* Top summary scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Ouvriers Actifs</span>
            <div className="text-xl font-black text-white">{activeWorkers.length} / {workers.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Masse Salariale Base</span>
            <div className="text-xl font-black text-white">{formatCurrency(totalBaseSalary)}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Primes ({selectedMonth})
            </span>
            <div className="text-xl font-black text-purple-400">+{formatCurrency(totalBonusesThisMonth)}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Avances ({selectedMonth})
            </span>
            <div className="text-xl font-black text-red-400">-{formatCurrency(totalAdvancesThisMonth)}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Reste Net à Payer</span>
            <div className="text-xl font-black text-emerald-400">{formatCurrency(remainingNetPayThisMonth)}</div>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher ouvrier, poste..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-56 md:w-64"
            />
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <label className="text-[11px] text-slate-400 font-medium">Mois :</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer"
            />
          </div>

          {/* Active toggle */}
          <button
            onClick={() => setFilterActiveOnly(!filterActiveOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              filterActiveOnly
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {filterActiveOnly ? 'Actifs uniquement' : 'Tous les statuts'}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            id="btn-add-bonus"
            onClick={() => {
              setEditingBonus({
                workerId: workers[0]?.id || '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                motif: ''
              });
              setShowBonusModal(true);
            }}
            disabled={workers.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 border border-purple-500/30 text-xs font-bold text-purple-300 hover:bg-purple-950/40 hover:text-white transition cursor-pointer disabled:opacity-40"
          >
            <Award className="w-4 h-4 text-purple-400" />
            <span>Ajouter une Prime</span>
          </button>

          <button
            id="btn-add-advance"
            onClick={() => {
              setEditingAdvance({
                workerId: workers[0]?.id || '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                note: ''
              });
              setShowAdvanceModal(true);
            }}
            disabled={workers.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer disabled:opacity-40"
          >
            <CreditCard className="w-4 h-4 text-amber-400" />
            <span>Verser une Avance</span>
          </button>

          <button
            id="btn-add-worker"
            onClick={() => {
              setEditingWorker({ active: true, salary: 50000 });
              setShowWorkerModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer shadow-md shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvel Ouvrier</span>
          </button>
        </div>
      </div>

      {/* Workers Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Chargement du personnel de production...</div>
      ) : filteredWorkers.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-800 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">Aucun ouvrier trouvé.</p>
          <button
            onClick={() => {
              setEditingWorker({ active: true, salary: 50000 });
              setShowWorkerModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition"
          >
            Créer le premier ouvrier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map((worker) => {
            const workerAdvancesThisMonth = getWorkerMonthAdvances(worker.id);
            const workerBonusesThisMonth = getWorkerMonthBonuses(worker.id);
            // Calcul officiel demandé : Salaire mensuel + Bonus - Avances = Reste à payer
            const remainingToPay = Math.max(0, worker.salary + workerBonusesThisMonth - workerAdvancesThisMonth);
            const totalWorkerAdvancesCount = advances.filter((a) => a.workerId === worker.id).length;
            const totalWorkerBonusesCount = bonuses.filter((b) => b.workerId === worker.id).length;

            return (
              <div
                key={worker.id}
                className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 bg-slate-900/60 ${
                  selectedWorkerId === worker.id
                    ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>{worker.name}</span>
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium mt-0.5">
                        <Briefcase className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>{worker.fonction}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        worker.active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {worker.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {/* Financial breakdown for selected month */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Salaire mensuel :</span>
                      <span className="font-semibold text-slate-200">{formatCurrency(worker.salary)}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1">
                        <span>Primes / Bonus ({selectedMonth}) :</span>
                      </span>
                      <span className={`font-bold ${workerBonusesThisMonth > 0 ? 'text-purple-400' : 'text-slate-500'}`}>
                        {workerBonusesThisMonth > 0 ? `+${formatCurrency(workerBonusesThisMonth)}` : '0 DA'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1">
                        <span>Avances ({selectedMonth}) :</span>
                      </span>
                      <span className={`font-bold ${workerAdvancesThisMonth > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {workerAdvancesThisMonth > 0 ? `-${formatCurrency(workerAdvancesThisMonth)}` : '0 DA'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300 font-bold">Reste à payer :</span>
                      <span className="text-sm font-black text-emerald-400">{formatCurrency(remainingToPay)}</span>
                    </div>
                  </div>
                </div>

                {/* Card actions */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => {
                      setEditingBonus({
                        workerId: worker.id,
                        amount: '',
                        date: new Date().toISOString().split('T')[0],
                        motif: ''
                      });
                      setShowBonusModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/20 text-xs font-bold transition cursor-pointer"
                    title="Attribuer une prime"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Prime</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingAdvance({
                        workerId: worker.id,
                        amount: '',
                        date: new Date().toISOString().split('T')[0],
                        note: ''
                      });
                      setShowAdvanceModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/20 text-xs font-bold transition cursor-pointer"
                    title="Verser une avance"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Avance</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedWorkerId(worker.id);
                      setDossierTab('ALL');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold transition cursor-pointer"
                    title="Voir l'historique complet"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dossier ({totalWorkerAdvancesCount + totalWorkerBonusesCount})</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingWorker(worker);
                      setShowWorkerModal(true);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                    title="Modifier l'ouvrier"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAILED WORKER DOSSIER MODAL */}
      {selectedWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedWorker.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedWorker.fonction} • Salaire mensuel : <strong className="text-amber-400">{formatCurrency(selectedWorker.salary)}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingBonus({
                      workerId: selectedWorker.id,
                      amount: '',
                      date: new Date().toISOString().split('T')[0],
                      motif: ''
                    });
                    setShowBonusModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500 text-xs font-bold text-white hover:bg-purple-400 transition cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Ajouter une prime</span>
                </button>

                <button
                  onClick={() => {
                    setEditingAdvance({
                      workerId: selectedWorker.id,
                      amount: '',
                      date: new Date().toISOString().split('T')[0],
                      note: ''
                    });
                    setShowAdvanceModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Ajouter une avance</span>
                </button>

                <button
                  onClick={() => {
                    setEditingWorker(selectedWorker);
                    setShowWorkerModal(true);
                  }}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDeleteWorker(selectedWorker.id)}
                  className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition cursor-pointer"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setSelectedWorkerId(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Current month stats for this worker: Salaire + Bonus - Avances = Reste à payer */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Salaire mensuel :</span>
                <p className="text-base font-bold text-slate-100">{formatCurrency(selectedWorker.salary)}</p>
              </div>
              <div>
                <span className="text-slate-400">Primes ({selectedMonth}) :</span>
                <p className="text-base font-bold text-purple-400">
                  +{formatCurrency(getWorkerMonthBonuses(selectedWorker.id))}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Avances ({selectedMonth}) :</span>
                <p className="text-base font-bold text-red-400">
                  -{formatCurrency(getWorkerMonthAdvances(selectedWorker.id))}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Reste à payer ({selectedMonth}) :</span>
                <p className="text-base font-bold text-emerald-400">
                  {formatCurrency(
                    Math.max(
                      0,
                      selectedWorker.salary +
                        getWorkerMonthBonuses(selectedWorker.id) -
                        getWorkerMonthAdvances(selectedWorker.id)
                    )
                  )}
                </p>
              </div>
            </div>

            {/* Dossier Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
              <button
                onClick={() => setDossierTab('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  dossierTab === 'ALL'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Tout l'historique ({selectedWorkerAdvances.length + selectedWorkerBonuses.length})
              </button>
              <button
                onClick={() => setDossierTab('BONUSES')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  dossierTab === 'BONUSES'
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Primes & Bonus ({selectedWorkerBonuses.length})
              </button>
              <button
                onClick={() => setDossierTab('ADVANCES')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  dossierTab === 'ADVANCES'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Avances ({selectedWorkerAdvances.length})
              </button>
            </div>

            {/* Combined or Tabbed List */}
            <div className="space-y-4">
              {/* SECTION: PRIMES & BONUS */}
              {(dossierTab === 'ALL' || dossierTab === 'BONUSES') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" />
                      <span>Historique des Primes & Bonus</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">{selectedWorkerBonuses.length} prime(s)</span>
                  </div>

                  {selectedWorkerBonuses.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                      Aucune prime enregistrée pour cet ouvrier.
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Montant</th>
                            <th className="py-2.5 px-3">Motif de la prime</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          {selectedWorkerBonuses.map((bon) => (
                            <tr key={bon.id} className="hover:bg-slate-800/40 transition">
                              <td className="py-2 px-3 font-medium text-slate-200">
                                {formatDateFr(bon.date)}
                              </td>
                              <td className="py-2 px-3 font-bold text-purple-400">
                                +{formatCurrency(bon.amount)}
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                {bon.motif || <span className="italic text-slate-500">Prime de rendement</span>}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() => handleDeleteBonus(bon.id)}
                                  className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                                  title="Supprimer cette prime"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: AVANCES */}
              {(dossierTab === 'ALL' || dossierTab === 'ADVANCES') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Historique des Avances & Retenues</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">{selectedWorkerAdvances.length} avance(s)</span>
                  </div>

                  {selectedWorkerAdvances.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                      Aucune avance enregistrée pour cet ouvrier.
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Montant</th>
                            <th className="py-2.5 px-3">Motif / Note</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          {selectedWorkerAdvances.map((adv) => (
                            <tr key={adv.id} className="hover:bg-slate-800/40 transition">
                              <td className="py-2 px-3 font-medium text-slate-200">
                                {formatDateFr(adv.date)}
                              </td>
                              <td className="py-2 px-3 font-bold text-red-400">
                                -{formatCurrency(adv.amount)}
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {adv.note || <span className="italic text-slate-600">Sans motif</span>}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() => handleDeleteAdvance(adv.id)}
                                  className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                                  title="Supprimer cette avance"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT WORKER MODAL */}
      {showWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingWorker?.id ? "Modifier l'Ouvrier" : 'Nouvel Ouvrier'}
              </h3>
              <button
                onClick={() => {
                  setShowWorkerModal(false);
                  setEditingWorker(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorker} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mourad Boualem"
                  value={editingWorker?.name || ''}
                  onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Poste / Fonction *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Opérateur CNC, Monteur Dormants, Finisseur..."
                  value={editingWorker?.fonction || ''}
                  onChange={(e) => setEditingWorker({ ...editingWorker, fonction: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Salaire mensuel de base (DA) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="500"
                  placeholder="Ex: 55000"
                  value={editingWorker?.salary ?? ''}
                  onChange={(e) => setEditingWorker({ ...editingWorker, salary: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="worker-active-toggle"
                  checked={editingWorker?.active ?? true}
                  onChange={(e) => setEditingWorker({ ...editingWorker, active: e.target.checked })}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="worker-active-toggle" className="text-slate-300 cursor-pointer">
                  Ouvrier en activité (Actif)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowWorkerModal(false);
                    setEditingWorker(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 transition"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ADVANCE MODAL */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Verser une Avance sur Salaire</span>
              </h3>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Ouvrier bénéficiaire *</label>
                <select
                  required
                  value={editingAdvance.workerId}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, workerId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="" disabled>Sélectionner un ouvrier</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} — {w.fonction} (Base: {formatCurrency(w.salary)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Montant de l'avance (DA) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="500"
                    placeholder="Ex: 10000"
                    value={editingAdvance.amount}
                    onChange={(e) => setEditingAdvance({ ...editingAdvance, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-bold text-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Date du versement *</label>
                  <input
                    type="date"
                    required
                    value={editingAdvance.date}
                    onChange={(e) => setEditingAdvance({ ...editingAdvance, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Motif / Note (Optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: Avance mi-mois, Urgence personnelle..."
                  value={editingAdvance.note}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 transition"
                >
                  Confirmer le versement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BONUS / PRIME MODAL */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-400" />
                <span>Attribuer une Prime ou Bonus</span>
              </h3>
              <button
                onClick={() => setShowBonusModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBonus} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Ouvrier bénéficiaire *</label>
                <select
                  required
                  value={editingBonus.workerId}
                  onChange={(e) => setEditingBonus({ ...editingBonus, workerId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="" disabled>Sélectionner un ouvrier</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} — {w.fonction} (Base: {formatCurrency(w.salary)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Montant de la prime (DA) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="500"
                    placeholder="Ex: 5000"
                    value={editingBonus.amount}
                    onChange={(e) => setEditingBonus({ ...editingBonus, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500 font-bold text-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Date d'attribution *</label>
                  <input
                    type="date"
                    required
                    value={editingBonus.date}
                    onChange={(e) => setEditingBonus({ ...editingBonus, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Motif de la prime</label>
                <input
                  type="text"
                  placeholder="Ex: Prime de rendement, Heures supplémentaires, Déplacement..."
                  value={editingBonus.motif}
                  onChange={(e) => setEditingBonus({ ...editingBonus, motif: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-500 font-bold text-white hover:bg-purple-400 transition"
                >
                  Confirmer la prime
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
