"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Recording } from "@/lib/api";
import {
  Mic2,
  Sparkles,
  Mail,
  ChevronRight,
  Trash2,
  Search,
  Home,
} from "lucide-react";

interface SidebarProps {
  recordings: Recording[];
  selectedId: string | null;
  onSelectRecording: (rec: Recording) => void;
  onDeleteRecording: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function Sidebar({
  recordings,
  selectedId,
  onSelectRecording,
  onDeleteRecording,
  searchQuery,
  onSearchChange,
}: SidebarProps) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = recordings.filter((r) =>
    r.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-[#0d0d0d] border-r border-[#1f1f2e] h-screen overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1f1f2e]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Mic2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Vyohm</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-3 pt-4 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#1a1a2e] hover:text-white transition-colors"
        >
          <Home className="w-4 h-4 text-violet-400" />
          Dashboard
        </Link>
        <Link
          href="/email-approval"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#1a1a2e] hover:text-white transition-colors"
        >
          <Mail className="w-4 h-4 text-violet-400" />
          Email Approval
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-3 mt-4 mb-3 border-t border-[#1f1f2e]" />

      {/* Today's Recordings section */}
      <div className="px-3 flex-1 overflow-hidden flex flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2 px-1">
          Today's Recordings
        </p>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search recordings…"
            className="w-full bg-[#111118] border border-[#1f1f2e] rounded-lg pl-7 pr-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-violet-600 transition-colors"
          />
        </div>

        {/* Recording list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-6">No recordings found</p>
          ) : (
            filtered.map((rec) => {
              const isSelected = rec.id === selectedId;
              const isHovered = rec.id === hoveredId;
              return (
                <div
                  key={rec.id}
                  onMouseEnter={() => setHoveredId(rec.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelectRecording(rec)}
                  className={`group relative rounded-lg px-3 py-2.5 cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-violet-600/15 border-violet-600/40 text-white"
                      : "bg-transparent border-transparent hover:bg-[#1a1a2e] hover:border-[#1f1f2e] text-gray-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{rec.filename}</p>
                      {rec.recorded_at && (
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {formatDate(rec.recorded_at)}
                        </p>
                      )}
                    </div>
                    {/* Action icons on hover */}
                    <div className={`flex items-center gap-1 shrink-0 transition-opacity ${isHovered || isSelected ? "opacity-100" : "opacity-0"}`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecording(rec.id);
                        }}
                        title="Delete"
                        className="p-1 rounded hover:bg-red-600/20 text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecording(rec);
                          router.push(`/chat/${rec.id}`);
                        }}
                        title="Insights"
                        className="p-1 rounded hover:bg-violet-600/20 text-gray-600 hover:text-violet-400 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-500 rounded-r-full" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom status */}
      <div className="px-5 py-4 border-t border-[#1f1f2e]">
        <p className="text-[10px] text-gray-600 text-center">
          {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
        </p>
      </div>
    </aside>
  );
}
