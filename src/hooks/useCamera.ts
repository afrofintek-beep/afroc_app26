import { useState, useCallback } from "react";
import { Camera, CameraResultType, CameraSource, Photo } from "@capacitor/camera";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

export function useCamera() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isNative = Capacitor.isNativePlatform();

  const checkPermissions = useCallback(
    async (required: "camera" | "photos") => {
      if (!isNative) {
        // On web, permissions are handled by the browser
        return true;
      }

      const isPhotosOk = (value: string | undefined) =>
        value === "granted" || value === "limited";

      const hasRequired = (perm: { camera?: string; photos?: string }) => {
        if (required === "camera") return perm.camera === "granted";
        return isPhotosOk(perm.photos);
      };

      try {
        const permission = await Camera.checkPermissions();
        console.log("Camera permissions:", permission);

        if (!hasRequired(permission)) {
          const requestResult = await Camera.requestPermissions({ permissions: [required] });
          console.log("Permission request result:", requestResult);

          if (!hasRequired(requestResult)) {
            throw new Error(`Missing ${required} permission`);
          }
        }

        return true;
      } catch (error: any) {
        console.error("Permission error:", error);
        toast({
          title: "Permissão necessária",
          description:
            required === "camera"
              ? "Permita o acesso à câmara para capturar a foto."
              : "Permita o acesso às fotos para selecionar da galeria.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, isNative],
  );

  const warnIfEmbedded = useCallback(
    (purpose: "camera" | "gallery") => {
      if (typeof window === "undefined") return;

      // Check if in iframe - warn but don't block (many browsers allow file input in iframes)
      let inIframe = false;
      try {
        inIframe = window.self !== window.top;
      } catch {
        inIframe = true;
      }

      if (inIframe) {
        console.log(`[useCamera] Running in iframe, attempting ${purpose} anyway...`);
      }
    },
    [],
  );

  const ensureWebPickerAllowed = useCallback(
    (purpose: "camera" | "gallery") => {
      if (typeof window === "undefined") return false;

      // iOS requires secure context for camera / file capture.
      if (!window.isSecureContext && window.location.hostname !== "localhost") {
        toast({
          title: "Ligação não segura",
          description: "A câmara/galeria só funciona em HTTPS.",
          variant: "destructive",
        });
        return false;
      }

      // Warn about iframe but don't block - many browsers now support file inputs in iframes
      warnIfEmbedded(purpose);

      // Helps debugging when user expects camera but browser shows file chooser.
      console.log(`[useCamera] Web picker allowed for: ${purpose}`);
      return true;
    },
    [toast, warnIfEmbedded],
  );

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const selectFromFileInput = useCallback(
    (capture?: boolean): Promise<string | null> => {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.style.position = "fixed";
        input.style.left = "-9999px";
        input.style.width = "1px";
        input.style.height = "1px";
        input.style.opacity = "0";

        if (capture) {
          // iOS Safari is more reliable when using setAttribute
          input.setAttribute("capture", "environment");
        }

        document.body.appendChild(input);

        let resolved = false;
        let selectionInProgress = false;
        let timeoutId: number | undefined;

        const cleanup = () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          if (timeoutId) window.clearTimeout(timeoutId);
          input.remove();
        };

        const safeResolve = (value: string | null) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve(value);
        };

        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            safeResolve(null);
            return;
          }

          selectionInProgress = true;

          try {
            const base64 = await fileToBase64(file);
            safeResolve(base64);
          } catch (error) {
            console.error("File read error:", error);
            safeResolve(null);
          }
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible" && !selectionInProgress) {
            // Small delay to allow onchange to fire first if file was selected
            window.setTimeout(() => {
              if (!selectionInProgress) safeResolve(null);
            }, 200);
          }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        timeoutId = window.setTimeout(() => {
          if (!selectionInProgress) safeResolve(null);
        }, 30000);

        // Must be synchronous within the same user gesture.
        input.click();
      });
    },
    [],
  );

  const takePicture = useCallback(
    async (): Promise<string | null> => {
      if (loading) return null;

      if (!isNative && !ensureWebPickerAllowed("camera")) {
        return null;
      }

      setLoading(true);
      try {
        if (!isNative) {
          return await selectFromFileInput(true);
        }

        const hasPermission = await checkPermissions("camera");
        if (!hasPermission) return null;

        const photo: Photo = await Camera.getPhoto({
          quality: 100,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          saveToGallery: true,
          // IMPORTANT: Set to false to preserve EXIF metadata including GPS
          correctOrientation: false,
        });

        if (!photo.base64String) {
          throw new Error("Failed to capture photo");
        }

        return `data:image/${photo.format};base64,${photo.base64String}`;
      } catch (error: any) {
        console.error("Camera error:", error);

        if (error?.message !== "User cancelled photos app") {
          toast({
            title: "Erro da câmara",
            description: error?.message || "Falha ao capturar foto",
            variant: "destructive",
          });
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    [loading, isNative, ensureWebPickerAllowed, selectFromFileInput, checkPermissions, toast],
  );

  const selectFromGallery = useCallback(
    async (): Promise<string | null> => {
      if (loading) return null;

      if (!isNative && !ensureWebPickerAllowed("gallery")) {
        return null;
      }

      setLoading(true);
      try {
        if (!isNative) {
          return await selectFromFileInput(false);
        }

        const hasPermission = await checkPermissions("photos");
        if (!hasPermission) return null;

        const photo: Photo = await Camera.getPhoto({
          quality: 100,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Photos,
          saveToGallery: false,
          // IMPORTANT: Set to false to preserve EXIF metadata including GPS
          correctOrientation: false,
        });

        if (!photo.base64String) {
          throw new Error("Failed to select photo");
        }

        return `data:image/${photo.format};base64,${photo.base64String}`;
      } catch (error: any) {
        console.error("Gallery error:", error);

        if (error?.message !== "User cancelled photos app") {
          toast({
            title: "Erro da galeria",
            description: error?.message || "Falha ao selecionar foto",
            variant: "destructive",
          });
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    [loading, isNative, ensureWebPickerAllowed, selectFromFileInput, checkPermissions, toast],
  );

  return {
    loading,
    takePicture,
    selectFromGallery,
    checkPermissions,
  };
}
