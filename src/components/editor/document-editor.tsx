"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeDiff } from "@/lib/crdt/operations";
import { createDeleteOp, createInsertOp } from "@/lib/crdt/operations";
import {
  getClientId,
  queueOperation,
  saveDocumentLocal,
} from "@/lib/local/indexed-db";
import { syncEngine } from "@/lib/local/sync-engine";
import { createSnapshot } from "@/lib/local/snapshots";
import { getVersionsLocal } from "@/lib/local/indexed-db";
import type { DocumentRole, DocumentState } from "@/types";
import { SyncStatus } from "@/components/sync/sync-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  History,
  Save,
  Users,
} from "lucide-react";
import { VersionTimeline } from "./version-timeline";
import { AIPanel } from "./ai-panel";
import { MembersPanel } from "./members-panel";

interface DocumentEditorProps {
  initialDoc: DocumentState;
  userId: string;
  onDocumentChange?: (doc: DocumentState) => void;
}

export function DocumentEditor({ initialDoc, userId, onDocumentChange }: DocumentEditorProps) {
  const [doc, setDoc] = useState(initialDoc);
  const [title, setTitle] = useState(initialDoc.title);
  const [content, setContent] = useState(initialDoc.content);
  const [clock, setClock] = useState(initialDoc.clock);
  const [clientReady, setClientReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"online" | "offline" | "syncing" | "synced" | "error">(
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"
  );
  const [showHistory, setShowHistory] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const lastContentRef = useRef(initialDoc.content);
  const titleRef = useRef(initialDoc.title);
  const clientIdRef = useRef<string>("");
  const isTypingRef = useRef(false);
  const isEditingTitleRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeLockRef = useRef(false);
  const canEdit = doc.role === "owner" || doc.role === "editor";

  const applyRemoteState = useCallback(
    (remote: DocumentState) => {
      if (isTypingRef.current) return;

      if (isEditingTitleRef.current) {
        const preservedTitle = titleRef.current;
        const merged: DocumentState = { ...remote, title: preservedTitle };
        setDoc(merged);
        setContent(remote.content);
        setClock(remote.clock);
        lastContentRef.current = remote.content;
        onDocumentChange?.(merged);
        return;
      }

      setDoc(remote);
      setTitle(remote.title);
      titleRef.current = remote.title;
      setContent(remote.content);
      setClock(remote.clock);
      lastContentRef.current = remote.content;
      onDocumentChange?.(remote);
    },
    [onDocumentChange]
  );

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    if (isTypingRef.current || isEditingTitleRef.current) return;
    setDoc(initialDoc);
    setTitle(initialDoc.title);
    titleRef.current = initialDoc.title;
    setContent(initialDoc.content);
    setClock(initialDoc.clock);
    lastContentRef.current = initialDoc.content;
  }, [initialDoc]);

  useEffect(() => {
    let mounted = true;

    getClientId().then((id) => {
      if (!mounted) return;
      clientIdRef.current = id;
      setClientReady(true);
    });

    syncEngine.start();
    syncEngine.watchDocument(doc.id);

    const unsub = syncEngine.subscribe((event) => {
      if (event.documentId && event.documentId !== doc.id) return;
      if (event.type === "offline") setSyncStatus("offline");
      else if (event.type === "syncing") setSyncStatus("syncing");
      else if (event.type === "synced") setSyncStatus("synced");
      else if (event.type === "error") setSyncStatus("error");
      else if (event.type === "pulled" && event.document) {
        applyRemoteState(event.document);
        setSyncStatus(navigator.onLine ? "synced" : "offline");
      }
    });

    const handleOnline = () => {
      setSyncStatus("syncing");
      syncEngine.flush(doc.id);
    };
    const handleOffline = () => setSyncStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (navigator.onLine && canEdit) {
      syncEngine.flush(doc.id);
    }

    return () => {
      mounted = false;
      unsub();
      syncEngine.stopWatching(doc.id);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    };
  }, [doc.id, canEdit, applyRemoteState]);

  const persistLocal = useCallback(
    async (newContent: string, newClock: typeof clock, newTitle?: string) => {
      const updated: DocumentState = {
        ...doc,
        title: newTitle ?? title,
        content: newContent,
        clock: newClock,
        updatedAt: new Date().toISOString(),
      };
      await saveDocumentLocal(updated);
      setDoc(updated);
      onDocumentChange?.(updated);
    },
    [doc, title, onDocumentChange]
  );

  const saveTitle = useCallback(
    async (rawTitle: string) => {
      const nextTitle = rawTitle.trim() || "Untitled Document";
      if (!canEdit || nextTitle === doc.title) return;

      setTitle(nextTitle);
      titleRef.current = nextTitle;
      await syncEngine.queueTitleChange(doc.id, nextTitle);
      await persistLocal(content, clock, nextTitle);
    },
    [canEdit, doc.id, doc.title, content, clock, persistLocal]
  );

  const handleTitleChange = (value: string) => {
    if (!canEdit) return;
    setTitle(value);
    titleRef.current = value;
    isEditingTitleRef.current = true;

    if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    titleSaveTimerRef.current = setTimeout(() => {
      isEditingTitleRef.current = false;
      void saveTitle(value);
    }, 500);
  };

  const handleTitleBlur = async () => {
    if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    isEditingTitleRef.current = false;
    await saveTitle(title);
  };

  const handleContentChange = async (newContent: string) => {
    if (!canEdit || !clientReady || !clientIdRef.current) return;

    isTypingRef.current = true;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 1500);

    setContent(newContent);
    const diff = computeDiff(lastContentRef.current, newContent);
    lastContentRef.current = newContent;

    if (changeLockRef.current) return;
    changeLockRef.current = true;

    try {
      let currentClock = { ...clock };
      for (const d of diff) {
        if (d.type === "insert" && d.text) {
          const { operation, newClock } = createInsertOp(
            doc.id,
            clientIdRef.current,
            currentClock,
            d.position,
            d.text,
            userId
          );
          currentClock = newClock;
          await queueOperation(operation);
        } else if (d.type === "delete" && d.length) {
          const { operation, newClock } = createDeleteOp(
            doc.id,
            clientIdRef.current,
            currentClock,
            d.position,
            d.length,
            userId
          );
          currentClock = newClock;
          await queueOperation(operation);
        }
      }

      setClock(currentClock);
      await persistLocal(newContent, currentClock);

      if (navigator.onLine) {
        setSyncStatus("syncing");
        syncEngine.flush(doc.id).catch(() => setSyncStatus("error"));
      } else {
        setSyncStatus("offline");
      }
    } finally {
      changeLockRef.current = false;
    }
  };

  const handleSnapshot = async () => {
    setSnapshotting(true);
    setSnapshotMessage(null);
    try {
      const result = await createSnapshot({
        documentId: doc.id,
        title,
        content,
        clock,
        userId,
      });
      setHistoryRefreshKey((k) => k + 1);
      setShowHistory(true);
      setSnapshotMessage(
        result.synced
          ? "Snapshot saved"
          : "Snapshot saved locally — will sync when online"
      );
      setTimeout(() => setSnapshotMessage(null), 3000);
    } catch {
      setSnapshotMessage("Snapshot failed — try again");
    } finally {
      setSnapshotting(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (versionId.startsWith("local-")) {
      const versions = await getVersionsLocal(doc.id);
      const version = versions.find((v) => v.id === versionId);
      if (!version) return;

      isTypingRef.current = false;
      setContent(version.content);
      setTitle(version.title);
      setClock(version.clock);
      lastContentRef.current = version.content;
      await persistLocal(version.content, version.clock, version.title);

      if (navigator.onLine) {
        const res = await fetch(`/api/documents/${doc.id}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: `Restored locally from: ${version.label ?? "snapshot"}`,
            title: version.title,
            content: version.content,
            clock: version.clock,
          }),
        });
        if (res.ok) await syncEngine.flush(doc.id);
      }
      return;
    }

    const res = await fetch(`/api/documents/${doc.id}/versions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    if (res.ok) {
      const data = await res.json();
      isTypingRef.current = false;
      setContent(data.content);
      setTitle(data.title);
      setClock(data.clock);
      lastContentRef.current = data.content;
      await persistLocal(data.content, data.clock, data.title);
      setHistoryRefreshKey((k) => k + 1);
      if (navigator.onLine) await syncEngine.pullDocument(doc.id);
    }
  };

  const handleAIResult = (result: string) => {
    handleContentChange(result);
    setShowAI(false);
  };

  const toggleHistory = () => {
    setShowHistory((v) => !v);
    setShowAI(false);
    setShowMembers(false);
  };

  const toggleAI = () => {
    setShowAI((v) => !v);
    setShowHistory(false);
    setShowMembers(false);
  };

  const toggleMembers = () => {
    setShowMembers((v) => !v);
    setShowHistory(false);
    setShowAI(false);
  };

  const roleBadge: Record<DocumentRole, string> = {
    owner: "Owner",
    editor: "Editor",
    viewer: "Viewer",
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem-2.75rem)] flex-col sm:h-[calc(100dvh-4rem-2.75rem)]">
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            disabled={!canEdit}
            className="min-w-0 flex-1 border-0 text-base font-semibold shadow-none focus-visible:ring-0 sm:text-lg"
            aria-label="Document title"
          />
          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 sm:px-2.5 sm:text-xs dark:bg-violet-900/40 dark:text-violet-300">
            {roleBadge[doc.role]}
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-2 py-1.5 sm:gap-2 sm:border-t-0 sm:px-4 sm:pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SyncStatus status={syncStatus} />
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSnapshot}
                disabled={snapshotting}
                aria-label="Save snapshot"
                className="shrink-0 px-2 sm:px-3"
              >
                <Save className={`h-4 w-4 ${snapshotting ? "animate-pulse" : ""}`} />
                <span className="hidden sm:inline">{snapshotting ? "Saving…" : "Snapshot"}</span>
              </Button>
              <Button
                variant={showAI ? "secondary" : "ghost"}
                size="sm"
                onClick={toggleAI}
                aria-label="AI tools"
                className="shrink-0 px-2 sm:px-3"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI</span>
              </Button>
            </>
          )}
          <Button
            variant={showHistory ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleHistory}
            aria-label="Version history"
            className="shrink-0 px-2 sm:px-3"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </Button>
          <Button
            variant={showMembers ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleMembers}
            aria-label="Members"
            className="shrink-0 px-2 sm:px-3"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </Button>
        </div>

        {snapshotMessage && (
          <p className="border-t border-emerald-100 bg-emerald-50 px-3 py-1.5 text-center text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" role="status">
            {snapshotMessage}
          </p>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            disabled={!canEdit || !clientReady}
            placeholder={
              canEdit
                ? clientReady
                  ? "Start writing… Changes save locally and sync when online."
                  : "Preparing local editor…"
                : "You have view-only access."
            }
            className="min-h-[calc(100dvh-12rem)] w-full resize-none bg-transparent text-base leading-relaxed text-slate-800 outline-none sm:min-h-full dark:text-slate-100"
            aria-label="Document content"
          />
        </main>

        {showHistory && (
          <VersionTimeline
            documentId={doc.id}
            refreshKey={historyRefreshKey}
            onRestore={handleRestore}
            onClose={() => setShowHistory(false)}
            canEdit={canEdit}
          />
        )}

        {showAI && canEdit && (
          <AIPanel
            documentId={doc.id}
            content={content}
            onResult={handleAIResult}
            onClose={() => setShowAI(false)}
          />
        )}

        {showMembers && (
          <MembersPanel
            documentId={doc.id}
            canManage={doc.role === "owner"}
            onClose={() => setShowMembers(false)}
          />
        )}
      </div>
    </div>
  );
}
