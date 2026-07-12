export async function capturePagePreview(url: string): Promise<{
    text: string;
    images?: {
        mediaType: string;
        data: string;
    }[];
}> {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed))
        throw new Error("Укажите http/https URL.");
    const res = await fetch(trimmed);
    const html = await res.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? trimmed;
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
    return { text: `URL: ${trimmed}\nTitle: ${title}\n\n${text}` };
}
