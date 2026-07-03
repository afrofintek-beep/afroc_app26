import { useState, useEffect } from "react";
import { Volume2, VolumeX, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTextToSpeech } from "@/utils/textToSpeech";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PageReader() {
  const { t, language } = useLanguage();
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { toast } = useToast();
  const tts = getTextToSpeech();

  useEffect(() => {
    return () => {
      tts.stop();
    };
  }, []);

  const readPage = () => {
    console.log('PageReader: readPage called', { isReading, isPaused });
    
    if (isReading && !isPaused) {
      tts.pause();
      setIsPaused(true);
    } else if (isReading && isPaused) {
      tts.resume();
      setIsPaused(false);
    } else {
      // Get all text content from important elements
      const mainContent = [
        t('hero_title'),
        t('hero_description'),
        t('why_afroloc'),
        t('why_description'),
        t('feature_addressing'),
        t('feature_addressing_desc'),
        t('feature_validation'),
        t('feature_validation_desc'),
        t('feature_financial'),
        t('feature_financial_desc'),
      ].join('. ');

      console.log('PageReader: Starting to read content');
      
      try {
        tts.speak(mainContent, language, () => {
          console.log('PageReader: Finished reading');
          setIsReading(false);
          setIsPaused(false);
        });
        setIsReading(true);
        setIsPaused(false);
        
        toast({
          title: t('read_page'),
          description: "Leitura iniciada",
        });
      } catch (error) {
        console.error('Error starting speech:', error);
        toast({
          title: "Erro",
          description: "Não foi possível iniciar a leitura de áudio",
          variant: "destructive",
        });
      }
    }
  };

  const stopReading = () => {
    console.log('PageReader: stopReading called');
    tts.stop();
    setIsReading(false);
    setIsPaused(false);
  };

  return (
    <div className="fixed bottom-5 right-4 sm:bottom-8 sm:right-8 z-40 flex gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={readPage}
            size="lg"
            aria-label={isReading && !isPaused ? t('pause_reading') : isPaused ? t('resume_reading') : t('read_page')}
            className="h-12 w-12 rounded-full shadow-lg"
            variant={isReading ? "default" : "secondary"}
          >
            {isReading && !isPaused ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>
            {isReading && !isPaused
              ? t('pause_reading')
              : isPaused
              ? t('resume_reading')
              : t('read_page')}
          </p>
        </TooltipContent>
      </Tooltip>

      {isReading && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={stopReading}
              size="lg"
              aria-label={t('stop_reading')}
              className="h-12 w-12 rounded-full shadow-lg"
              variant="destructive"
            >
              <VolumeX className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{t('stop_reading')}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
