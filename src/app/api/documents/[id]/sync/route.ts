import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { connectDB } from "@/lib/db/mongodb";
import { Document, SyncOperation } from "@/lib/db/models";
import { rebuildFromOperations } from "@/lib/crdt/merge";
import { syncPayloadSchema, validateBodySize } from "@/lib/validation/schemas";
import { canSync, getUserRole } from "@/lib/auth/permissions";
import type { DocumentOperation } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.text();
  if (!validateBodySize(rawBody)) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = syncPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  if (parsed.data.documentId !== id) {
    return NextResponse.json({ error: "Document ID mismatch" }, { status: 400 });
  }

  await connectDB();
  const doc = await Document.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = getUserRole(doc, session.user.id);
  if (!canSync(role)) {
    return NextResponse.json(
      { error: "Viewers cannot push sync updates" },
      { status: 403 }
    );
  }

  const incomingOps = parsed.data.operations.filter(
    (op) => op.userId === session.user!.id
  );

  const existingOpIds = new Set(
    (
      await SyncOperation.find({
        opId: { $in: incomingOps.map((o) => o.id) },
      }).select("opId")
    ).map((o) => o.opId)
  );

  const newOps = incomingOps.filter((op) => !existingOpIds.has(op.id));

  for (const op of newOps) {
    await SyncOperation.create({
      opId: op.id,
      documentId: id,
      clientId: op.clientId,
      clock: op.clock,
      type: op.type,
      position: op.position,
      text: op.text,
      length: op.length,
      userId: session.user.id,
      timestamp: op.timestamp,
    });
  }

  const allServerOps = await SyncOperation.find({ documentId: id })
    .sort({ timestamp: 1 })
    .limit(5000)
    .lean();

  const remoteOps: DocumentOperation[] = allServerOps.map((op) => ({
    id: op.opId,
    documentId: id,
    clientId: op.clientId,
    clock: op.clock as DocumentOperation["clock"],
    type: op.type,
    position: op.position,
    text: op.text,
    length: op.length,
    userId: op.userId.toString(),
    timestamp: op.timestamp,
  }));

  const clientOpIds = new Set(incomingOps.map((o) => o.id));
  const opsToReturn = remoteOps.filter((op) => !clientOpIds.has(op.id));

  const merged = rebuildFromOperations(remoteOps);

  doc.content = merged.content;
  doc.clock = merged.clock;
  doc.lastSyncedAt = new Date();
  await doc.save();

  return NextResponse.json({
    operations: opsToReturn.slice(-500),
    serverClock: doc.clock,
    content: doc.content,
    merged: true,
  });
}
