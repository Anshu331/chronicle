import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models";
import { createDocumentSchema } from "@/lib/validation/schemas";
import { scopeDocumentQuery } from "@/lib/auth/permissions";
import { getUserRole } from "@/lib/auth/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const docs = await Document.find(scopeDocumentQuery(session.user.id))
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      content: d.content,
      preview: d.content.slice(0, 200),
      role: getUserRole(d as Parameters<typeof getUserRole>[0], session.user.id),
      ownerId: d.ownerId.toString(),
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      clock: d.clock,
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const doc = await Document.create({
    title: parsed.data.title,
    content: "",
    clock: {},
    ownerId: session.user.id,
    members: [],
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      title: doc.title,
      content: doc.content,
      clock: doc.clock,
      role: "owner",
      ownerId: session.user.id,
      updatedAt: doc.updatedAt,
    },
    { status: 201 }
  );
}
