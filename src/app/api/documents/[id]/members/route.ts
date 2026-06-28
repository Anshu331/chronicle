import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { connectDB } from "@/lib/db/mongodb";
import { Document, User } from "@/lib/db/models";
import {
  addMemberSchema,
  removeMemberSchema,
  updateMemberSchema,
} from "@/lib/validation/schemas";
import {
  canManageMembers,
  canRead,
  getUserRole,
  resolveMemberUserId,
} from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function formatMember(
  m: {
    userId: unknown;
    role: string;
  },
  user?: { _id: { toString(): string }; name: string; email: string } | null
) {
  const id = user?._id.toString() ?? resolveMemberUserId(m as Parameters<typeof resolveMemberUserId>[0]);
  return {
    id,
    name: user?.name ?? "Unknown",
    email: user?.email ?? "",
    role: m.role,
  };
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

  await doc.populate("members.userId", "name email");
  const owner = await User.findById(doc.ownerId).select("name email");

  const members = doc.members
    .map((m) => {
      const user = m.userId as unknown as {
        _id?: { toString(): string };
        name?: string;
        email?: string;
      };
      if (user && user._id && user.name) {
        return formatMember(m, user as { _id: { toString(): string }; name: string; email: string });
      }
      return null;
    })
    .filter(Boolean);

  return NextResponse.json({
    owner: owner
      ? { id: owner._id.toString(), name: owner.name, email: owner.email, role: "owner" as const }
      : null,
    members,
    canManage: canManageMembers(role),
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const doc = await Document.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = getUserRole(doc, session.user.id);
  if (!canManageMembers(role)) {
    return NextResponse.json({ error: "Only owner can add members" }, { status: 403 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  if (session.user.email?.toLowerCase() === email) {
    return NextResponse.json({ error: "You are already the document owner" }, { status: 400 });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json(
      {
        error: "No account found with this email. They must register on Chronicle first.",
      },
      { status: 404 }
    );
  }

  if (user._id.toString() === doc.ownerId.toString()) {
    return NextResponse.json({ error: "User is already the owner" }, { status: 400 });
  }

  const existing = doc.members.find((m) => resolveMemberUserId(m) === user._id.toString());
  if (existing) {
    existing.role = parsed.data.role;
  } else {
    doc.members.push({ userId: user._id, role: parsed.data.role, addedAt: new Date() });
  }

  await doc.save();

  return NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: parsed.data.role,
    message: existing ? "Member role updated" : "Member added successfully",
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const doc = await Document.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = getUserRole(doc, session.user.id);
  if (!canManageMembers(role)) {
    return NextResponse.json({ error: "Only owner can update members" }, { status: 403 });
  }

  const member = doc.members.find((m) => resolveMemberUserId(m) === parsed.data.memberId);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  member.role = parsed.data.role;
  await doc.save();

  const user = await User.findById(parsed.data.memberId).select("name email");

  return NextResponse.json({
    id: parsed.data.memberId,
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: parsed.data.role,
    message: "Role updated",
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = removeMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const doc = await Document.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = getUserRole(doc, session.user.id);
  if (!canManageMembers(role)) {
    return NextResponse.json({ error: "Only owner can remove members" }, { status: 403 });
  }

  const before = doc.members.length;
  doc.members = doc.members.filter(
    (m) => resolveMemberUserId(m) !== parsed.data.memberId
  );

  if (doc.members.length === before) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await doc.save();

  return NextResponse.json({ success: true, message: "Member removed" });
}
