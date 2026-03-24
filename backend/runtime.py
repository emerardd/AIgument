"""
Runtime path helpers for local development and packaged desktop builds.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


APP_NAME = "AIgument"


def is_frozen() -> bool:
    return getattr(sys, "frozen", False)


def get_bundle_dir() -> Path:
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent.parent


def get_executable_dir() -> Path:
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def get_backend_dir() -> Path:
    if is_frozen():
        return get_bundle_dir() / "backend"
    return Path(__file__).resolve().parent


def get_user_data_dir() -> Path:
    if not is_frozen():
        return Path(__file__).resolve().parent.parent / "instance"
    if os.name == "nt":
        base_dir = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA") or str(Path.home())
        return Path(base_dir) / APP_NAME
    return Path.home() / f".{APP_NAME.lower()}"


def is_dir_writable(directory: Path) -> bool:
    try:
        directory.mkdir(parents=True, exist_ok=True)
        probe = directory / ".write_test"
        with probe.open("w", encoding="utf-8") as handle:
            handle.write("ok")
        probe.unlink()
        return True
    except OSError:
        return False


def ensure_user_data_dir() -> Path:
    candidate_dirs = [
        get_user_data_dir(),
        Path(__file__).resolve().parent.parent / "instance",
    ]
    for candidate in candidate_dirs:
        if is_dir_writable(candidate):
            return candidate
    raise PermissionError("Unable to create a writable data directory for AIgument.")


def get_env_file_candidates() -> list[Path]:
    user_dir = get_user_data_dir()
    backend_dir = get_backend_dir()
    executable_dir = get_executable_dir()
    return [
        user_dir / ".env",
        executable_dir / ".env",
        executable_dir.parent / ".env",
        backend_dir / ".env",
    ]


def get_database_path() -> Path:
    return ensure_user_data_dir() / "aigument.db"


def get_frontend_dist_dir() -> Path:
    search_dirs = [
        Path(__file__).resolve().parent.parent / "src" / "static" / "dist",
        get_bundle_dir() / "frontend_dist",
        get_executable_dir().parent / "frontend_dist",
        get_executable_dir() / "frontend_dist",
    ]
    for directory in search_dirs:
        if directory.exists():
            return directory
    return search_dirs[0]
