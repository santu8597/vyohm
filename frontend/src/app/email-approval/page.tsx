"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle, XCircle, ChevronLeft, Clock } from "lucide-react";
import { api } from "@/lib/api";

interface DraftEmail {
  id: string;
  subject: string;
  to: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
}

export default function EmailApprovalPage() {
  const [drafts, setDrafts] = useState<DraftEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getDraftEmails?.();
        if (data) setDrafts(data);
      } catch {
        // API may not expose this yet – show empty state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.approveDraftEmail?.(id);
      setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, status: "approved" } : d));
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectDraftEmail?.(id);
      setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, status: "rejected" } : d));
    } catch (e) {
      console.error(e);
    }
  };

  const pending = drafts.filter((d) => d.status === "pending");
  const resolved = drafts.filter((d) => d.status !== "pending");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-[#1f1f2e] bg-[#0d0d0d] px-6 py-4 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="w-px h-5 bg-[#1f1f2e]" />
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-violet-400" />
          <h1 className="text-lg font-bold text-white">Email Approval</h1>
        </div>
        {pending.length > 0 && (
          <span className="ml-auto px-2.5 py-0.5 rounded-full bg-violet-600/20 text-violet-300 text-xs font-semibold border border-violet-600/30">
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-600">
            <div className="animate-spin w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full mr-3" />
            Loading drafts…
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-4">
            <Mail className="w-12 h-12" />
            <p className="text-sm">No draft emails pending approval.</p>
            <p className="text-xs text-gray-700 text-center max-w-xs">
              When the AI drafts a follow-up email from a recording, it will appear here for your review before being saved.
            </p>
          </div>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Pending Review
                </p>
                {pending.map((draft) => (
                  <EmailCard
                    key={draft.id}
                    draft={draft}
                    isExpanded={expanded === draft.id}
                    onToggle={() => setExpanded(expanded === draft.id ? null : draft.id)}
                    onApprove={() => handleApprove(draft.id)}
                    onReject={() => handleReject(draft.id)}
                  />
                ))}
              </section>
            )}

            {/* Resolved */}
            {resolved.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Resolved
                </p>
                {resolved.map((draft) => (
                  <EmailCard
                    key={draft.id}
                    draft={draft}
                    isExpanded={expanded === draft.id}
                    onToggle={() => setExpanded(expanded === draft.id ? null : draft.id)}
                    onApprove={() => {}}
                    onReject={() => {}}
                    readonly
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface EmailCardProps {
  draft: DraftEmail;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  readonly?: boolean;
}

function EmailCard({ draft, isExpanded, onToggle, onApprove, onReject, readonly }: EmailCardProps) {
  const statusColors: Record<string, string> = {
    pending: "text-yellow-400 border-yellow-600/30 bg-yellow-600/10",
    approved: "text-green-400 border-green-600/30 bg-green-600/10",
    rejected: "text-red-400 border-red-600/30 bg-red-600/10",
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        draft.status === "pending"
          ? "border-[#1f1f2e] bg-[#111118] hover:border-violet-600/30"
          : "border-[#1a1a1a] bg-[#0d0d0d] opacity-70"
      }`}
    >
      {/* Card header */}
      <button
        className="w-full flex items-start justify-between px-5 py-4 text-left"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{draft.subject}</p>
          <p className="text-xs text-gray-500 mt-0.5">To: {draft.to}</p>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${statusColors[draft.status]}`}>
            {draft.status}
          </span>
          {draft.created_at && (
            <span className="text-[10px] text-gray-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(draft.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#1f1f2e] pt-4">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
            {draft.body}
          </pre>
          {!readonly && draft.status === "pending" && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={onApprove}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Approve & Save
              </button>
              <button
                onClick={onReject}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a2e] hover:bg-red-600/20 border border-[#1f1f2e] hover:border-red-600/30 text-gray-300 hover:text-red-400 text-sm font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
