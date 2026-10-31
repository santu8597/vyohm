"use client";

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, FastForward, RotateCcw } from "lucide-react";
import { api, Recording } from "@/lib/api";

interface AudioDetailPlayerProps {
  recording: Recording;
  seekTimeMs?: number | null;
  onTimeUpdate?: (currentTimeMs: number) => void;
}

export function AudioDetailPlayer({
  recording,
  seekTimeMs,
  onTimeUpdate,
}: AudioDetailPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioUrl = api.getAudioUrl(recording.id);

  // Handle external seek requests (e.g. clicking a transcript timestamp or citation)
  useEffect(() => {
    if (seekTimeMs !== null && seekTimeMs !== undefined && audioRef.current) {
      const targetSec = Math.max(0, seekTimeMs / 1000);
      audioRef.current.currentTime = targetSec;
      setCurrentTime(targetSec);
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [seekTimeMs]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      setCurrentTime(cur);
      onTimeUpdate?.(Math.floor(cur * 1000));
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || recording.duration_ms / 1000);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const changeRate = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-wide">{recording.filename}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {recording.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Device: <span className="text-slate-300 font-mono">{recording.device_id}</span> • Recorded:{" "}
            {new Date(recording.recorded_at).toLocaleString()}
          </p>
        </div>

        {/* Audio Waveform visualization preview */}
        <div className="flex items-center gap-1.5 h-8 px-4 py-1 rounded-xl bg-slate-900/60 border border-slate-800">
          {[12, 24, 18, 30, 14, 28, 20, 16, 26, 10, 22, 14, 30, 18, 24].map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${
                isPlaying ? "bg-indigo-400" : "bg-slate-600"
              }`}
              style={{
                height: isPlaying ? `${Math.max(6, (h * (i % 2 === 0 ? 1.2 : 0.8)))}px` : `${Math.min(10, h)}px`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Scrubber */}
      <div className="space-y-1.5">
        <input
          type="range"
          min="0"
          max={duration || recording.duration_ms / 1000 || 100}
          step="0.05"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || recording.duration_ms / 1000)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed selectors */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          {[1, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              onClick={() => changeRate(rate)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                playbackRate === rate
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
