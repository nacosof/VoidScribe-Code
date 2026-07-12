export function sortToolsForExecution<T extends {
    name?: string;
    function?: {
        name?: string;
    };
}>(items: T[]): T[] {
    const priority = (item: T) => {
        const name = item.name ?? item.function?.name ?? "";
        if (name === "read_file" || name === "list_directory" || name === "grep")
            return 0;
        if (name === "search_replace" || name === "write_file")
            return 1;
        if (name === "run_command")
            return 2;
        return 3;
    };
    return [...items].sort((a, b) => priority(a) - priority(b));
}
