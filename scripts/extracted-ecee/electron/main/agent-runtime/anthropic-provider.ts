import {
  buildAgentActionNudge,
  buildTruncationNudge,
} from "../agent-reliability";
import {
  resolveAnthropicMaxTokens,
  resolveRequestTimeoutMs,
  type AiRuntimeSettings,
} from "../ai";
import { AGENT_TOOLS, type OpenAiMessage } from "../agent-tools";
import { toAnthropicToolResultContent } from "../agent-tool-result";
import { sortToolsForExecution } from "../agent-tool-order";
import type { AgentToolResult } from "../agent-tool-result";
import type {
  AgentSchedulerProvider,
  ChatTurn,
  SchedulerModelStep,
} from "./provider-types";
import type { AgentToolBatchResult, AgentToolCallRequest } from "./tool-batch";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type AnthropicTextBlock = { type: "text"; text: string };

type AnthropicImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    data: string;
  };
};

type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string | AnthropicContentBlock[];
};

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

function getAnthropicAgentTools(): AnthropicTool[] {
  return AGENT_TOOLS.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? "",
    input_schema: (tool.function.parameters ?? {
      type: "object",
      properties: {},
    }) as Record<string, unknown>,
  }));
}

function openAiContentToAnthropic(
  content: OpenAiMessage["content"]
): string | AnthropicContentBlock[] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const blocks: AnthropicContentBlock[] = [];
  for (const part of content) {
    if (part.type === "text" && part.text) {
      blocks.push({ type: "text", text: part.text });
      continue;
    }
    if (part.type === "image_url") {
      const url =
        typeof part.image_url === "string"
          ? part.image_url
          : part.image_url?.url;
      if (!url) continue;
      const match = /^data:(image\/[^;]+);base64,(.+)$/i.exec(url);
      if (!match) continue;
      const mediaType = match[1].toLowerCase();
      if (
        mediaType !== "image/png" &&
        mediaType !== "image/jpeg" &&
        mediaType !== "image/webp" &&
        mediaType !== "image/gif"
      ) {
        continue;
      }
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: match[2],
        },
      });
    }
  }

  return blocks.length > 0 ? blocks : "";
}

export function splitAgentMessages(messages: OpenAiMessage[]): {
  system: string;
  messages: AnthropicMessage[];
} {
  let system = "";
  const out: AnthropicMessage[] = [];

  const flushToolResults = (blocks: AnthropicToolResultBlock[]) => {
    if (!blocks.length) return;
    out.push({ role: "user", content: blocks });
  };

  let pendingToolResults: AnthropicToolResultBlock[] = [];

  for (const msg of messages) {
    if (msg.role === "system" && typeof msg.content === "string") {
      system = msg.content;
      continue;
    }

    if (msg.role === "tool") {
      const toolMsg = msg as {
        role: "tool";
        tool_call_id: string;
        content: string;
      };
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: toolMsg.tool_call_id,
        content: toolMsg.content,
      });
      continue;
    }

    flushToolResults(pendingToolResults);
    pendingToolResults = [];

    if (msg.role === "assistant") {
      const assistantMsg = msg as OpenAiMessage & {
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
      };

      if (assistantMsg.tool_calls?.length) {
        const blocks: AnthropicContentBlock[] = [];
        const textContent = assistantMsg.content;
        if (typeof textContent === "string" && textContent.trim()) {
          blocks.push({ type: "text", text: textContent });
        } else if (Array.isArray(textContent)) {
          for (const part of textContent) {
            if (part.type === "text" && part.text?.trim()) {
              blocks.push({ type: "text", text: part.text });
            }
          }
        }

        for (const call of assistantMsg.tool_calls) {
          if (call.type !== "function") continue;
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(call.function.arguments || "{}") as Record<
              string,
              unknown
            >;
          } catch {
            input = {};
          }
          blocks.push({
            type: "tool_use",
            id: call.id,
            name: call.function.name,
            input,
          });
        }

        out.push({ role: "assistant", content: blocks });
        continue;
      }

      const content = openAiContentToAnthropic(msg.content ?? "");
      out.push({ role: "assistant", content });
      continue;
    }

    if (msg.role === "user") {
      const content = openAiContentToAnthropic(msg.content ?? "");
      out.push({ role: "user", content });
    }
  }

  flushToolResults(pendingToolResults);

  return { system, messages: out };
}

async function callAnthropic(input: {
  apiKey: string;
  model: string;
  system: string;
  messages: AnthropicMessage[];
  maxOutputTokens?: number;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<{
  content: AnthropicContentBlock[];
  stop_reason: string | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  if (input.signal) {
    if (input.signal.aborted) {
      clearTimeout(timer);
      throw new DOMException("Aborted", "AbortError");
    }
    input.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey.trim(),
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: resolveAnthropicMaxTokens(input.maxOutputTokens),
        system: input.system,
        tools: getAnthropicAgentTools(),
        messages: input.messages,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      content?: AnthropicContentBlock[];
      stop_reason?: string | null;
    };

    if (!res.ok) {
      throw new Error(data.error?.message || `Anthropic ${res.status}`);
    }

    return {
      content: data.content ?? [],
      stop_reason: data.stop_reason ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type AnthropicSchedulerProviderOptions = {
  settings: AiRuntimeSettings;
  openAiMessages: OpenAiMessage[];
  projectMature: boolean;
};

export function createAnthropicSchedulerProvider(
  options: AnthropicSchedulerProviderOptions
): AgentSchedulerProvider {
  const { settings, projectMature } = options;
  const split = splitAgentMessages(options.openAiMessages);
  const system = split.system;
  const messages = split.messages;
  const requestTimeoutMs = resolveRequestTimeoutMs(settings);
  let lastAssistantContent: AnthropicContentBlock[] = [];

  return {
    getMessages(): ChatTurn[] {
      return messages as ChatTurn[];
    },

    preferTools(): boolean {
      return false;
    },

    async completeModelStep(input): Promise<SchedulerModelStep> {
      const response = await callAnthropic({
        apiKey: settings.apiKey,
        model: settings.model,
        system,
        messages,
        maxOutputTokens: settings.maxOutputTokens,
        timeoutMs: requestTimeoutMs,
        signal: input.signal,
      });

      lastAssistantContent = response.content;
      const toolUses = response.content.filter(
        (block): block is AnthropicToolUseBlock => block.type === "tool_use"
      );
      const text = response.content
        .filter((block): block is AnthropicTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const stopReason = response.stop_reason;
      const truncated =
        stopReason === "max_tokens" || stopReason === "length";

      const toolCalls: AgentToolCallRequest[] = sortToolsForExecution(
        toolUses
      ).map((toolUse) => ({
        id: toolUse.id,
        name: toolUse.name,
        arguments: JSON.stringify(toolUse.input ?? {}),
      }));

      return {
        visibleText: text,
        toolCalls,
        finishReason: stopReason,
        truncatedOutput: truncated,
        truncatedPath: null,
      };
    },

    recordAssistantToolStep() {
      messages.push({ role: "assistant", content: lastAssistantContent });
    },

    recordToolBatchResults(results: AgentToolBatchResult[]) {
      const toolResults: AnthropicToolResultBlock[] = results.map(
        ({ call, result }) => ({
          type: "tool_result",
          tool_use_id: call.id,
          content: toAnthropicToolResultContent(result as AgentToolResult),
        })
      );
      messages.push({ role: "user", content: toolResults });
    },

    recordAssistantTextForNudge() {
      messages.push({ role: "assistant", content: lastAssistantContent });
    },

    recordNudgeUserMessage(step) {
      messages.push({
        role: "user",
        content: step.truncatedOutput
          ? buildTruncationNudge()
          : buildAgentActionNudge(messages as ChatTurn[], { projectMature }),
      });
    },
  };
}
