# AI conversation logging

Eneba requires the **full** agent chat history (prompts and responses). This is how we keep it complete and how anyone can check that it is.

## AI tools used

| Tool | Used for | Where the history is |
|---|---|---|
| ChatGPT | Analysing the assignment; writing the original Claude Code Plan Mode prompt (the first user message in the Claude transcript); reviewing revision 1 of the plan | Shared link: https://chatgpt.com/share/6afb8cee-cbcc-83ed-b0cd-8dc72839ec88 (to be filled in) |
| Claude Code (desktop app, Opus 5.5) | Planning, research of eneba.com, all implementation, testing, deployment | `docs/agent-chat-history.md` |

## Where Claude Code keeps conversations (verified 2026-11-17)

- Claude Code 2.1.282 writes every session to an append-only JSONL file: `~/.claude/projects/<project path with / replaced by ->/<sessionId>.jsonl`.
- Next to it, `<sessionId>/tool-results/` holds large outputs and screenshots, and `<sessionId>/subagents/` holds sub-agent transcripts.
- The file holds every user message (including messages sent while Claude is working, stored as `queued_command` attachments), every assistant reply, every tool call and every tool result, with timestamps.
- The model's private reasoning is stored **without its text**. It can't be exported; the transcript shows a placeholder where it happened.
- Context compaction appends a summary; earlier messages stay in the file, so nothing is lost.
- By default Claude Code deletes transcripts after 30 days. We set `"cleanupPeriodDays": 3650` in `~/.claude/settings.json` (previous file kept as `settings.json.bak-20261117`).
- `/export` is a slash command of the terminal CLI; it isn't available inside the desktop app's Code tab. The desktop app's own **Export** (session menu) writes a zip with the transcript, sub-agent transcripts and metadata to `~/Downloads`. We tested it: every message in the zip is also in the live JSONL (169 of 169; the live file had 4 more, written after the export).

## Pipeline

`scripts/transcripts/transcripts.py` (Python standard library only):

| Command | What it does |
|---|---|
| `discover` | Lists every session file for this repo: main sessions, sub-agents, and sessions in other project folders whose working directory was this repo |
| `export` | Writes `docs/agent-chat-history.md` and `docs/agent-chat-history/` |
| `verify [--final]` | Checks the export against the raw files (below) |

Export rules:
- User prompts, Claude's replies and tool-call inputs are copied **verbatim and in full**. User prompts are in text fences so markup in pasted text stays visible.
- Tool results up to 20,000 characters are inline; longer ones are copied verbatim to `docs/agent-chat-history/results/` and linked. Outputs Claude Code saved to separate text files are copied to `docs/agent-chat-history/persisted/` and linked. Nothing is truncated.
- Not reproduced, and listed in `docs/agent-chat-history/EXCLUSIONS.md`: binary payloads (screenshots, PDF page images), harness bookkeeping records, `<system-reminder>` context the harness injects into messages, and the `toolUseResult` duplicate of each tool result.
- Redaction: strings in `scripts/transcripts/private-strings.local.txt` (gitignored; contains the owner's e-mail), connection strings, tokens and known secret variables become `[REDACTED:<kind>]`; the home directory becomes `~`. Counts are printed at the top of the transcript.

Verification (`verify`) fails if:
- a session file on disk is missing from the export;
- any prompt, reply, tool input or tool result differs from the raw source (exact text comparison after the same redaction), or a linked file is missing, unlinked or changed;
- block counts per kind differ, or blocks are out of order;
- the first planning prompt is missing;
- a private string or secret pattern appears in any published file;
- (`--final` only) the ChatGPT link is still a placeholder.

Tested on 2026-11-17: export + verify pass on session 1; changing one word in a prompt and appending a line to a result file were both detected.

## Automation and backups

- Project hook (`.claude/settings.json`, `Stop`) runs export + verify after every Claude turn; output goes to `.claude/transcript-hook.log` (gitignored). Committing the transcript is a manual, reviewed step.
- Raw JSONL is **never** committed (`*.jsonl` is gitignored). Private backups: `~/EnebaTask-transcripts-backup/<timestamp>/` (copied at each milestone) and the desktop Export zips in `~/Downloads`.

## Before submission

1. `python3 -I scripts/transcripts/transcripts.py export`
2. `python3 -I scripts/transcripts/transcripts.py verify --final`
3. Skim the whole file once for readability.
4. Fresh raw backup + desktop Export zip.
5. Commit and push; open `docs/agent-chat-history.md` on GitHub while logged out and click a result-file link.
