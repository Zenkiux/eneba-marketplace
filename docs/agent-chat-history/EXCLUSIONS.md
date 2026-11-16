# Items not reproduced in agent-chat-history.md

## Binary payloads

| Time | Tool / id | Item | Reason |
|---|---|---|---|
| 2026-11-16T23:03:21.995Z | Read toolu_01UzWGkKLFFS2PsTBKNcK7iq | document application/pdf, 205,096 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:07:37.653Z | mcp__Claude_Browser__computer toolu_01TxKgPrZtq2grU3m4haZbSy | image image/jpeg, 56,092 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:07:37.653Z | mcp__Claude_Browser__computer toolu_01TxKgPrZtq2grU3m4haZbSy | mcp-Claude_Browser-blob-1794870457643-b24b13.jpg (42,068 bytes) | binary file stored by Claude Code (screenshot) |
| 2026-11-16T23:08:06.634Z | mcp__Claude_Browser__computer toolu_01VgKpPDTfLqi69g3JusGyP4 | image image/jpeg, 48,256 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:08:06.634Z | mcp__Claude_Browser__computer toolu_01VgKpPDTfLqi69g3JusGyP4 | mcp-Claude_Browser-blob-1794870486613-mqm8lx.jpg (36,191 bytes) | binary file stored by Claude Code (screenshot) |
| 2026-11-16T23:08:27.009Z | mcp__Claude_Browser__computer toolu_01Q91AMfqerWL3KMCmbr3391 | image image/jpeg, 32,768 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:08:27.009Z | mcp__Claude_Browser__computer toolu_01Q91AMfqerWL3KMCmbr3391 | mcp-Claude_Browser-blob-1794870507000-c3hryh.jpg (24,574 bytes) | binary file stored by Claude Code (screenshot) |
| 2026-11-16T23:08:41.998Z | mcp__Claude_Browser__computer toolu_014p1dzSXnNYpL7WvCZ2tjGt | image image/jpeg, 80,588 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:08:41.998Z | mcp__Claude_Browser__computer toolu_014p1dzSXnNYpL7WvCZ2tjGt | mcp-Claude_Browser-blob-1794870521975-crf70j.jpg (60,440 bytes) | binary file stored by Claude Code (screenshot) |
| 2026-11-16T23:08:47.564Z | mcp__Claude_Browser__computer toolu_01EY5tgywP4XspcAvJJnpnTa | image image/jpeg, 28,288 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:08:47.564Z | mcp__Claude_Browser__computer toolu_01EY5tgywP4XspcAvJJnpnTa | mcp-Claude_Browser-blob-1794870527553-aeaad8.jpg (21,214 bytes) | binary file stored by Claude Code (screenshot) |
| 2026-11-16T23:08:52.535Z | mcp__Claude_Browser__computer toolu_01Ao7PUepug3kwHLX1wfM4n7 | image image/jpeg, 29,800 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:08:52.535Z | mcp__Claude_Browser__computer toolu_01Ao7PUepug3kwHLX1wfM4n7 | mcp-Claude_Browser-blob-1794870532517-3844h0.jpg (22,348 bytes) | binary file stored by Claude Code (screenshot) |
| 2026-11-16T23:09:20.209Z | mcp__Claude_Browser__computer toolu_01TEPQxhqdVTu1ARkbVoMmrj | image image/jpeg, 22,540 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:09:20.209Z | mcp__Claude_Browser__computer toolu_01TEPQxhqdVTu1ARkbVoMmrj | mcp-Claude_Browser-blob-1794870560204-xw258a.jpg (16,905 bytes) | binary file stored by Claude Code (screenshot) |

## Harness bookkeeping records (not conversation)

| Record type | Count |
|---|---|
| `agent-name` | 37 |
| `api-request` | 56 |
| `api-request-blob` | 46 |
| `api-request-shape` | 3 |
| `atis-latch` | 37 |
| `attachment:agent_listing_delta` | 1 |
| `attachment:auto_mode` | 1 |
| `attachment:credential_org` | 1 |
| `attachment:date` | 1 |
| `attachment:deferred_tools_delta` | 2 |
| `attachment:deferred_tools_record` | 17 |
| `attachment:edited_text_file` | 1 |
| `attachment:environment` | 1 |
| `attachment:mcp_instructions_delta` | 2 |
| `attachment:model` | 1 |
| `attachment:plan_mode` | 1 |
| `attachment:plan_mode_exit` | 1 |
| `attachment:prompt_snapshot` | 2 |
| `attachment:remote_session_change` | 1 |
| `attachment:session_context` | 1 |
| `attachment:silent_turn_reminder` | 6 |
| `attachment:skill_listing` | 1 |
| `custom-title` | 38 |
| `file-history-delta` | 10 |
| `file-history-snapshot` | 1 |
| `last-prompt` | 37 |
| `queue-operation` | 4 |
| `relocated` | 37 |
| `tools-used` | 13 |

Reasoning steps stored without text: 41

Also omitted: `toolUseResult` fields (a structured duplicate of each tool result shown in the main file) and `<system-reminder>` blocks injected by the harness into user messages.
