import type { ChatImageAttachment } from "@/types";

export const MAX_CHAT_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const ALLOWED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function isAllowedMediaType(value: string): value is ChatImageAttachment["mediaType"] {
  return ALLOWED_MEDIA_TYPES.has(value);
}

export async function fileToChatImage(file: File): Promise<ChatImageAttachment | null> {
  if (!isAllowedMediaType(file.type)) return null;
  if (file.size > MAX_IMAGE_BYTES) return null;

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("invalid image"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });

  return {
    mediaType: file.type,
    base64,
    name: file.name || undefined,
  };
}

export async function readClipboardImages(
  clipboard: DataTransfer
): Promise<ChatImageAttachment[]> {
  const files: File[] = [];

  if (clipboard.files?.length) {
    for (const file of clipboard.files) {
      if (file.type.startsWith("image/")) files.push(file);
    }
  }

  for (const item of clipboard.items ?? []) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }

  const unique = new Map<string, File>();
  for (const file of files) {
    unique.set(`${file.name}:${file.size}:${file.type}`, file);
  }

  const images: ChatImageAttachment[] = [];
  for (const file of unique.values()) {
    const image = await fileToChatImage(file);
    if (image) images.push(image);
  }

  return images;
}
