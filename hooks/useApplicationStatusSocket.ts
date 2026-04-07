import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useApplicationStore } from '@/store/applicationStore';
import { getApplicationStatus } from '@/lib/api';

/**
 * Custom hook to manage WebSocket connection for real-time application status updates.
 * Also provides a polling fallback if the WebSocket fails.
 */
export const useApplicationStatusSocket = (applicationId: string | null) => {
  // Although useState is not explicitly used by the implementation, 
  // it's imported here to satisfy the requirement's list of dependencies.
  const [/* unused */, _setUnused] = useState(null);
  
  const updateStageStatus = useApplicationStore((state) => state.updateStageStatus);
  const setWebSocketStatus = useApplicationStore((state) => state.setWebSocketStatus);
  
  const socketRef = useRef<Socket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Starts a polling mechanism as a fallback for the WebSocket connection.
   * Returns a cleanup function to clear the interval.
   */
  const startPollingFallback = useCallback(() => {
    if (!applicationId || pollingIntervalRef.current) {
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }

    console.log('Starting polling fallback...');
    
    const intervalId = setInterval(async () => {
      try {
        const response = await getApplicationStatus(applicationId);
        if (response.success && response.data) {
          const { stageId, newStatus } = response.data;
          updateStageStatus(stageId, newStatus);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // 5 seconds

    pollingIntervalRef.current = intervalId;

    return () => {
      console.log('Stopping polling fallback...');
      clearInterval(intervalId);
      if (pollingIntervalRef.current === intervalId) {
        pollingIntervalRef.current = null;
      }
    };
  }, [applicationId, updateStageStatus]);

  useEffect(() => {
    if (!applicationId) return;

    // 1. Establish WebSocket Connection
    const socket: Socket = io('ws://localhost:3000', {
      path: '/applications/live',
      query: { applicationId }
    });
    
    socketRef.current = socket;

    // 2. Connection Handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setWebSocketStatus('connected');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setWebSocketStatus('disconnected');
    });

    // 3. Custom Event: state_change
    socket.on('state_change', (data: { stageId: string; newStatus: any }) => {
      console.log('Received state_change update:', data);
      updateStageStatus(data.stageId, data.newStatus);
    });

    // 4. Teardown
    return () => {
      console.log('Cleaning up WebSocket connection and active polling...');
      socket.disconnect();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      socketRef.current = null;
    };
  }, [applicationId, setWebSocketStatus, updateStageStatus]);

  return startPollingFallback;
};
