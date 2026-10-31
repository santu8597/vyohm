"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { AudioDetailPlayer } from "@/components/AudioDetailPlayer";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { RagChat } from "@/components/RagChat";
import { ActionItemsPanel } from "@/components/ActionItemsPanel";
import { UploadModal } from "@/components/UploadModal";
import { VerificationModal } from "@/components/VerificationModal";
import { Sidebar } from "@/components/Sidebar";
import { api, Recording } from "@/lib/api";
import { Headphones, Mic } from "lucide-react";

export default function DashboardPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [seekTimeMs, setSeekTimeMs] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadModalMode, setUploadModalMode] = useState<"record" | "upload">("record");
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [dbMode, setDbMode] = useState("MongoDB");
  const [loading, setLoading] = useState(true);

  // ─── Data Loading ───────────────────────────────────────────────────────────
  const loadRecordings = useCallback(async () => {
    try {
      const data = await api.getRecordings();
      setRecordings(data);
      if (data.length > 0 && !selectedRecording) {
        const detail = await api.getRecordingDetail(data[0].id);
        setSelectedRecording(detail);
      }
    } catch (err) {
      console.error("Error loading recordings:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedRecording]);

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
      setCurrentTimeMs(0);
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
        if (updatedList.length > 0) {
          const first = await api.getRecordingDetail(updatedList[0].id);
          setSelectedRecording(first);
        } else {
          setSelectedRecording(null);
        }
        setSeekTimeMs(0);
        setCurrentTimeMs(0);
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
        setCurrentTimeMs(0);
      } else if (data.length > 0) {
        const detail = await api.getRecordingDetail(data[0].id);
        setSelectedRecording(detail);
      }
    } catch (err) {
      console.error("Error refreshing recordings after upload:", err);
    }
  };

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

          {/* Content: Player + Transcript | Chat + Actions */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

            {/* Player + Transcript (7 cols) */}
            <div className="xl:col-span-7 space-y-4">
              {selectedRecording ? (
                <>
                  <AudioDetailPlayer
                    recording={selectedRecording}
                    seekTimeMs={seekTimeMs}
                    onTimeUpdate={(ms) => setCurrentTimeMs(ms)}
                    onDelete={handleDeleteRecording}
                  />
                  <div className="h-[500px] overflow-hidden rounded-xl border border-[#1f1f2e]">
                    <TranscriptViewer
                      segments={selectedRecording.segments || []}
                      currentTimeMs={currentTimeMs}
                      onSeek={(ms) => setSeekTimeMs(ms)}
                      wordCount={selectedRecording.word_count || 0}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-[#1f1f2e] bg-[#111118] text-gray-600 gap-3">
                  <Headphones className="w-10 h-10" />
                  <p className="text-sm">Select a recording from the sidebar to get started.</p>
                </div>
              )}
            </div>

            {/* RAG Chat + Action Items (5 cols) */}
            <div className="xl:col-span-5 space-y-4">
              <div className="h-[420px] overflow-hidden rounded-xl border border-[#1f1f2e]">
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
