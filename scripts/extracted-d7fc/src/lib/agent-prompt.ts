/** Компактные правила агента — общие для main и оценки контекста в UI. */
export const AGENT_WORKSPACE_RULES = `Workspace: только открытая папка, без ../. Перед правками — list/read при нужде. Откат — list_file_history → restore_file.`;

export const AGENT_SHELL_RULES = `run_command: cwd=. или подпапка. Win PS: «;» вместо &&. Без rm -rf / rmdir /s на корне.`;

export const AGENT_RUNTIME_RULES = `Режим агента: задачи — tools (write_file, run_command, read_file…), не план без вызова tools. Код в файлы, не в чат. «Давай/продолжай» — сразу tools.
${AGENT_WORKSPACE_RULES}
${AGENT_SHELL_RULES}
Ошибки команд — stderr/stdout → read/write → повтор. [Контекст — файл/папка] — сначала read/list по путям.`;

export function buildAgentSystemPrompt(
  personaPrompt: string,
  workspacePath: string
): string {
  const workspace = workspacePath.trim();
  const persona = personaPrompt.trim();
  if (!workspace) {
    return `${persona}\n\n${AGENT_RUNTIME_RULES}`;
  }
  return `${persona}\n\n${AGENT_RUNTIME_RULES}\n\nПапка: ${workspace}`;
}
