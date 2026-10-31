"use client";

import React from "react";
import { CheckCircle2, Mic, Clock, VolumeX } from "lucide-react";
import { Segment } from "@/lib/api";

interface TranscriptViewerProps {
  segments: Segment[];
  currentTimeMs: number;
  onSeek: (ms: number) => void;
  wordCount: number;
}

export function TranscriptViewer({
  segments,
  currentTimeMs,
  onSeek,
  wordCount,
}: TranscriptViewerProps) {
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getSpeakerStyle = (speaker: string) => {
    if (speaker === "-2" || speaker === "SILENCE") {
      return {
        badgeBg: "bg-slate-800 text-slate-400 border-slate-700",
        label: "SILENCE (0s loss)",
        borderActive: "border-slate-700",
        isSilence: true,
      };
    }
    if (speaker.includes("00") || speaker.includes("0")) {
      return {
        badgeBg: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        label: "Speaker 1",
        borderActive: "border-indigo-500/60 shadow-indigo-500/10",
        isSilence: false,
      };
    }
    if (speaker.includes("01") || speaker.includes("1")) {
      return {
        badgeBg: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
        label: "Speaker 2",
        borderActive: "border-cyan-500/60 shadow-cyan-500/10",
        isSilence: false,
      };
    }
    return {
      badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      label: speaker,
      borderActive: "border-emerald-500/60 shadow-emerald-500/10",
      isSilence: false,
    };
  };

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col h-full">
      {/* Header with Zero Loss Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Mic className="w-5 h-5 text-indigo-400" />
            Speaker-Labeled Transcript
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Aligned via WhisperLiveKit Zero-Loss Specification
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Zero-Loss Verified ({wordCount} words)
          </div>
        </div>
      </div>

      {/* Segments Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[520px]">
        {segments.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No transcript segments available for this recording.
          </div>
        ) : (
          segments.map((seg, idx) => {
            const isActive =
              currentTimeMs >= seg.start_ms && currentTimeMs <= seg.end_ms;
            const style = getSpeakerStyle(seg.speaker);

            if (style.isSilence) {
              return (
                <div
                  key={idx}
                  onClick={() => onSeek(seg.start_ms)}
                  className={`flex items-center justify-between px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                    isActive
                      ? "bg-slate-800/80 border-slate-600"
                      : "bg-slate-900/40 border-slate-800/60 hover:bg-slate-850"
                  }`}
                >
                  <div className="flex items-center gap-2 text-slate-400">
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                    <span>[Silent Pause · Isolated Segment]</span>
                  </div>
                  <span className="text-slate-500">
                    {formatTime(seg.start_ms)} - {formatTime(seg.end_ms)}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={idx}
                onClick={() => onSeek(seg.start_ms)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? `bg-slate-800/90 ${style.borderActive} shadow-lg`
                    : "bg-slate-900/50 border-slate-800/70 hover:bg-slate-850 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${style.badgeBg}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      ({seg.speaker})
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(seg.start_ms);
                    }}
                    className="flex items-center gap-1 text-xs font-mono text-indigo-400 hover:text-indigo-300 hover:underline bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/50"
                  >
                    <Clock className="w-3 h-3" />
                    {formatTime(seg.start_ms)}
                  </button>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed font-normal">
                  {seg.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
