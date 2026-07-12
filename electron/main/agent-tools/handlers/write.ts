import {
    readWorkspaceFileIfExists,
    resolveAgentRelativePath,
    WorkspaceError,
} from "../../workspace";
import { recordFileSnapshot } from "../../file-history";
import { validateWriteFile } from "../../agent-workspace";
import {
    pathEditGuardForWorkspace,
    userIntentRequestsCreate,
    userIntentRequestsFileChange,
} from "../../agent-path-edit-guard";
import { stripAgentPastedLineNumbers } from "../../build-diagnostics";
import { toolText, type AgentToolResult } from "../../agent-tool-result";
import { emitToolEvent, type ToolExecutionContext } from "../context";
import {
    clampWriteFileContent,
    countOccurrences,
    MAX_WRITE_FILE_LINES,
    normalizeWriteContent,
    readStringArg,
} from "../utils";

export async function handleWriteFile(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const path = await validateWriteFile(ctx.workspaceRoot, readStringArg(ctx.args, "path"));
    const pathGuard = pathEditGuardForWorkspace(ctx.workspaceRoot);
    if (pathGuard.isWriteBlocked(path)) {
        throw new WorkspaceError(`write_file на «${path}» заблокирован (${pathGuard.writeNoopCount(path)}× один и тот же текст). Измени код или остановись.`);
    }
    let content = stripAgentPastedLineNumbers(normalizeWriteContent(ctx.args));
    const clamped = clampWriteFileContent(content);
    content = clamped.content;
    const diskContent = await readWorkspaceFileIfExists(ctx.workspaceRoot, path);
    const effectivePrevious = await ctx.overlay.readEffective(ctx.workspaceRoot, path);
    if (effectivePrevious === null && content.trim().length === 0) {
        if (userIntentRequestsCreate(ctx.userIntent)) {
            content = path.endsWith(".ts") || path.endsWith(".tsx")
                ? "export {}\n"
                : path.endsWith(".py")
                    ? "\n"
                    : "\n";
        }
        else {
            throw new WorkspaceError("Пустой content в write_file — передай полный код в поле JSON «content» (не contents/body). Не дублируй код в чат.");
        }
    }
    if (effectivePrevious !== null && content.trim().length === 0) {
        throw new WorkspaceError("Пустой content — файл не изменён. Передай полное содержимое в поле JSON «content».");
    }
    if (effectivePrevious !== null && effectivePrevious === content) {
        const noopCount = pathGuard.recordWriteNoopFail(path, content);
        if (pathGuard.isWriteBlocked(path)) {
            throw new WorkspaceError(`write_file «${path}» заблокирован после ${noopCount} попыток с тем же текстом. Остановись.`);
        }
        const wantsChange = userIntentRequestsFileChange(ctx.userIntent);
        throw new WorkspaceError(wantsChange
            ? `Файл «${path}» не изменён — ты отправил тот же текст, что уже в файле. ` +
                `Пользователь просит изменить («${ctx.userIntent.slice(0, 100)}»). ` +
                `Для точечной замены (FastAPI→REST и т.п.) используй search_replace с old_string/new_string. ` +
                `Иначе write_file с полным НОВЫМ кодом — не копируй приложенный текст дословно. ` +
                `delete_path запрещён — не удаляй и не пересоздавай файл.`
            : `Файл «${path}» уже содержит этот код (${content.length} симв.). Измени content, используй search_replace или остановись.`);
    }
    if (diskContent !== null) {
        await recordFileSnapshot(ctx.workspaceRoot, path, diskContent, "agent");
    }
    const change = ctx.overlay.stage(path, content, diskContent);
    await ctx.overlay.flushPath(ctx.workspaceRoot, path);
    pathGuard.recordWriteSuccess(path);
    emitToolEvent(ctx, {
        type: "file_change",
        path,
        kind: change.kind,
        previousContent: change.previousContent,
        newContent: change.newContent,
        staged: true,
    });
    let resultText = `Файл записан: ${path} (${content.length} символов)`;
    if (clamped.autoTruncated) {
        resultText +=
            `\n⚠️ Было ${clamped.originalLines} строк — записаны первые ${MAX_WRITE_FILE_LINES}. ` +
            `read_file «${path}» и допиши остальное через write_file.`;
    }
    return toolText(resultText);
}

export async function handleSearchReplace(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const path = resolveAgentRelativePath(ctx.workspaceRoot, readStringArg(ctx.args, "path"));
    const oldString = readStringArg(ctx.args, "old_string", "oldString");
    const newString = readStringArg(ctx.args, "new_string", "newString");
    const diskContent = await readWorkspaceFileIfExists(ctx.workspaceRoot, path);
    const current = ctx.overlay.getEffectiveContent(path, diskContent);
    if (current === null)
        throw new WorkspaceError("Файл не найден.");
    if (!oldString) {
        if (!current.trim()) {
            throw new WorkspaceError("Файл пустой — используй write_file с полным содержимым, не search_replace.");
        }
        throw new WorkspaceError("old_string пустой.");
    }
    if (oldString === newString)
        throw new WorkspaceError("new_string должен отличаться от old_string.");
    const matches = countOccurrences(current, oldString);
    if (matches !== 1)
        throw new WorkspaceError(`old_string найден ${matches} раз; нужен ровно 1.`);
    if (diskContent !== null)
        await recordFileSnapshot(ctx.workspaceRoot, path, diskContent, "agent");
    const next = current.replace(oldString, newString);
    const change = ctx.overlay.stage(path, next, diskContent);
    await ctx.overlay.flushPath(ctx.workspaceRoot, path);
    emitToolEvent(ctx, {
        type: "file_change",
        path,
        kind: change.kind,
        previousContent: change.previousContent,
        newContent: change.newContent,
        staged: true,
    });
    return toolText(`Updated replace in ${path}`);
}
