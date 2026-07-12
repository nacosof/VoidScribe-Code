import { deleteWorkspaceEntry, writeWorkspaceFile } from "./workspace";
import { WorkspaceEditOverlay } from "./agent-runtime/edit-overlay";
export type CheckpointFileSnapshot = {
    before: string | null;
    after: string | null;
};
export type ChatCheckpointPayload = {
    id: string;
    label: string;
    files: Record<string, CheckpointFileSnapshot>;
};
export async function restoreChatCheckpoint(workspaceRoot: string, checkpoint: ChatCheckpointPayload): Promise<string[]> {
    const overlay = WorkspaceEditOverlay.forRoot(workspaceRoot);
    const restored: string[] = [];
    for (const [path, snap] of Object.entries(checkpoint.files)) {
        if (snap.before === null) {
            try {
                await deleteWorkspaceEntry(workspaceRoot, path);
            }
            catch {
            }
        }
        else {
            await writeWorkspaceFile(workspaceRoot, path, snap.before, {
                historySource: "user",
            });
        }
        overlay.acknowledgePath(path);
        restored.push(path);
    }
    return restored;
}
