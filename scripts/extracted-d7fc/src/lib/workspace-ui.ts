export function getWorkspaceFolderName(workspacePath: string): string {
  const trimmed = workspacePath.trim().replace(/[/\\]+$/, "");
  if (!trimmed) return "";
  const parts = trimmed.split(/[/\\]/);
  return parts[parts.length - 1] ?? trimmed;
}
