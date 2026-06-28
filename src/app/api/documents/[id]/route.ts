import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { connectDB } from "@/lib/db/mongodb";
import { Document, SyncOperation } from "@/lib/db/models";
import { updateDocumentMetaSchema } from "@/lib/validation/schemas";
import { canRead, canEdit, getUserRole } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const doc = await Document.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = getUserRole(doc, session.user.id);
  if (!canRead(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pendingOps = await SyncOperation.find({ documentId: id })
    .sort({ timestamp: 1 })
    .limit(1000)
    .lean();

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    content: doc.content,
    clock: doc.clock,
    role,
    ownerId: doc.ownerId.toString(),
    updatedAt: doc.updatedAt,
    pendingOps: pendingOps.map((op) => ({
      id: op.opId,
      documentId: id,
      clientId: op.clientId,
      clock: op.clock,
      type: op.type,
      position: op.position,
      text: op.text,
      length: op.length,
      userId: op.userId.toString(),
      timestamp: op.timestamp,
    })),
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateDocumentMetaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const doc = await Document.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = getUserRole(doc, session.user.id);
  if (!canEdit(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.title) doc.title = parsed.data.title;
  await doc.save();

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    updatedAt: doc.updatedAt,
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const doc = await Document.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.ownerId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Only owner can delete" }, { status: 403 });
  }

  await Document.deleteOne({ _id: id });
  await SyncOperation.deleteMany({ documentId: id });

  return NextResponse.json({ success: true });
}
