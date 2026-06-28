import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Shield, Users, CheckCircle, Globe, Zap, TrendingUp, RefreshCw, Code, AlertCircle, Smartphone, Home, User, Bell, Clock, CheckCircle2, LocateFixed, Trophy, ArrowUp, ArrowUpRight, ArrowUpLeft, UserCheck, Book, FileText } from "lucide-react";
import afrolocSymbol from "@/assets/afroloc-symbol-brand.webp";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageReader } from "@/components/PageReader";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatedFeatureCard } from "@/components/AnimatedFeatureCard";
import { AnimatedProcessCard } from "@/components/AnimatedProcessCard";
import { StickFigure } from "@/components/StickFigure";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar iOS - beforeinstallprompt não funciona no iOS/Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Apenas adicionar listener se NÃO for iOS
    if (!isIOSDevice) {
      const handler = (e: Event) => {
        e.preventDefault();
        console.log('beforeinstallprompt capturado');
        setDeferredPrompt(e);
        setIsInstallable(true);
      };

      window.addEventListener('beforeinstallprompt', handler);

      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstallApp = async () => {
    // Se for iOS, sempre ir para página de instruções
    if (isIOS) {
      toast.info('No iOS, use Safari e siga as instruções para adicionar à tela inicial');
      navigate("/install");
      return;
    }

    // Se não tiver o prompt disponível (Android/Desktop sem suporte)
    if (!deferredPrompt) {
      navigate("/install");
      return;
    }

    // Tentar instalar via prompt (Chrome/Edge/Android)
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('Aplicativo instalado com sucesso!');
      } else {
        toast.info('Instalação cancelada. Você pode instalar mais tarde.');
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('Erro ao instalar:', error);
      toast.error('Erro ao instalar o aplicativo');
      navigate("/install");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-40 -z-10"></div>
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-float"></div>
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl -z-10 animate-float" style={{ animationDelay: '1s' }}></div>
      
      {/* Header */}
      <header className="glass-strong border-b border-border/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2 animate-fade-in shrink-0">
            <img 
              src={afrolocSymbol} 
              alt="AFROLOC" 
              className="h-8 w-8 sm:h-9 sm:w-9 object-cover rounded-lg shadow-md ring-1 ring-primary/20"
            />
            <span className="text-base sm:text-lg font-display font-bold text-primary whitespace-nowrap tracking-wide">AFROLOC</span>
          </div>
          <nav className="flex items-center gap-0.5 sm:gap-1 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <LanguageSelector />
            <ThemeToggle />
            <div className="hidden md:flex items-center gap-0.5 ml-2">
              <Button variant="ghost" size="sm" className="hover:bg-primary/10 px-3" onClick={() => navigate("/about")}>
                Sobre
              </Button>
              <Button variant="ghost" size="sm" className="hover:bg-primary/10 px-3" onClick={() => navigate("/documents")}>
                <FileText className="h-4 w-4 mr-1" />
                Documentos
              </Button>
              <Button variant="ghost" size="sm" className="hover:bg-primary/10 px-3" onClick={() => navigate("/pricing")}>
                Planos
              </Button>
              <Button variant="ghost" size="sm" className="hover:bg-primary/10 px-3" onClick={() => navigate("/faq")}>
                FAQ
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="hidden sm:flex hover:bg-primary/10 px-3" onClick={() => navigate("/install")}>
              {t('install_app')}
            </Button>
            <div className="flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-primary/30 text-foreground hover:bg-primary/10 hover:border-primary/50 text-xs sm:text-sm px-2.5 sm:px-3 h-8"
                onClick={() => navigate("/login")}
              >
                {t('login')}
              </Button>
              <Button 
                size="sm" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs sm:text-sm px-2.5 sm:px-3 h-8 whitespace-nowrap"
                onClick={() => navigate("/pre-signup")}
              >
                {t('signup')}
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 sm:py-28 relative">
        <div className="mx-auto max-w-5xl">
          <div className="text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-strong border border-border/50 shadow-soft mb-6 animate-scale-in">
              <MapPin className="h-4 w-4 text-primary animate-pulse-glow" />
              <span className="text-sm font-medium">{t('continental_system_badge')}</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent animate-fade-in" style={{ animationDelay: '0.1s' }}>
              {t('hero_title')}
            </h1>
            
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {t('hero_description')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Button 
                size="lg" 
                onClick={() => navigate("/pre-signup")} 
                className="w-full sm:w-auto px-8 py-6 text-lg bg-gradient-primary hover:scale-105 shadow-premium hover:shadow-xl transition-all group"
              >
                <MapPin className="mr-2 h-5 w-5 group-hover:animate-pulse-glow" />
                {t('create_afroloc')}
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={handleInstallApp} 
                className="w-full sm:w-auto px-8 py-6 text-lg glass-strong border-2 border-primary/50 hover:border-primary hover:bg-primary/10 hover:shadow-glow transition-all group"
              >
                <Smartphone className="mr-2 h-5 w-5 group-hover:animate-bounce" />
                {isInstallable ? 'Instalar App' : 'Baixar App'}
                <ArrowUpRight className="ml-2 h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => navigate("/login")} 
                className="w-full sm:w-auto px-8 py-6 text-lg glass-strong border-2 border-border/50 hover:border-primary hover:shadow-glow transition-all"
              >
                {t('enter')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative border-t border-border/50 py-16 sm:py-28">
        <div className="absolute inset-0 bg-dots-pattern opacity-5"></div>
        <div className="container mx-auto px-4 relative">
          <div className="mb-12 text-center sm:mb-16 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50 shadow-soft mb-6">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('key_features_badge')}</span>
            </div>
            <h2 className="mb-4 text-3xl sm:text-5xl font-display font-bold text-foreground">
              {t('why_afroloc')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('why_description')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Problem Statement Card */}
            <AnimatedFeatureCard
              icon={<AlertCircle className="h-6 w-6" />}
              title={t('challenge_title')}
              description={t('challenge_desc')}
              animationSteps={[
                {
                  title: t('challenge_step1_title'),
                  description: t('challenge_step1_desc'),
                  duration: 3000
                },
                {
                  title: t('challenge_step2_title'),
                  description: t('challenge_step2_desc'),
                  duration: 3000
                },
                {
                  title: t('challenge_step3_title'),
                  description: t('challenge_step3_desc'),
                  duration: 3000
                },
                {
                  title: t('challenge_step4_title'),
                  description: t('challenge_step4_desc'),
                  duration: 2500
                }
              ]}
            />

            {/* Universal Addressing */}
            <AnimatedFeatureCard
              icon={<MapPin className="h-6 w-6" />}
              title={t('addressing_title')}
              description={t('addressing_desc')}
              animationSteps={[
                {
                  title: t('addressing_step1_title'),
                  description: t('addressing_step1_desc'),
                  duration: 2500
                },
                {
                  title: t('addressing_step2_title'),
                  description: t('addressing_step2_desc'),
                  duration: 3000
                },
                {
                  title: t('addressing_step3_title'),
                  description: t('addressing_step3_desc'),
                  duration: 2500
                },
                {
                  title: t('addressing_step4_title'),
                  description: t('addressing_step4_desc'),
                  duration: 2500
                }
              ]}
            />

            {/* Community Validation */}
            <AnimatedFeatureCard
              icon={<Users className="h-6 w-6" />}
              title={t('validation_title')}
              description={t('validation_desc')}
              animationSteps={[
                {
                  title: t('validation_step1_title'),
                  description: t('validation_step1_desc'),
                  duration: 2500
                },
                {
                  title: t('validation_step2_title'),
                  description: t('validation_step2_desc'),
                  duration: 3000
                },
                {
                  title: t('validation_step3_title'),
                  description: t('validation_step3_desc'),
                  duration: 2500
                },
                {
                  title: t('validation_step4_title'),
                  description: t('validation_step4_desc'),
                  duration: 3000
                }
              ]}
            />

            {/* Financial Inclusion */}
            <AnimatedFeatureCard
              icon={<TrendingUp className="h-6 w-6" />}
              title={t('financial_title')}
              description={t('financial_desc')}
              animationSteps={[
                {
                  title: t('financial_step1_title'),
                  description: t('financial_step1_desc'),
                  duration: 2500
                },
                {
                  title: t('financial_step2_title'),
                  description: t('financial_step2_desc'),
                  duration: 3000
                },
                {
                  title: t('financial_step3_title'),
                  description: t('financial_step3_desc'),
                  duration: 2500
                },
                {
                  title: t('financial_step4_title'),
                  description: t('financial_step4_desc'),
                  duration: 3000
                }
              ]}
            />

            {/* Periodic Verification */}
            <AnimatedFeatureCard
              icon={<RefreshCw className="h-6 w-6" />}
              title={t('verification_title')}
              description={t('verification_desc')}
              animationSteps={[
                {
                  title: t('verification_step1_title'),
                  description: t('verification_step1_desc'),
                  duration: 2500
                },
                {
                  title: t('verification_step2_title'),
                  description: t('verification_step2_desc'),
                  duration: 2500
                },
                {
                  title: t('verification_step3_title'),
                  description: t('verification_step3_desc'),
                  duration: 2500
                },
                {
                  title: t('verification_step4_title'),
                  description: t('verification_step4_desc'),
                  duration: 2500
                }
              ]}
            />

            {/* Interoperability */}
            <AnimatedFeatureCard
              icon={<Globe className="h-6 w-6" />}
              title={t('interop_title')}
              description={t('interop_desc')}
              animationSteps={[
                {
                  title: t('interop_step1_title'),
                  description: t('interop_step1_desc'),
                  duration: 2500
                },
                {
                  title: t('interop_step2_title'),
                  description: t('interop_step2_desc'),
                  duration: 3000
                },
                {
                  title: t('interop_step3_title'),
                  description: t('interop_step3_desc'),
                  duration: 2500
                },
                {
                  title: t('interop_step4_title'),
                  description: t('interop_step4_desc'),
                  duration: 3000
                }
              ]}
            />

            {/* Open APIs */}
            <AnimatedFeatureCard
              icon={<Code className="h-6 w-6" />}
              title={t('apis_title')}
              description={t('apis_desc')}
              animationSteps={[
                {
                  title: t('apis_step1_title'),
                  description: t('apis_step1_desc'),
                  duration: 2500
                },
                {
                  title: t('apis_step2_title'),
                  description: t('apis_step2_desc'),
                  duration: 3000
                },
                {
                  title: t('apis_step3_title'),
                  description: t('apis_step3_desc'),
                  duration: 2500
                },
                {
                  title: t('apis_step4_title'),
                  description: t('apis_step4_desc'),
                  duration: 3000
                }
              ]}
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 sm:py-28 relative">
        <div className="absolute inset-0 bg-gradient-radial opacity-30"></div>
        <div className="mx-auto max-w-6xl relative">
          <div className="mb-12 text-center sm:mb-16 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-strong border border-border/50 shadow-soft mb-6">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('how_it_works_badge')}</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-foreground">
              {t('how_it_works')}
            </h2>
          </div>
          
          <div className="grid gap-6 md:grid-cols-4">
            {/* Step 1: Georeferencing */}
            <AnimatedProcessCard
              icon={<LocateFixed className="h-6 w-6" />}
              title={t('process_geo_title')}
              description={t('process_geo_desc')}
              scenes={[
                {
                  stickFigures: [
                    { pose: "holding-phone" as const, position: { x: 50, y: 50 }, delay: 0, size: 80 },
                  ],
                  icons: [
                    { Icon: LocateFixed, position: { x: 70, y: 30 }, delay: 500, scale: 1.5, color: "text-green-500" },
                  ],
                  duration: 2500,
                  label: t('process_geo_label1')
                },
                {
                  stickFigures: [
                    { pose: "pointing" as const, position: { x: 40, y: 50 }, delay: 0, size: 70 },
                  ],
                  icons: [
                    { Icon: Home, position: { x: 65, y: 50 }, delay: 200, scale: 1.8, color: "text-blue-500" },
                    { Icon: MapPin, position: { x: 75, y: 35 }, delay: 500, scale: 1.5, color: "text-red-500" },
                  ],
                  duration: 2000,
                  label: t('process_geo_label2')
                },
                {
                  stickFigures: [
                    { pose: "celebrating" as const, position: { x: 50, y: 50 }, delay: 0, size: 80 },
                  ],
                  icons: [
                    { Icon: Trophy, position: { x: 50, y: 35 }, delay: 400, scale: 1.3, color: "text-yellow-500" },
                  ],
                  duration: 2000,
                  label: t('process_geo_label3')
                }
              ]}
            />

            {/* Step 2: Witness Validation */}
            <AnimatedProcessCard
              icon={<UserCheck className="h-6 w-6" />}
              title={t('process_wit_title')}
              description={t('process_wit_desc')}
              scenes={[
                {
                  stickFigures: [
                    { pose: "standing" as const, position: { x: 65, y: 50 }, delay: 0, size: 60, color: "#3B82F6" },
                    { pose: "standing" as const, position: { x: 15, y: 70 }, delay: 200, size: 45, color: "#10B981" },
                    { pose: "standing" as const, position: { x: 45, y: 75 }, delay: 400, size: 45, color: "#10B981" },
                    { pose: "standing" as const, position: { x: 85, y: 70 }, delay: 600, size: 45, color: "#10B981" },
                  ],
                  icons: [
                    { Icon: Home, position: { x: 40, y: 25 }, delay: 0, scale: 1.5, color: "text-blue-500" },
                  ],
                  duration: 2500,
                  label: t('process_wit_label1')
                },
                {
                  stickFigures: [
                    { pose: "standing" as const, position: { x: 65, y: 50 }, delay: 0, size: 60, color: "#3B82F6" },
                    { pose: "standing" as const, position: { x: 15, y: 70 }, delay: 0, size: 45, color: "#10B981" },
                    { pose: "standing" as const, position: { x: 45, y: 75 }, delay: 0, size: 45, color: "#10B981" },
                    { pose: "standing" as const, position: { x: 85, y: 70 }, delay: 0, size: 45, color: "#10B981" },
                  ],
                  icons: [
                    { Icon: Home, position: { x: 50, y: 25 }, delay: 0, scale: 1.5, color: "text-blue-500" },
                    { Icon: Bell, position: { x: 20, y: 55 }, delay: 300, scale: 1.2, color: "text-yellow-500" },
                    { Icon: Bell, position: { x: 50, y: 60 }, delay: 500, scale: 1.2, color: "text-yellow-500" },
                    { Icon: Bell, position: { x: 80, y: 55 }, delay: 700, scale: 1.2, color: "text-yellow-500" },
                  ],
                  duration: 2500,
                  label: t('process_wit_label2')
                },
                {
                  stickFigures: [
                    { pose: "pointing" as const, position: { x: 65, y: 45 }, delay: 0, size: 60, color: "#3B82F6" },
                    { pose: "pointing" as const, position: { x: 15, y: 70 }, delay: 150, size: 45, color: "#10B981" },
                    { pose: "pointing" as const, position: { x: 45, y: 75 }, delay: 300, size: 45, color: "#10B981" },
                    { pose: "pointing" as const, position: { x: 85, y: 70 }, delay: 450, size: 45, color: "#10B981" },
                  ],
                  icons: [
                    { Icon: Home, position: { x: 40, y: 25 }, delay: 0, scale: 1.5, color: "text-blue-500" },
                    { Icon: CheckCircle2, position: { x: 15, y: 55 }, delay: 600, scale: 1.3, color: "text-green-500" },
                    { Icon: CheckCircle2, position: { x: 45, y: 60 }, delay: 800, scale: 1.3, color: "text-green-500" },
                    { Icon: CheckCircle2, position: { x: 85, y: 55 }, delay: 1000, scale: 1.3, color: "text-green-500" },
                  ],
                  duration: 2000,
                  label: t('process_wit_label3')
                }
              ]}
            />

            {/* Step 3: Administrative Validation */}
            <AnimatedProcessCard
              icon={<Users className="h-6 w-6" />}
              title={t('process_val_title')}
              description={t('process_val_desc')}
              scenes={[
                {
                  stickFigures: [
                    // Beneficiário (à esquerda, azul, segurando telefone)
                    { pose: "holding-phone" as const, position: { x: 15, y: 65 }, delay: 0, size: 55, color: "#3B82F6" },
                    // 3 Testemunhas (no meio, cinza, em pé)
                    { pose: "standing" as const, position: { x: 35, y: 65 }, delay: 150, size: 45, color: "#6B7280" },
                    { pose: "standing" as const, position: { x: 50, y: 65 }, delay: 300, size: 45, color: "#6B7280" },
                    { pose: "standing" as const, position: { x: 65, y: 65 }, delay: 450, size: 45, color: "#6B7280" },
                    // Administrador (à direita, verde, maior, caminhando)
                    { pose: "walking" as const, position: { x: 85, y: 60 }, delay: 600, size: 70, color: "#10B981" },
                  ],
                  icons: [
                    { Icon: Home, position: { x: 50, y: 25 }, delay: 0, scale: 2, color: "text-blue-500" },
                    // Ícone Beneficiário
                    { Icon: User, position: { x: 15, y: 48 }, delay: 200, scale: 1.2, color: "text-blue-400" },
                    // Ícones Testemunhas (3x)
                    { Icon: Users, position: { x: 35, y: 48 }, delay: 350, scale: 1, color: "text-gray-400" },
                    { Icon: Users, position: { x: 50, y: 48 }, delay: 500, scale: 1, color: "text-gray-400" },
                    { Icon: Users, position: { x: 65, y: 48 }, delay: 650, scale: 1, color: "text-gray-400" },
                    // Ícone Administrador
                    { Icon: Shield, position: { x: 85, y: 42 }, delay: 800, scale: 1.5, color: "text-green-500" },
                    // Livro do Administrador
                    { Icon: Book, position: { x: 85, y: 52 }, delay: 900, scale: 1.2, color: "text-green-400" },
                  ],
                  duration: 2500,
                  label: t('process_val_label1')
                },
                {
                  stickFigures: [
                    // Beneficiário (azul, apontando)
                    { pose: "pointing" as const, position: { x: 15, y: 65 }, delay: 0, size: 55, color: "#3B82F6" },
                    // 3 Testemunhas (cinza, apontando)
                    { pose: "pointing" as const, position: { x: 35, y: 65 }, delay: 150, size: 45, color: "#6B7280" },
                    { pose: "pointing" as const, position: { x: 50, y: 65 }, delay: 300, size: 45, color: "#6B7280" },
                    { pose: "pointing" as const, position: { x: 65, y: 65 }, delay: 450, size: 45, color: "#6B7280" },
                    // Administrador (verde, maior, apontando)
                    { pose: "pointing" as const, position: { x: 85, y: 60 }, delay: 600, size: 70, color: "#10B981" },
                  ],
                  icons: [
                    { Icon: Home, position: { x: 50, y: 25 }, delay: 0, scale: 2, color: "text-blue-500" },
                    // Ícone Beneficiário
                    { Icon: User, position: { x: 15, y: 48 }, delay: 100, scale: 1.2, color: "text-blue-400" },
                    // Ícones Testemunhas (3x)
                    { Icon: Users, position: { x: 35, y: 48 }, delay: 250, scale: 1, color: "text-gray-400" },
                    { Icon: Users, position: { x: 50, y: 48 }, delay: 400, scale: 1, color: "text-gray-400" },
                    { Icon: Users, position: { x: 65, y: 48 }, delay: 550, scale: 1, color: "text-gray-400" },
                    // Ícone Administrador
                    { Icon: Shield, position: { x: 85, y: 42 }, delay: 200, scale: 1.5, color: "text-green-500" },
                    // Setas apontando para a casa
                    { Icon: ArrowUpRight, position: { x: 22, y: 35 }, delay: 700, scale: 1.2, color: "text-blue-400" },
                    { Icon: ArrowUpRight, position: { x: 41, y: 35 }, delay: 850, scale: 1.2, color: "text-gray-400" },
                    { Icon: ArrowUp, position: { x: 50, y: 35 }, delay: 1000, scale: 1.2, color: "text-gray-400" },
                    { Icon: ArrowUpLeft, position: { x: 59, y: 35 }, delay: 1150, scale: 1.2, color: "text-gray-400" },
                    { Icon: ArrowUpLeft, position: { x: 78, y: 32 }, delay: 1300, scale: 1.3, color: "text-green-400" },
                  ],
                  duration: 2500,
                  label: t('process_val_label2')
                },
                {
                  stickFigures: [
                    { pose: "celebrating" as const, position: { x: 65, y: 50 }, delay: 0, size: 60, color: "#3B82F6" },
                  ],
                  icons: [
                    { Icon: Home, position: { x: 40, y: 25 }, delay: 0, scale: 2, color: "text-blue-500" },
                    { Icon: CheckCircle2, position: { x: 50, y: 10 }, delay: 300, scale: 1.5, color: "text-green-500" },
                    { Icon: Trophy, position: { x: 50, y: 60 }, delay: 500, scale: 1.3, color: "text-yellow-500" },
                  ],
                  duration: 2000,
                  label: t('process_val_label3')
                }
              ]}
            />

            {/* Step 4: Periodic Verification */}
            <AnimatedProcessCard
              icon={<RefreshCw className="h-6 w-6" />}
              title={t('process_ver_title')}
              description={t('process_ver_desc')}
              scenes={[
                {
                  stickFigures: [],
                  icons: [
                    { Icon: Home, position: { x: 50, y: 35 }, delay: 0, scale: 2, color: "text-blue-500" },
                    { Icon: Clock, position: { x: 50, y: 55 }, delay: 300, scale: 1.5, color: "text-muted-foreground" },
                    { Icon: RefreshCw, position: { x: 50, y: 15 }, delay: 600, scale: 1.3, color: "text-primary" },
                  ],
                  duration: 2500,
                  label: t('process_ver_label1')
                },
                {
                  stickFigures: [
                    { pose: "holding-phone" as const, position: { x: 30, y: 60 }, delay: 0, size: 55 },
                  ],
                  icons: [
                    { Icon: Home, position: { x: 70, y: 35 }, delay: 0, scale: 1.8, color: "text-blue-500" },
                    { Icon: Bell, position: { x: 50, y: 40 }, delay: 300, scale: 1.5, color: "text-yellow-500" },
                    { Icon: ArrowUpRight, position: { x: 40, y: 48 }, delay: 600, scale: 1.2, color: "text-yellow-500" },
                  ],
                  duration: 2500,
                  label: t('process_ver_label2')
                },
                {
                  stickFigures: [],
                  icons: [
                    { Icon: Home, position: { x: 50, y: 40 }, delay: 0, scale: 2, color: "text-blue-500" },
                    { Icon: RefreshCw, position: { x: 35, y: 25 }, delay: 300, scale: 1.3, color: "text-primary" },
                    { Icon: CheckCircle2, position: { x: 65, y: 25 }, delay: 600, scale: 1.5, color: "text-green-500" },
                  ],
                  duration: 2000,
                  label: t('process_ver_label3')
                }
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-primary py-12 text-primary-foreground sm:py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-3 text-2xl font-bold sm:mb-4 sm:text-3xl">
            {t('cta_title')}
          </h2>
          <p className="mb-6 text-base opacity-90 sm:mb-8 sm:text-lg">
            {t('cta_description')}
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => navigate("/signup")}
            className="w-full sm:w-auto"
          >
            {t('start_now')}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate("/about")} className="text-muted-foreground hover:text-foreground">
              Sobre
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/documents")} className="text-muted-foreground hover:text-foreground">
              <FileText className="h-4 w-4 mr-1" />
              Documentos
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/brand-guidelines")} className="text-muted-foreground hover:text-foreground">
              <Book className="h-4 w-4 mr-1" />
              Brand Book
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/pricing")} className="text-muted-foreground hover:text-foreground">
              Planos
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/faq")} className="text-muted-foreground hover:text-foreground">
              FAQ
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/contact")} className="text-muted-foreground hover:text-foreground">
              Contacto
            </Button>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{t('footer_initiative')}</p>
            <p className="mt-2">{t('footer_proponent')}</p>
            <p className="mt-3">{t('footer_copyright')}</p>
            <p className="mt-1">{t('footer_version')}</p>
          </div>
        </div>
      </footer>

      {/* Audio Page Reader */}
      <PageReader />
    </div>
  );
}
