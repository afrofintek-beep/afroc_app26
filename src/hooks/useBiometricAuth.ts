import { useState, useEffect } from 'react';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';
import { useDeviceFingerprint } from './useDeviceFingerprint';

interface BiometricCapabilities {
  isAvailable: boolean;
  biometryType: BiometryType;
  hasCredentials: boolean;
}

export const useBiometricAuth = () => {
  const [capabilities, setCapabilities] = useState<BiometricCapabilities>({
    isAvailable: false,
    biometryType: BiometryType.NONE,
    hasCredentials: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const deviceInfo = useDeviceFingerprint();

  useEffect(() => {
    checkBiometricCapabilities();
  }, []);

  const checkBiometricCapabilities = async () => {
    try {
      const result = await NativeBiometric.isAvailable();
      const { value: hasCredentials } = await Preferences.get({ key: 'biometric_credentials_saved' });
      
      setCapabilities({
        isAvailable: result.isAvailable,
        biometryType: result.biometryType,
        hasCredentials: hasCredentials === 'true',
      });
    } catch (error) {
      // Silently handle error on web/non-mobile platforms
      console.log('Biometric not available on this platform');
      setCapabilities({
        isAvailable: false,
        biometryType: BiometryType.NONE,
        hasCredentials: false,
      });
    }
  };

  const saveCredentials = async (email: string, password: string) => {
    try {
      await NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: 'afro-id-auth',
      });
      await Preferences.set({ key: 'biometric_credentials_saved', value: 'true' });
      await Preferences.set({ key: 'biometric_email', value: email });
      await checkBiometricCapabilities();
      return true;
    } catch (error) {
      console.error('Error saving biometric credentials:', error);
      return false;
    }
  };

  const authenticateWithBiometric = async (): Promise<{ email: string; password: string } | null> => {
    setIsLoading(true);
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Autenticar com biometria',
        title: 'Login AFROLOC',
        subtitle: 'Use sua biometria para fazer login',
        description: 'Autenticação biométrica segura',
      });

      const credentials = await NativeBiometric.getCredentials({
        server: 'afro-id-auth',
      });

      setIsLoading(false);
      return {
        email: credentials.username,
        password: credentials.password,
      };
    } catch (error) {
      console.error('Biometric authentication error:', error);
      setIsLoading(false);
      return null;
    }
  };

  const deleteCredentials = async () => {
    try {
      await NativeBiometric.deleteCredentials({
        server: 'afro-id-auth',
      });
      await Preferences.remove({ key: 'biometric_credentials_saved' });
      await Preferences.remove({ key: 'biometric_email' });
      await checkBiometricCapabilities();
      return true;
    } catch (error) {
      console.error('Error deleting biometric credentials:', error);
      return false;
    }
  };

  const logBiometricLogin = async () => {
    if (!deviceInfo) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('biometric_login_history').insert({
        user_id: user.id,
        device_name: deviceInfo.deviceName,
        device_type: deviceInfo.deviceType,
        device_fingerprint: deviceInfo.fingerprint,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        biometry_type: getBiometricLabel(),
        login_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging biometric login:', error);
    }
  };

  const getBiometricLabel = () => {
    switch (capabilities.biometryType) {
      case BiometryType.FACE_ID:
        return 'Face ID';
      case BiometryType.TOUCH_ID:
        return 'Touch ID';
      case BiometryType.FINGERPRINT:
        return 'Impressão Digital';
      case BiometryType.FACE_AUTHENTICATION:
        return 'Reconhecimento Facial';
      case BiometryType.IRIS_AUTHENTICATION:
        return 'Reconhecimento de Íris';
      default:
        return 'Biometria';
    }
  };

  return {
    capabilities,
    isLoading,
    saveCredentials,
    authenticateWithBiometric,
    deleteCredentials,
    getBiometricLabel,
    logBiometricLogin,
  };
};
