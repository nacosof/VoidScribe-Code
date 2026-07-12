import { createId } from "@/lib/chat-sessions";
import type { ChatImage } from "@/types";
export const MAX_CHAT_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
]);
function isAllowedImageFile(file: File): boolean {
    return ALLOWED_MEDIA_TYPES.has(file.type) || file.type.startsWith("image/");
}
export async function fileToChatImage(file: File): Promise<ChatImage | null> {
    if (!isAllowedImageFile(file))
        return null;
    if (file.size > MAX_IMAGE_BYTES)
        return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("invalid image"));
                return;
            }
            resolve(result);
        };
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(file);
    });
    return {
        id: createId(),
        name: file.name || "image",
        dataUrl,
        mediaType: file.type || "image/png",
    };
}
export async function readClipboardImages(clipboard: DataTransfer): Promise<ChatImage[]> {
    const files: File[] = [];
    if (clipboard.files?.length) {
        for (const file of clipboard.files) {
            if (isAllowedImageFile(file))
                files.push(file);
        }
    }
    for (const item of clipboard.items ?? []) {
        if (!item.type.startsWith("image/"))
            continue;
        const file = item.getAsFile();
        if (file)
            files.push(file);
    }
    const unique = new Map<string, File>();
    for (const file of files) {
        unique.set(`${file.name}:${file.size}:${file.type}`, file);
    }
    const images: ChatImage[] = [];
    for (const file of unique.values()) {
        const image = await fileToChatImage(file);
        if (image)
            images.push(image);
    }
    return images;
}
export async function readDroppedImageFiles(dataTransfer: DataTransfer): Promise<ChatImage[]> {
    const files = [...(dataTransfer.files ?? [])].filter(isAllowedImageFile);
    const images: ChatImage[] = [];
    for (const file of files) {
        const image = await fileToChatImage(file);
        if (image)
            images.push(image);
    }
    return images;
}
export function mergeChatImages(current: ChatImage[], next: ChatImage[]): ChatImage[] {
    const merged = [...current];
    for (const image of next) {
        if (merged.length >= MAX_CHAT_IMAGES)
            break;
        if (merged.some((item) => item.dataUrl === image.dataUrl))
            continue;
        merged.push(image);
    }
    return merged;
}
