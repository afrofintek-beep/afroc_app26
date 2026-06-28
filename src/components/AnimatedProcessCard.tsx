import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { StickFigure } from "./StickFigure";
import { useLanguage } from "@/contexts/LanguageContext";

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
  scenes
}: AnimatedProcessCardProps) => {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentScene, setCurrentScene] = useState(0);

  const startAnimation = () => {
    setIsPlaying(true);
    setCurrentScene(0);
    playScenes(0);
  };

  const playScenes = (sceneIndex: number) => {
    if (sceneIndex >= scenes.length) {
      setIsPlaying(false);
      setCurrentScene(0);
      return;
    }

    setCurrentScene(sceneIndex);
    
    setTimeout(() => {
      playScenes(sceneIndex + 1);
    }, scenes[sceneIndex].duration);
  };

  const resetAnimation = () => {
    setIsPlaying(false);
    setCurrentScene(0);
  };

  const currentSceneData = scenes[currentScene];

  return (
    <Card className="group hover:shadow-xl transition-all duration-500 border-2 hover:border-primary/50 relative overflow-hidden flex flex-col h-full">
      {/* Animated background gradient - More vibrant */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 opacity-0 transition-all duration-700",
        isPlaying && "opacity-100 animate-pulse"
      )} />
      
      {/* Floating particles effect when playing */}
      {isPlaying && (
        <>
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-primary/30 rounded-full animate-float" style={{ animationDelay: '0s' }} />
          <div className="absolute top-1/4 right-1/4 w-1.5 h-1.5 bg-accent/30 rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-primary/20 rounded-full animate-float" style={{ animationDelay: '1s' }} />
        </>
      )}
      
      <CardHeader className="relative pb-3 z-10">
        <div className="flex items-start justify-between">
          <div className={cn(
            "p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/20 text-primary mb-3 transition-all duration-500 shadow-sm",
            isPlaying && "scale-110 shadow-glow animate-pulse"
          )}>
            {icon}
          </div>
          <div className="flex gap-2">
            {!isPlaying ? (
              <Button
                size="sm"
                variant="outline"
                onClick={startAnimation}
                className="hover:bg-primary hover:text-primary-foreground hover:scale-105 transition-all duration-300 shadow-sm h-8 w-8 p-0"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={resetAnimation}
                className="hover:scale-105 transition-all duration-300 h-8 w-8 p-0"
              >
                <RotateCcw className="h-3.5 w-3.5 animate-spin" />
              </Button>
            )}
          </div>
        </div>
        <CardTitle className={cn(
          "text-base font-semibold transition-all duration-500 mb-1.5 line-clamp-1",
          isPlaying && "text-primary scale-105"
        )}>
          {title}
        </CardTitle>
        <CardDescription className="text-xs line-clamp-2 leading-relaxed">{description}</CardDescription>
      </CardHeader>
      
      <CardContent className="relative flex-1 flex flex-col z-10">
        {/* Visual Animation Area - ONLY icons and figures */}
        <div className="h-32 bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg border-2 border-dashed border-muted-foreground/20 mb-2 overflow-hidden transition-all duration-500 hover:border-primary/30 relative shrink-0">
          {isPlaying && currentSceneData && (
            <>
              {/* Scene background glow */}
              <div className="absolute inset-0 bg-gradient-radial from-primary/5 to-transparent animate-pulse" />
              
              {currentSceneData.icons.map((iconData, index) => {
                const IconComponent = iconData.Icon;
                return (
                  <div
                    key={`icon-${index}`}
                    className="absolute animate-fade-in"
                    style={{
                      left: `${iconData.position.x}%`,
                      top: `${iconData.position.y}%`,
                      transform: 'translate(-50%, -50%)',
                      animationDelay: `${iconData.delay}ms`,
                      animationDuration: '500ms',
                      animationFillMode: 'forwards',
                      opacity: 0,
                    }}
                  >
                    <div className="relative">
                      {/* Icon glow effect */}
                      <div className="absolute inset-0 blur-xl opacity-50" style={{
                        background: iconData.color === 'text-green-500' ? 'rgba(34, 197, 94, 0.3)' :
                                   iconData.color === 'text-blue-500' ? 'rgba(59, 130, 246, 0.3)' :
                                   iconData.color === 'text-yellow-500' ? 'rgba(234, 179, 8, 0.3)' :
                                   'rgba(var(--primary), 0.3)'
                      }} />
                      <IconComponent
                        size={iconData.scale ? iconData.scale * 20 : 28}
                        className={cn(
                          "transition-all duration-500 relative z-10 drop-shadow-lg",
                          iconData.color || "text-primary",
                          "animate-pulse"
                        )}
                        strokeWidth={2.5}
                      />
                    </div>
                  </div>
                );
              })}
              
              {currentSceneData.stickFigures?.map((figureData, index) => (
                <div
                  key={`figure-${index}`}
                  className="absolute animate-fade-in"
                  style={{
                    left: `${figureData.position.x}%`,
                    top: `${figureData.position.y}%`,
                    transform: 'translate(-50%, -50%)',
                    animationDelay: `${figureData.delay}ms`,
                    animationDuration: '500ms',
                    animationFillMode: 'forwards',
                    opacity: 0,
                  }}
                >
                  <StickFigure
                    pose={figureData.pose}
                    size={figureData.size ? figureData.size * 0.8 : 56}
                    color={figureData.color}
                  />
                </div>
              ))}
            </>
          )}
          
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110">
              <Play className="h-10 w-10 opacity-20" />
            </div>
          )}
        </div>

        {/* Text Area - SEPARATE, VISIBLE, below visual area */}
        <div className="h-16 mb-2 shrink-0">
          {isPlaying && currentSceneData && (
            <div className="h-full p-2.5 bg-gradient-to-r from-background/95 via-background to-background/95 rounded-lg border border-primary/40 animate-fade-in shadow-sm backdrop-blur-sm">
              <p className="text-xs font-semibold text-primary mb-1 truncate">
                {currentSceneData.label}
              </p>
            </div>
          )}
          {!isPlaying && (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-muted-foreground/50">{t('click_play_to_view')}</p>
            </div>
          )}
        </div>

        {/* Progress indicators - bottom */}
        <div className="flex gap-1.5 shrink-0">
          {scenes.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-500 relative overflow-hidden",
                index <= currentScene && isPlaying
                  ? "bg-primary shadow-glow"
                  : "bg-muted"
              )}
            >
              {index === currentScene && isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-slide-right" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
