#!/usr/bin/env python3
"""Export and verify the full Claude Code conversation history for this project.

Usage (run from anywhere; `-I` keeps Python from importing stray modules):
    python3 -I scripts/transcripts/transcripts.py discover
    python3 -I scripts/transcripts/transcripts.py export
    python3 -I scripts/transcripts/transcripts.py verify [--final]

Source of truth: Claude Code's append-only session files in
~/.claude/projects/<project-dir>/<sessionId>.jsonl (+ <sessionId>/subagents/*.jsonl and
<sessionId>/tool-results/*). Nothing here edits those files.

Output (committed): docs/agent-chat-history.md plus docs/agent-chat-history/
  results/      tool results larger than INLINE_LIMIT, copied verbatim (after redaction)
  persisted/    text files Claude Code stored outside the JSONL ("persisted-output")
  EXCLUSIONS.md everything not reproduced, with size and reason
  sessions.json manifest used by `verify`

Privacy: strings listed in scripts/transcripts/private-strings.local.txt (gitignored, one per
line, e.g. your e-mail) and common secret patterns are replaced with [REDACTED:<kind>].
The home directory path is shortened to "~". Every replacement is counted in the header.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "docs"
OUT_MD = DOCS / "agent-chat-history.md"
OUT_DIR = DOCS / "agent-chat-history"
PRIVATE_FILE = Path(__file__).resolve().parent / "private-strings.local.txt"
CLAUDE_PROJECTS = Path.home() / ".claude" / "projects"
INLINE_LIMIT = 20_000  # characters; larger tool results move verbatim to results/
CHATGPT_PLACEHOLDER = "CHATGPT_TRANSCRIPT_URL"
CHATGPT_LINK_FILE = Path(__file__).resolve().parent / "chatgpt-link.txt"

BOOKKEEPING_TYPES = {
    "api-request", "api-request-blob", "api-request-shape", "atis-latch", "agent-name",
    "custom-title", "last-prompt", "relocated", "tools-used", "queue-operation",
    "file-history-snapshot", "file-history-delta", "summary",
}

SECRET_PATTERNS = [
    ("postgres-url", re.compile(r"postgres(?:ql)?://[^\s:/@]+:[^\s@]+@[^\s'\"]+")),
    ("github-token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b")),
    ("api-key", re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_-]{24,}\b")),
    ("neon-password", re.compile(r"\bnpg_[A-Za-z0-9]{8,}\b")),
    ("bearer-token", re.compile(r"\bBearer\s+[A-Za-z0-9._~+/-]{24,}=*")),
    ("env-secret", re.compile(r"\b((?:KEY_ENCRYPTION_KEY|DATABASE_URL|SESSION_SECRET|RENDER_API_KEY|VERCEL_TOKEN)\s*[=:]\s*)(?!\[REDACTED)[^\s'\"]+")),
]
SYSTEM_REMINDER = re.compile(r"<system-reminder>.*?</system-reminder>\s*", re.S)


def rd(path) -> str:
    """Read text exactly as stored (no newline translation: tool output may contain \\r\\n)."""
    with open(path, encoding="utf-8", errors="replace", newline="") as fh:
        return fh.read()


def wr(path, text: str) -> None:
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)


# ---------------------------------------------------------------- redaction
class Redactor:
    def __init__(self) -> None:
        self.counts: Counter[str] = Counter()
        self.private: list[str] = []
        if PRIVATE_FILE.exists():
            self.private = [s.strip() for s in rd(PRIVATE_FILE).splitlines()
                            if s.strip() and not s.startswith("#")]
        home = str(Path.home())
        self.home = home
        self.home_dash = home.replace("/", "-")

    def __call__(self, text: str) -> str:
        for s in self.private:
            n = text.count(s)
            if n:
                self.counts["private-string"] += n
                text = text.replace(s, "[REDACTED:private]")
        for kind, pat in SECRET_PATTERNS:
            def sub(m: re.Match, kind=kind) -> str:
                self.counts[kind] += 1
                prefix = m.group(1) if (pat.groups and m.group(1)) else ""
                return prefix + f"[REDACTED:{kind}]"
            text = pat.sub(sub, text)
        n = text.count(self.home) + text.count(self.home_dash)
        if n:
            self.counts["home-path (shortened to ~)"] += n
            text = text.replace(self.home, "~").replace(self.home_dash, "-~")
        return text


def to_portable(path: str) -> str:
    """Manifest paths without the local home directory (username stays out of the repo)."""
    return path.replace(str(CLAUDE_PROJECTS) + "/", "{CLAUDE_PROJECTS}/").replace(
        str(Path.home()).replace("/", "-"), "{HOME_DASH}")


def from_portable(path: str) -> str:
    return path.replace("{CLAUDE_PROJECTS}", str(CLAUDE_PROJECTS)).replace(
        "{HOME_DASH}", str(Path.home()).replace("/", "-"))


def leaks(text: str, red: Redactor) -> list[str]:
    found = [s for s in red.private if s in text]
    for kind, pat in SECRET_PATTERNS:
        for m in pat.finditer(text):
            if "[REDACTED" not in m.group(0):
                found.append(kind)
    return found


# ---------------------------------------------------------------- discovery
def project_dir_name(path: Path) -> str:
    return re.sub(r"[^A-Za-z0-9]", "-", str(path))


def discover() -> list[dict]:
    """All main-session and subagent JSONL files that belong to this repository."""
    files: dict[Path, str] = {}
    own = CLAUDE_PROJECTS / project_dir_name(REPO)
    if own.is_dir():
        for f in own.glob("*.jsonl"):
            files[f] = "main"
        for f in own.glob("*/subagents/*.jsonl"):
            files[f] = "subagent"
    # Sessions started from another folder (worktree, relocated cwd) that worked in this repo.
    repo_s = str(REPO)
    for d in CLAUDE_PROJECTS.iterdir() if CLAUDE_PROJECTS.is_dir() else []:
        if d == own or not d.is_dir():
            continue
        for f in d.glob("*.jsonl"):
            try:
                with f.open() as fh:
                    for i, line in enumerate(fh):
                        if i > 400:
                            break
                        if repo_s not in line:
                            continue
                        # Match the session's working directory only; a tool result that merely
                        # mentions this repo's path (e.g. a disk listing) must not pull it in.
                        try:
                            rec = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        cwds = [rec.get("cwd"), rec.get("relocatedCwd")] if isinstance(rec, dict) else []
                        if any(isinstance(c, str) and (c == repo_s or c.startswith(repo_s + os.sep))
                               for c in cwds):
                            files[f] = "main"
                            for s in f.with_suffix("").glob("subagents/*.jsonl"):
                                files[s] = "subagent"
                            break
            except OSError:
                pass
    out = []
    for f, kind in files.items():
        first = last = None
        lines = 0
        with f.open() as fh:
            for line in fh:
                lines += 1
                try:
                    ts = json.loads(line).get("timestamp")
                except json.JSONDecodeError:
                    continue
                if ts:
                    first = first or ts
                    last = ts
        out.append({"path": str(f), "kind": kind, "session": f.stem if kind == "main" else f.parent.parent.name,
                    "agent": f.stem if kind == "subagent" else None,
                    "first": first or "", "last": last or "", "lines": lines})
    out.sort(key=lambda s: (s["first"], s["kind"] != "main"))
    return out


# ---------------------------------------------------------------- parsing
def read_records(path: str, limit: int | None = None) -> list[dict]:
    recs, seen = [], set()
    with open(path) as fh:
        for i, line in enumerate(fh):
            if limit is not None and i >= limit:
                break
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            key = d.get("uuid")
            if key and key in seen:  # resumed sessions can repeat records
                continue
            if key:
                seen.add(key)
            recs.append(d)
    return recs


def blocks_of(rec: dict):
    """Yield (kind, payload) for conversational content in one JSONL record, in order."""
    t = rec.get("type")
    if t == "attachment":
        a = rec.get("attachment", {})
        if a.get("type") == "queued_command" and a.get("prompt"):
            yield "user_queued", a["prompt"]
        return
    if t not in ("user", "assistant"):
        return
    msg = rec.get("message", {})
    content = msg.get("content")
    if t == "user":
        if isinstance(content, str):
            kind = "compact_summary" if rec.get("isCompactSummary") else ("user_meta" if rec.get("isMeta") else "user")
            yield kind, content
            return
        for b in content or []:
            bt = b.get("type")
            if bt == "text":
                kind = "compact_summary" if rec.get("isCompactSummary") else ("user_meta" if rec.get("isMeta") else "user")
                yield kind, b.get("text", "")
            elif bt == "tool_result":
                yield "tool_result", b
            elif bt in ("image", "document"):
                yield "user_binary", b
        return
    for b in content or []:
        bt = b.get("type")
        if bt == "text":
            yield "assistant", b.get("text", "")
        elif bt == "tool_use":
            yield "tool_use", b
        elif bt in ("thinking", "redacted_thinking"):
            yield "thinking", b.get("thinking", "")


def clean_user_text(text: str) -> str:
    return SYSTEM_REMINDER.sub("", text).strip("\n")


def tool_result_parts(b: dict):
    """Split a tool_result into text and excluded binary parts."""
    c = b.get("content")
    if isinstance(c, str):
        return [c], []
    texts, binaries = [], []
    for x in c or []:
        xt = x.get("type")
        if xt == "text":
            texts.append(x.get("text", ""))
        elif xt == "tool_reference":
            texts.append(f"[tool schema loaded: {x.get('tool_name')}]")
        elif xt in ("image", "document"):
            src = x.get("source", {})
            binaries.append((xt, src.get("media_type", "?"), len(src.get("data", "") or "")))
        else:
            texts.append(json.dumps(x, ensure_ascii=False))
    return texts, binaries


def fence(text: str, lang: str = "") -> tuple[str, str]:
    longest = max((len(m) for m in re.findall(r"`+", text)), default=0)
    f = "`" * max(3, longest + 1)
    return f + lang, f


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


PERSISTED_RE = re.compile(r"(/[^\s'\"]*?/tool-results/[A-Za-z0-9._-]+)")


# ---------------------------------------------------------------- export
def export() -> int:
    sessions = discover()
    if not sessions:
        print("no sessions found", file=sys.stderr)
        return 1
    red = Redactor()
    if OUT_DIR.exists():
        for sub in ("results", "persisted"):
            shutil.rmtree(OUT_DIR / sub, ignore_errors=True)
    (OUT_DIR / "results").mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "persisted").mkdir(parents=True, exist_ok=True)

    body: list[str] = []
    # Random per-export marker prefix, so transcript content that quotes an older export
    # (e.g. `cat docs/agent-chat-history.md`) can never be mistaken for a block boundary.
    nonce = "tx" + os.urandom(4).hex()
    manifest = {"sessions": [], "blocks": [], "nonce": nonce}
    exclusions: list[tuple[str, str, str, str]] = []
    bookkeeping: Counter[str] = Counter()
    totals: Counter[str] = Counter()
    tool_names: dict[str, str] = {}
    copied_persisted: set[str] = set()

    def emit(uid: str, kind: str, text: str, fenced: bool, lang: str = "") -> None:
        text = red(text)
        marker = f"<!-- {nonce} block:{uid}:{kind} -->"
        end = f"<!-- {nonce} /block -->"
        if fenced:
            o, c = fence(text, lang)
            body.append(f"{marker}\n{o}\n{text}\n{c}\n{end}\n")
        else:
            body.append(f"{marker}\n{text}\n{end}\n")
        manifest["blocks"].append({"id": uid, "kind": kind, "fenced": fenced, "sha256": sha(text)})

    for s in sessions:
        recs = read_records(s["path"], s["lines"])
        label = "Session" if s["kind"] == "main" else f"Subagent `{s['agent']}` of session"
        body.append(f"\n---\n\n## {label} `{s['session']}`\n\n_{s['first']} → {s['last']}_\n")
        counts: Counter[str] = Counter()
        sess_dir = Path(s["path"]).with_suffix("") if s["kind"] == "main" else Path(s["path"]).parent.parent
        for rec in recs:
            t = rec.get("type")
            if t in BOOKKEEPING_TYPES:
                bookkeeping[t] += 1
            elif t == "attachment" and rec.get("attachment", {}).get("type") != "queued_command":
                bookkeeping["attachment:" + str(rec.get("attachment", {}).get("type"))] += 1
            uuid = rec.get("uuid") or rec.get("messageId") or "x"
            ts = rec.get("timestamp", "")
            for i, (kind, p) in enumerate(blocks_of(rec)):
                uid = f"{uuid}:{i}"
                counts[kind] += 1
                if kind in ("user", "user_queued"):
                    text = clean_user_text(p)
                    if not text:
                        counts[kind] -= 1
                        continue
                    title = "User" if kind == "user" else "User (message sent while Claude was working)"
                    body.append(f"\n### {title} — {ts}\n")
                    emit(uid, kind, text, fenced=True, lang="text")
                elif kind == "user_meta":
                    text = clean_user_text(p)
                    if not text:
                        counts[kind] -= 1
                        continue
                    body.append(f"\n#### Harness message (not typed by the user) — {ts}\n")
                    emit(uid, kind, text, fenced=True, lang="text")
                elif kind == "compact_summary":
                    body.append(f"\n### Context compaction summary (generated by Claude Code) — {ts}\n")
                    emit(uid, kind, p, fenced=True, lang="text")
                elif kind == "assistant":
                    if not p.strip():
                        counts[kind] -= 1
                        continue
                    body.append(f"\n### Claude — {ts}\n")
                    emit(uid, kind, p, fenced=False)
                elif kind == "thinking":
                    if p.strip():
                        body.append(f"\n#### Claude reasoning — {ts}\n")
                        emit(uid, kind, p, fenced=True, lang="text")
                    else:
                        totals["thinking_not_stored"] += 1
                        body.append("\n> _(model reasoning step — its text is not stored by Claude Code)_\n")
                elif kind == "tool_use":
                    tool_names[p.get("id", "")] = p.get("name", "?")
                    body.append(f"\n#### Tool call: `{p.get('name')}` — {ts}\n")
                    emit(uid, kind, json.dumps(p.get("input", {}), indent=2, ensure_ascii=False), fenced=True, lang="json")
                elif kind == "tool_result":
                    tid = p.get("tool_use_id", "")
                    name = tool_names.get(tid, "?")
                    texts, binaries = tool_result_parts(p)
                    text = "\n".join(texts)
                    rejected = text.startswith("The user doesn't want to proceed")
                    title = "Tool result — user declined and replied" if rejected else "Tool result"
                    if p.get("is_error") and not rejected:
                        title += " (error)"
                    body.append(f"\n#### {title} (`{name}`) — {ts}\n")
                    for bt, mt, size in binaries:
                        exclusions.append((ts, f"{name} {tid}", f"{bt} {mt}, {size:,} base64 chars", "binary payload (screenshot / PDF page images)"))
                        body.append(f"> _[{bt} ({mt}, {size:,} base64 chars) not reproduced — see EXCLUSIONS.md]_\n")
                    # Copy files Claude Code persisted outside the JSONL.
                    for m in PERSISTED_RE.finditer(text):
                        src = Path(m.group(1))
                        if not src.exists() or src.name in copied_persisted:
                            continue
                        if src.suffix.lower() in (".txt", ".json", ".md", ".log", ""):
                            dst = OUT_DIR / "persisted" / src.name
                            wr(dst, red(rd(src)))
                            copied_persisted.add(src.name)
                            manifest.setdefault("persisted", []).append({"name": src.name, "source": red(str(src)), "sha256": sha(rd(dst))})
                            rel = dst.relative_to(DOCS).as_posix()
                            body.append(f"> Output saved by Claude Code to a separate file, copied verbatim to [{rel}]({rel})\n")
                        else:
                            exclusions.append((ts, f"{name} {tid}", f"{src.name} ({src.stat().st_size:,} bytes)", "binary file stored by Claude Code (screenshot)"))
                            copied_persisted.add(src.name)
                    if not text and binaries:
                        manifest["blocks"].append({"id": uid, "kind": kind, "fenced": None, "sha256": sha("")})
                        continue
                    if len(text) > INLINE_LIMIT:
                        safe = re.sub(r"[^A-Za-z0-9_-]", "_", tid or uid)
                        f = OUT_DIR / "results" / f"{safe}.txt"
                        wr(f, red(text))
                        rel = f.relative_to(DOCS).as_posix()
                        body.append(f"> Full result ({len(text):,} characters) stored verbatim in [{rel}]({rel})\n")
                        manifest["blocks"].append({"id": uid, "kind": kind, "fenced": None, "file": rel, "sha256": sha(rd(f))})
                    else:
                        emit(uid, kind, text, fenced=True, lang="text")
                elif kind == "user_binary":
                    src = p.get("source", {})
                    exclusions.append((ts, "user attachment", f"{p.get('type')} {src.get('media_type','?')}", "binary payload"))
                    body.append(f"> _[user attached {p.get('type')} not reproduced — see EXCLUSIONS.md]_\n")
        manifest["sessions"].append({**s, "path": to_portable(s["path"]), "counts": dict(counts)})
        totals.update(counts)

    chatgpt = rd(CHATGPT_LINK_FILE).strip() if CHATGPT_LINK_FILE.exists() else CHATGPT_PLACEHOLDER
    head = [
        "# AI conversation history — Eneba Intern Assignment 2027\n",
        "Complete, chronological export of every Claude Code session used to build this project, "
        "generated from Claude Code's own session files by `scripts/transcripts/transcripts.py`. "
        "Prompts, Claude's replies and tool calls are reproduced verbatim; nothing is summarised.\n",
        "## Other AI conversation (ChatGPT)\n",
        "The assignment was first analysed with **ChatGPT**, which wrote the original Claude Code Plan Mode "
        "prompt (the first user message below) and later reviewed the first version of the plan. "
        f"That conversation is shared separately: {chatgpt}\n",
        "## How to read this file\n",
        "- `User` blocks are exactly what was typed or pasted. `User (message sent while Claude was working)` "
        "are messages sent mid-turn. Answers to Claude's multiple-choice questions and feedback given when "
        "declining a proposed action appear as tool results.\n",
        "- `Claude` blocks are Claude's visible replies; `Tool call` / `Tool result` blocks show every action "
        "it took and what came back.\n",
        "- Claude Code stores the model's private reasoning without its text, so those steps appear only as a placeholder.\n",
        f"- Tool results longer than {INLINE_LIMIT:,} characters are in `agent-chat-history/results/`; "
        "outputs Claude Code saved to separate files are in `agent-chat-history/persisted/`. Both are linked and verbatim.\n",
        "- Not reproduced: screenshots/PDF images (binary), harness bookkeeping records and injected "
        "`<system-reminder>` context. Every binary item is listed in "
        "[agent-chat-history/EXCLUSIONS.md](agent-chat-history/EXCLUSIONS.md).\n",
        "- HTML comments around each block are integrity markers used by `transcripts.py verify`.\n",
    ]
    head = ["\n".join(h.rstrip("\n") + "\n" for h in head)]
    head += [
        "\n## Sessions\n\n",
        "| # | Kind | Session | Start | End | User msgs | Claude replies | Tool calls |\n|---|---|---|---|---|---|---|---|\n",
    ]
    for i, s in enumerate(manifest["sessions"], 1):
        c = s["counts"]
        head.append(f"| {i} | {s['kind']} | `{s['session'][:8]}`{(' / ' + s['agent']) if s['agent'] else ''} | {s['first']} | {s['last']} | "
                    f"{c.get('user', 0) + c.get('user_queued', 0)} | {c.get('assistant', 0)} | {c.get('tool_use', 0)} |\n")
    head.append("\n## Redactions\n\n")
    if red.counts:
        head += [f"- {k}: {v}\n" for k, v in sorted(red.counts.items())]
    else:
        head.append("- none\n")
    wr(OUT_MD, "".join(head) + "".join(body))

    ex = ["# Items not reproduced in agent-chat-history.md\n\n",
          "## Binary payloads\n\n| Time | Tool / id | Item | Reason |\n|---|---|---|---|\n"]
    ex += [f"| {a} | {b} | {c} | {d} |\n" for a, b, c, d in exclusions]
    ex.append("\n## Harness bookkeeping records (not conversation)\n\n| Record type | Count |\n|---|---|\n")
    ex += [f"| `{k}` | {v} |\n" for k, v in sorted(bookkeeping.items())]
    ex.append(f"\nReasoning steps stored without text: {totals['thinking_not_stored']}\n")
    ex.append("\nAlso omitted: `toolUseResult` fields (a structured duplicate of each tool result shown in the main file) "
              "and `<system-reminder>` blocks injected by the harness into user messages.\n")
    wr(OUT_DIR / "EXCLUSIONS.md", "".join(ex))
    manifest["redactor_private_count"] = len(red.private)
    wr(OUT_DIR / "sessions.json", json.dumps(manifest, indent=1))
    print(f"exported {len(manifest['sessions'])} session file(s), {len(manifest['blocks'])} blocks -> {OUT_MD.relative_to(REPO)}")
    print("totals:", dict(totals))
    return 0


# ---------------------------------------------------------------- verify
def block_re(nonce: str) -> re.Pattern:
    n = re.escape(nonce)
    return re.compile(rf"<!-- {n} block:([^ ]+?):([a-z_]+) -->\n(.*?)\n<!-- {n} /block -->", re.S)


def unfence(s: str) -> str:
    first_nl = s.index("\n")
    last_nl = s.rindex("\n")
    return s[first_nl + 1:last_nl]


def verify(final: bool) -> int:
    errors, warnings = [], []
    if not OUT_MD.exists():
        print("FAIL: docs/agent-chat-history.md missing")
        return 1
    md = rd(OUT_MD)
    manifest = json.loads(rd(OUT_DIR / "sessions.json"))
    red = Redactor()
    BLOCK_RE = block_re(manifest["nonce"])
    found = {m.group(1): (m.group(2), m.group(3)) for m in BLOCK_RE.finditer(md)}

    # 1. Every session on disk is in the export, and nothing newer is missing.
    for s in manifest["sessions"]:
        s["path"] = from_portable(s["path"])
    current = {s["path"]: s for s in discover()}
    exported = {s["path"]: s for s in manifest["sessions"]}
    for p, s in current.items():
        if p not in exported:
            errors.append(f"session not exported: {p}")
        elif s["lines"] > exported[p]["lines"]:
            warnings.append(f"{Path(p).name}: {s['lines'] - exported[p]['lines']} newer line(s) since export (run export again)")

    # 2. Independent re-derivation from the raw JSONL (only the lines that were exported).
    expected = []
    for s in manifest["sessions"]:
        tool_ids_seen = 0
        for rec in read_records(s["path"], s["lines"]):
            uuid = rec.get("uuid") or rec.get("messageId") or "x"
            for i, (kind, p) in enumerate(blocks_of(rec)):
                uid = f"{uuid}:{i}"
                if kind in ("user", "user_queued", "user_meta"):
                    t = clean_user_text(p)
                    if t:
                        expected.append((uid, kind, red(t)))
                elif kind == "compact_summary":
                    expected.append((uid, kind, red(p)))
                elif kind == "assistant" and p.strip():
                    expected.append((uid, kind, red(p)))
                elif kind == "thinking" and p.strip():
                    expected.append((uid, kind, red(p)))
                elif kind == "tool_use":
                    expected.append((uid, kind, red(json.dumps(p.get("input", {}), indent=2, ensure_ascii=False))))
                elif kind == "tool_result":
                    texts, binaries = tool_result_parts(p)
                    t = "\n".join(texts)
                    if t or not binaries:
                        expected.append((uid, kind, red(t)))
                    tool_ids_seen += 1
    by_id = {b["id"]: b for b in manifest["blocks"]}
    order = [m.group(1) for m in BLOCK_RE.finditer(md)]
    exp_ids = [e[0] for e in expected]
    missing = [e for e in expected if e[0] not in found and not by_id.get(e[0], {}).get("file")]
    if missing:
        errors.append(f"{len(missing)} conversation block(s) missing from markdown, e.g. {missing[0][0]} ({missing[0][1]})")
    if [i for i in order if i in set(exp_ids)] != [i for i in exp_ids if i in set(order)]:
        errors.append("blocks are not in the original chronological order")
    bad = 0
    for uid, kind, text in expected:
        meta = by_id.get(uid)
        if meta and meta.get("file"):
            f = DOCS / meta["file"]
            if not f.exists():
                errors.append(f"linked result file missing: {meta['file']}")
            elif rd(f) != text:
                bad += 1
                errors.append(f"result file differs from source: {meta['file']}")
            if f"]({meta['file']})" not in md:
                errors.append(f"result file not linked from markdown: {meta['file']}")
            continue
        if uid not in found:
            continue
        k, raw = found[uid]
        got = raw if k in ("assistant",) else unfence(raw)
        if got != text:
            bad += 1
            if bad <= 5:
                errors.append(f"content mismatch in block {uid} ({kind})")
    for p in manifest.get("persisted", []):
        f = OUT_DIR / "persisted" / p["name"]
        if not f.exists() or sha(rd(f)) != p["sha256"]:
            errors.append(f"persisted file missing or changed: {p['name']}")

    # 3. Counts per kind.
    exp_counts = Counter(k for _, k, _ in expected)
    # Count every block in the markdown, not unique ids: a session continued after a context
    # limit repeats a few records (same uuid, same content) from the session before it.
    got_counts = Counter(m.group(2) for m in BLOCK_RE.finditer(md))
    for k in exp_counts:
        file_backed = sum(1 for e in expected if e[1] == k and by_id.get(e[0], {}).get("file"))
        if exp_counts[k] != got_counts.get(k, 0) + file_backed:
            errors.append(f"count mismatch for {k}: source {exp_counts[k]}, markdown {got_counts.get(k, 0)} + {file_backed} file(s)")

    # 4. The very first prompt (the ChatGPT-authored planning prompt) is present.
    first_user = next((e for e in expected if e[1] == "user"), None)
    if not first_user or first_user[0] not in found:
        errors.append("first user prompt not found")

    # 5. No private strings or secrets in anything that will be published.
    pubs = [OUT_MD] + list((OUT_DIR).rglob("*.txt")) + list((OUT_DIR).rglob("*.md"))
    for f in pubs:
        hits = leaks(rd(f), red)
        if hits:
            errors.append(f"possible secret/private data in {f.relative_to(REPO)}: {sorted(set(hits))}")
    if not red.private:
        warnings.append(f"{PRIVATE_FILE.name} missing or empty: personal strings (e-mail) are not being redacted")

    # 6. ChatGPT link.
    # Only the generated header counts: earlier messages may quote the placeholder verbatim.
    if CHATGPT_PLACEHOLDER in md.split("\n## Sessions", 1)[0]:
        (errors if final else warnings).append("ChatGPT transcript link is still a placeholder")

    for w in warnings:
        print("WARN:", w)
    for e in errors:
        print("FAIL:", e)
    total_chars = sum(len(t) for _, _, t in expected)
    print(f"checked {len(expected)} blocks ({total_chars:,} chars) across {len(manifest['sessions'])} session file(s): "
          + ("OK" if not errors else f"{len(errors)} problem(s)"))
    return 1 if errors else 0


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "export"
    if cmd == "discover":
        print(json.dumps(discover(), indent=1))
        return 0
    if cmd == "export":
        return export()
    if cmd == "verify":
        return verify("--final" in sys.argv)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
