export type WritingTone = "professional" | "casual" | "academic";

export const TONE_LABELS: Record<WritingTone, string> = {
  professional: "Professional",
  casual: "Casual",
  academic: "Academic",
};

export const TONE_GUIDANCE: Record<WritingTone, string> = {
  professional:
    "Use clear, polished, and business-appropriate language. Be concise, respectful, and suitable for workplace or client-facing communication. Avoid slang and overly informal phrasing.",
  casual:
    "Use friendly, conversational, and approachable language. Write as if explaining to a colleague in a relaxed setting. Keep it natural and easy to read while staying clear.",
  academic:
    "Use formal scholarly language with precise terminology, logical structure, and objective phrasing. Favor well-reasoned statements, appropriate hedging where needed, and an analytical academic style.",
};

type AiAction = "summarize" | "improve" | "expand" | "tone";

export function buildAiPrompt(
  action: AiAction,
  content: string,
  tone: WritingTone = "professional"
): string {
  const toneLabel = TONE_LABELS[tone];
  const guidance = TONE_GUIDANCE[tone];

  const instructions: Record<AiAction, string> = {
    summarize: `Summarize the following document in 2-3 paragraphs using a ${toneLabel.toLowerCase()} writing style.

Tone requirements:
${guidance}

Return only the summary, with no preamble.`,

    improve: `Improve the writing quality, clarity, grammar, and flow of the following document while keeping its meaning intact. The rewritten text must use a ${toneLabel.toLowerCase()} writing style.

Tone requirements:
${guidance}

Return only the improved text, with no preamble.`,

    expand: `Expand on the ideas in the following document with more detail, context, and examples. The expanded version must use a ${toneLabel.toLowerCase()} writing style.

Tone requirements:
${guidance}

Return only the expanded text, with no preamble.`,

    tone: `Rewrite the following document entirely in a ${toneLabel.toLowerCase()} tone.

Tone requirements:
${guidance}

Preserve the core meaning and key points. Return only the rewritten text, with no preamble.`,
  };

  return `${instructions[action]}\n\n---\nDocument:\n${content}`;
}
