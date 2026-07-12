import type { WorkspaceTreeNode } from "@/types";
import { getLintStrategy } from "@/lib/language-registry";
import { normalizeWorkspacePath } from "@/shared/lib/paths";

function normalizePath(path: string): string {
    return normalizeWorkspacePath(path).replace(/^\.\//, "");
}

export function collectTreeFilePaths(nodes: WorkspaceTreeNode[]): string[] {
    const paths: string[] = [];
    function walk(items: WorkspaceTreeNode[]): void {
        for (const node of items) {
            if (node.kind === "file" && !node.excluded && getLintStrategy(node.path)) {
                paths.push(normalizePath(node.path));
            }
            if (node.children?.length)
                walk(node.children);
        }
    }
    walk(nodes);
    return paths;
}
