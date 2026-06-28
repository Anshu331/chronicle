import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { connectDB } from "@/lib/db/mongodb";
import { Document, DocumentVersion, SyncOperation } from "@/lib/db/models";
import { createVersionSchema, restoreVersionSchema } from "@/lib/validation/schemas";
import { canEdit, canRead, getUserRole } from "@/lib/auth/permissions";
import { nanoid } from "nanoid";

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

  const versions = await DocumentVersion.find({ documentId: id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json(
    versions.map((v) => ({
      id: v._id.toString(),
      documentId: id,
      title: v.title,
      content: v.content,
      clock: v.clock,
      label: v.label,
      createdBy: v.createdBy.toString(),
      createdAt:
        v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
      isSnapshot: v.isSnapshot,
    }))
  );
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = createVersionSchema.safeParse(body);
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

  const snapshotTitle = parsed.data.title ?? doc.title;
  const snapshotContent = parsed.data.content ?? doc.content;
  const snapshotClock = parsed.data.clock ?? doc.clock;

  if (parsed.data.content !== undefined || parsed.data.title !== undefined) {
    doc.title = snapshotTitle;
    doc.content = snapshotContent;
    if (parsed.data.clock) doc.clock = snapshotClock;
    await doc.save();
  }

  const version = await DocumentVersion.create({
    documentId: id,
    title: snapshotTitle,
    content: snapshotContent,
    clock: snapshotClock,
    label: parsed.data.label ?? `Snapshot ${new Date().toLocaleString()}`,
    createdBy: session.user.id,
    isSnapshot: true,
  });

  return NextResponse.json(
    {
      id: version._id.toString(),
      documentId: id,
      title: version.title,
      content: version.content,
      clock: version.clock,
      label: version.label,
      createdBy: session.user.id,
      createdAt: version.createdAt.toISOString(),
      isSnapshot: true,
    },
    { status: 201 }
  );
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = restoreVersionSchema.safeParse(body);
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

  const version = await DocumentVersion.findOne({
    _id: parsed.data.versionId,
    documentId: id,
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const restoreOpId = nanoid();
  await SyncOperation.create({
    opId: restoreOpId,
    documentId: id,
    clientId: `restore-${session.user.id}`,
    clock: { ...version.clock, restore: (version.clock.restore ?? 0) + 1 },
    type: "delete",
    position: 0,
    length: doc.content.length,
    userId: session.user.id,
    timestamp: Date.now(),
  });

  if (version.content.length > 0) {
    await SyncOperation.create({
      opId: nanoid(),
      documentId: id,
      clientId: `restore-${session.user.id}`,
      clock: { ...version.clock, restore: (version.clock.restore ?? 0) + 2 },
      type: "insert",
      position: 0,
      text: version.content,
      userId: session.user.id,
      timestamp: Date.now() + 1,
    });
  }

  doc.content = version.content;
  doc.clock = { ...version.clock, restore: (version.clock.restore ?? 0) + 2 };
  doc.title = version.title;
  await doc.save();

  await DocumentVersion.create({
    documentId: id,
    title: version.title,
    content: version.content,
    clock: version.clock,
    label: `Restored from: ${version.label ?? version.createdAt}`,
    createdBy: session.user.id,
    isSnapshot: false,
  });

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    content: doc.content,
    clock: doc.clock,
    restoredFrom: version._id.toString(),
  });
}
