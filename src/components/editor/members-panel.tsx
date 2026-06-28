"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import type { DocumentRole } from "@/types";
import { SidePanel } from "@/components/ui/side-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crown, Loader2, Pencil, Eye, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  email: string;
  role: DocumentRole;
}

interface MembersPanelProps {
  documentId: string;
  canManage: boolean;
  onClose: () => void;
}

const ROLE_STYLES: Record<DocumentRole, string> = {
  owner: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  editor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

function RoleBadge({ role }: { role: DocumentRole }) {
  const Icon = role === "owner" ? Crown : role === "editor" ? Pencil : Eye;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        ROLE_STYLES[role]
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {ROLE_LABELS[role]}
    </span>
  );
}

export function MembersPanel({ documentId, canManage, onClose }: MembersPanelProps) {
  const [owner, setOwner] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/members`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load collaborators");
        return;
      }
      setOwner(data.owner ?? null);
      setMembers(data.members ?? []);
    } catch {
      setError("Failed to load collaborators");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const addMember = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to add member");
        return;
      }

      setEmail("");
      setMessage(data.message ?? "Member added successfully");
      await load();
    } catch {
      setError("Failed to add member — check your connection");
    } finally {
      setSubmitting(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: "editor" | "viewer") => {
    setError(null);
    setMessage(null);

    const res = await fetch(`/api/documents/${documentId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role: newRole }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to update role");
      return;
    }

    setMessage(data.message ?? "Role updated");
    await load();
  };

  const removeMember = async (memberId: string) => {
    setError(null);
    setMessage(null);

    const res = await fetch(`/api/documents/${documentId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to remove member");
      return;
    }

    setMessage(data.message ?? "Member removed");
    await load();
  };

  return (
    <SidePanel
      title="Collaborators"
      onClose={onClose}
      className="bg-slate-50 dark:bg-slate-950"
      footer={
        canManage ? (
          <form onSubmit={addMember} className="space-y-2">
            <Label htmlFor="member-email">Invite by email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              autoComplete="email"
              disabled={submitting}
            />
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              disabled={submitting}
            >
              <option value="editor">Editor — can edit & sync</option>
              <option value="viewer">Viewer — read-only</option>
            </select>
            <p className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[role]}</p>
            <Button type="submit" size="sm" className="w-full" disabled={!email.trim() || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add Member
            </Button>
            <p className="text-xs text-slate-400">
              User must already have a Chronicle account with this email.
            </p>
          </form>
        ) : undefined
      }
    >
      <div className="space-y-4 p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        ) : (
          <>
            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" role="status">
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert">
                {error}
              </p>
            )}

            {owner && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Owner</p>
                <div className="rounded-lg border border-violet-200 bg-white p-3 dark:border-violet-900 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{owner.name}</p>
                      <p className="break-all text-xs text-slate-500">{owner.email}</p>
                    </div>
                    <RoleBadge role="owner" />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{ROLE_DESCRIPTIONS.owner}</p>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Members</p>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                  No members yet. Invite someone by email below.
                </p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{m.name}</p>
                          <p className="break-all text-xs text-slate-500">{m.email}</p>
                        </div>
                        {!canManage && <RoleBadge role={m.role} />}
                      </div>

                      {canManage && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <select
                            value={m.role}
                            onChange={(e) =>
                              updateMemberRole(m.id, e.target.value as "editor" | "viewer")
                            }
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                            aria-label={`Role for ${m.name}`}
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-red-600 hover:text-red-700"
                            onClick={() => removeMember(m.id)}
                            aria-label={`Remove ${m.name}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      <p className="mt-2 text-xs text-slate-500">{ROLE_DESCRIPTIONS[m.role]}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!canManage && (
              <p className="text-xs text-slate-500">
                Only the document owner can invite or manage collaborators.
              </p>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}
