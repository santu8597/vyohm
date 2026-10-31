"use client";

import React, { useState } from "react";
import { Upload, X, CheckCircle, AlertTriangle, Cpu, Layers } from "lucide-react";
import { api } from "@/lib/api";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [deviceId, setDeviceId] = useState("hw-recorder-01");
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an audio file (WAV, MP3, M4A).");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("device_id", deviceId);
    formData.append("recorded_at", new Date(recordedAt).toISOString());

    try {
      const res = await api.uploadAudio(formData);
      setResult(res);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSimulateHardware = async () => {
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      // Create synthetic audio clip in memory as blob
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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Audio Upload & Hardware Ingest</h3>
            <p className="text-xs text-slate-400">
              Contract Endpoint: <span className="font-mono text-indigo-400">POST /upload</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Audio File (.wav, .mp3, .m4a)
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
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
            >
              {uploading ? "Ingesting..." : "Upload Clip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
