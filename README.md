# Kotomi Browser Extension

Kotomi Browser Extension is a Chrome extension that captures audio from the current browser tab and sends it to a local Kotomi transcription service.

It is designed as the browser-side “ear” of Kotomi: a lightweight interface for turning web audio, meetings, lectures, videos, and streams into structured transcripts.

## Goals

- Capture audio from the active browser tab
- Stream audio chunks to a local transcription backend
- Display live transcript in the browser side panel
- Export transcripts as Markdown and JSON
- Keep user control explicit: no background recording, no silent upload

## Non-goals

- General web scraping
- Browser history analysis
- Hidden monitoring
- Cloud-only transcription
- Automatic recording without user action
