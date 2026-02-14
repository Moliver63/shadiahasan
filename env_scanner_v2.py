#!/usr/bin/env python3
"""
env_scanner_v2.py
- Scans a project for environment variable usage:
  - process.env.X and process.env["X"]
  - import.meta.env.VITE_X (Vite)
- Outputs:
  1) env-report.json (keys + file hits)
  2) env-report.txt (human readable)
  3) .env.example (commented template)
  4) .env.production.sample (same keys, placeholders)
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Set, Tuple

ROOT = Path(".").resolve()

TEXT_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"}
SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", ".next", ".vercel",
    ".turbo", ".cache", ".pnpm-store", "coverage"
}

RE_PROC_DOT = re.compile(r"\bprocess\.env\.([A-Z0-9_]+)\b")
RE_PROC_BRACKET = re.compile(r"\bprocess\.env\[['\"]([A-Z0-9_]+)['\"]\]\b")
RE_VITE = re.compile(r"\bimport\.meta\.env\.([A-Z0-9_]+)\b")

# Optional: detect dotenv-safe style like env("KEY") if you use it
RE_ENV_FUNC = re.compile(r"\benv\(\s*['\"]([A-Z0-9_]+)['\"]\s*\)")

@dataclass
class Hit:
    file: str
    kind: str
    key: str
    line: int
    context: str

def should_skip_dir(path: Path) -> bool:
    parts = set(path.parts)
    return any(p in parts for p in SKIP_DIRS)

def scan_file(path: Path) -> List[Hit]:
    hits: List[Hit] = []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return hits

    lines = text.splitlines()
    for i, line in enumerate(lines, start=1):
        for m in RE_PROC_DOT.finditer(line):
            hits.append(Hit(str(path), "process.env", m.group(1), i, line.strip()))
        for m in RE_PROC_BRACKET.finditer(line):
            hits.append(Hit(str(path), "process.env[]", m.group(1), i, line.strip()))
        for m in RE_VITE.finditer(line):
            hits.append(Hit(str(path), "import.meta.env", m.group(1), i, line.strip()))
        for m in RE_ENV_FUNC.finditer(line):
            hits.append(Hit(str(path), "env('KEY')", m.group(1), i, line.strip()))
    return hits

def group_hits(hits: List[Hit]) -> Dict[str, List[Hit]]:
    grouped: Dict[str, List[Hit]] = {}
    for h in hits:
        grouped.setdefault(h.key, []).append(h)
    return grouped

def load_existing_env(env_path: Path) -> Dict[str, str]:
    if not env_path.exists():
        return {}
    data: Dict[str, str] = {}
    for raw in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = raw.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        data[k.strip()] = v.strip()
    return data

def infer_comment(key: str) -> str:
    # You can customize these comments anytime.
    mapping = {
        "NODE_ENV": "Runtime mode: development | production",
        "PORT": "Server port (Node/Express). In cPanel Node App, you can set this too.",
        "SITE_URL": "Public site URL (used for redirects/callbacks/links).",
        "APP_URL": "Alternative name some projects use for public URL.",
        "DATABASE_URL": "MySQL connection string: mysql://user:pass@host:3306/db",
        "JWT_SECRET": "JWT signing secret (use a long random string).",
        "COOKIE_SECRET": "Cookie/session secret (use a long random string).",
        "FROM_EMAIL": "Default sender email address.",
        "RESEND_API_KEY": "Resend API key for email sending.",
        "OAUTH_SERVER_URL": "OAuth server base URL.",
        "OWNER_OPEN_ID": "Owner/admin OpenID (if used by your auth flow).",
        "BUILT_IN_FORGE_API_URL": "Forge API base URL (backend).",
        "BUILT_IN_FORGE_API_KEY": "Forge API key (backend).",
        "VITE_APP_ID": "Frontend app id (exposed to browser).",
        "VITE_FRONTEND_FORGE_API_URL": "Frontend Forge API base URL (exposed to browser).",
        "VITE_FRONTEND_FORGE_API_KEY": "Frontend Forge API key (exposed to browser).",
        "VITE_OAUTH_PORTAL_URL": "Frontend OAuth portal URL (exposed to browser).",
    }
    return mapping.get(key, "TODO: describe this variable")

def placeholder_value(key: str) -> str:
    # Safe placeholders (no secrets generated here)
    defaults = {
        "NODE_ENV": "production",
        "PORT": "3000",
        "SITE_URL": "https://www.seudominio.com",
        "APP_URL": "https://www.seudominio.com",
        "DATABASE_URL": "mysql://USER:PASSWORD@HOST:3306/DBNAME",
        "FROM_EMAIL": "contato@seudominio.com",
        "OAUTH_SERVER_URL": "https://oauth.seudominio.com",
        "BUILT_IN_FORGE_API_URL": "https://api.seudominio.com",
        "VITE_FRONTEND_FORGE_API_URL": "https://api.seudominio.com",
        "VITE_OAUTH_PORTAL_URL": "https://oauth.seudominio.com",
    }
    if key in defaults:
        return defaults[key]
    # Secrets / keys placeholders
    if "SECRET" in key or key.endswith("_KEY") or key.endswith("API_KEY"):
        return "CHANGE_ME"
    return "CHANGE_ME"

def write_env_example(keys: List[str], existing: Dict[str, str], out_path: Path, commented: bool = True):
    lines: List[str] = []
    for k in keys:
        comment = infer_comment(k)
        val = existing.get(k, placeholder_value(k))
        if commented:
            lines.append(f"# {comment}")
        lines.append(f"{k}={val}")
        lines.append("")
    out_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

def main():
    all_hits: List[Hit] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dp = Path(dirpath)
        if should_skip_dir(dp):
            dirnames[:] = []
            continue
        for fn in filenames:
            p = dp / fn
            if p.suffix.lower() not in TEXT_EXTS:
                continue
            all_hits.extend(scan_file(p))

    grouped = group_hits(all_hits)

    proc_keys: Set[str] = set()
    vite_keys: Set[str] = set()
    other_keys: Set[str] = set()

    for key, hs in grouped.items():
        kinds = {h.kind for h in hs}
        if any(k.startswith("import.meta.env") for k in kinds) or key.startswith("VITE_"):
            vite_keys.add(key)
        elif any(k.startswith("process.env") for k in kinds):
            proc_keys.add(key)
        else:
            other_keys.add(key)

    # Merge and sort unique keys
    all_keys = sorted(proc_keys | vite_keys | other_keys)

    # Existing .env values if present
    existing = load_existing_env(ROOT / ".env")

    # Write JSON report
    json_report = {
        "root": str(ROOT),
        "counts": {
            "total_hits": len(all_hits),
            "unique_keys": len(all_keys),
            "process_env_keys": len(proc_keys),
            "vite_env_keys": len(vite_keys),
        },
        "keys": all_keys,
        "process_env_keys": sorted(proc_keys),
        "vite_env_keys": sorted(vite_keys),
        "hits_by_key": {
            k: [
                {
                    "file": h.file,
                    "kind": h.kind,
                    "line": h.line,
                    "context": h.context,
                }
                for h in grouped[k]
            ]
            for k in all_keys
        },
    }
    (ROOT / "env-report.json").write_text(json.dumps(json_report, indent=2, ensure_ascii=False), encoding="utf-8")

    # Write TXT report
    lines: List[str] = []
    lines.append("=== ENV SCANNER V2 REPORT ===")
    lines.append(f"Project root: {ROOT}")
    lines.append("")
    lines.append(f"Total hits: {len(all_hits)}")
    lines.append(f"Unique keys: {len(all_keys)}")
    lines.append("")
    lines.append("=== process.env KEYS ===")
    for k in sorted(proc_keys):
        lines.append(k)
    lines.append("")
    lines.append("=== import.meta.env (VITE) KEYS ===")
    for k in sorted(vite_keys):
        lines.append(k)
    lines.append("")
    lines.append("=== HITS (where each key appears) ===")
    for k in all_keys:
        lines.append(f"\n[{k}]")
        for h in grouped[k]:
            lines.append(f"- {h.file}:{h.line} ({h.kind})  {h.context}")
    (ROOT / "env-report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Generate .env.example and .env.production.sample
    write_env_example(all_keys, existing, ROOT / ".env.example", commented=True)
    write_env_example(all_keys, existing, ROOT / ".env.production.sample", commented=False)

    print("\n✅ Generated:")
    print("- env-report.json")
    print("- env-report.txt")
    print("- .env.example")
    print("- .env.production.sample")
    print("\nTip: VITE_* variables are baked into the frontend at build time (pnpm run build).")

if __name__ == "__main__":
    main()
