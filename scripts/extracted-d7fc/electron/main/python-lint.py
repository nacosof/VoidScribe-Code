#!/usr/bin/env python3
"""Lightweight diagnostics for VoidScribe editor (syntax + import resolution)."""
from __future__ import annotations

import ast
import importlib.util
import json
import os
import sys
from pathlib import Path


def _setup_path(file_path: str) -> None:
    workspace = os.environ.get("VOIDSCRIBE_WORKSPACE", "").strip()
    if workspace:
        sys.path.insert(0, workspace)
    parent = str(Path(file_path).resolve().parent)
    if parent not in sys.path:
        sys.path.insert(0, parent)


def _module_exists(name: str) -> bool:
    if not name:
        return True
    try:
        return importlib.util.find_spec(name) is not None
    except (ModuleNotFoundError, ValueError, ImportError, AttributeError):
        return False


def _resolve_relative_module(file_path: str, module: str | None, level: int) -> str | None:
    if level <= 0:
        return module
    path = Path(file_path).resolve()
    package_parts = list(path.parent.parts)
    if level > len(package_parts):
        return None
    base_parts = package_parts[: len(package_parts) - level + 1]
    if module:
        return ".".join(base_parts + tuple(module.split(".")))
    return ".".join(base_parts)


def _append_import_error(
    errors: list[dict],
    name: str,
    lineno: int,
    col: int,
    end_col: int,
) -> None:
    if _module_exists(name):
        return
    errors.append(
        {
            "line": lineno,
            "column": col,
            "endColumn": end_col,
            "severity": "error",
            "message": f'Не удалось найти модуль «{name}»',
        }
    )


def lint_file(file_path: str) -> list[dict]:
    _setup_path(file_path)
    source = Path(file_path).read_text(encoding="utf-8")
    errors: list[dict] = []

    try:
        tree = ast.parse(source, file_path)
    except SyntaxError as exc:
        col = max(0, (exc.offset or 1) - 1)
        end_col = exc.end_offset if exc.end_offset is not None else col + 1
        errors.append(
            {
                "line": exc.lineno or 1,
                "column": col,
                "endColumn": end_col,
                "severity": "error",
                "message": exc.msg or "Синтаксическая ошибка",
            }
        )
        return errors

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            base_col = node.col_offset + len("import ")
            for alias in node.names:
                name = alias.name
                col = getattr(alias, "col_offset", None)
                if col is None:
                    col = base_col
                end_col = col + len(alias.asname or alias.name)
                _append_import_error(errors, name, node.lineno, col, end_col)
                base_col = end_col + 2
        elif isinstance(node, ast.ImportFrom):
            level = node.level or 0
            resolved = _resolve_relative_module(file_path, node.module, level)
            if resolved:
                col = node.col_offset + len("from ")
                if node.module:
                    col += len(node.module) + len(" import ")
                else:
                    col += len("import ")
                end_col = col + len((node.module or "").split(".")[-1] or "")
                if node.module and level == 0:
                    _append_import_error(errors, node.module, node.lineno, col, col + len(node.module))
                elif level > 0 and resolved:
                    _append_import_error(errors, resolved, node.lineno, node.col_offset, node.col_offset + 1)

    return errors


def main() -> None:
    if len(sys.argv) < 2:
        print("[]")
        return
    print(json.dumps(lint_file(sys.argv[1]), ensure_ascii=False))


if __name__ == "__main__":
    main()
