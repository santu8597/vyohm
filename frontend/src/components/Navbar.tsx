"use client";

import React from "react";
import { Activity, Database, Upload, ShieldCheck, Mic, Zap } from "lucide-react";

interface NavbarProps {
  onOpenRecord: () => void;
  onOpenUpload: () => void;
  onOpenVerification: () => void;
  dbMode: string;
}

export function Navbar({ onOpenRecord, onOpenUpload, onOpenVerification, dbMode }: NavbarProps) {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-[#1f1f2e] bg-[#0d0d0d] z-40">
      {/* Page title area */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-white hidden sm:block">Dashboard</h2>
      </div>

      {/* Status + Actions */}
      <div className="flex items-center gap-2">

        {/* Groq badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-[#111118] border border-[#1f1f2e] text-gray-400">
          <Zap className="w-3 h-3 text-violet-400" />
          <span>Groq Turbo</span>
        </div>

        {/* DB badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-[#111118] border border-[#1f1f2e] text-gray-400">
          <Database className="w-3 h-3 text-violet-400" />
          <span>{dbMode || "MongoDB"}</span>
        </div>

        {/* API status */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-[#111118] border border-[#1f1f2e] text-gray-400">
          <Activity className="w-3 h-3 text-green-400" />
          <span>FastAPI 8000</span>
        </div>

        {/* Test Suite */}
        <button
          onClick={onOpenVerification}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111118] hover:bg-[#1a1a2e] text-gray-300 text-xs font-medium border border-[#1f1f2e] hover:border-violet-600/40 transition-all"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
          <span>Test Suite</span>
        </button>

        {/* Upload */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111118] hover:bg-[#1a1a2e] text-gray-300 text-xs font-medium border border-[#1f1f2e] hover:border-violet-600/40 transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload File</span>
        </button>

        {/* Record Mic — violet CTA */}
        <button
          onClick={onOpenRecord}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-lg shadow-violet-600/20"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Record Mic</span>
        </button>
      </div>
    </header>
  );
}
