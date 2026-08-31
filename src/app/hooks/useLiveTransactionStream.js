import { useCallback, useEffect, useRef } from "react";
import { connectLiveTransactionStream, LIVE_STREAM_RECONNECT_MS } from "../services/liveStream";

/**
 * Subscribe to server-pushed live transactions via SSE.
 * Falls back via onStreamError so callers can resume polling.
 */
export function useLiveTransactionStream({
  institution = null,
  enabled = true,
  paused = false,
  onTransaction,
  onMetricsDelta,
  onConnected,
  onStreamError,
} = {}) {
  const callbacksRef = useRef({ onTransaction, onMetricsDelta, onConnected, onStreamError });
  callbacksRef.current = { onTransaction, onMetricsDelta, onConnected, onStreamError };

  const connectOnce = useCallback(async (signal) => {
    await connectLiveTransactionStream({
      institution: institution || undefined,
      signal,
      onEvent: (eventName, data) => {
        if (eventName === "connected") {
          callbacksRef.current.onConnected?.(data);
          return;
        }
        if (eventName === "transaction" && data?.data) {
          callbacksRef.current.onTransaction?.(data.data);
          return;
        }
        if (eventName === "metrics-delta") {
          callbacksRef.current.onMetricsDelta?.(data);
          return;
        }
        if (data?.type === "transaction" && data?.data) {
          callbacksRef.current.onTransaction?.(data.data);
        } else if (data?.type === "metrics-delta") {
          callbacksRef.current.onMetricsDelta?.(data);
        }
      },
    });
  }, [institution]);

  useEffect(() => {
    if (!enabled || paused) return undefined;

    const abort = new AbortController();
    let reconnectTimer = null;
    let cancelled = false;

    const run = async () => {
      try {
        await connectOnce(abort.signal);
        if (!cancelled && !abort.signal.aborted) {
          callbacksRef.current.onStreamError?.(new Error("Live stream closed"));
        }
      } catch (error) {
        if (abort.signal.aborted || cancelled) return;
        callbacksRef.current.onStreamError?.(error);
      }

      if (!cancelled && !abort.signal.aborted && enabled && !paused) {
        reconnectTimer = window.setTimeout(run, LIVE_STREAM_RECONNECT_MS);
      }
    };

    run();

    return () => {
      cancelled = true;
      abort.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [enabled, paused, institution, connectOnce]);
}
