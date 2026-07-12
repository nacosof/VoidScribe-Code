import { isCasualOnlyUserMessage } from "./casual-chat";

/** Пользователь явно просил задачу по проекту (любой стек). */
export function userExplicitlyRequestedProjectWork(text: string): boolean {
  const t = text.trim();
  if (!t || isCasualOnlyUserMessage(t)) return false;

  if (
    /\b(создай|сделай|разверни|инициализ|сгенерируй|собери|напиши|добавь|implement|create|scaffold|init|setup|build|deploy|install|запусти|run)\b/ui.test(
      t
    ) &&
    /\b(проект|сайт|приложен|app|project|лендинг|скрипт|файл|модул|программ|код|api|backend|frontend|библиотек|пакет|зависимост)\b/ui.test(
      t
    )
  ) {
    return true;
  }

  return false;
}

/** Команда инициализации нового проекта (любой экосистемы). */
export function isProjectBootstrapCommand(command: string): boolean {
  return (
    /npm create\s|pnpm create\s|yarn create\s|npm init\b|npx\s+create-/i.test(
      command
    ) ||
    /\b(cargo init|django-admin startproject|flutter create|dotnet new|poetry new|mix new|rails new|go mod init)\b/i.test(
      command
    )
  );
}
