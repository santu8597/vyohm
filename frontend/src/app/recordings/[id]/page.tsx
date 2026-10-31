"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api, Recording, Segment, ChatMessage, ToolAction } from "@/lib/api";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import {
  ChevronLeft,
  Sparkles,
  Send,
  Mic2,
  Clock,
  User,
  Bot,
  Loader2,
  FileText,
  Trash2,
  Calendar,
  Mail,
  CheckCircle,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEAKER_COLORS = [
  "text-violet-400",
  "text-sky-400",
  "text-emerald-400",
  "text-amber-400",
  "text-pink-400",
];

function speakerColor(speaker: string): string {
  const hash = speaker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SPEAKER_COLORS[hash % SPEAKER_COLORS.length];
}

// ── Tool Action Card ──────────────────────────────────────────────────────────
function ToolActionCard({ action }: { action: ToolAction }) {
  const isCalendar = action.tool === "create_calendar_event";
  const isEmail = action.tool === "draft_email";

  const icon = isCalendar ? (
    <Calendar className="w-4 h-4 text-violet-400" />
  ) : isEmail ? (
    <Mail className="w-4 h-4 text-violet-400" />
  ) : (
    <CheckCircle className="w-4 h-4 text-green-400" />
  );

  const title = isCalendar
    ? `📅 Calendar: ${action.input.title || "Event"}`
    : isEmail
    ? `✉️ Email Draft: ${action.input.subject || "Draft"}`
    : action.tool;

  return (
    <div className="mt-2 rounded-lg border border-violet-600/30 bg-violet-600/5 px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-violet-300">{title}</span>
        <Link
          href="/email-approval"
          className="ml-auto text-[10px] text-violet-400 hover:underline"
        >
          Review →
        </Link>
      </div>
      {isCalendar && (
        <div className="text-[10px] text-gray-500 space-y-0.5 pl-6">
          <p>Start: {action.input.start_time}</p>
          {action.input.end_time && <p>End: {action.input.end_time}</p>}
          {action.input.attendees && <p>Attendees: {action.input.attendees}</p>}
        </div>
      )}
      {isEmail && (
        <div className="text-[10px] text-gray-500 space-y-0.5 pl-6">
          <p>To: {action.input.to}</p>
          <p className="text-gray-600 italic line-clamp-2">{action.input.body?.slice(0, 100)}…</p>
        </div>
      )}
      <p className="text-[10px] text-green-500 pl-6">✓ Saved — awaiting your approval</p>
    </div>
  );
}

// ── Chat message with tool actions ────────────────────────────────────────────
interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  toolActions?: ToolAction[];
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RecordingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [tab, setTab] = useState<"transcript" | "chat">("transcript");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Load recording ──────────────────────────────────────────────────────────
  const loadRecording = useCallback(async () => {
    if (!id) return;
    try {
      const detail = await api.getRecordingDetail(id);
      setRecording(detail);
    } catch (e) {
      console.error("Failed to load recording", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadRecording(); }, [loadRecording]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !recording || thinking) return;

    const userMsg: AssistantMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setThinking(true);

    try {
      // Build history in API format (only role + content, no toolActions)
      const apiHistory: ChatMessage[] = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.chatWithRecording(recording.id, apiHistory);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          toolActions: res.tool_actions || [],
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Failed to get a response. Please check your **Claude API key** in `backend/.env`.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async () => {
    if (!recording) return;
    if (!confirm(`Delete "${recording.filename}"? This cannot be undone.`)) return;
    try {
      await api.deleteRecording(recording.id);
      router.push("/");
    } catch {
      alert("Failed to delete recording.");
    }
  };

  // ── States ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-violet-400" />
        Loading recording…
      </div>
    );
  }
  if (!recording) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-gray-500 gap-4">
        <FileText className="w-10 h-10" />
        <p>Recording not found.</p>
        <button onClick={() => router.push("/")} className="text-violet-400 hover:underline text-sm">← Back</button>
      </div>
    );
  }

  const segments: Segment[] = recording.segments || [];

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2e] bg-[#0d0d0d]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </button>
          <div className="w-px h-4 bg-[#1f1f2e]" />
          <div className="flex items-center gap-2 min-w-0">
            <Mic2 className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-sm font-semibold text-white truncate">{recording.filename}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-4 text-[11px] text-gray-600 font-mono">
            {recording.word_count > 0 && <span>{recording.word_count} words</span>}
            {recording.duration_ms > 0 && <span>{Math.round(recording.duration_ms / 1000)}s</span>}
          </div>
          <Link
            href="/email-approval"
            className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-300 transition-colors border border-[#1f1f2e] px-2.5 py-1.5 rounded-lg hover:border-violet-600/40"
          >
            <Mail className="w-3.5 h-3.5" />
            Approvals
          </Link>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg hover:bg-red-600/10 text-gray-700 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex border-b border-[#1f1f2e] bg-[#0d0d0d] px-5 gap-1">
        {([
          { id: "transcript" as const, label: "Transcript", icon: FileText },
          { id: "chat" as const, label: "Ask Claude", icon: Sparkles },
        ] as const).map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => setTab(tid)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === tid
                ? "border-violet-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {tid === "chat" && messages.filter((m) => m.role === "assistant").length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-violet-600/20 text-violet-300 text-[10px] font-semibold">
                {messages.filter((m) => m.role === "assistant").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* TRANSCRIPT TAB */}
        {tab === "transcript" && (
          <div className="h-full overflow-y-auto px-4 py-5 space-y-0.5">
            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-3">
                <FileText className="w-8 h-8" />
                <p className="text-sm">No transcript yet. Processing may still be in progress.</p>
              </div>
            ) : (
              <>
                {recording.summary && (
                  <div className="mb-5 rounded-xl border border-[#1f1f2e] bg-[#111118] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1.5">AI Summary</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{recording.summary}</p>
                  </div>
                )}
                {segments.map((seg, i) => (
                  <div
                    key={seg.id || i}
                    className="flex gap-3 rounded-lg px-3 py-3 hover:bg-[#111118] transition-colors"
                  >
                    <div className="shrink-0 flex items-center gap-1 pt-1 w-14">
                      <Clock className="w-3 h-3 text-gray-700" />
                      <span className="text-[10px] font-mono text-gray-600">{formatMs(seg.start_ms)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <User className="w-3 h-3 text-gray-600" />
                        <span className={`text-xs font-semibold ${speakerColor(seg.speaker)}`}>
                          {seg.speaker}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 leading-relaxed">{seg.text}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {tab === "chat" && (
          <div className="h-full flex flex-col">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center text-center py-10 text-gray-600 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-violet-600/15 border border-violet-600/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-violet-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">Ask Claude about this recording</p>
                  <p className="text-xs text-gray-600 max-w-xs">
                    Claude reads the full transcript and can answer questions, extract action items,
                    create calendar events, and draft follow-up emails automatically.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1 justify-center">
                    {[
                      "Summarize this recording",
                      "What action items were discussed?",
                      "Draft a follow-up email",
                      "Create a calendar event for any meetings mentioned",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-[#1f1f2e] bg-[#111118] text-gray-400 hover:border-violet-600/40 hover:text-violet-300 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                      msg.role === "user"
                        ? "bg-violet-600/20 border border-violet-600/30"
                        : "bg-[#1a1a2e] border border-[#1f1f2e]"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="w-3.5 h-3.5 text-violet-400" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-violet-600/15 border border-violet-600/25 text-white rounded-tr-sm"
                          : "bg-[#111118] border border-[#1f1f2e] rounded-tl-sm"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-sm">{msg.content}</p>
                      ) : (
                        <MarkdownMessage content={msg.content} />
                      )}
                    </div>

                    {/* Tool action cards */}
                    {msg.toolActions && msg.toolActions.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.toolActions.map((action, j) => (
                          <ToolActionCard key={j} action={action} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Thinking indicator */}
              {thinking && (
                <div className="flex gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-[#1a1a2e] border border-[#1f1f2e] flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="bg-[#111118] border border-[#1f1f2e] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    <span className="text-xs text-gray-500">Claude is thinking…</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 border-t border-[#1f1f2e] px-4 py-3 bg-[#0d0d0d]">
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this recording… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  className="flex-1 resize-none bg-[#111118] border border-[#1f1f2e] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-600/60 transition-colors max-h-28 overflow-y-auto"
                  style={{ minHeight: "42px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || thinking}
                  className="shrink-0 w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-[#1a1a2e] disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-700 mt-1.5 pl-1">
                Powered by Claude · Can create calendar events & draft emails automatically
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
