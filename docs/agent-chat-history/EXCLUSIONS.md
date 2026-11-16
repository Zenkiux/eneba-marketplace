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
| 2026-11-16T23:51:55.386Z | Read toolu_01K51WeYGo9i5BT8nuc9AQbk | image image/png, 10,400 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:52:11.464Z | Read toolu_01LdoHW62J7oX1KhyN4zD1sC | image image/jpeg, 314,188 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:52:29.931Z | Read toolu_01EXTWLcLHGrjYtdoQ9trNby | image image/jpeg, 314,496 base64 chars | binary payload (screenshot / PDF page images) |
| 2026-11-16T23:52:33.215Z | Read toolu_014Rc6g1grp4v7TdYx8FfFrS | image image/jpeg, 55,812 base64 chars | binary payload (screenshot / PDF page images) |

## Harness bookkeeping records (not conversation)

| Record type | Count |
|---|---|
| `agent-name` | 62 |
| `api-request` | 124 |
| `api-request-blob` | 97 |
| `api-request-shape` | 4 |
| `atis-latch` | 62 |
| `attachment:agent_listing_delta` | 2 |
| `attachment:auto_mode` | 2 |
| `attachment:credential_org` | 2 |
| `attachment:date` | 2 |
| `attachment:deferred_tools_delta` | 4 |
| `attachment:deferred_tools_record` | 38 |
| `attachment:edited_text_file` | 5 |
| `attachment:environment` | 6 |
| `attachment:mcp_instructions_delta` | 3 |
| `attachment:model` | 2 |
| `attachment:plan_mode` | 1 |
| `attachment:plan_mode_exit` | 1 |
| `attachment:prompt_snapshot` | 4 |
| `attachment:remote_session_change` | 2 |
| `attachment:session_context` | 2 |
| `attachment:silent_turn_reminder` | 12 |
| `attachment:skill_listing` | 2 |
| `custom-title` | 63 |
| `file-history-delta` | 17 |
| `file-history-snapshot` | 4 |
| `last-prompt` | 62 |
| `queue-operation` | 14 |
| `relocated` | 62 |
| `tools-used` | 16 |

Reasoning steps stored without text: 90

Also omitted: `toolUseResult` fields (a structured duplicate of each tool result shown in the main file) and `<system-reminder>` blocks injected by the harness into user messages.
