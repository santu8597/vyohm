"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AudioDetailPlayer } from "@/components/AudioDetailPlayer";
import { UploadModal } from "@/components/UploadModal";
import { VerificationModal } from "@/components/VerificationModal";
import { Sidebar } from "@/components/Sidebar";
import { api, Recording } from "@/lib/api";
import { Mic2, Sparkles, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [seekTimeMs, setSeekTimeMs] = useState<number | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadModalMode, setUploadModalMode] = useState<"record" | "upload">("record");
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [dbMode, setDbMode] = useState("MongoDB");
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Data Loading ───────────────────────────────────────────────────────────
  const loadRecordings = useCallback(async () => {
    try {
      const data = await api.getRecordings();
      setRecordings(data);
    } catch (err) {
      console.error("Error loading recordings:", err);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();
      if (health.database) {
        setDbMode(health.database === "mongodb" ? "MongoDB (Active)" : "SQLite (Fallback)");
      }
    } catch {
      setDbMode("Offline");
    }
  }, []);

  useEffect(() => {
    loadRecordings();
    loadHealth();
    const interval = setInterval(() => loadRecordings(), 10000);
    return () => clearInterval(interval);
  }, [loadRecordings, loadHealth]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectRecording = async (rec: Recording) => {
    try {
      const detail = await api.getRecordingDetail(rec.id);
      setSelectedRecording(detail);
      setSeekTimeMs(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRecording = async (recordingId: string) => {
    try {
      await api.deleteRecording(recordingId);
      const updatedList = await api.getRecordings();
      setRecordings(updatedList);
      if (selectedRecording?.id === recordingId) {
        setSelectedRecording(null);
        setSeekTimeMs(0);
      }
    } catch (err) {
      console.error("Failed to delete recording:", err);
      alert("Failed to delete recording.");
    }
  };

  const handleUploadSuccess = async (newRecordingId?: string) => {
    try {
      const data = await api.getRecordings();
      setRecordings(data);
      if (newRecordingId) {
        const detail = await api.getRecordingDetail(newRecordingId);
        setSelectedRecording(detail);
        setSeekTimeMs(0);
      } else if (data.length > 0) {
        const detail = await api.getRecordingDetail(data[0].id);
        setSelectedRecording(detail);
      }
    } catch (err) {
      console.error("Error refreshing recordings after upload:", err);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a] text-white">

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <Sidebar
        recordings={recordings}
        selectedId={selectedRecording?.id || null}
        onSelectRecording={handleSelectRecording}
        onDeleteRecording={handleDeleteRecording}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* ── Right: Navbar + Content ───────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Top Navbar */}
        <Navbar
          onOpenRecord={() => { setUploadModalMode("record"); setIsUploadOpen(true); }}
          onOpenUpload={() => { setUploadModalMode("upload"); setIsUploadOpen(true); }}
          onOpenVerification={() => setIsVerificationOpen(true)}
          dbMode={dbMode}
        />

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Stats bar */}
          <div className="flex items-center justify-between rounded-xl border border-[#1f1f2e] bg-[#111118] px-6 py-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-mono">Dashboard</p>
              <h1 className="text-xl font-bold text-white mt-0.5">Your Recordings</h1>
            </div>
            <div className="flex items-center gap-6 font-mono text-xs">
              <div className="text-center">
                <p className="text-gray-500 text-[10px]">RECORDINGS</p>
                <p className="text-2xl font-bold text-white">{recordings.length}</p>
              </div>
              <div className="w-px h-10 bg-[#1f1f2e]" />
              <div className="text-center">
                <p className="text-gray-500 text-[10px]">TOTAL WORDS</p>
                <p className="text-2xl font-bold text-violet-400">
                  {recordings.reduce((acc, r) => acc + (r.word_count || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Selected recording preview */}
          {selectedRecording ? (
            <div className="space-y-4">
              {/* Player */}
              <AudioDetailPlayer
                recording={selectedRecording}
                seekTimeMs={seekTimeMs}
                onTimeUpdate={() => {}}
                onDelete={handleDeleteRecording}
              />

              {/* Open Insights CTA */}
              <button
                onClick={() => router.push(`/recordings/${selectedRecording.id}`)}
                className="w-full flex items-center justify-between rounded-xl border border-violet-600/30 bg-violet-600/10 px-5 py-4 hover:bg-violet-600/20 hover:border-violet-500/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-600/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">View Transcript & Chat</p>
                    <p className="text-xs text-gray-500">Full transcript with Claude AI insights for this recording</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-violet-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-[#1f1f2e] text-gray-600 gap-4">
              <Mic2 className="w-10 h-10" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">No recording selected</p>
                <p className="text-xs mt-1">Click a recording in the sidebar to preview it, or record a new one.</p>
              </div>
              <button
                onClick={() => { setUploadModalMode("record"); setIsUploadOpen(true); }}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                Record Now
              </button>
            </div>
          )}

          {/* All recordings grid */}
          {recordings.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-mono">All Recordings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {recordings.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => router.push(`/recordings/${rec.id}`)}
                    className={`text-left rounded-xl border p-4 transition-all hover:border-violet-600/40 hover:bg-violet-600/5 ${
                      selectedRecording?.id === rec.id
                        ? "border-violet-600/40 bg-violet-600/10"
                        : "border-[#1f1f2e] bg-[#111118]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#1a1a2e] flex items-center justify-center shrink-0 mt-0.5">
                        <Mic2 className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{rec.filename}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {rec.recorded_at ? new Date(rec.recorded_at).toLocaleString() : "—"}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-gray-600 font-mono">{rec.word_count || 0} words</span>
                          {rec.duration_ms > 0 && (
                            <span className="text-[10px] text-gray-600 font-mono">
                              {Math.round(rec.duration_ms / 1000)}s
                            </span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            rec.status === "COMPLETED"
                              ? "text-green-400 bg-green-400/10"
                              : "text-yellow-400 bg-yellow-400/10"
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-600 mt-1 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        initialMode={uploadModalMode}
      />
      <VerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
      />
    </div>
  );
}
