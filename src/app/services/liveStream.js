import { API_ENDPOINTS } from "./api";
import { getApiAuthorizationHeader, getApiBaseUrl } from "../config/runtimeConfig";
import { readLocalStorage, STORAGE_KEY_NAMES } from "../config/storage";

function buildStreamUrl(institution) {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const path = API_ENDPOINTS.dashboards.liveStream;
  const params = new URLSearchParams();
  if (institution) {
    params.set("institution", institution);
  }
  const token = readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN);
  if (token) {
    params.set("auth-token", token);
  }
  const query = params.toString();
  return query ? `${base}${path}?${query}` : `${base}${path}`;
}

function buildStreamHeaders() {
  const token = readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN);
  const staticAuthorization = getApiAuthorizationHeader();
  const sessionAuthorization = token ? `Bearer ${token}` : "";
  const authorizationHeader = staticAuthorization || sessionAuthorization || undefined;

  return {
    Accept: "text/event-stream",
    ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
    ...(token ? { "auth-token": token } : {}),
  };
}

function parseSseBlock(block) {
  if (!block || !block.trim()) return null;
  let eventName = "message";
  const dataLines = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join("\n");
  try {
    return { eventName, data: JSON.parse(raw) };
  } catch {
    return { eventName, data: raw };
  }
}

/**
 * Connect to GET /transactions/live-stream using fetch (supports auth headers).
 * Calls onEvent(eventName, data) for each SSE frame; resolves when stream closes.
 */
export async function connectLiveTransactionStream({
  institution,
  signal,
  onEvent,
} = {}) {
  const url = buildStreamUrl(institution);
  const response = await fetch(url, {
    method: "GET",
    headers: buildStreamHeaders(),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Live stream failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error("Live stream not supported in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseBlock(block);
      if (parsed && onEvent) {
        onEvent(parsed.eventName, parsed.data);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

export const LIVE_STREAM_RECONNECT_MS = 5000;
