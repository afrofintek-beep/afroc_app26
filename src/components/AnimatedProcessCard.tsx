import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { StickFigure } from "./StickFigure";

interface AnimationScene {
  icons: {
    Icon: React.ComponentType<any>;
    position: { x: number; y: number };
    delay: number;
    scale?: number;
    color?: string;
  }[];
  stickFigures?: {
    pose: "standing" | "walking" | "pointing" | "waving" | "holding-phone" | "celebrating";
    position: { x: number; y: number };
    delay: number;
    size?: number;
    color?: string;
  }[];
  duration: number;
  label: string;
}

interface AnimatedProcessCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  scenes: AnimationScene[];
}

export const AnimatedProcessCard = ({
  icon,
  title,
  description,
  scenes,
}: AnimatedProcessCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentScene, setCurrentScene] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const hasAutoPlayed = useRef(false);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const playScenes = (sceneIndex: number) => {
    if (sceneIndex >= scenes.length) {
      setIsPlaying(false);
      setCurrentScene(0);
      return;
    }
    setCurrentScene(sceneIndex);
    timeoutRef.current = window.setTimeout(() => playScenes(sceneIndex + 1), scenes[sceneIndex].duration);
  };

  const startAnimation = () => {
    clearTimer();
    setIsPlaying(true);
    setCurrentScene(0);
    playScenes(0);
  };

  const resetAnimation = () => {
    clearTimer();
    setIsPlaying(false);
    setCurrentScene(0);
  };

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

  // Em repouso mostra a 1.ª cena estática (nunca um placeholder vazio).
  const scene = isPlaying ? scenes[currentScene] : scenes[0];

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
        {/* Área visual — mostra sempre a cena (animada quando a tocar, estática em repouso). */}
        <div className="h-32 bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg border-2 border-dashed border-muted-foreground/20 mb-2 overflow-hidden transition-all duration-500 hover:border-primary/30 relative shrink-0">
          {scene && (
            <>
              {isPlaying && <div className="absolute inset-0 bg-gradient-radial from-primary/5 to-transparent animate-pulse" />}

              {scene.icons.map((iconData, index) => {
                const IconComponent = iconData.Icon;
                return (
                  <div
                    key={`icon-${index}`}
                    className={cn("absolute", isPlaying && "animate-fade-in")}
                    style={{
                      left: `${iconData.position.x}%`,
                      top: `${iconData.position.y}%`,
                      transform: "translate(-50%, -50%)",
                      ...(isPlaying
                        ? { animationDelay: `${iconData.delay}ms`, animationDuration: "500ms", animationFillMode: "forwards", opacity: 0 }
                        : { opacity: 1 }),
                    }}
                  >
                    <IconComponent
                      size={iconData.scale ? iconData.scale * 20 : 28}
                      className={cn("relative z-10 drop-shadow-lg", iconData.color || "text-primary", isPlaying && "animate-pulse")}
                      strokeWidth={2.5}
                    />
                  </div>
                );
              })}

              {scene.stickFigures?.map((figureData, index) => (
                <div
                  key={`figure-${index}`}
                  className={cn("absolute", isPlaying && "animate-fade-in")}
                  style={{
                    left: `${figureData.position.x}%`,
                    top: `${figureData.position.y}%`,
                    transform: "translate(-50%, -50%)",
                    ...(isPlaying
                      ? { animationDelay: `${figureData.delay}ms`, animationDuration: "500ms", animationFillMode: "forwards", opacity: 0 }
                      : { opacity: 1 }),
                  }}
                >
                  <StickFigure pose={figureData.pose} size={figureData.size ? figureData.size * 0.8 : 56} color={figureData.color} />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Legenda da cena — sempre visível. */}
        <div className="h-16 mb-2 shrink-0">
          <div
            className={cn(
              "h-full p-2.5 rounded-lg border flex items-center transition-all duration-500",
              isPlaying
                ? "bg-gradient-to-r from-background/95 via-background to-background/95 border-primary/40 shadow-sm backdrop-blur-sm"
                : "bg-muted/30 border-border/50"
            )}
          >
            <p className={cn("text-xs font-semibold truncate", isPlaying ? "text-primary" : "text-foreground/70")}>
              {scene?.label}
            </p>
          </div>
        </div>

        {/* Indicadores de cena. */}
        <div className="flex gap-1.5 shrink-0">
          {scenes.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-500",
                isPlaying && index <= currentScene ? "bg-primary shadow-glow" : "bg-muted"
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
