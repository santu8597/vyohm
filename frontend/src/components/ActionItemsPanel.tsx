"use client";

import React, { useState } from "react";
import { Calendar, Mail, Check, X, ShieldAlert, Clock, CheckCircle } from "lucide-react";
import { ActionItem, api } from "@/lib/api";

interface ActionItemsPanelProps {
  actionItems: ActionItem[];
  onActionUpdated: () => void;
}

export function ActionItemsPanel({
  actionItems,
  onActionUpdated,
}: ActionItemsPanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleDecision = async (id: string, decision: "confirmed" | "rejected") => {
    setProcessingId(id);
    try {
      await api.confirmAction(id, decision);
      onActionUpdated();
    } catch (e) {
      console.error("Failed to update action", e);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Action Items & Approvals
          </h3>
          <p className="text-xs text-slate-400">
            L5 Enforced: Zero accidental writes or sends without explicit user consent
          </p>
        </div>

        <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
          Email: Draft-only in DB (No send_email function)
        </div>
      </div>

      <div className="space-y-3">
        {actionItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No action items extracted from current recording.
          </div>
        ) : (
          actionItems.map((act) => {
            const isPending = act.status === "awaiting_confirmation";
            const isEmail = act.type === "draft_email";

            return (
              <div
                key={act.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        isEmail
                          ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                          : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                      }`}
                    >
                      {isEmail ? <Mail className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">{act.title}</h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isPending
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : act.status === "confirmed"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {act.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Details Preview */}
                      <p className="text-xs text-slate-300 mt-2 font-mono bg-slate-950/70 p-2.5 rounded-lg border border-slate-900 leading-relaxed">
                        {act.details.preview || JSON.stringify(act.details)}
                      </p>

                      {act.details.note && (
                        <p className="text-[11px] text-slate-400 mt-1.5 italic">
                          ℹ️ {act.details.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Confirmation Actions */}
                  {isPending ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={processingId === act.id}
                        onClick={() => handleDecision(act.id, "confirmed")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                        title="Approve write"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Confirm
                      </button>
                      <button
                        disabled={processingId === act.id}
                        onClick={() => handleDecision(act.id, "rejected")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 text-xs font-semibold border border-slate-700 transition disabled:opacity-50"
                        title="Reject proposal"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0 font-mono">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Action resolved</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
