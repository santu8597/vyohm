"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Calendar, CheckCircle, XCircle, ChevronLeft, Clock, AlertCircle } from "lucide-react";
import { api, ActionItem } from "@/lib/api";

export default function EmailApprovalPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadItems = async () => {
    try {
      const data = await api.getActionItems();
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (e) {
      console.error("Failed to fetch action items:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.confirmAction(id, "confirmed");
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "confirmed" } : item
        )
      );
    } catch (e) {
      console.error("Failed to approve action:", e);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.confirmAction(id, "rejected");
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "rejected" } : item
        )
      );
    } catch (e) {
      console.error("Failed to reject action:", e);
    }
  };

  const pending = items.filter((d) => d.status === "awaiting_confirmation");
  const resolved = items.filter((d) => d.status !== "awaiting_confirmation");

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
          <h1 className="text-lg font-bold text-white">Email & Calendar Approvals</h1>
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
            Loading pending approvals…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-4">
            <Mail className="w-12 h-12" />
            <p className="text-sm">No items pending approval.</p>
            <p className="text-xs text-gray-700 text-center max-w-xs">
              When Claude creates a calendar event or drafts a follow-up email from a recording transcript, it will appear here for your review before being saved.
            </p>
          </div>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Pending Review ({pending.length})
                </p>
                {pending.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    isExpanded={expanded === item.id}
                    onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
                    onApprove={() => handleApprove(item.id)}
                    onReject={() => handleReject(item.id)}
                  />
                ))}
              </section>
            )}

            {/* Resolved */}
            {resolved.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Resolved History ({resolved.length})
                </p>
                {resolved.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    isExpanded={expanded === item.id}
                    onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
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

interface ActionItemCardProps {
  item: ActionItem;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  readonly?: boolean;
}

function ActionItemCard({ item, isExpanded, onToggle, onApprove, onReject, readonly }: ActionItemCardProps) {
  const isCalendar = item.type === "create_calendar_event";
  const isEmail = item.type === "draft_email";
  const details = item.details || {};

  const isPending = item.status === "awaiting_confirmation";
  const isApproved = item.status === "confirmed";

  const statusLabel = isPending ? "Pending Review" : isApproved ? "Approved" : "Rejected";
  const statusColor = isPending
    ? "text-yellow-400 border-yellow-600/30 bg-yellow-600/10"
    : isApproved
    ? "text-green-400 border-green-600/30 bg-green-600/10"
    : "text-red-400 border-red-600/30 bg-red-600/10";

  return (
    <div
      className={`rounded-xl border transition-all ${
        isPending
          ? "border-[#1f1f2e] bg-[#111118] hover:border-violet-600/30"
          : "border-[#1a1a1a] bg-[#0d0d0d] opacity-70"
      }`}
    >
      {/* Header */}
      <button
        className="w-full flex items-start justify-between px-5 py-4 text-left"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-violet-600/10 border border-violet-600/20 text-violet-400 shrink-0 mt-0.5">
            {isCalendar ? <Calendar className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{item.title}</p>
            {isEmail && details.to && (
              <p className="text-xs text-gray-500 mt-0.5">To: {details.to}</p>
            )}
            {isCalendar && details.start && (
              <p className="text-xs text-gray-500 mt-0.5">Start: {details.start}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>
            {statusLabel}
          </span>
          {item.created_at && (
            <span className="text-[10px] text-gray-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#1f1f2e] pt-4">
          {isEmail && (
            <div className="space-y-2">
              <div className="text-xs text-gray-400">
                <span className="font-semibold text-gray-300">Subject: </span>
                {details.subject}
              </div>
              <div className="text-xs text-gray-400">
                <span className="font-semibold text-gray-300">Recipient: </span>
                {details.to}
              </div>
              <div className="bg-[#0a0a0a] p-3 rounded-lg border border-[#1f1f2e]">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {details.body || details.preview}
                </pre>
              </div>
            </div>
          )}

          {isCalendar && (
            <div className="space-y-1.5 text-xs text-gray-400">
              <p><span className="font-semibold text-gray-300">Event Title: </span>{details.title}</p>
              <p><span className="font-semibold text-gray-300">Start Time: </span>{details.start}</p>
              {details.end && <p><span className="font-semibold text-gray-300">End Time: </span>{details.end}</p>}
              {details.attendees && (
                <p>
                  <span className="font-semibold text-gray-300">Attendees: </span>
                  {Array.isArray(details.attendees) ? details.attendees.join(", ") : details.attendees}
                </p>
              )}
              {details.description && (
                <p><span className="font-semibold text-gray-300">Notes: </span>{details.description}</p>
              )}
            </div>
          )}

          {!readonly && isPending && (
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
