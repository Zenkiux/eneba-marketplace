# Test results log

Real results only. Automated and manual checks are listed separately.

## 2026-11-17 — transcript pipeline

Automated (command output):
- `transcripts.py export` → `exported 1 session file(s) …`; `verify` → `checked … blocks … : OK` (only warning: ChatGPT link placeholder).
- Tamper test 1: changed "Planning" → "Planing" in the first prompt → `FAIL: content mismatch in block 868fdc42-…:0 (user)`, exit 1.
- Tamper test 2: appended a line to `results/toolu_01Gg….txt` → `FAIL: result file differs from source`, exit 1.
- Private-string scan of `docs/` after redaction fix → no hits.

Manual:
- Desktop app Export zip compared with the live JSONL: 169/169 messages present in live file.
- Stop-hook command run by hand → export + verify OK, log written.
