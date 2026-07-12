export type ParsedCodeError = {
  file: string;
  line?: number;
  message: string;
  kind: "css" | "typescript" | "other";
};

function normalizeErrorPath(raw: string): string {
  const trimmed = raw.replace(/\\/g, "/").trim();
  const srcIdx = trimmed.toLowerCase().indexOf("/src/");
  if (srcIdx >= 0) return trimmed.slice(srcIdx + 1);
  return trimmed.replace(/^\.\//, "");
}

function dedupeErrors(errors: ParsedCodeError[]): ParsedCodeError[] {
  const seen = new Set<string>();
  const out: ParsedCodeError[] = [];
  for (const item of errors) {
    const key = `${item.file}:${item.line ?? 0}:${item.message.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function parseCodeErrorsFromOutput(text: string): ParsedCodeError[] {
  const errors: ParsedCodeError[] = [];
  const combined = text;

  const patterns: Array<{
    re: RegExp;
    kind: ParsedCodeError["kind"];
  }> = [
    {
      re: /([^\s"'():]+\.(?:css|scss|sass)):(\d+)(?::\d+)?[^:\n]*(?:Unclosed block|CssSyntaxError|SyntaxError)/gi,
      kind: "css",
    },
    {
      re: /CssSyntaxError:[^\n]*?([^\s"'():]+\.(?:css|scss|sass)):(\d+)/gi,
      kind: "css",
    },
    {
      re: /Unclosed block[^\n]*/gi,
      kind: "css",
    },
    {
      re: /error TS(\d+):[^\n]*/gi,
      kind: "typescript",
    },
    {
      re: /Failed to compile[^\n]*/gi,
      kind: "other",
    },
  ];

  for (const { re, kind } of patterns) {
    for (const match of combined.matchAll(re)) {
      const file = match[1] ? normalizeErrorPath(match[1]) : undefined;
      const line = match[2] ? Number.parseInt(match[2], 10) : undefined;
      errors.push({
        file: file ?? "unknown",
        line: Number.isFinite(line) ? line : undefined,
        message: match[0].trim().slice(0, 240),
        kind,
      });
    }
  }

  const fileLineRe =
    /([^\s"'():]+\.(?:css|scss|sass|tsx?|jsx?)):(\d+)(?::\d+)?/gi;
  for (const match of combined.matchAll(fileLineRe)) {
    const start = Math.max(0, match.index ?? 0);
    const context = combined.slice(start, start + 200);
    if (!/error|failed|syntax|unclosed|⨯/i.test(context)) continue;
    errors.push({
      file: normalizeErrorPath(match[1]!),
      line: Number.parseInt(match[2]!, 10),
      message: context.trim().slice(0, 240),
      kind: /\.css|\.scss|\.sass/i.test(match[1]!) ? "css" : "other",
    });
  }

  return dedupeErrors(errors);
}

export function userIntentMentionsCodeError(userIntent: string): boolean {
  return /CssSyntaxError|Unclosed block|failed to compile|syntax error|error TS\d+/i.test(
    userIntent
  );
}

export function parseCodeErrorsFromUserIntent(userIntent: string): ParsedCodeError[] {
  return parseCodeErrorsFromOutput(userIntent);
}

export function analyzeCommandOutput(input: {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  userIntent?: string;
}): { success: boolean; errors: ParsedCodeError[]; agentNote: string } {
  const combined = `${input.stdout}\n${input.stderr}`;
  const errors = parseCodeErrorsFromOutput(combined);
  const intentErrors = input.userIntent
    ? parseCodeErrorsFromUserIntent(input.userIntent)
    : [];
  const merged = dedupeErrors([...errors, ...intentErrors]);

  const exitFailed =
    input.exitCode !== null && input.exitCode !== 0;
  const outputFailed =
    /failed to compile|CssSyntaxError|⨯\s+\.\/|compilation failed|ELIFECYCLE/i.test(
      combined
    );
  const hasCss = merged.some((item) => item.kind === "css");
  const intentStillBroken =
    Boolean(input.userIntent) &&
    userIntentMentionsCodeError(input.userIntent!) &&
    !hasCss &&
    !outputFailed &&
    !exitFailed;

  const success = !exitFailed && !outputFailed && !hasCss && !intentStillBroken;

  if (success) {
    if (/non-standard\s+"NODE_ENV"/i.test(combined)) {
      return {
        success: true,
        errors: merged,
        agentNote:
          "⚠️ Предупреждение NODE_ENV — не цель исправления, если пользователь жаловался на CSS/страницу. " +
          "Если лендинг всё ещё падает — read_file файл из ошибки пользователя и правь синтаксис.",
      };
    }
    return { success: true, errors: merged, agentNote: "" };
  }

  const primary = merged[0];
  if (primary) {
    const lineHint = primary.line
      ? `строка ${primary.line} (прочитай ±15 строк вокруг)`
      : "найди строку из ошибки";
    return {
      success: false,
      errors: merged,
      agentNote:
        `🔴 СБОРКА/СТИЛИ НЕ ИСПРАВЛЕНЫ. Игнорируй NODE_ENV — это не причина.\n` +
        `Файл: ${primary.file}, ${lineHint}.\n` +
        `Проблема: ${primary.message}\n` +
        `Действие: read_file → найди незакрытый блок { } → search_replace с ТОЧНЫМ текстом из read_file (с номерами строк) или write_file хвост файла.`,
    };
  }

  if (intentStillBroken) {
    const fromUser = intentErrors[0];
    return {
      success: false,
      errors: intentErrors,
      agentNote:
        `🔴 npm run build завершился без ошибки, но пользователь прислал CssSyntaxError — dev всё ещё сломан.\n` +
        (fromUser
          ? `Исправь ${fromUser.file}${fromUser.line ? ` около строки ${fromUser.line}` : ""}: незакрытый CSS-блок. read_file → правка → build снова.`
          : "read_file globals.css, закрой незакрытые { }."),
    };
  }

  return {
    success: false,
    errors: merged,
    agentNote:
      `🔴 Команда завершилась с ошибкой (exit ${input.exitCode ?? "?"}). ` +
      "Исправь причину в stdout/stderr, не запускай build снова без правки файлов.",
  };
}
