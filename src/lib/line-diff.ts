export type LineDiffSegment = {
    type: "equal";
    lines: string[];
} | {
    type: "insert";
    lines: string[];
} | {
    type: "delete";
    lines: string[];
};
export function diffLines(before: string, after: string): LineDiffSegment[] {
    const a = before.replace(/\r\n/g, "\n").split("\n");
    const b = after.replace(/\r\n/g, "\n").split("\n");
    const n = a.length;
    const m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
            dp[i]![j] =
                a[i - 1] === b[j - 1]
                    ? dp[i - 1]![j - 1]! + 1
                    : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
        }
    }
    const reversed: LineDiffSegment[] = [];
    let i = n;
    let j = m;
    const pushSegment = (type: LineDiffSegment["type"], line: string) => {
        const last = reversed[0];
        if (last && last.type === type) {
            last.lines.unshift(line);
            return;
        }
        reversed.unshift({ type, lines: [line] } as LineDiffSegment);
    };
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            pushSegment("equal", a[i - 1]!);
            i -= 1;
            j -= 1;
        }
        else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
            pushSegment("insert", b[j - 1]!);
            j -= 1;
        }
        else {
            pushSegment("delete", a[i - 1]!);
            i -= 1;
        }
    }
    return reversed;
}
export type InlineDiffMark = {
    kind: "insert";
    line: number;
} | {
    kind: "delete-block";
    afterLine: number;
    lines: string[];
};
export function inlineDiffMarks(before: string, after: string): InlineDiffMark[] {
    const segments = diffLines(before, after);
    const marks: InlineDiffMark[] = [];
    let line = 1;
    for (const segment of segments) {
        if (segment.type === "equal") {
            line += segment.lines.length;
            continue;
        }
        if (segment.type === "insert") {
            for (let i = 0; i < segment.lines.length; i += 1) {
                marks.push({ kind: "insert", line: line + i });
            }
            line += segment.lines.length;
            continue;
        }
        if (segment.lines.length > 0) {
            marks.push({
                kind: "delete-block",
                afterLine: Math.max(0, line - 1),
                lines: segment.lines,
            });
        }
    }
    return marks;
}
