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
  Copy,
  Check,
  RefreshCw,
  Search,
  ArrowRight,
  Tag,
  Volume2,
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
          <p className="text-gray-400 italic line-clamp-2">{action.input.body?.slice(0, 100)}…</p>
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
  
  // AI Insights & Email draft states
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [draftResult, setDraftResult] = useState<any | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSilence, setHideSilence] = useState(true);

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

  useEffect(() => {
    loadRecording();
  }, [loadRecording]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // ── Generate AI Alias & Insights ────────────────────────────────────────────
  const handleGenerateInsights = async () => {
    if (!recording || generatingInsights) return;
    setGeneratingInsights(true);
    try {
      const data = await api.generateInsights(recording.id);
      setRecording((prev) =>
        prev
          ? {
              ...prev,
              alias: data.alias,
              summary: data.summary,
              key_insights: data.key_insights,
            }
          : null
      );
    } catch (err: any) {
      alert(err?.message || "Failed to generate AI insights.");
    } finally {
      setGeneratingInsights(false);
    }
  };

  // ── Draft Follow-up Email ───────────────────────────────────────────────────
  const handleDraftFollowup = async () => {
    if (!recording || draftingEmail) return;
    setDraftingEmail(true);
    setDraftResult(null);
    try {
      const res = await api.draftFollowUp(recording.id);
      setDraftResult(res.drafted);
    } catch (err: any) {
      alert(err?.message || "Failed to draft follow-up email.");
    } finally {
      setDraftingEmail(false);
    }
  };

  const copyDraftToClipboard = () => {
    if (!draftResult) return;
    const text = `To: ${draftResult.to || "Team"}\nSubject: ${draftResult.subject || "Follow-up"}\n\n${draftResult.body || ""}`;
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // ── Send message in Ask Claude tab ─────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !recording || thinking) return;

    const userMsg: AssistantMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setThinking(true);

    try {
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
        <button onClick={() => router.push("/")} className="text-violet-400 hover:underline text-sm">← Back to Dashboard</button>
      </div>
    );
  }

  const rawSegments: Segment[] = recording.segments || [];
  const segments = rawSegments.filter((seg) => {
    if (hideSilence && (seg.text === "[SILENCE]" || !seg.text.trim())) {
      return false;
    }
    if (searchTerm) {
      return (
        seg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        seg.speaker.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return true;
  });

  const keyInsights: string[] = Array.isArray(recording.key_insights)
    ? recording.key_insights
    : typeof recording.key_insights === "string"
    ? JSON.parse(recording.key_insights || "[]")
    : [];

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#1f1f2e] bg-[#0d0d0d]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors shrink-0 px-2 py-1.5 rounded-lg hover:bg-[#1a1a2e]"
          >
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </button>
          <div className="w-px h-5 bg-[#1f1f2e]" />
          
          {/* Assigned Alias & Filename */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              {recording.alias ? (
                <Sparkles className="w-4 h-4 text-violet-400" />
              ) : (
                <Mic2 className="w-4 h-4 text-violet-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-white truncate">
                  {recording.alias || recording.filename}
                </h1>
                {recording.alias && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 shrink-0">
                    AI Alias
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 truncate font-mono">
                {recording.filename}
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden md:flex items-center gap-3 text-[11px] text-gray-500 font-mono">
            {recording.word_count > 0 && <span>{recording.word_count} words</span>}
            {recording.duration_ms > 0 && <span>{Math.round(recording.duration_ms / 1000)}s</span>}
          </div>

          <button
            onClick={handleGenerateInsights}
            disabled={generatingInsights}
            title="Generate AI Alias, Summary & Key Insights with Claude"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50"
          >
            {generatingInsights ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{recording.alias ? "Regenerate Alias" : "Generate Alias"}</span>
          </button>

          <Link
            href="/email-approval"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-300 transition-colors border border-[#1f1f2e] px-3 py-1.5 rounded-lg hover:border-violet-600/40"
          >
            <Mail className="w-3.5 h-3.5" />
            Approvals
          </Link>

          <button
            onClick={handleDelete}
            title="Delete Recording"
            className="p-1.5 rounded-lg hover:bg-red-600/10 text-gray-600 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between border-b border-[#1f1f2e] bg-[#0d0d0d] px-5">
        <div className="flex gap-1">
          {([
            { id: "transcript" as const, label: "Transcript & Insights", icon: FileText },
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

        {tab === "transcript" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHideSilence(!hideSilence)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                hideSilence
                  ? "border-violet-600/40 bg-violet-600/10 text-violet-300"
                  : "border-[#1f1f2e] text-gray-500 hover:text-gray-300"
              }`}
            >
              {hideSilence ? "Silence Hidden" : "Show All Tokens"}
            </button>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* ── TRANSCRIPT TAB: 2-COLUMN SPLIT (Beside the transcription) ── */}
        {tab === "transcript" && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

            {/* Left: Transcription Feed */}
            <div className="lg:col-span-7 xl:col-span-7 h-full flex flex-col border-r border-[#1f1f2e] overflow-hidden">
              
              {/* Filter bar */}
              <div className="px-4 py-2.5 border-b border-[#1f1f2e] bg-[#0c0c10] flex items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search in transcription…"
                    className="w-full bg-[#111118] border border-[#1f1f2e] rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="text-[11px] text-gray-500 font-mono">
                  {segments.length} segment{segments.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Segments Stream */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {rawSegments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-3">
                    <FileText className="w-8 h-8" />
                    <p className="text-sm">No transcript segments found.</p>
                  </div>
                ) : segments.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-10">
                    No segments match "{searchTerm}".
                  </p>
                ) : (
                  segments.map((seg, i) => (
                    <div
                      key={seg.id || i}
                      className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-[#12121c] transition-colors group"
                    >
                      <div className="shrink-0 flex items-center gap-1 pt-0.5 w-14">
                        <Clock className="w-3 h-3 text-gray-700" />
                        <span className="text-[10px] font-mono text-gray-500">
                          {formatMs(seg.start_ms)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <User className="w-3 h-3 text-gray-600" />
                          <span className={`text-xs font-semibold ${speakerColor(seg.speaker)}`}>
                            {seg.speaker}
                          </span>
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed font-normal">
                          {seg.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: AI Intelligence Panel (Beside the transcription) */}
            <div className="lg:col-span-5 xl:col-span-5 h-full overflow-y-auto bg-[#0b0b10] p-5 space-y-4">
              
              {/* Section Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    AI Recording Insights
                  </h2>
                </div>
                <button
                  onClick={handleGenerateInsights}
                  disabled={generatingInsights}
                  className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${generatingInsights ? "animate-spin" : ""}`} />
                  {generatingInsights ? "Analyzing..." : "Refresh"}
                </button>
              </div>

              {/* 1. Alias Card */}
              <div className="rounded-xl border border-[#1f1f2e] bg-[#111118] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500">
                    Assigned Alias
                  </span>
                  <span className="text-[10px] text-violet-400 bg-violet-600/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                    Generated by Claude
                  </span>
                </div>
                <p className="text-base font-semibold text-white">
                  {recording.alias || "Not yet assigned"}
                </p>
                {!recording.alias && (
                  <p className="text-xs text-gray-500 mt-1">
                    Click "Generate Alias" to let Claude assign a clean, memorable name based on the transcript.
                  </p>
                )}
              </div>

              {/* 2. Ready to Read Summary Card */}
              <div className="rounded-xl border border-violet-600/30 bg-[#11111a] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-violet-300 font-semibold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-violet-400" />
                    Ready-to-Read Summary
                  </span>
                  <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                    Concise
                  </span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">
                  {recording.summary || (
                    <span className="text-gray-500 italic">
                      No summary available yet. Click "Generate Alias" above to create a ready-to-read summary.
                    </span>
                  )}
                </p>
              </div>

              {/* 3. Small Key Insight Words / Phrases */}
              <div className="rounded-xl border border-[#1f1f2e] bg-[#111118] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-violet-400" />
                    Key Insight Phrases
                  </span>
                  {keyInsights.length > 0 && (
                    <span className="text-[10px] text-gray-500 font-mono">
                      {keyInsights.length} phrases
                    </span>
                  )}
                </div>

                {keyInsights.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    Key insight words and phrases will appear here ready to read at a glance.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {keyInsights.map((insight, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:border-violet-500 hover:bg-violet-600/25 transition-colors cursor-default"
                      >
                        {insight}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Draft Follow-up Email Section */}
              <div className="rounded-xl border border-violet-600/40 bg-gradient-to-b from-[#151522] to-[#101018] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold text-white">
                      Follow-up Email Generator
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">Context-Aware</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Generate a ready-to-send follow-up email extracting key action items, participants, and context directly from this recording.
                </p>

                <button
                  onClick={handleDraftFollowup}
                  disabled={draftingEmail}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 transition-all disabled:opacity-50"
                >
                  {draftingEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Drafting email with Claude…</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Draft Follow-up Email</span>
                    </>
                  )}
                </button>

                {/* Draft Result Box */}
                {draftResult && (
                  <div className="mt-3 rounded-lg border border-violet-600/40 bg-[#0d0d14] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Draft Saved to Approvals
                      </span>
                      <button
                        onClick={copyDraftToClipboard}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="w-3 h-3 text-green-400" />
                            <span className="text-green-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-gray-300 space-y-1">
                      <p><span className="text-gray-500">To:</span> {draftResult.to || "Team"}</p>
                      <p><span className="text-gray-500">Subject:</span> {draftResult.subject || "Follow-up"}</p>
                    </div>

                    <div className="max-h-32 overflow-y-auto text-[11px] text-gray-400 bg-[#09090e] p-2 rounded border border-[#1f1f2e] whitespace-pre-wrap leading-relaxed">
                      {draftResult.body}
                    </div>

                    <Link
                      href="/email-approval"
                      className="flex items-center justify-between text-xs text-violet-300 hover:text-white pt-1 group"
                    >
                      <span>Review in Email Approvals</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                )}
              </div>

              {/* 5. Switch to Chat Shortcut */}
              <div className="rounded-xl border border-[#1f1f2e] bg-[#0f0f15] p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white">Need deeper answers?</p>
                  <p className="text-[11px] text-gray-500">Chat with Claude about this recording</p>
                </div>
                <button
                  onClick={() => setTab("chat")}
                  className="px-3 py-1.5 rounded-lg border border-violet-600/40 text-violet-300 hover:bg-violet-600/20 text-xs font-medium transition-colors"
                >
                  Open Chat →
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (
          <div className="h-full flex flex-col">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center text-center py-10 text-gray-500 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-violet-600/15 border border-violet-600/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-violet-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-300">
                    Ask Claude about "{recording.alias || recording.filename}"
                  </p>
                  <p className="text-xs text-gray-500 max-w-sm">
                    Claude reads the full transcript and can answer questions, extract action items,
                    create calendar events, and draft follow-up emails automatically.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center max-w-md">
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
                <div
                  key={i}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                  )}

                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-br-sm"
                        : "bg-[#111118] border border-[#1f1f2e] text-gray-200 rounded-bl-sm space-y-2"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p>{msg.content}</p>
                    ) : (
                      <MarkdownMessage content={msg.content} />
                    )}

                    {/* Auto Tool Action Cards */}
                    {msg.toolActions && msg.toolActions.length > 0 && (
                      <div className="pt-2 border-t border-[#1f1f2e] space-y-2">
                        {msg.toolActions.map((action, ai) => (
                          <ToolActionCard key={ai} action={action} />
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-[#1f1f2e] flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  )}
                </div>
              ))}

              {thinking && (
                <div className="flex gap-3 items-center text-gray-500 text-xs">
                  <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shrink-0">
                    <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                  </div>
                  <span>Claude is analyzing transcript…</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="shrink-0 p-4 border-t border-[#1f1f2e] bg-[#0d0d0d]">
              <div className="flex items-center gap-2 rounded-xl border border-[#1f1f2e] bg-[#111118] px-4 py-2.5 focus-within:border-violet-600 transition-colors">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask Claude anything about ${recording.alias || recording.filename}…`}
                  disabled={thinking}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || thinking}
                  className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
