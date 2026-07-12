function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function contentFingerprint(content: string): string {
  return `${content.length}:${content.slice(0, 160)}`;
}

/** Блокирует бессмысленные повторы patch/write на одном файле. */
export class AgentPathEditGuard {
  private readonly patchFails = new Map<string, number>();
  private readonly writeNoopFails = new Map<string, number>();
  private readonly lastNoopFingerprint = new Map<string, string>();

  recordPatchFail(path: string): void {
    const key = normalizePath(path);
    this.patchFails.set(key, (this.patchFails.get(key) ?? 0) + 1);
  }

  recordWriteSuccess(path: string): void {
    const key = normalizePath(path);
    this.patchFails.delete(key);
    this.writeNoopFails.delete(key);
    this.lastNoopFingerprint.delete(key);
  }

  /** Возвращает nudge для агента, если пора сменить стратегию. */
  recordWriteNoopFail(path: string, content: string): string | null {
    const key = normalizePath(path);
    const fingerprint = contentFingerprint(content);
    const sameAsLast = this.lastNoopFingerprint.get(key) === fingerprint;
    this.lastNoopFingerprint.set(key, fingerprint);

    const fails = (this.writeNoopFails.get(key) ?? 0) + 1;
    this.writeNoopFails.set(key, fails);

    if (fails >= 2 || (fails >= 1 && sameAsLast)) {
      return (
        `write_file «${key}» заблокирован: ты ${fails}× отправил тот же текст (${content.length} симв.). ` +
        `Файл уже такой. Доделай лендинг в ДРУГИХ файлах: layout.tsx, globals.css, components/*. ` +
        `Или измени page.tsx — добавь новые секции/CTA/стили, не копируй read_file.`
      );
    }

    return (
      `«${key}» не изменён — content идентичен файлу. ` +
      `Не повторяй write_file с тем же текстом. Добавь реальный JSX/стили или правь layout.tsx / globals.css.`
    );
  }

  isPatchBlocked(path: string): boolean {
    const key = normalizePath(path);
    return (this.patchFails.get(key) ?? 0) >= 2;
  }

  isWriteBlocked(path: string): boolean {
    const key = normalizePath(path);
    return (this.writeNoopFails.get(key) ?? 0) >= 2;
  }

  patchFailCount(path: string): number {
    const key = normalizePath(path);
    return this.patchFails.get(key) ?? 0;
  }

  writeNoopCount(path: string): number {
    const key = normalizePath(path);
    return this.writeNoopFails.get(key) ?? 0;
  }

  reset(): void {
    this.patchFails.clear();
    this.writeNoopFails.clear();
    this.lastNoopFingerprint.clear();
  }
}

const guardsByWorkspace = new Map<string, AgentPathEditGuard>();

export function pathEditGuardForWorkspace(workspaceRoot: string): AgentPathEditGuard {
  const key = workspaceRoot.trim();
  let guard = guardsByWorkspace.get(key);
  if (!guard) {
    guard = new AgentPathEditGuard();
    guardsByWorkspace.set(key, guard);
  }
  return guard;
}

export function resetPathEditGuard(workspaceRoot: string): void {
  guardsByWorkspace.get(workspaceRoot.trim())?.reset();
}
