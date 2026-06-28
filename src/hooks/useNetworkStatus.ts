import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string>('unknown');

  useEffect(() => {
    // Check initial status
    const checkStatus = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        setNetworkType(status.connectionType);
      } catch (error) {
        console.error('Network status check failed:', error);
        // Fallback to browser API
        setIsOnline(navigator.onLine);
      }
    };

    checkStatus();

    // Listen for network changes
    const listener = Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed:', status);
      setIsOnline(status.connected);
      setNetworkType(status.connectionType);
    });

    // Cleanup
    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  return { isOnline, networkType };
}
