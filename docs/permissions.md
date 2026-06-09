# Permissions

This extension requires the following Manifest V3 permissions.

## Required Permissions

| Permission | Reason |
|---|---|
| `tabCapture` | Capture audio from the active browser tab. |
| `offscreen` | Create an offscreen document to use `MediaRecorder` APIs. |
| `storage` | Persist transcript sessions and user preferences. |
| `sidePanel` | Display the live transcript in Chrome's side panel. |
| `activeTab` | Access the active tab's URL and title for session metadata. |

## Host Permissions

| Host | Reason |
|---|---|
| `http://localhost/*` | Communicate with the local Kotomi transcriber. |
| `http://127.0.0.1/*` | Alternative loopback address for local transcriber. |

## Non-required Permissions (intentionally omitted)

- **No `<all_urls>`** — The extension only communicates with localhost.
- **No `tabs`** — Tab metadata is obtained through `activeTab`.
- **No `scripting`** — No content scripts are injected in v0.1.
- **No `cookies`** — No cookie access is needed.
- **No `clipboardRead` / `clipboardWrite`** — Export is file-based, not clipboard-based.

## Permission Rationale

Every permission is traceable to a specific, user-visible feature. No permission is requested speculatively for future use.
