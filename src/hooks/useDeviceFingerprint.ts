import { useState, useEffect } from 'react';

interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
  userAgent: string;
}

export const useDeviceFingerprint = () => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  useEffect(() => {
    generateDeviceInfo();
  }, []);

  const generateDeviceInfo = () => {
    const ua = navigator.userAgent;
    
    // Detect device type
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const isTablet = /(iPad|Android(?!.*Mobile))/i.test(ua);
    const deviceType: 'mobile' | 'desktop' | 'tablet' = 
      isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    // Detect browser
    let browser = 'Unknown';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('Opera')) browser = 'Opera';

    // Detect OS
    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    // Generate device name
    const deviceName = `${browser} on ${os}`;

    // Generate fingerprint (simple version - in production use a library like FingerprintJS)
    const fingerprint = generateFingerprint(ua, deviceType, browser, os);

    setDeviceInfo({
      fingerprint,
      deviceName,
      deviceType,
      browser,
      os,
      userAgent: ua
    });
  };

  const generateFingerprint = (
    userAgent: string,
    deviceType: string,
    browser: string,
    os: string
  ): string => {
    // Combine various factors for a semi-unique fingerprint
    const screen = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    const platform = navigator.platform;
    
    const components = [
      userAgent,
      deviceType,
      browser,
      os,
      screen,
      timezone,
      language,
      platform
    ].join('|');

    // Simple hash function (in production use crypto.subtle.digest)
    return btoa(components).substring(0, 32);
  };

  return deviceInfo;
};
