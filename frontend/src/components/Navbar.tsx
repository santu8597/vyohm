"use client";

import React from "react";
import { Activity, Database, Upload, ShieldCheck, Waves } from "lucide-react";

interface NavbarProps {
  onOpenUpload: () => void;
  onOpenVerification: () => void;
  dbMode: string;
}

export function Navbar({ onOpenUpload, onOpenVerification, dbMode }: NavbarProps) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white">VYOHM</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                Audio Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Zero-Loss Speaker Alignment & Agent Layer</p>
          </div>
        </div>

        {/* Status Badges & Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Database Mode Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-slate-900 border border-slate-800 text-slate-300">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="capitalize">{dbMode || "MongoDB"}</span>
          </div>

          {/* Engine Status */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Activity className="w-3.5 h-3.5" />
            <span>FastAPI 8000</span>
          </div>

          {/* Test Suite Button */}
          <button
            onClick={onOpenVerification}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Test Suite</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Audio</span>
          </button>
        </div>
      </div>
    </header>
  );
}
