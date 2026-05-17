"""Shared utilities: repo detection, console, subprocess."""

import io
import os
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

import typer
from rich.console import Console

from . import __version__ as CLI_VERSION  # populated by package __init__

console = Console()
err_console = Console(stderr=True)

GITHUB_REPO_SLUG = "skyyycodes/zkai"
GITHUB_REPO_URL = f"https://github.com/{GITHUB_REPO_SLUG}.git"
DEFAULT_RUNTIME_DIR = Path.home() / ".zkai"


def _runtime_tarball_url(version: str) -> str:
    # Asset uploaded to a GitHub Release. We try the version that matches the
    # installed CLI first, then fall back to "latest" if that release does not
    # exist (helps during pre-release CLI updates).
    return (
        f"https://github.com/{GITHUB_REPO_SLUG}/releases/download/"
        f"v{version}/zkai-runtime-v{version}.tar.gz"
    )


def _runtime_tarball_url_latest() -> str:
    return (
        f"https://github.com/{GITHUB_REPO_SLUG}/releases/latest/download/"
        f"zkai-runtime.tar.gz"
    )


# ── Repo detection ────────────────────────────────────────────────────────────

def _looks_like_zkai_root(p: Path) -> bool:
    return (p / "provider" / "docker-compose.yml").exists()


def find_repo_root(hint: str | None = None, auto_clone: bool = False) -> Path:
    """
    Locate the zkai runtime root. Search order:
    1. --dir flag passed by user
    2. Walk up from cwd looking for provider/docker-compose.yml
    3. ~/.zkai (new default — runtime extracted by zkai init)
    4. ~/zkai (legacy default for users who cloned manually)
    5. If auto_clone=True, download the runtime tarball
    """
    if hint:
        p = Path(hint).expanduser().resolve()
        _assert_repo(p)
        return p

    cur = Path.cwd()
    for candidate in [cur, *cur.parents]:
        if _looks_like_zkai_root(candidate):
            return candidate

    for fallback in [DEFAULT_RUNTIME_DIR, Path.home() / "zkai"]:
        if _looks_like_zkai_root(fallback):
            return fallback

    if auto_clone:
        return _download_runtime()

    err_console.print(
        "[red]ZKai runtime not found.[/red] "
        "Run [bold]zkai init[/bold] to set up, or pass [bold]--dir /path/to/zkai[/bold]."
    )
    raise typer.Exit(1)


def ensure_repo(repo_dir: str | None) -> Path:
    """Like find_repo_root but always downloads the runtime if missing. Used by init."""
    if repo_dir:
        p = Path(repo_dir).expanduser().resolve()
        _assert_repo(p)
        return p

    cur = Path.cwd()
    for candidate in [cur, *cur.parents]:
        if _looks_like_zkai_root(candidate):
            return candidate

    for fallback in [DEFAULT_RUNTIME_DIR, Path.home() / "zkai"]:
        if _looks_like_zkai_root(fallback):
            return fallback

    return _download_runtime()


def _download_runtime() -> Path:
    """
    Fetch the runtime tarball from the GitHub Release that matches this CLI
    version and extract it to ~/.zkai. Falls back to "latest" release if the
    pinned version is missing. No git dependency.
    """
    dest = DEFAULT_RUNTIME_DIR
    dest.mkdir(parents=True, exist_ok=True)

    urls = [_runtime_tarball_url(CLI_VERSION), _runtime_tarball_url_latest()]
    last_error: Exception | None = None
    for url in urls:
        console.print(f"[bold]Downloading ZKai runtime[/bold] from [dim]{url}[/dim] ...")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": f"zkai-cli/{CLI_VERSION}"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"HTTP {resp.status}")
                data = resp.read()
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
                tf.extractall(dest)
            console.print(f"[green]Runtime extracted to {dest}[/green]")
            if not _looks_like_zkai_root(dest):
                # Some tarballs have a top-level folder; try to flatten
                children = [c for c in dest.iterdir() if c.is_dir()]
                for child in children:
                    if _looks_like_zkai_root(child):
                        # Move its contents up
                        for item in child.iterdir():
                            item.rename(dest / item.name)
                        child.rmdir()
                        break
            if not _looks_like_zkai_root(dest):
                raise RuntimeError("Tarball did not contain provider/docker-compose.yml")
            return dest
        except Exception as e:
            last_error = e
            continue

    err_console.print(f"[red]Failed to download runtime:[/red] {last_error}")
    err_console.print(
        "You can download manually from "
        f"https://github.com/{GITHUB_REPO_SLUG}/releases and extract to {dest}."
    )
    raise typer.Exit(1)


def _assert_repo(p: Path):
    if not _looks_like_zkai_root(p):
        err_console.print(
            f"[red]{p}[/red] does not look like a zkai runtime "
            "(missing provider/docker-compose.yml)."
        )
        raise typer.Exit(1)


def compose_dir(repo: Path) -> Path:
    return repo / "provider"


def deploy_dir(repo: Path) -> Path:
    return repo / "deploy"


def env_file(repo: Path) -> Path:
    return compose_dir(repo) / ".env"


def read_env_file(repo: Path) -> dict[str, str]:
    """Parse provider/.env into a dict. Returns empty dict if file missing."""
    ef = env_file(repo)
    result: dict[str, str] = {}
    if not ef.exists():
        return result
    for line in ef.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        result[k.strip()] = v.strip()
    return result


# ── Shell helpers ─────────────────────────────────────────────────────────────

def run(cmd: list[str], cwd: Path | None = None, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess:
    kwargs: dict = dict(cwd=str(cwd) if cwd else None)
    if capture:
        kwargs["capture_output"] = True
        kwargs["text"] = True
    return subprocess.run(cmd, check=check, **kwargs)


def stream(cmd: list[str], cwd: Path | None = None):
    result = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    if result.returncode != 0:
        raise typer.Exit(result.returncode)


def require_docker():
    r = subprocess.run(["docker", "compose", "version"], capture_output=True)
    if r.returncode != 0:
        err_console.print("[red]docker compose not found.[/red] Install Docker Engine with the Compose plugin.")
        raise typer.Exit(1)


def require_node(repo: Path):
    r = subprocess.run(["node", "--version"], capture_output=True)
    if r.returncode != 0:
        err_console.print("[red]node not found.[/red] Install Node.js 20+.")
        raise typer.Exit(1)
