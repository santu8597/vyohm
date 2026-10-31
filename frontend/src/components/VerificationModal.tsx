"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, Play, ShieldCheck, X, RefreshCw, Zap } from "lucide-react";
import { api, VerificationResult } from "@/lib/api";

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
  const [loadingPhase, setLoadingPhase] = useState<number | null>(null);
  const [results, setResults] = useState<{ [phase: number]: VerificationResult | null }>({
    1: null,
    2: null,
    3: null,
  });

  if (!isOpen) return null;

  const runPhaseTest = async (phase: 1 | 2 | 3) => {
    setLoadingPhase(phase);
    try {
      let res: VerificationResult;
      if (phase === 1) res = await api.runPhase1();
      else if (phase === 2) res = await api.runPhase2();
      else res = await api.runPhase3();

      setResults((prev) => ({ ...prev, [phase]: res }));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingPhase(null);
    }
  };

  const runAllTests = async () => {
    await runPhaseTest(1);
    await runPhaseTest(2);
    await runPhaseTest(3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 border border-slate-700 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Acceptance Criteria Test Suite</h3>
              <p className="text-xs text-slate-400">
                Automated Verification of Phase 1, Phase 2, and Phase 3 Invariants
              </p>
            </div>
          </div>

          <button
            onClick={runAllTests}
            disabled={loadingPhase !== null}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/25 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            Run All Tests
          </button>
        </div>

        <div className="space-y-4">
          {/* Phase 1 Card */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] font-mono text-indigo-400 font-semibold uppercase tracking-wider">
                  Phase 1
                </span>
                <h4 className="text-sm font-bold text-white">
                  Zero-Loss Alignment Layer & WhisperLiveKit Specification
                </h4>
              </div>

              <div className="flex items-center gap-2">
                {results[1] && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      results[1].status === "PASS"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {results[1].status}
                  </span>
                )}
                <button
                  onClick={() => runPhaseTest(1)}
                  disabled={loadingPhase === 1}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Run Phase 1 Tests"
                >
                  {loadingPhase === 1 ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              Validates word count equality, character-level identical text, speaker boundary overlap assignment, and isolated silence lines (speaker: -2).
            </p>

            {results[1] && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero-Loss Word Count: {results[1].loss_report?.raw_word_count} = {results[1].loss_report?.aligned_word_count} words</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Silent segments isolated on separate lines: {results[1].silence_segments_isolated ? "True" : "False"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Phase 2 Card */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] font-mono text-cyan-400 font-semibold uppercase tracking-wider">
                  Phase 2
                </span>
                <h4 className="text-sm font-bold text-white">
                  RAG Citations, Transcripts Search & Approval Safeguards
                </h4>
              </div>

              <div className="flex items-center gap-2">
                {results[2] && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      results[2].status === "PASS"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {results[2].status}
                  </span>
                )}
                <button
                  onClick={() => runPhaseTest(2)}
                  disabled={loadingPhase === 2}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Run Phase 2 Tests"
                >
                  {loadingPhase === 2 ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              Validates search indexing, mandatory citation formatting (recording_id and time_ms), and confirms email draft has no send capability.
            </p>

            {results[2] && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Strict Citations Enforced: {results[2].citations_verified ? "True" : "False"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Draft email only saved in DB (send disabled): {results[2].email_draft_only_no_send ? "True" : "False"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Phase 3 Card */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  Phase 3
                </span>
                <h4 className="text-sm font-bold text-white">
                  Idempotency, Offline Queue & Abstention Rate (L5/L6)
                </h4>
              </div>

              <div className="flex items-center gap-2">
                {results[3] && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      results[3].status === "PASS"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {results[3].status}
                  </span>
                )}
                <button
                  onClick={() => runPhaseTest(3)}
                  disabled={loadingPhase === 3}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Run Phase 3 Tests"
                >
                  {loadingPhase === 3 ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              Validates UNIQUE(device_id, recorded_at) returning HTTP 200 Duplicate vs 201 Created, and tests abstention rate on out-of-domain evaluation set (&gt;=80%).
            </p>

            {results[3] && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Idempotency Verified: {results[3].idempotency_verified ? "True" : "False"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Abstention Rate: {results[3].abstention_rate_pct}% (Target: &gt;= 80%)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
