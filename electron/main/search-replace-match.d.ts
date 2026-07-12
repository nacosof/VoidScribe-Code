export declare function countOccurrences(haystack: string, needle: string): number;
export declare function resolveSearchNeedle(content: string, oldString: string): {
    needle: string;
    count: number;
} | null;
export declare function applySearchReplace(input: {
    content: string;
    needle: string;
    newString: string;
    replaceAll: boolean;
    matchCount: number;
}): {
    nextContent: string;
    replaced: number;
    note?: string;
};
