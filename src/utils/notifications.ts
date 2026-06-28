// Utility functions for browser notifications and sound alerts

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
};

export const showBrowserNotification = (title: string, options?: NotificationOptions) => {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/pwa-192x192.png",
      badge: "/apple-touch-icon.png",
      ...options,
    });
  }
};

// Create a simple notification sound using Web Audio API
export const createNotificationSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const playSound = () => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Create a pleasant notification sound (two-tone)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };
  
  return { play: playSound };
};

// Alternative: Use a pre-recorded notification sound
export const playNotificationSound = () => {
  // Create a simple beep sound using Web Audio API
  try {
    const sound = createNotificationSound();
    sound.play();
  } catch (error) {
    console.error("Error playing notification sound:", error);
  }
};
