import type { UserAiProviderId } from "./providers";

const VISION_MODEL_RE =
  /pixtral|gpt-4o|gpt-4\.1|gpt-4-turbo|o[134]-|vision|llava|bakllava|moondream|minicpm-v|qwen2\.?5?-vl|qwen-vl|internvl|glm-4v|gemini|claude-3|claude-sonnet|claude-opus|claude-haiku/i;

/** Эвристика: поддерживает ли модель image_url / vision в чате. */
export function modelSupportsVision(
  provider: UserAiProviderId,
  model: string
): boolean {
  const id = model.trim().toLowerCase();
  if (!id) return false;

  if (provider === "mistral") {
    return /pixtral/i.test(id);
  }

  if (provider === "anthropic") {
    return /claude/i.test(id);
  }

  if (provider === "gemini") {
    return true;
  }

  if (provider === "openai") {
    return /gpt-4|gpt-5|o[134]|vision/i.test(id);
  }

  if (provider === "openrouter" || provider === "genapi") {
    return VISION_MODEL_RE.test(id);
  }

  if (provider === "ollama" || provider === "lmstudio") {
    return VISION_MODEL_RE.test(id);
  }

  if (provider === "openai_compatible") {
    return VISION_MODEL_RE.test(id);
  }

  return VISION_MODEL_RE.test(id);
}

export function visionModelHint(provider: UserAiProviderId): string {
  if (provider === "mistral") {
    return "pixtral-12b-2409 или pixtral-large-latest";
  }
  if (provider === "openai") {
    return "gpt-4o";
  }
  if (provider === "anthropic") {
    return "claude-sonnet";
  }
  if (provider === "gemini") {
    return "gemini-2.0-flash";
  }
  return "модель с поддержкой vision";
}

export function buildVisionUnsupportedNote(
  imageCount: number,
  provider: UserAiProviderId
): string {
  const hint = visionModelHint(provider);
  const noun =
    imageCount === 1
      ? "изображение (скриншот)"
      : `изображения (${imageCount} шт.)`;
  return (
    `[Прикреплено ${noun}, но текущая модель не поддерживает vision — в API картинка не отправлена. ` +
    `Опишите содержимое текстом или смените модель, например ${hint}.]`
  );
}
