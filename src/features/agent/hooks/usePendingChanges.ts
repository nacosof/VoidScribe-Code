import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { useEditorTabs } from "@/hooks/useEditorTabs";
import type { useChatSessions } from "@/hooks/useChatSessions";
import {
    addPendingChange,
    loadPendingChanges,
    pendingChangesForWorkspace,
    pendingChangesToPaths,
    reconcilePendingStore,
    removePendingByPath,
    savePendingChanges,
} from "@/lib/pending-changes";
import { pathsEqual } from "@/shared/lib/paths";
import type { PendingFileChange } from "@/types";

type EditorApi = ReturnType<typeof useEditorTabs>;
type ChatsApi = ReturnType<typeof useChatSessions>;

type UsePendingChangesOptions = {
    activeSessionId: string;
    sessions: ChatsApi["sessions"];
    workspacePath: string;
    editor: EditorApi;
    refreshTree: () => void;
};

export function usePendingChanges({
    activeSessionId,
    sessions,
    workspacePath,
    editor,
    refreshTree,
}: UsePendingChangesOptions) {
    const [pendingBySession, setPendingBySession] = useState(loadPendingChanges);
    const pendingBySessionRef = useRef(pendingBySession);
    pendingBySessionRef.current = pendingBySession;

    useEffect(() => {
        savePendingChanges(pendingBySession);
    }, [pendingBySession]);

    useEffect(() => {
        const root = workspacePath.trim();
        if (!root)
            return;
        let cancelled = false;
        void (async () => {
            const reconciled = await reconcilePendingStore({
                store: pendingBySessionRef.current,
                workspacePath: root,
                sessionIds: sessions.map((item) => item.id),
                readFile: async (path) => {
                    const result = await window.voidscribe.readWorkspaceFile(path);
                    return result.ok
                        ? { ok: true, content: result.content }
                        : { ok: false };
                },
            });
            if (cancelled)
                return;
            if (JSON.stringify(reconciled) !== JSON.stringify(pendingBySessionRef.current)) {
                setPendingBySession(reconciled);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [workspacePath, sessions]);

    const sessionPending = pendingChangesForWorkspace(pendingBySession[activeSessionId] ?? [], workspacePath);

    const workspacePendingPaths = useMemo(() => pendingChangesToPaths(sessionPending), [sessionPending]);

    const activeAgentPending = useMemo(() => {
        if (!editor.activePath)
            return null;
        return (sessionPending.find((change) => pathsEqual(change.path, editor.activePath!) && change.kind !== "deleted") ?? null);
    }, [sessionPending, editor.activePath]);

    const trackFileChange = useCallback((sessionId: string, fileEvent: {
        path: string;
        kind: "created" | "modified" | "deleted";
        previousContent: string | null;
        newContent: string;
    }) => {
        if (fileEvent.kind === "deleted") {
            editor.removeTabByPath(fileEvent.path);
        }
        else if (fileEvent.kind === "created") {
            void editor.openFile(fileEvent.path);
        }
        else {
            editor.applyExternalContent(fileEvent.path, fileEvent.newContent);
        }
        setPendingBySession((prev) => addPendingChange(prev, sessionId, {
            path: fileEvent.path,
            kind: fileEvent.kind,
            previousContent: fileEvent.previousContent,
            newContent: fileEvent.newContent,
            workspacePath: workspacePath.trim() || undefined,
        }));
        refreshTree();
    }, [editor, refreshTree, workspacePath]);

    const verifyPendingAfterFlush = useCallback(async (sessionId: string) => {
        const root = workspacePath.trim();
        if (!root)
            return;
        const reconciled = await reconcilePendingStore({
            store: pendingBySessionRef.current,
            workspacePath: root,
            sessionIds: sessions.map((item) => item.id),
            readFile: async (path) => {
                const result = await window.voidscribe.readWorkspaceFile(path);
                return result.ok
                    ? { ok: true, content: result.content }
                    : { ok: false };
            },
        });
        setPendingBySession(reconciled);
    }, [workspacePath, sessions]);

    const undoPendingChange = useCallback(async (change: PendingFileChange) => {
        if (change.kind === "deleted") {
            if (change.previousContent !== null) {
                await window.voidscribe.writeWorkspaceFile(change.path, change.previousContent);
                editor.applyExternalContent(change.path, change.previousContent);
            }
            setPendingBySession((prev) => removePendingByPath(prev, activeSessionId, change.path));
            refreshTree();
            return;
        }
        if (change.kind === "created") {
            await window.voidscribe.deleteWorkspaceEntry(change.path);
        }
        else if (change.previousContent !== null) {
            await window.voidscribe.writeWorkspaceFile(change.path, change.previousContent);
            editor.applyExternalContent(change.path, change.previousContent);
        }
        setPendingBySession((prev) => removePendingByPath(prev, activeSessionId, change.path));
        refreshTree();
    }, [activeSessionId, editor, refreshTree]);

    const restoreChatCheckpoint = useCallback(async (checkpointId: string) => {
        const session = sessions.find((item) => item.id === activeSessionId);
        const checkpoint = session?.checkpoints?.find((item) => item.id === checkpointId);
        if (!checkpoint)
            return;
        const result = await window.voidscribe.restoreChatCheckpoint(checkpoint);
        if (!result.ok)
            return;
        for (const [path, snap] of Object.entries(checkpoint.files)) {
            setPendingBySession((prev) => removePendingByPath(prev, activeSessionId, path));
            if (snap.before === null) {
                editor.removeTabByPath(path);
            }
            else {
                editor.applyExternalContent(path, snap.before);
            }
        }
        refreshTree();
    }, [activeSessionId, editor, refreshTree, sessions]);

    const keepPendingChange = useCallback(async (change: PendingFileChange, contentOverride?: string) => {
        const content = contentOverride ?? change.newContent;
        if (change.kind === "deleted") {
            const result = await window.voidscribe.flushAgentStagedFiles([change.path]);
            if (!result.ok) {
                await window.voidscribe.deleteWorkspaceEntry(change.path);
            }
            editor.removeTabByPath(change.path);
            setPendingBySession((prev) => removePendingByPath(prev, activeSessionId, change.path));
            refreshTree();
            return;
        }
        const result = await window.voidscribe.flushAgentStagedFiles([change.path]);
        if (!result.ok) {
            await window.voidscribe.writeWorkspaceFile(change.path, content);
        }
        editor.applyExternalContent(change.path, content);
        setPendingBySession((prev) => removePendingByPath(prev, activeSessionId, change.path));
        refreshTree();
    }, [activeSessionId, editor, refreshTree]);

    const openPendingFile = useCallback(async (path: string) => {
        const change = sessionPending.find((item) => pathsEqual(item.path, path));
        if (change?.kind === "deleted")
            return;
        const disk = await window.voidscribe.readWorkspaceFile(path);
        if (disk.ok) {
            await editor.openFile(path);
            if (change)
                editor.applyExternalContent(path, change.newContent);
            return;
        }
        if (change) {
            await editor.openFileWithContent(path, change.newContent);
            return;
        }
        await editor.openFile(path);
    }, [editor, sessionPending]);

    return {
        sessionPending,
        workspacePendingPaths,
        activeAgentPending,
        trackFileChange,
        verifyPendingAfterFlush,
        undoPendingChange,
        keepPendingChange,
        openPendingFile,
        restoreChatCheckpoint,
    };
}
