import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  RotateCw,
  Terminal,
  FileCheck2
} from 'lucide-react';
import { runAutomatedScenarioTests, type ScenarioTestResult } from '../tests/testScenarios';

export const TestsView: React.FC = () => {
  const [results, setResults] = useState<ScenarioTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioTestResult | null>(null);

  const handleRunAll = async () => {
    setIsRunning(true);
    try {
      const res = await runAutomatedScenarioTests();
      setResults(res);
      setSelectedScenario(res[0] || null);
    } catch (err) {
      console.error('Erreur tests:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSingle = async (scenarioId: string) => {
    setIsRunning(true);
    try {
      const all = await runAutomatedScenarioTests();
      const target = all.find((s) => s.id === scenarioId);
      if (target) {
        setResults((prev) => {
          const filtered = prev.filter((p) => p.id !== scenarioId);
          return [...filtered, target].sort((a, b) => a.id.localeCompare(b.id));
        });
        setSelectedScenario(target);
      }
    } catch (err) {
      console.error('Erreur scenario:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Banc d'Essai & Validation des Règles Métier</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exécute automatiquement les 6 scénarios critiques de gestion d'atelier (Scénarios A à F)
          </p>
        </div>

        <button
          onClick={handleRunAll}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer disabled:opacity-50 shadow-md shadow-amber-500/10"
        >
          {isRunning ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{isRunning ? 'Tests en cours...' : 'Lancer tous les tests métier'}</span>
        </button>
      </div>

      {/* Summary Scorecards if ran */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <span className="text-slate-400">Scénarios exécutés</span>
            <span className="text-lg font-black text-white">{results.length} / 6</span>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-between">
            <span className="text-emerald-300">Succès conformes</span>
            <span className="text-lg font-black text-emerald-400">{passedCount}</span>
          </div>
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 flex items-center justify-between">
            <span className="text-red-300">Échecs constatés</span>
            <span className="text-lg font-black text-red-400">{failedCount}</span>
          </div>
        </div>
      )}

      {/* Scenarios Grid / List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Scenarios list */}
        <div className="space-y-3 lg:col-span-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scénarios Spécifiés</h4>

          {[
            { id: 'SCENARIO_A', name: 'A. Stock Réservé & Disponible', desc: 'Vérifie que disponible = physique - réservé' },
            { id: 'SCENARIO_B', name: 'B. Déclenchement Fabrication', desc: 'Déclenche ordre atelier si stock insuffisant' },
            { id: 'SCENARIO_C', name: 'C. Règle Stricte des Tarifs', desc: 'Lookup direct sans calcul opaque de surface' },
            { id: 'SCENARIO_D', name: 'D. Consommation Nomenclatures', desc: 'Déduction matières/quincaillerie à la production' },
            { id: 'SCENARIO_E', name: 'E. Règlements & Reste à Payer', desc: 'Cohérence soldes et acomptes encaissés' },
            { id: 'SCENARIO_F', name: 'F. Sauvegarde & Chiffrement', desc: 'Cryptographie AES-GCM 256 bits et intégrité' }
          ].map((sc) => {
            const res = results.find((r) => r.id === sc.id);
            const isSelected = selectedScenario?.id === sc.id;

            return (
              <div
                key={sc.id}
                onClick={() => res && setSelectedScenario(res)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-amber-500 bg-slate-900 shadow-md'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-bold text-white">{sc.name}</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">{sc.desc}</p>
                  </div>

                  {res ? (
                    res.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunSingle(sc.id);
                      }}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                      title="Lancer"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {res && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{res.durationMs} ms</span>
                    <span className={res.passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {res.passed ? 'VALIDE' : 'ERREUR'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Step logs details */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>Console d'exécution & Journaux détaillés</span>
            </div>
            {selectedScenario && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedScenario.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {selectedScenario.name}
              </span>
            )}
          </div>

          {!selectedScenario ? (
            <div className="py-16 text-center text-xs text-slate-500">
              Cliquez sur "Lancer tous les tests métier" ou sélectionnez un scénario pour visualiser le détail des assertions.
            </div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              <div className="text-slate-300 font-sans text-xs">
                <span className="font-bold text-white">{selectedScenario.name}</span>
                <span className="text-slate-500 text-[11px] ml-2">({selectedScenario.durationMs} millisecondes)</span>
              </div>

              {selectedScenario.error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  <strong>Erreur : </strong> {selectedScenario.error}
                </div>
              )}

              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] text-slate-500 font-sans block mb-1">Étapes vérifiées :</span>
                {selectedScenario.details.map((st, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start gap-2"
                  >
                    <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                    <span className="text-slate-300 text-[11px] leading-relaxed">{st}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
