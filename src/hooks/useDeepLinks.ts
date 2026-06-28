/**
 * AFROLOC Deep Link Handler
 * 
 * Handles afroloc:// custom scheme and https:// universal links.
 * 
 * Supported deep link patterns:
 *   afroloc://address/{code}        → Navigate to address detail
 *   afroloc://checkin/{recordId}    → Trigger check-in flow
 *   afroloc://verify/{code}        → Open verification page
 *   afroloc://qr/{code}            → Decode QR and navigate
 *   
 * Web fallback:
 *   https://{host}/dl/address/{code}
 *   https://{host}/dl/checkin/{recordId}
 *   https://{host}/dl/verify/{code}
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface DeepLinkResult {
  action: 'address' | 'checkin' | 'verify' | 'qr' | 'unknown';
  code?: string;
  recordId?: string;
  raw: string;
}

function parseDeepLink(url: string): DeepLinkResult {
  const raw = url;

  try {
    // Handle afroloc:// scheme
    let path = '';
    if (url.startsWith('afroloc://')) {
      path = url.replace('afroloc://', '');
    } else {
      // Handle web fallback: /dl/action/code
      const urlObj = new URL(url);
      const dlMatch = urlObj.pathname.match(/^\/dl\/(.+)/);
      if (dlMatch) {
        path = dlMatch[1];
      }
    }

    if (!path) return { action: 'unknown', raw };

    const segments = path.split('/').filter(Boolean);
    const action = segments[0];
    const value = segments[1];

    switch (action) {
      case 'address':
        return { action: 'address', code: value, raw };
      case 'checkin':
        return { action: 'checkin', recordId: value, raw };
      case 'verify':
        return { action: 'verify', code: value, raw };
      case 'qr':
        return { action: 'qr', code: value, raw };
      default:
        return { action: 'unknown', raw };
    }
  } catch {
    return { action: 'unknown', raw };
  }
}

export function useDeepLinks() {
  const navigate = useNavigate();

  const handleDeepLink = useCallback((url: string) => {
    console.log('[DeepLink] Received:', url);
    const result = parseDeepLink(url);
    console.log('[DeepLink] Parsed:', result);

    switch (result.action) {
      case 'address':
        if (result.code) {
          // Navigate to identity detail — search by code
          navigate(`/identity/${result.code}`);
        }
        break;
      case 'checkin':
        if (result.recordId) {
          navigate(`/identity/${result.recordId}?action=checkin`);
        }
        break;
      case 'verify':
        if (result.code) {
          navigate(`/identity/${result.code}?action=verify`);
        }
        break;
      case 'qr':
        if (result.code) {
          navigate(`/identity/${result.code}`);
        }
        break;
      default:
        console.warn('[DeepLink] Unknown action:', result.raw);
    }
  }, [navigate]);

  useEffect(() => {
    // Native: listen for app URL open events
    if (Capacitor.isNativePlatform()) {
      const listener = CapApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        handleDeepLink(event.url);
      });

      return () => {
        listener.then(l => l.remove());
      };
    }

    // Web: check if current URL has /dl/ path (universal link fallback)
    const path = window.location.pathname;
    if (path.startsWith('/dl/')) {
      handleDeepLink(window.location.href);
    }
  }, [handleDeepLink]);

  return { handleDeepLink, parseDeepLink };
}

/**
 * Generate a deep link URL for a given action and code
 */
export function generateDeepLink(
  action: 'address' | 'checkin' | 'verify' | 'qr',
  code: string,
  options?: { preferNative?: boolean; webBaseUrl?: string }
): { native: string; web: string } {
  const webBase = options?.webBaseUrl || window.location.origin;

  return {
    native: `afroloc://${action}/${code}`,
    web: `${webBase}/dl/${action}/${code}`,
  };
}
