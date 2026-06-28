import mongoose, { Schema, type Model } from "mongoose";
import type { DocumentRole } from "@/types";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export interface IDocumentMember {
  userId: mongoose.Types.ObjectId;
  role: DocumentRole;
  addedAt: Date;
}

export interface IDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  clock: Record<string, number>;
  ownerId: mongoose.Types.ObjectId;
  members: IDocumentMember[];
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentMemberSchema = new Schema<IDocumentMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "editor", "viewer"], required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DocumentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: "", maxlength: 500_000 },
    clock: { type: Schema.Types.Mixed, default: {} },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: { type: [DocumentMemberSchema], default: [] },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DocumentSchema.index({ "members.userId": 1 });
DocumentSchema.index({ ownerId: 1, updatedAt: -1 });

export const Document: Model<IDocument> =
  mongoose.models.Document ?? mongoose.model<IDocument>("Document", DocumentSchema);

export interface IDocumentVersion {
  _id: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  clock: Record<string, number>;
  label?: string;
  createdBy: mongoose.Types.ObjectId;
  isSnapshot: boolean;
  createdAt: Date;
}

const DocumentVersionSchema = new Schema<IDocumentVersion>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 500_000 },
    clock: { type: Schema.Types.Mixed, default: {} },
    label: { type: String, maxlength: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isSnapshot: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DocumentVersionSchema.index({ documentId: 1, createdAt: -1 });

export const DocumentVersion: Model<IDocumentVersion> =
  mongoose.models.DocumentVersion ??
  mongoose.model<IDocumentVersion>("DocumentVersion", DocumentVersionSchema);

export interface ISyncOperation {
  _id: mongoose.Types.ObjectId;
  opId: string;
  documentId: mongoose.Types.ObjectId;
  clientId: string;
  clock: Record<string, number>;
  type: "insert" | "delete";
  position: number;
  text?: string;
  length?: number;
  userId: mongoose.Types.ObjectId;
  timestamp: number;
  createdAt: Date;
}

const SyncOperationSchema = new Schema<ISyncOperation>(
  {
    opId: { type: String, required: true, unique: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    clientId: { type: String, required: true },
    clock: { type: Schema.Types.Mixed, required: true },
    type: { type: String, enum: ["insert", "delete"], required: true },
    position: { type: Number, required: true, min: 0, max: 500_000 },
    text: { type: String, maxlength: 50_000 },
    length: { type: Number, min: 0, max: 50_000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    timestamp: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SyncOperationSchema.index({ documentId: 1, timestamp: 1 });

export const SyncOperation: Model<ISyncOperation> =
  mongoose.models.SyncOperation ??
  mongoose.model<ISyncOperation>("SyncOperation", SyncOperationSchema);
