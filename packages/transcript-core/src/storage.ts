// Local storage persistence — serialize and deserialize transcript sessions
// for chrome.storage.local. Pure functions with no Chrome API dependency.

import type { TranscriptSession, TranscriptMetadata, StoredSegment } from "./transcript";

export const STORAGE_KEY = "kotomi.transcript.currentSession";
export const STORAGE_SCHEMA_VERSION = "0.1.0";

export interface PersistedSession {
  schemaVersion: string;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  metadata: PersistedMetadata;
  segments: StoredSegment[];
}

export interface PersistedMetadata {
  url?: string;
  title?: string;
  startedAt: number;
  endedAt?: number;
  captureMode: "tab_audio" | "microphone";
  transcriberState?: string;
  source: string;
}

/** Serialize a TranscriptSession to a PersistedSession for storage. */
export function serializeSession(session: TranscriptSession, createdAt?: number): PersistedSession {
  const now = Date.now();
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    sessionId: session.sessionId,
    createdAt: createdAt ?? session.metadata.startedAt,
    updatedAt: now,
    metadata: {
      url: session.metadata.url,
      title: session.metadata.title,
      startedAt: session.metadata.startedAt,
      endedAt: session.metadata.endedAt,
      captureMode: session.metadata.captureMode,
      transcriberState: session.metadata.transcriberState,
      source: session.metadata.source,
    },
    segments: session.segments,
  };
}

/** Deserialize a PersistedSession from storage back to a TranscriptSession. */
export function deserializeSession(data: PersistedSession): TranscriptSession {
  return {
    sessionId: data.sessionId,
    segments: data.segments,
    metadata: {
      url: data.metadata.url,
      title: data.metadata.title,
      startedAt: data.metadata.startedAt,
      endedAt: data.metadata.endedAt,
      captureMode: data.metadata.captureMode,
      transcriberState: data.metadata.transcriberState,
      source: data.metadata.source,
    },
  };
}

/** Validate that stored data looks like a PersistedSession (schemaVersion check). */
export function isValidPersistedSession(data: unknown): data is PersistedSession {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.schemaVersion === STORAGE_SCHEMA_VERSION &&
    typeof d.sessionId === "string" &&
    typeof d.createdAt === "number" &&
    Array.isArray(d.segments)
  );
}
