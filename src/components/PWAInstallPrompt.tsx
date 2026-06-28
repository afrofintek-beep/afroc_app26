import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Pages where we don't show the install prompt
  const excludedPages = ['/install', '/app-download', '/login', '/signup', '/pre-signup', '/admin/login'];

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // Listen for install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show after a delay (since beforeinstallprompt doesn't fire)
    if (isIOS && isMobile) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000); // Show after 3 seconds on iOS

      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsVisible(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [isMobile]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Try native install prompt first
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsVisible(false);
        }
        setDeferredPrompt(null);
        return;
      } catch (error) {
        console.error('Install prompt error:', error);
      }
    }
    
    // Navigate to install page for instructions
    navigate('/install');
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if installed, dismissed, not mobile, or on excluded pages
  if (isInstalled || isDismissed || !isMobile || !isVisible) {
    return null;
  }

  // Don't show on excluded pages
  if (excludedPages.some(page => location.pathname.startsWith(page))) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-fade-in">
      <div className="bg-primary text-primary-foreground rounded-xl shadow-lg p-4 flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
            <Download className="h-5 w-5" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Instalar AFROLOC</p>
          <p className="text-xs text-primary-foreground/80 truncate">
            Acesso rápido e funciona offline
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleInstallClick}
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            Instalar
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
