"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { RagChat } from "@/components/RagChat";
import { api, Recording } from "@/lib/api";
import { Headphones, Sparkles } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const { id } = useParams(); // recording id from URL
  const [recording, setRecording] = useState<Recording | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [seekTimeMs, setSeekTimeMs] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      (async () => {
        try {
          const detail = await api.getRecordingDetail(id as string);
          setRecording(detail);
        } catch (e) {
          console.error("Failed to load recording", e);
        }
      })();
    }
  }, [id]);

  const handleCitationClick = (recordingId: string, timeMs: number) => {
    if (recording?.id !== recordingId) return;
    setSeekTimeMs(timeMs);
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <Navbar onOpenRecord={() => {}} onOpenUpload={() => {}} onOpenVerification={() => {}} dbMode="" />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6 bg-[#0a0a0a]">
        <button className="text-sm text-violet-300 underline" onClick={() => router.back()}>
          ← Back to Dashboard
        </button>
        {recording ? (
          <>
            <div className="glass-panel rounded-2xl p-6 bg-gradient-to-r from-black via-[#2a0a46] to-black border border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 text-violet-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Recording Insights</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white">{recording.filename}</h2>
            </div>
            <div className="h-[560px] overflow-y-auto mb-4">
              <TranscriptViewer
                segments={recording.segments || []}
                currentTimeMs={currentTimeMs}
                onSeek={(ms) => setSeekTimeMs(ms)}
                wordCount={recording.word_count || 0}
              />
            </div>
            <div className="h-[460px] overflow-y-auto">
              <RagChat onCitationClick={handleCitationClick} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <Headphones className="w-10 h-10 mr-2" /> Loading recording...
          </div>
        )}
      </main>
    </div>
  );
}
