import { useState, useEffect, useRef } from "react";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedFeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  animationSteps: {
    title: string;
    description: string;
    duration: number;
  }[];
}

export const AnimatedFeatureCard = ({
  icon,
  title,
  description,
  animationSteps,
}: AnimatedFeatureCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const hasAutoPlayed = useRef(false);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const playSteps = (stepIndex: number) => {
    if (stepIndex >= animationSteps.length) {
      setIsPlaying(false);
      setCurrentStep(0); // volta ao 1.º passo em repouso
      return;
    }
    setCurrentStep(stepIndex);
    timeoutRef.current = window.setTimeout(
      () => playSteps(stepIndex + 1),
      animationSteps[stepIndex].duration
    );
  };

  const startAnimation = () => {
    clearTimer();
    setIsPlaying(true);
    setCurrentStep(0);
    playSteps(0);
  };

  const resetAnimation = () => {
    clearTimer();
    setIsPlaying(false);
    setCurrentStep(0);
  };

  // Auto-explica: anima uma vez quando o card entra no ecrã (respeita reduce-motion).
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !hasAutoPlayed.current) {
            hasAutoPlayed.current = true;
            startAnimation();
          }
        });
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Em repouso mostra o 1.º passo (nunca um placeholder vazio).
  const stepData = animationSteps[isPlaying ? currentStep : 0];

  return (
    <Card
      ref={cardRef}
      className="group hover:shadow-xl transition-all duration-500 border-2 hover:border-primary/50 relative overflow-hidden flex flex-col h-full"
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 opacity-0 transition-all duration-700",
          isPlaying && "opacity-100"
        )}
      />

      <CardHeader className="relative pb-3 z-10">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/20 text-primary mb-3 transition-all duration-500 shadow-sm",
              isPlaying && "scale-110 shadow-glow"
            )}
          >
            {icon}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={isPlaying ? resetAnimation : startAnimation}
            aria-label={isPlaying ? "Reiniciar" : "Ver de novo"}
            className="hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-sm h-8 w-8 p-0"
          >
            {isPlaying ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <CardTitle
          className={cn(
            "text-base font-semibold transition-all duration-500 mb-1.5 line-clamp-1",
            isPlaying && "text-primary"
          )}
        >
          {title}
        </CardTitle>
        <CardDescription className="text-xs line-clamp-2 leading-relaxed">{description}</CardDescription>
      </CardHeader>

      <CardContent className="relative flex-1 flex flex-col z-10">
        {/* Corpo: sempre com conteúdo real (passo atual ou 1.º passo em repouso). */}
        <div className="h-20 mb-2 shrink-0">
          <div
            className={cn(
              "h-full p-2.5 rounded-lg border animate-fade-in flex flex-col transition-all duration-500",
              isPlaying
                ? "bg-gradient-to-r from-background/95 via-background to-background/95 border-primary/40 shadow-sm backdrop-blur-sm"
                : "bg-muted/30 border-border/50"
            )}
          >
            <h4 className="font-semibold text-xs mb-1 flex items-center gap-1.5 shrink-0">
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full", isPlaying ? "bg-primary animate-pulse" : "bg-muted-foreground/40")} />
              <span className={cn("truncate", isPlaying && "text-primary")}>{stepData?.title}</span>
            </h4>
            <p className="text-[11px] text-muted-foreground flex-1 line-clamp-3 leading-relaxed overflow-hidden">
              {stepData?.description}
            </p>
          </div>
        </div>

        {/* Indicadores de passo. */}
        <div className="flex gap-1.5 shrink-0">
          {animationSteps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-500",
                isPlaying && index <= currentStep ? "bg-primary shadow-glow" : "bg-muted"
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
