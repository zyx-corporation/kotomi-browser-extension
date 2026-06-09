# Privacy Design

Kotomi Browser Extension follows a user-initiated capture model.

## Principles

1. No recording starts without explicit user action.
2. No page audio is captured in the background.
3. No audio or transcript is sent to a remote service by default.
4. The default transcription endpoint is localhost.
5. Users can inspect, export, and delete transcript sessions.
6. Each transcript session records source metadata only when needed:
   - URL
   - page title
   - started_at
   - ended_at
   - capture mode
7. Sensitive pages should be excluded by default or require explicit confirmation.

## Default Data Flow

```
Active Tab Audio
→ Chrome Extension
→ Local Kotomi Transcriber
→ Transcript Result
→ Side Panel
→ Local Export
```
