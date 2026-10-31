"use client";

import React from "react";
import { Folder, Clock, Hash, ChevronRight, Search, Radio } from "lucide-react";
import { Recording } from "@/lib/api";

interface RecordingListProps {
  recordings: Recording[];
  selectedId: string | null;
  onSelect: (recording: Recording) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
}

export function RecordingList({
  recordings,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
}: RecordingListProps) {
  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-base">Recordings</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {recordings.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>Live Polling (10s)</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
          placeholder="Search across all transcripts..."
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[580px]">
        {recordings.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No recordings uploaded yet. Click "+ Upload Audio" above.
          </div>
        ) : (
          recordings.map((rec) => {
            const isSelected = rec.id === selectedId;
            return (
              <div
                key={rec.id}
                onClick={() => onSelect(rec)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600/15 border-indigo-500/60 shadow-lg shadow-indigo-500/10"
                    : "bg-slate-900/50 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {rec.filename}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                      {rec.device_id} • {new Date(rec.recorded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected ? "text-indigo-400 translate-x-0.5" : "text-slate-600"
                    }`}
                  />
                </div>

                <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {formatDuration(rec.duration_ms)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-500" />
                    {rec.word_count} words
                  </span>
                  <span
                    className={`ml-auto text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                      rec.status === "COMPLETED"
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-amber-400 bg-amber-500/10 animate-pulse"
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
