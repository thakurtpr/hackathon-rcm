import { useEffect, useRef, useState, useCallback } from 'react';
import { useApplicationStore, PipelineStage } from '@/store/applicationStore';
import { getApplicationStatus } from '@/lib/api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
const MAX_BACKOFF_MS = 30000;

/**
 * Native WebSocket hook with exponential backoff reconnection and polling fallback.
 * Connects to Go backend's /applications/:app_id/live WebSocket endpoint.
 */
export const useApplicationStatusSocket = (applicationId: string | null) => {
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const updateStageStatus = useApplicationStore((state) => state.updateStageStatus);
  const setWebSocketStatus = useApplicationStore((state) => state.setWebSocketStatus);

  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const retryRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef(1000); // start at 1s
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPollingFallback = useCallback(() => {
    if (!applicationId || pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      try {
        const data = await getApplicationStatus(applicationId);
        if (data?.pipeline_stages) {
          Object.entries(data.pipeline_stages).forEach(([stage, status]) => {
            updateStageStatus(stage, status as PipelineStage['status']);
          });
        }
      } catch {
        // Swallow polling errors silently
      }
    }, 5000);

    return stopPolling;
  }, [applicationId, updateStageStatus, stopPolling]);

  const connect = useCallback(() => {
    if (!applicationId || !mountedRef.current) return;

    const token = typeof window !== 'undefined'
      ? sessionStorage.getItem('access_token') ?? ''
      : '';

    const url = `${WS_URL}/applications/${applicationId}/live${token ? `?token=${token}` : ''}`;

    setWsStatus('connecting');
    setWebSocketStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      backoffRef.current = 1000; // reset backoff on success
      setWsStatus('connected');
      setWebSocketStatus('connected');
      stopPolling(); // stop polling if WS connected
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const payload = JSON.parse(event.data);
        // Handle different message types from backend
        if (payload.pipeline_stages) {
          Object.entries(payload.pipeline_stages).forEach(([stage, status]) => {
            updateStageStatus(stage, status as PipelineStage['status']);
          });
        } else if (payload.stage && payload.status) {
          updateStageStatus(payload.stage, payload.status);
        } else if (payload.topic && payload.payload) {
          // Kafka event forwarded via Redis pubsub
          const inner = payload.payload;
          if (inner.stage) updateStageStatus(inner.stage, inner.status ?? 'completed');
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      // Start polling as fallback on error
      startPollingFallback();
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      setWsStatus('disconnected');
      setWebSocketStatus('disconnected');

      // Exponential backoff reconnect (not on clean close)
      if (event.code !== 1000 && event.code !== 1001) {
        const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);

        retryRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);

        // Start polling as fallback while reconnecting
        startPollingFallback();
      }
    };
  }, [applicationId, setWebSocketStatus, startPollingFallback, stopPolling, updateStageStatus]);

  useEffect(() => {
    mountedRef.current = true;

    if (applicationId) {
      connect();
    }

    return () => {
      mountedRef.current = false;

      // Clean up WebSocket
      if (wsRef.current) {
        wsRef.current.close(1000, 'component unmounted');
        wsRef.current = null;
      }

      // Clean up timers
      stopPolling();
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [applicationId, connect, stopPolling]);

  return { wsStatus, startPollingFallback };
};
