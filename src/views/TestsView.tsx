import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  RotateCw,
  Terminal,
  FileCheck2
} from 'lucide-react';
import {
  runAutomatedScenarioTests,
  runScenarioTest,
  getAllTestDefinitions,
  type ScenarioTestResult
} from '../tests/testScenarios';

export const TestsView: React.FC = () => {
  const [results, setResults] = useState<ScenarioTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioTestResult | null>(null);

  const testDefs = getAllTestDefinitions();

  const handleRunAll = async () => {
    setIsRunning(true);
    setRunningId('ALL');
    try {
      const res = await runAutomatedScenarioTests();
      setResults(res);
      setSelectedScenario(res[0] || null);
    } catch (err) {
      console.error('Erreur tests:', err);
    } finally {
      setIsRunning(false);
      setRunningId(null);
    }
  };

  const handleRunSingle = async (scenarioId: string) => {
    setIsRunning(true);
    setRunningId(scenarioId);
    try {
      const res = await runScenarioTest(scenarioId);
      setResults((prev) => {
        const filtered = prev.filter((p) => p.id !== scenarioId);
        return [...filtered, res].sort((a, b) => a.id.localeCompare(b.id));
      });
      setSelectedScenario(res);
    } catch (err) {
      console.error('Erreur scenario:', err);
    } finally {
      setIsRunning(false);
      setRunningId(null);
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
            <h3 className="text-base font-bold text-white">Banc d'Essai & Validation Automatisée</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Suite complète de tests d'intégrité métier, gestion de stock, BOM et conformité Dexie.js
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Environnement isolé (OtmDoorTestDB) — Données de production protégées
          </div>
        </div>

        <button
          onClick={handleRunAll}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer disabled:opacity-50 shadow-md shadow-amber-500/10"
        >
          {isRunning && runningId === 'ALL' ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{isRunning && runningId === 'ALL' ? 'Exécution des 7 tests...' : 'Lancer tous les tests'}</span>
        </button>
      </div>

      {/* Summary Scorecards if ran */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <span className="text-slate-400">Tests exécutés</span>
            <span className="text-lg font-black text-white">{results.length} / {testDefs.length}</span>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-between">
            <span className="text-emerald-300">Succès (PASS)</span>
            <span className="text-lg font-black text-emerald-400">{passedCount}</span>
          </div>
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 flex items-center justify-between">
            <span className="text-red-300">Échecs (FAIL)</span>
            <span className="text-lg font-black text-red-400">{failedCount}</span>
          </div>
        </div>
      )}

      {/* Scenarios Grid / List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Scenarios list */}
        <div className="space-y-3 lg:col-span-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tests Disponibles</h4>

          {testDefs.map((sc) => {
            const res = results.find((r) => r.id === sc.id);
            const isSelected = selectedScenario?.id === sc.id;
            const isCurrentRunning = isRunning && runningId === sc.id;

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
                  <div className="flex-1">
                    <h5 className="text-xs font-bold text-white leading-snug">{sc.name}</h5>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{sc.description}</p>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {res ? (
                      res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunSingle(sc.id);
                        }}
                        disabled={isRunning}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] cursor-pointer disabled:opacity-50"
                        title="Exécuter ce test"
                      >
                        {isCurrentRunning ? <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {res && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{res.durationMs} ms</span>
                    <span className={res.passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {res.passed ? 'PASS' : 'FAIL'}
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
              <span>Détails & Assertions d'Exécution</span>
            </div>
            {selectedScenario && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedScenario.passed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {selectedScenario.passed ? 'PASS' : 'FAIL'}
              </span>
            )}
          </div>

          {!selectedScenario ? (
            <div className="py-20 text-center text-xs text-slate-500">
              Cliquez sur "Lancer tous les tests" ou sur l'icône de lecture d'un test pour vérifier les règles métier en temps réel.
            </div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              <div className="text-slate-300 font-sans text-xs flex items-center justify-between">
                <span className="font-bold text-white">{selectedScenario.name}</span>
                <span className="text-slate-500 text-[11px]">Durée: {selectedScenario.durationMs} ms</span>
              </div>

              {selectedScenario.error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  <strong>Erreur constatée : </strong> {selectedScenario.error}
                </div>
              )}

              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] text-slate-500 font-sans block mb-1">Journal des vérifications :</span>
                {selectedScenario.details.map((st, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start gap-2"
                  >
                    <span className={st.startsWith('ÉCHEC') ? 'text-red-400 shrink-0 mt-0.5' : 'text-emerald-400 shrink-0 mt-0.5'}>
                      {st.startsWith('ÉCHEC') ? '✗' : '✓'}
                    </span>
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
