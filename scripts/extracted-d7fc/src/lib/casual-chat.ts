/** Сообщение без явной задачи — привет, «ку» и т.п. */
export function isCasualOnlyUserMessage(content: string): boolean {
  const text = content.trim();
  if (!text || text.length > 100) return false;

  if (
    /\b(создай|сделай|напиши|исправ|добав|удали|запусти|npm|npx|файл|папк|сайт|лендинг|проект|скрипт|баг|ошибк|fix|create|build|write|run|code)\b/ui.test(
      text
    )
  ) {
    return false;
  }

  if (
    /^(привет|приветик|ку|куку|здаров|здарова|здравствуй|hi|hello|hey|салют|хай|йо|yo|добрый\s+(день|вечер|утро)|как\s+дела|чё\s+как|чо\s+как)(?:[!.,?…\s]|$)/iu.test(
      text
    )
  ) {
    return true;
  }

  return text.length <= 12 && !/\d/.test(text) && !/[\\/]/.test(text);
}
