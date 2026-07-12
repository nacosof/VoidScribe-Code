import { analyzeCommandOutput, isMissingNodeModulesBuildError, isProductionBuildCommand } from "../../build-diagnostics";
import { hasNodeModules, resolveNpmProjectCwd, withAgentDevServerPort } from "../../npm-project-cwd";
import { isDevServerCommand, runWorkspaceCommand } from "../../terminal";
import { validateAgentCommand, validateAgentCwd } from "../../agent-workspace";
import { appendMirrorOutputForWorkspace } from "../../pty-manager";
import { toolText, type AgentToolResult } from "../../agent-tool-result";
import { emitToolEvent, type ToolExecutionContext } from "../context";
import { readStringArg } from "../utils";

type CommandRun = Awaited<ReturnType<typeof runWorkspaceCommand>>;

async function runWithStreams(ctx: ToolExecutionContext, command: string, cwd: string): Promise<CommandRun> {
    return runWorkspaceCommand(ctx.workspaceRoot, command, cwd, {
        signal: ctx.signal,
        onStdout: (text) => {
            appendMirrorOutputForWorkspace(ctx.workspaceRoot, text);
            emitToolEvent(ctx, { type: "console_output", text, stream: "stdout" });
        },
        onStderr: (text) => {
            appendMirrorOutputForWorkspace(ctx.workspaceRoot, `\x1b[31m${text}\x1b[0m`);
            emitToolEvent(ctx, { type: "console_output", text, stream: "stderr" });
        },
    });
}

function formatRunResult(cwdResolutionNote: string, run: CommandRun, flushed: string[], agentNote: string, extraNotes: string[] = []): string {
    return [
        ...extraNotes,
        cwdResolutionNote,
        `cwd: ${run.cwd}`,
        `exit: ${run.exitCode}`,
        flushed.length ? `applied staged files: ${flushed.join(", ")}` : "",
        run.stdout,
        run.stderr,
        agentNote,
    ].filter(Boolean).join("\n");
}

export async function handleRunCommand(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const rawCommand = validateAgentCommand(readStringArg(ctx.args, "command"), ctx.userIntent);
    const requestedCwd = validateAgentCwd(ctx.workspaceRoot, readStringArg(ctx.args, "cwd") || ".");
    const cwdResolution = await resolveNpmProjectCwd(ctx.workspaceRoot, rawCommand, requestedCwd, ctx.overlay.listPaths());
    const cwd = validateAgentCwd(ctx.workspaceRoot, cwdResolution.cwd);
    const portPatch = await withAgentDevServerPort(ctx.workspaceRoot, cwd, rawCommand);
    const command = portPatch.command;
    const flushed = await ctx.overlay.flushAll(ctx.workspaceRoot);
    appendMirrorOutputForWorkspace(ctx.workspaceRoot, `\r\n\x1b[36m> ${command}\x1b[0m\r\n`);
    if (cwdResolution.note) {
        appendMirrorOutputForWorkspace(ctx.workspaceRoot, `\x1b[33m${cwdResolution.note}\x1b[0m\r\n`);
    }
    if (portPatch.note) {
        appendMirrorOutputForWorkspace(ctx.workspaceRoot, `\x1b[33m${portPatch.note}\x1b[0m\r\n`);
    }
    emitToolEvent(ctx, { type: "console_command", command, source: "agent" });

    let run = await runWithStreams(ctx, command, cwd);
    let analysis = analyzeCommandOutput({
        command,
        stdout: run.stdout,
        stderr: run.stderr,
        exitCode: run.exitCode,
        userIntent: ctx.userIntent,
    });
    const extraNotes: string[] = [];
    const combined = `${run.stdout}\n${run.stderr}`;
    const shouldAutoInstall = !analysis.success &&
        (isProductionBuildCommand(command) || isDevServerCommand(command)) &&
        isMissingNodeModulesBuildError(combined) &&
        !(await hasNodeModules(ctx.workspaceRoot, cwd));
    if (shouldAutoInstall) {
        const autoNote = "[VoidScribe] node_modules не найден — автоматически запускаю npm install…";
        extraNotes.push(autoNote);
        appendMirrorOutputForWorkspace(ctx.workspaceRoot, `\r\n\x1b[33m${autoNote}\x1b[0m\r\n`);
        appendMirrorOutputForWorkspace(ctx.workspaceRoot, `\r\n\x1b[36m> npm install\x1b[0m\r\n`);
        emitToolEvent(ctx, { type: "console_command", command: "npm install", source: "agent" });
        await runWithStreams(ctx, "npm install", cwd);
        appendMirrorOutputForWorkspace(ctx.workspaceRoot, `\r\n\x1b[36m> ${command}\x1b[0m\r\n`);
        emitToolEvent(ctx, { type: "console_command", command, source: "agent" });
        run = await runWithStreams(ctx, command, cwd);
        analysis = analyzeCommandOutput({
            command,
            stdout: run.stdout,
            stderr: run.stderr,
            exitCode: run.exitCode,
            userIntent: ctx.userIntent,
        });
    }

    appendMirrorOutputForWorkspace(ctx.workspaceRoot, `\r\n\x1b[90mexit ${run.exitCode ?? "?"}\x1b[0m\r\n`);
    const text = formatRunResult(
        [cwdResolution.note, portPatch.note].filter(Boolean).join("\n"),
        run,
        flushed,
        analysis.agentNote,
        extraNotes,
    );
    return toolText(text, analysis.success);
}

export async function handleReadLintErrors(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const run = await runWorkspaceCommand(ctx.workspaceRoot, "npm run build", ".", { signal: ctx.signal });
    return toolText(`${run.stdout}\n${run.stderr}`.trim() || `exit ${run.exitCode}`, run.exitCode === 0);
}
