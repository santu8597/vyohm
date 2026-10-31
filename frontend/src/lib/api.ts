/**
 * Vyohm API Client
 * Connects frontend to FastAPI backend engine on port 8000.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Recording {
  id: string;
  device_id: string;
  recorded_at: string;
  filename: string;
  filepath: string;
  duration_ms: number;
  word_count: number;
  status: string;
  summary: string;
  alias?: string;
  key_insights?: string[];  // stored as JSON string in DB, parsed on GET
  created_at: string;
  segments?: Segment[];
  action_items?: ActionItem[];
}

export interface RecordingInsights {
  recording_id: string;
  alias: string;
  summary: string;
  key_insights: string[];
}

export interface Segment {
  id?: string;
  recording_id?: string;
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
  order_idx?: number;
}

export interface ActionItem {
  id: string;
  recording_id: string;
  type: "create_calendar_event" | "draft_email" | string;
  title: string;
  details: {
    title?: string;
    start?: string;
    end?: string;
    to?: string;
    subject?: string;
    body?: string;
    status?: string;
    preview?: string;
    note?: string;
    [key: string]: any;
  };
  status: "awaiting_confirmation" | "confirmed" | "rejected";
  created_at: string;
}

export interface ChatSource {
  recording_id: string;
  recording_name: string;
  time_ms: number;
  timestamp_formatted: string;
  speaker: string;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

export interface VerificationResult {
  status: "PASS" | "FAIL";
  criteria: Record<string, boolean>;
  [key: string]: any;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolAction {
  tool: "create_calendar_event" | "draft_email" | string;
  input: Record<string, any>;
  result: string;
}

export interface RecordingChatResponse {
  answer: string;
  model: string;
  recording_id: string;
  tool_actions: ToolAction[];
}

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getRecordings(): Promise<Recording[]> {
    const res = await fetch(`${API_BASE}/recordings`);
    if (!res.ok) throw new Error("Failed to fetch recordings");
    return res.json();
  },

  async getRecordingDetail(id: string): Promise<Recording> {
    const res = await fetch(`${API_BASE}/recordings/${id}`);
    if (!res.ok) throw new Error("Failed to fetch recording detail");
    return res.json();
  },

  async deleteRecording(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/recordings/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete recording");
    return res.json();
  },

  getAudioUrl(recordingId: string): string {
    return `${API_BASE}/audio/${recordingId}`;
  },

  async uploadAudio(formData: FormData) {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return {
      status_code: res.status,
      data,
    };
  },

  async getJobStatus(jobId: string) {
    const res = await fetch(`${API_BASE}/transcriptions/${jobId}`);
    return res.json();
  },

  async searchTranscripts(q: string) {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
    return res.json();
  },

  async getActionItems(status?: string): Promise<ActionItem[]> {
    const url = status ? `${API_BASE}/action-items?status=${status}` : `${API_BASE}/action-items`;
    const res = await fetch(url);
    return res.json();
  },

  async confirmAction(actionId: string, decision: "confirmed" | "rejected") {
    const res = await fetch(`${API_BASE}/action-items/${actionId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    return res.json();
  },

  async chat(query: string): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    return res.json();
  },

  /** Claude-powered chat scoped to a single recording's transcript */
  async chatWithRecording(recordingId: string, messages: ChatMessage[]): Promise<RecordingChatResponse> {
    const res = await fetch(`${API_BASE}/chat/recording/${recordingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error("Chat request failed");
    return res.json();
  },

  /** Generate Claude alias, summary, and key insight phrases for a recording */
  async generateInsights(recordingId: string): Promise<RecordingInsights> {
    const res = await fetch(`${API_BASE}/recordings/${recordingId}/insights`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || "Failed to generate insights");
    }
    return res.json();
  },

  /** Draft a follow-up email from the transcript and save to approvals queue */
  async draftFollowUp(recordingId: string): Promise<{ recording_id: string; drafted: any; message: string }> {
    const res = await fetch(`${API_BASE}/recordings/${recordingId}/draft-followup`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || "Failed to draft follow-up email");
    }
    return res.json();
  },

  async runPhase1(): Promise<VerificationResult> {
    const res = await fetch(`${API_BASE}/verify/phase1`, { method: "POST" });
    return res.json();
  },

  async runPhase2(): Promise<VerificationResult> {
    const res = await fetch(`${API_BASE}/verify/phase2`, { method: "POST" });
    return res.json();
  },

  async runPhase3(): Promise<VerificationResult> {
    const res = await fetch(`${API_BASE}/verify/phase3`, { method: "POST" });
    return res.json();
  },
};

