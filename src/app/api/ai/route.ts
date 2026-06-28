import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildAiPrompt, type WritingTone } from "@/lib/ai/prompts";
import { auth } from "@/lib/auth/config";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models";
import { aiRequestSchema } from "@/lib/validation/schemas";
import { canRead, getUserRole } from "@/lib/auth/permissions";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = aiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const doc = await Document.findById(parsed.data.documentId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = getUserRole(doc, session.user.id);
  if (!canRead(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const tone: WritingTone = parsed.data.tone ?? "professional";

  if (!apiKey) {
    return NextResponse.json(
      {
        result: `[AI Demo Mode] ${parsed.data.action} (${tone} tone) applied to ${parsed.data.content.length} characters. Set GEMINI_API_KEY for live AI.`,
        demo: true,
        tone,
      }
    );
  }

  const prompt = buildAiPrompt(parsed.data.action, parsed.data.content, tone);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({
      result: text,
      demo: false,
      provider: "gemini",
      tone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
