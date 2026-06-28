import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTextToSpeech } from "@/utils/textToSpeech";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AudioButtonProps {
  textKey?: string;
  customText?: string;
}

export function AudioButton({ textKey, customText }: AudioButtonProps) {
  const { t, language } = useLanguage();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const tts = getTextToSpeech();

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      tts.stop();
    };
  }, []);

  const handleSpeak = () => {
    if (isSpeaking) {
      tts.stop();
      setIsSpeaking(false);
    } else {
      const textToSpeak = customText || (textKey ? t(textKey) : "");
      if (textToSpeak) {
        tts.speak(textToSpeak, language, () => setIsSpeaking(false));
        setIsSpeaking(true);
      }
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSpeak}
          className={isSpeaking ? "text-primary" : ""}
        >
          {isSpeaking ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isSpeaking ? t('stop_audio') : t('play_audio')}</p>
      </TooltipContent>
    </Tooltip>
  );
}
