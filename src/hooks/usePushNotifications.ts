import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    checkPushSupport();
    checkExistingSubscription();
  }, []);

  const checkPushSupport = () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if (!supported) {
      console.log('[Push] Push notifications not supported');
    }
  };

  const checkExistingSubscription = async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await (registration as any).pushManager.getSubscription();
      
      if (existingSub) {
        setIsSubscribed(true);
        setSubscription(existingSub);
        console.log('[Push] Existing subscription found');
      }
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
    }
  };

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('[Push] Notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  };

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Notificações push não são suportadas neste navegador');
      return false;
    }

    setLoading(true);

    try {
      // Request notification permission
      const permission = await requestPermission();
      
      if (permission !== 'granted') {
        toast.error('Permissão para notificações negada');
        setLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // VAPID public key (you'll need to generate this)
      // For now, using a placeholder - you should generate your own keys
      const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xQmrpcPBblQy5F-HsGfZmr5WyLQtGxzWHQ5c4cYiLfXvJ9Q5p_VYE';
      
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push notifications
      const pushSubscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as BufferSource
      });

      console.log('[Push] Subscription successful:', pushSubscription);

      // Save subscription to database
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const p256dhKey = pushSubscription.getKey('p256dh');
        const authKey = pushSubscription.getKey('auth');

        const subscriptionData: PushSubscriptionData = {
          endpoint: pushSubscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(p256dhKey),
            auth: arrayBufferToBase64(authKey)
          }
        };

        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            subscription: subscriptionData as any,
            updated_at: new Date().toISOString()
          } as any, {
            onConflict: 'user_id'
          });

        if (error) {
          console.error('[Push] Error saving subscription:', error);
          toast.error('Erro ao guardar inscrição');
          setLoading(false);
          return false;
        }
      }

      setIsSubscribed(true);
      setSubscription(pushSubscription);
      toast.success('Notificações push ativadas!');
      setLoading(false);
      return true;

    } catch (error) {
      console.error('[Push] Error subscribing:', error);
      toast.error('Erro ao ativar notificações push');
      setLoading(false);
      return false;
    }
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    if (!subscription) {
      return false;
    }

    setLoading(true);

    try {
      await subscription.unsubscribe();

      // Remove from database
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id);
      }

      setIsSubscribed(false);
      setSubscription(null);
      toast.success('Notificações push desativadas');
      setLoading(false);
      return true;

    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      toast.error('Erro ao desativar notificações push');
      setLoading(false);
      return false;
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer | null): string => {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  return {
    isSupported,
    isSubscribed,
    loading,
    subscribeToPush,
    unsubscribeFromPush,
    requestPermission
  };
};
