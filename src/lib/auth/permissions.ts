import type { DocumentRole } from "@/types";
import type { IDocument, IDocumentMember } from "@/lib/db/models";
import mongoose from "mongoose";

/** Works whether `userId` is populated or a raw ObjectId. */
export function resolveMemberUserId(member: IDocumentMember): string {
  const uid = member.userId as mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId };
  if (uid && typeof uid === "object" && "_id" in uid && uid._id) {
    return uid._id.toString();
  }
  return member.userId.toString();
}

export function getUserRole(doc: IDocument, userId: string): DocumentRole | null {
  if (doc.ownerId.toString() === userId) return "owner";
  const member = doc.members.find((m) => resolveMemberUserId(m) === userId);
  return member?.role ?? null;
}

export function canRead(role: DocumentRole | null): boolean {
  return role !== null;
}

export function canEdit(role: DocumentRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canSync(role: DocumentRole | null): boolean {
  return canEdit(role);
}

export function canManageMembers(role: DocumentRole | null): boolean {
  return role === "owner";
}

export function scopeDocumentQuery(userId: string) {
  return {
    $or: [{ ownerId: userId }, { "members.userId": userId }],
  };
}

export const ROLE_LABELS: Record<DocumentRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<DocumentRole, string> = {
  owner: "Full control — edit, sync, invite members, delete document",
  editor: "Can edit content and sync changes with collaborators",
  viewer: "Read-only access — cannot edit or push sync updates",
};
