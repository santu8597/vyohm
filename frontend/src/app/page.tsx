"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { RecordingList } from "@/components/RecordingList";
import { AudioDetailPlayer } from "@/components/AudioDetailPlayer";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { RagChat } from "@/components/RagChat";
import { ActionItemsPanel } from "@/components/ActionItemsPanel";
import { UploadModal } from "@/components/UploadModal";
import { VerificationModal } from "@/components/VerificationModal";
import { api, Recording } from "@/lib/api";
import { Headphones, Sparkles, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [seekTimeMs, setSeekTimeMs] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [dbMode, setDbMode] = useState("MongoDB");
  const [loading, setLoading] = useState(true);

  // Load recordings list
  const loadRecordings = useCallback(async () => {
    try {
      const data = await api.getRecordings();
      setRecordings(data);
      if (data.length > 0 && !selectedRecording) {
        // Automatically select first recording
        const detail = await api.getRecordingDetail(data[0].id);
        setSelectedRecording(detail);
      }
    } catch (err) {
      console.error("Error loading recordings:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedRecording]);

  // Load health & DB mode
  const loadHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();
      if (health.database) {
        setDbMode(health.database === "mongodb" ? "MongoDB (Active)" : "SQLite (Fallback)");
      }
    } catch (e) {
      setDbMode("Offline");
    }
  }, []);

  useEffect(() => {
    loadRecordings();
    loadHealth();

    // Phase 3.2 L6 Requirement: Dashboard polls every 10 seconds to catch live watcher ingest
    const interval = setInterval(() => {
      loadRecordings();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadRecordings, loadHealth]);

  // Handle recording selection
  const handleSelectRecording = async (rec: Recording) => {
    try {
      const detail = await api.getRecordingDetail(rec.id);
      setSelectedRecording(detail);
      setSeekTimeMs(0);
      setCurrentTimeMs(0);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle citation click in RAG Chat (L4/Phase 2)
  const handleCitationClick = async (recordingId: string, timeMs: number) => {
    if (!selectedRecording || selectedRecording.id !== recordingId) {
      const target = recordings.find((r) => r.id === recordingId);
      if (target) {
        const detail = await api.getRecordingDetail(target.id);
        setSelectedRecording(detail);
      }
    }
    setSeekTimeMs(timeMs);
  };

  // Search handler
  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) {
      loadRecordings();
      return;
    }
    try {
      const results = await api.searchTranscripts(searchQuery);
      if (results && results.length > 0) {
        const firstMatchRecId = results[0].recording_id;
        const target = recordings.find((r) => r.id === firstMatchRecId);
        if (target) {
          const detail = await api.getRecordingDetail(target.id);
          setSelectedRecording(detail);
          setSeekTimeMs(results[0].start_ms);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      <Navbar
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenVerification={() => setIsVerificationOpen(true)}
        dbMode={dbMode}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Hero Banner */}
        <div className="glass-panel rounded-2xl p-6 bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>WhisperLiveKit Specification & Zero-Loss Engine</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Executive Audio Attribution & RAG Center
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Word-level timestamp attribution, isolated silence spans, strict citations, and confirmation-gated tools with zero send risk.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">TOTAL RECORDINGS</span>
              <span className="text-lg font-bold text-white">{recordings.length}</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">TOTAL WORDS ALIGNED</span>
              <span className="text-lg font-bold text-indigo-400">
                {recordings.reduce((acc, r) => acc + (r.word_count || 0), 0)}
              </span>
            </div>
          </div>
        </div>

        {/* 3-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Column 1: Recording List (3 cols) */}
          <div className="lg:col-span-3 h-[780px]">
            <RecordingList
              recordings={recordings}
              selectedId={selectedRecording?.id || null}
              onSelect={handleSelectRecording}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearchSubmit={handleSearchSubmit}
            />
          </div>

          {/* Column 2: Player + Transcript Viewer (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {selectedRecording ? (
              <>
                <AudioDetailPlayer
                  recording={selectedRecording}
                  seekTimeMs={seekTimeMs}
                  onTimeUpdate={(ms) => setCurrentTimeMs(ms)}
                />

                <div className="h-[560px]">
                  <TranscriptViewer
                    segments={selectedRecording.segments || []}
                    currentTimeMs={currentTimeMs}
                    onSeek={(ms) => setSeekTimeMs(ms)}
                    wordCount={selectedRecording.word_count || 0}
                  />
                </div>
              </>
            ) : (
              <div className="glass-panel rounded-2xl p-16 text-center text-slate-500 space-y-3">
                <Headphones className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm">Select a recording from the left to view transcript and playback.</p>
              </div>
            )}
          </div>

          {/* Column 3: RAG Chat & Action Items (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="h-[460px]">
              <RagChat onCitationClick={handleCitationClick} />
            </div>

            <ActionItemsPanel
              actionItems={selectedRecording?.action_items || []}
              onActionUpdated={() => {
                if (selectedRecording) handleSelectRecording(selectedRecording);
              }}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          loadRecordings();
        }}
      />

      <VerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
      />
    </div>
  );
}
