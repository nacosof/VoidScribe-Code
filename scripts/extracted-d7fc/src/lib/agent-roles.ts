export const PREDEFINED_ROLE_IDS = [
  "developer",
  "designer",
  "qa",
  "writer",
] as const;

export type PredefinedRoleId = (typeof PREDEFINED_ROLE_IDS)[number];
export type AgentRoleType = PredefinedRoleId | "custom";

export const BASE_VOIDSCRIBE_PROMPT = `Ты VoidScribe Code — локальный AI-ассистент для разработки.
Помогай писать, чинить и объяснять код. Отвечай по-русски, если пользователь пишет по-русски.
Будь конкретным: предлагай готовые фрагменты кода, шаги и команды.
Если не хватает контекста — задай уточняющий вопрос.`;

export const PREDEFINED_AGENT_ROLES: Record<
  PredefinedRoleId,
  { label: string; prompt: string }
> = {
  developer: {
    label: "Разработчик",
    prompt:
      "Ты — один из лучших разработчиков программного обеспечения. Пишешь чистый и поддерживаемый код, предлагаешь продуманные архитектурные решения, быстро находишь и исправляешь ошибки и объясняешь технические детали понятно.",
  },
  designer: {
    label: "Дизайнер",
    prompt:
      "Ты — талантливый UI/UX дизайнер. Помогаешь с визуальной концепцией, компоновкой, цветами, типографикой и пользовательскими сценариями. Даёшь конкретные рекомендации по интерфейсу и опыту пользователя.",
  },
  qa: {
    label: "QA / Тестировщик",
    prompt:
      "Ты — внимательный QA-инженер. Находишь баги, составляешь тест-кейсы, проверяешь граничные случаи и помогаешь повысить качество и надёжность продукта.",
  },
  writer: {
    label: "Копирайтер",
    prompt:
      "Ты — сильный технический копирайтер. Пишешь ясные и точные тексты: документацию, README, release notes, подсказки в интерфейсе и описания функций.",
  },
};

export const AGENT_ROLE_OPTIONS: { value: AgentRoleType; label: string }[] = [
  ...PREDEFINED_ROLE_IDS.map((id) => ({
    value: id,
    label: PREDEFINED_AGENT_ROLES[id].label,
  })),
  { value: "custom", label: "Своя роль" },
];

export function isAgentRoleType(value: unknown): value is AgentRoleType {
  return (
    typeof value === "string" &&
    (PREDEFINED_ROLE_IDS.includes(value as PredefinedRoleId) ||
      value === "custom")
  );
}

export function getRoleLabel(
  roleType: AgentRoleType,
  customRoleName?: string
): string {
  if (roleType === "custom") {
    const name = customRoleName?.trim();
    return name || "Своя роль";
  }
  return PREDEFINED_AGENT_ROLES[roleType].label;
}

export function resolvePresetSystemPrompt(input: {
  roleType: AgentRoleType;
  customRolePrompt?: string;
  basePrompt?: string;
}): string {
  const base = (input.basePrompt?.trim() || BASE_VOIDSCRIBE_PROMPT).trim();

  if (input.roleType === "custom") {
    const custom = input.customRolePrompt?.trim();
    return custom ? `${base}\n\n${custom}` : base;
  }

  const rolePrompt = PREDEFINED_AGENT_ROLES[input.roleType]?.prompt;
  return rolePrompt ? `${base}\n\n${rolePrompt}` : base;
}
