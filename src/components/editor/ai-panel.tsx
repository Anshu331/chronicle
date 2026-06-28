"use client";

import { useState } from "react";
import { TONE_GUIDANCE, TONE_LABELS, type WritingTone } from "@/lib/ai/prompts";
import { SidePanel } from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AIPanelProps {
  documentId: string;
  content: string;
  onResult: (result: string) => void;
  onClose: () => void;
}

const ACTIONS = [
  { id: "summarize", label: "Summarize" },
  { id: "improve", label: "Improve Writing" },
  { id: "expand", label: "Expand Ideas" },
  { id: "tone", label: "Rewrite in Selected Tone" },
] as const;

export function AIPanel({ documentId, content, onResult, onClose }: AIPanelProps) {
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState<WritingTone>("professional");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTone, setLastTone] = useState<WritingTone | null>(null);

  const runAI = async (action: (typeof ACTIONS)[number]["id"]) => {
    setLoading(true);
    setPreview(null);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, action, content, tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI request failed");
        return;
      }
      setLastTone(data.tone ?? tone);
      setPreview(data.result ?? "");
    } catch {
      setError("AI request failed — check your connection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidePanel
      title="AI Assistant (Gemini)"
      onClose={onClose}
      className="bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/20 dark:to-slate-950"
      footer={
        preview ? (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => onResult(preview)}>
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPreview(null)}>
              Discard
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <label htmlFor="tone-select" className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Writing tone
          </label>
          <p className="mb-2 text-xs text-slate-500">Applies to all AI actions below</p>
          <select
            id="tone-select"
            value={tone}
            onChange={(e) => setTone(e.target.value as WritingTone)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="professional">{TONE_LABELS.professional}</option>
            <option value="casual">{TONE_LABELS.casual}</option>
            <option value="academic">{TONE_LABELS.academic}</option>
          </select>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{TONE_GUIDANCE[tone]}</p>
        </div>

        {ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            disabled={loading || !content.trim()}
            onClick={() => runAI(action.id)}
            className="h-auto min-h-10 justify-start whitespace-normal py-2.5 text-left"
          >
            {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            <span className="flex-1">{action.label}</span>
            <span className="shrink-0 text-xs text-slate-400">{TONE_LABELS[tone]}</span>
          </Button>
        ))}

        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        {preview && (
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="mb-2 text-xs font-medium text-slate-500">
              Preview {lastTone ? `· ${TONE_LABELS[lastTone]} tone` : ""}
            </p>
            <div className="rounded-lg bg-white p-3 text-sm leading-relaxed dark:bg-slate-900">
              {preview}
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
