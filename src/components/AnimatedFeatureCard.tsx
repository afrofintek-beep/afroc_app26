import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

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
  animationSteps
}: AnimatedFeatureCardProps) => {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const startAnimation = () => {
    setIsPlaying(true);
    setCurrentStep(0);
    playSteps(0);
  };

  const playSteps = (stepIndex: number) => {
    if (stepIndex >= animationSteps.length) {
      setIsPlaying(false);
      setCurrentStep(0);
      return;
    }

    setCurrentStep(stepIndex);
    
    setTimeout(() => {
      playSteps(stepIndex + 1);
    }, animationSteps[stepIndex].duration);
  };

  const resetAnimation = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  const currentStepData = animationSteps[currentStep];

  return (
    <Card className="group hover:shadow-xl transition-all duration-500 border-2 hover:border-primary/50 relative overflow-hidden flex flex-col h-full">
      {/* Animated background gradient - Enhanced */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 opacity-0 transition-all duration-700",
        isPlaying && "opacity-100 animate-pulse"
      )} />
      
      {/* Floating particles effect when playing */}
      {isPlaying && (
        <>
          <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-primary/30 rounded-full animate-float" style={{ animationDelay: '0s' }} />
          <div className="absolute top-2/3 right-1/4 w-1.5 h-1.5 bg-accent/30 rounded-full animate-float" style={{ animationDelay: '0.7s' }} />
          <div className="absolute bottom-1/4 left-1/4 w-1 h-1 bg-primary/20 rounded-full animate-float" style={{ animationDelay: '1.2s' }} />
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
        {/* Text Area - VISIBLE at top */}
        <div className="h-20 mb-2 shrink-0">
          {isPlaying && currentStepData && (
            <div className="h-full p-2.5 bg-gradient-to-r from-background/95 via-background to-background/95 rounded-lg border border-primary/40 animate-fade-in shadow-sm backdrop-blur-sm flex flex-col">
              <h4 className="font-semibold text-xs mb-1 text-primary flex items-center gap-1.5 shrink-0">
                <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <span className="truncate">{currentStepData.title}</span>
              </h4>
              <p className="text-[11px] text-muted-foreground flex-1 line-clamp-3 leading-relaxed overflow-hidden">
                {currentStepData.description}
              </p>
            </div>
          )}
          {!isPlaying && (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-muted-foreground/50">{t('click_play_to_view')}</p>
            </div>
          )}
        </div>

        {/* Progress bar - visual indicator */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2 shrink-0">
          {isPlaying && currentStepData && (
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent shadow-glow relative"
              style={{
                width: `${((currentStep + 1) / animationSteps.length) * 100}%`,
                transition: 'width 0.5s ease-out'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-slide-right" />
            </div>
          )}
        </div>

        {/* Step indicators - bottom */}
        <div className="flex gap-1.5 shrink-0">
          {animationSteps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-500 relative overflow-hidden",
                index <= currentStep && isPlaying
                  ? "bg-primary shadow-glow"
                  : "bg-muted"
              )}
            >
              {index === currentStep && isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-slide-right" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
