"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  X,
  CheckCircle,
  AlertTriangle,
  Cpu,
  Layers,
  Mic,
  MicOff,
  Square,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Loader2,
  Volume2
} from "lucide-react";
import { api } from "@/lib/api";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newRecordingId?: string) => void;
  initialMode?: "record" | "upload";
}

export function UploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  initialMode = "record",
}: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<"record" | "upload">(initialMode);
  
  // Upload File State
  const [file, setFile] = useState<File | null>(null);
  const [deviceId, setDeviceId] = useState("browser-mic");
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));
  const [uploading, setUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live Microphone Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(10));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode, isOpen]);

  // Clean up recording state on modal close
  useEffect(() => {
    if (!isOpen) {
      stopRecordingCleanup();
      setError(null);
      setResult(null);
      setProcessingStatus("");
    }
  }, [isOpen]);

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsRecording(false);
  };

  // Start Live Audio Recording
  const startRecording = async () => {
    setError(null);
    setRecordedAudioBlob(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup Web Audio Analyser for live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const updateVisualizer = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          // Sample 16 bars
          const sampled = Array.from({ length: 16 }, (_, i) => {
            const val = dataArray[i * 2] || 0;
            return Math.max(12, Math.min(100, (val / 255) * 100));
          });
          setAudioLevels(sampled);
          animFrameRef.current = requestAnimationFrame(updateVisualizer);
        };
        updateVisualizer();
      } catch (audioErr) {
        console.warn("Visualizer audio context init error:", audioErr);
      }

      // Pick supported mime type
      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // Stop all mic tracks
        stream.getTracks().forEach((track) => track.stop());
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
        setAudioLevels(new Array(16).fill(10));
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);

      // Timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Microphone access was denied. Please allow microphone permissions in your browser."
          : `Failed to access microphone: ${err.message}`
      );
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Discard & Re-record
  const handleResetRecording = () => {
    stopRecordingCleanup();
    setRecordedAudioBlob(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setRecordingSeconds(0);
    setResult(null);
    setError(null);
  };

  // Submit Recorded Audio to Groq Pipeline
  const handleSubmitRecordedAudio = async () => {
    if (!recordedAudioBlob) {
      setError("No recorded audio available to submit.");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);
    setProcessingStatus("Uploading voice recording to backend...");

    const ext = recordedAudioBlob.type.includes("mp4") ? ".m4a" : ".webm";
    const filename = `voice_recording_${Date.now()}${ext}`;
    const audioFile = new File([recordedAudioBlob], filename, {
      type: recordedAudioBlob.type || "audio/webm",
    });

    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("device_id", deviceId || "browser-mic");
    formData.append("recorded_at", new Date().toISOString());

    try {
      const res = await api.uploadAudio(formData);
      setResult(res);

      const jobId = res.data.id;
      const recId = res.data.recording_id;

      setProcessingStatus("Transcribing with Groq whisper-large-v3-turbo...");

      // Poll job for fast Groq completion
      if (jobId) {
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const job = await api.getJobStatus(jobId);
            if (job.status === "COMPLETED" || attempts >= 15) {
              clearInterval(pollInterval);
              setProcessingStatus("Transcription & alignment complete!");
              setTimeout(() => {
                onUploadSuccess(recId);
                onClose();
              }, 600);
            }
          } catch (e) {
            clearInterval(pollInterval);
            onUploadSuccess(recId);
            onClose();
          }
        }, 800);
      } else {
        setTimeout(() => {
          onUploadSuccess(recId);
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || "Recording upload failed");
      setUploading(false);
    }
  };

  // Submit File Upload
  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an audio file (WAV, MP3, M4A, WEBM).");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);
    setProcessingStatus("Uploading audio file...");

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("device_id", deviceId);
    formData.append("recorded_at", new Date(recordedAt).toISOString());

    try {
      const res = await api.uploadAudio(formData);
      setResult(res);

      const jobId = res.data.id;
      const recId = res.data.recording_id;

      setProcessingStatus("Transcribing with Groq whisper-large-v3-turbo...");

      if (jobId) {
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const job = await api.getJobStatus(jobId);
            if (job.status === "COMPLETED" || attempts >= 15) {
              clearInterval(pollInterval);
              setProcessingStatus("Transcription complete!");
              setTimeout(() => {
                onUploadSuccess(recId);
                onClose();
              }, 600);
            }
          } catch (e) {
            clearInterval(pollInterval);
            onUploadSuccess(recId);
            onClose();
          }
        }, 800);
      } else {
        setTimeout(() => {
          onUploadSuccess(recId);
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setUploading(false);
    }
  };

  const handleSimulateHardware = async () => {
    setUploading(true);
    setError(null);
    setResult(null);
    setProcessingStatus("Simulating hardware clip ingest...");

    try {
      const testBlob = new Blob([new Uint8Array(16000)], { type: "audio/wav" });
      const testFile = new File([testBlob], "hardware_test_clip.wav", { type: "audio/wav" });

      const fixedTime = "2026-10-31T11:45:00Z";
      const formData = new FormData();
      formData.append("audio", testFile);
      formData.append("device_id", "hw-demo-device");
      formData.append("recorded_at", fixedTime);

      const res = await api.uploadAudio(formData);
      setResult(res);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || "Hardware simulation failed");
    } finally {
      setUploading(false);
      setProcessingStatus("");
    }
  };

  const formatSeconds = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="glass-panel w-full max-w-xl rounded-2xl p-6 border border-slate-700 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">Record & Transcribe Audio</h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <Zap className="w-3 h-3 text-cyan-400" />
                Groq Whisper Turbo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Powered by <code className="text-indigo-300 font-mono">whisper-large-v3-turbo</code> with zero-loss speaker alignment
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab("record")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "record"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Record with Microphone</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "upload"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Audio File</span>
          </button>
        </div>

        {/* TAB 1: LIVE MICROPHONE RECORDING */}
        {activeTab === "record" && (
          <div className="space-y-5">
            {/* Recording Stage Box */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-center flex flex-col items-center justify-center relative overflow-hidden">
              {/* Pulsing background glow during recording */}
              {isRecording && (
                <div className="absolute inset-0 bg-rose-500/10 animate-pulse pointer-events-none" />
              )}

              {/* Status & Timer */}
              <div className="mb-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    isRecording
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                      : recordedAudioBlob
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRecording
                        ? "bg-rose-500 animate-ping"
                        : recordedAudioBlob
                        ? "bg-emerald-400"
                        : "bg-slate-500"
                    }`}
                  />
                  {isRecording
                    ? "Recording in progress..."
                    : recordedAudioBlob
                    ? "Audio captured ready for Groq"
                    : "Ready to Record"}
                </span>

                <div className="text-3xl font-mono font-extrabold text-white mt-2">
                  {formatSeconds(recordingSeconds)}
                </div>
              </div>

              {/* Live Audio Wave Visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-12 w-full max-w-xs mb-5">
                {audioLevels.map((lvl, idx) => (
                  <div
                    key={idx}
                    className={`w-2 rounded-full transition-all duration-75 ${
                      isRecording
                        ? "bg-gradient-to-t from-indigo-500 to-rose-400"
                        : recordedAudioBlob
                        ? "bg-emerald-500/70"
                        : "bg-slate-800"
                    }`}
                    style={{ height: `${lvl}%` }}
                  />
                ))}
              </div>

              {/* Record / Stop Action Button */}
              {!recordedAudioBlob ? (
                <div>
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={uploading}
                      className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-rose-600/30 transition transform hover:scale-105 active:scale-95"
                    >
                      <Mic className="w-5 h-5 animate-bounce" />
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-600/40 transition transform hover:scale-105 active:scale-95"
                    >
                      <Square className="w-5 h-5 fill-white" />
                      <span>Stop & Review Audio</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Playback Review */
                <div className="w-full space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <p className="text-[11px] text-slate-400 mb-2 font-mono flex items-center justify-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      Playback Preview ({formatSeconds(recordingSeconds)})
                    </p>
                    <audio src={recordedAudioUrl || ""} controls className="w-full h-9" />
                  </div>

                  <button
                    type="button"
                    onClick={handleResetRecording}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Discard & Re-record</span>
                  </button>
                </div>
              )}
            </div>

            {/* Device ID Input */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Device Identifier
                </label>
                <input
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="browser-mic"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  AI Model Selected
                </label>
                <div className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-indigo-300 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">whisper-large-v3-turbo</span>
                </div>
              </div>
            </div>

            {/* Progress / Status banner */}
            {processingStatus && (
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 flex items-center gap-2.5 font-mono animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span>{processingStatus}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Recording Button */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitRecordedAudio}
                disabled={uploading || !recordedAudioBlob}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transcribing with Groq...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Transcribe with Groq</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: UPLOAD AUDIO FILE */}
        {activeTab === "upload" && (
          <form onSubmit={handleFileUploadSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Select Audio File (.wav, .mp3, .m4a, .webm, .ogg)
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer p-2 rounded-xl bg-slate-900 border border-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Device ID
                </label>
                <input
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="hw-recorder-01"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Recorded Timestamp
                </label>
                <input
                  type="datetime-local"
                  value={recordedAt}
                  onChange={(e) => setRecordedAt(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Idempotency Hint */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-900 text-xs text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Idempotency Guard Active:
              </span>
              <p className="text-[11px] leading-relaxed">
                If (device_id, recorded_at) already exists, returns <strong>HTTP 200 Duplicate</strong>.
                Only fresh clips receive <strong>HTTP 201 Created</strong>.
              </p>
            </div>

            {processingStatus && (
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 flex items-center gap-2.5 font-mono animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span>{processingStatus}</span>
              </div>
            )}

            {result && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-mono space-y-1 ${
                  result.status_code === 201
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                    : "bg-amber-950/30 border-amber-500/40 text-amber-300"
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {result.status_code === 201 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    HTTP {result.status_code} ({result.data.status})
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Job ID: {result.data.id || result.data.recording_id}
                </p>
                {result.data.message && (
                  <p className="text-[11px] italic">{result.data.message}</p>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleSimulateHardware}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                title="Test hardware idempotency response"
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Simulate Hardware Queue
              </button>

              <button
                type="submit"
                disabled={uploading || !file}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Upload & Transcribe</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
