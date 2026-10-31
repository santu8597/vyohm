"use client";

import React, { useState } from "react";
import { Send, Bot, User, Sparkles, ExternalLink, HelpCircle, AlertCircle } from "lucide-react";
import { api, ChatSource } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

interface RagChatProps {
  onCitationClick: (recordingId: string, timeMs: number) => void;
}

export function RagChat({ onCitationClick }: RagChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your Vyohm RAG Assistant. Every factual answer is strictly backed by verifiable citations directly from your audio recordings. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (queryText?: string) => {
    const q = queryText || input;
    if (!q.trim() || loading) return;

    const userMsg: Message = { role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const res = await api.chat(q);
      const botMsg: Message = {
        role: "assistant",
        content: res.answer,
        sources: res.sources,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Encountered an error contacting the agent: " + err.message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">RAG Assistant</h3>
            <p className="text-xs text-slate-400">Strict Citations & Abstention Guard (L4/L6)</p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
          Source: Name · mm:ss
        </span>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[
          "What did we promise the vendor?",
          "What is the capital city of Mars?", // Unanswerable test
          "When is the contract due?",
        ].map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[480px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-slate-900/80 text-slate-200 border border-slate-800"
              }`}
            >
              <p>{msg.content}</p>

              {/* Strict Citations Rendering */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Verified Sources:
                  </span>
                  {msg.sources.map((src, srcIdx) => (
                    <div
                      key={srcIdx}
                      onClick={() => onCitationClick(src.recording_id, src.time_ms)}
                      className="group flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 shrink-0" />
                        <span className="text-xs text-indigo-300 font-medium truncate">
                          Source: {src.recording_name || src.recording_id} · {src.timestamp_formatted}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-900 shrink-0">
                        Jump to Audio
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Abstention notice when no info */}
              {msg.content.includes("The recordings do not contain this information") && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-400/90 font-mono">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Abstention activated: Zero hallucinations</span>
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="text-xs text-slate-400">Searching transcripts & verifying citations...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mt-4 pt-3 border-t border-slate-800 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about meeting promises, dates, or decisions..."
          className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium flex items-center justify-center transition shadow-md shadow-indigo-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
