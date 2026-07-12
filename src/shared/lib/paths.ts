export function normalizeWorkspacePath(path: string): string {
    return path.replace(/\\/g, "/");
}

export function pathsEqual(a: string, b: string): boolean {
    return normalizeWorkspacePath(a) === normalizeWorkspacePath(b);
}
