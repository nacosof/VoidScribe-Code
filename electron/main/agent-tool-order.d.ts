export declare function sortToolsForExecution<T extends {
    name?: string;
    function?: {
        name?: string;
    };
}>(items: T[]): T[];
