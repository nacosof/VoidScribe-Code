export function stripAnsi(text: string): string {
    return text
        .replace(/\x1b\[[0-9;]*m/g, "")
        .replace(/\x1b\][^\x07]*\x07/g, "")
        .replace(/\r/g, "");
}
