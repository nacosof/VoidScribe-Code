const TOOL_EXECUTION_ORDER: Record<string, number> = {
  list_directory: 10,
  read_file: 10,
  read_file_history: 10,
  list_file_history: 10,
  write_file: 20,
  restore_file: 20,
  scaffold_next_app: 20,
  capture_page_preview: 30,
  run_command: 100,
};

export function sortToolsForExecution<T extends { name: string }>(uses: T[]): T[] {
  return [...uses].sort(
    (a, b) =>
      (TOOL_EXECUTION_ORDER[a.name] ?? 50) -
      (TOOL_EXECUTION_ORDER[b.name] ?? 50)
  );
}
