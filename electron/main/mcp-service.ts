import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
export type McpServerConfig = {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    disabled?: boolean;
};
export type McpConfigFile = {
    mcpServers?: Record<string, McpServerConfig>;
};
type McpToolEntry = {
    serverName: string;
    toolName: string;
    description: string;
    inputSchema: Record<string, unknown>;
};
const MCP_TOOL_PREFIX = "mcp__";
let cachedTools: ChatCompletionTool[] = [];
let cachedEntries: McpToolEntry[] = [];
let lastRefresh = 0;
export function mcpConfigPath(): string {
    return join(homedir(), ".voidscribe", "mcp.json");
}
export async function readMcpConfig(): Promise<McpConfigFile> {
    try {
        const raw = await readFile(mcpConfigPath(), "utf8");
        return JSON.parse(raw) as McpConfigFile;
    }
    catch {
        return { mcpServers: {} };
    }
}
function toOpenAiTool(entry: McpToolEntry): ChatCompletionTool {
    const name = `${MCP_TOOL_PREFIX}${entry.serverName}__${entry.toolName}`;
    return {
        type: "function",
        function: {
            name,
            description: `[MCP ${entry.serverName}] ${entry.description}`,
            parameters: entry.inputSchema,
        },
    };
}
export function getMcpToolsForAgent(): ChatCompletionTool[] {
    return cachedTools;
}
export function isMcpToolName(name: string): boolean {
    return name.startsWith(MCP_TOOL_PREFIX);
}
function parseMcpToolName(name: string): {
    serverName: string;
    toolName: string;
} {
    const body = name.slice(MCP_TOOL_PREFIX.length);
    const split = body.indexOf("__");
    if (split < 1) {
        throw new Error(`Invalid MCP tool name: ${name}`);
    }
    return {
        serverName: body.slice(0, split),
        toolName: body.slice(split + 2),
    };
}
export async function refreshMcpTools(force = false): Promise<ChatCompletionTool[]> {
    const now = Date.now();
    if (!force && now - lastRefresh < 30000 && cachedTools.length) {
        return cachedTools;
    }
    const config = await readMcpConfig();
    const servers = config.mcpServers ?? {};
    const nextTools: ChatCompletionTool[] = [];
    const nextEntries: McpToolEntry[] = [];
    for (const [serverName, server] of Object.entries(servers)) {
        if (!server?.command || server.disabled)
            continue;
        let client: Client | null = null;
        let transport: StdioClientTransport | null = null;
        try {
            transport = new StdioClientTransport({
                command: server.command,
                args: server.args ?? [],
                env: { ...process.env, ...(server.env ?? {}) } as Record<string, string>,
            });
            client = new Client({ name: "voidscribe", version: "0.1.0" });
            await client.connect(transport);
            const listed = await client.listTools();
            for (const tool of listed.tools) {
                const entry: McpToolEntry = {
                    serverName,
                    toolName: tool.name,
                    description: tool.description ?? tool.name,
                    inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {
                        type: "object",
                        properties: {},
                    },
                };
                nextEntries.push(entry);
                nextTools.push(toOpenAiTool(entry));
            }
        }
        catch {
        }
        finally {
            try {
                await client?.close();
            }
            catch {
            }
            try {
                await transport?.close();
            }
            catch {
            }
        }
    }
    cachedTools = nextTools;
    cachedEntries = nextEntries;
    lastRefresh = now;
    return cachedTools;
}
export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
    const { serverName, toolName } = parseMcpToolName(name);
    const config = await readMcpConfig();
    const server = config.mcpServers?.[serverName];
    if (!server?.command || server.disabled) {
        throw new Error(`MCP server «${serverName}» not configured.`);
    }
    const transport = new StdioClientTransport({
        command: server.command,
        args: server.args ?? [],
        env: { ...process.env, ...(server.env ?? {}) } as Record<string, string>,
    });
    const client = new Client({ name: "voidscribe", version: "0.1.0" });
    try {
        await client.connect(transport);
        const result = await client.callTool({ name: toolName, arguments: args });
        const chunks = Array.isArray(result.content) ? result.content : [];
        const text = chunks
            .map((item: {
            type?: string;
            text?: string;
        }) => {
            if (item?.type === "text" && typeof item.text === "string") {
                return item.text;
            }
            return JSON.stringify(item);
        })
            .filter(Boolean)
            .join("\n");
        return text || JSON.stringify(result);
    }
    finally {
        try {
            await client.close();
        }
        catch {
        }
        try {
            await transport.close();
        }
        catch {
        }
    }
}
export async function listMcpServersStatus(): Promise<Array<{
    name: string;
    toolCount: number;
    disabled: boolean;
}>> {
    await refreshMcpTools(true);
    const config = await readMcpConfig();
    const servers = config.mcpServers ?? {};
    const counts = new Map<string, number>();
    for (const entry of cachedEntries) {
        counts.set(entry.serverName, (counts.get(entry.serverName) ?? 0) + 1);
    }
    return Object.keys(servers).map((name) => ({
        name,
        toolCount: counts.get(name) ?? 0,
        disabled: Boolean(servers[name]?.disabled),
    }));
}
