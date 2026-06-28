import { Language } from "@/contexts/LanguageContext";

// Map language codes to speech synthesis language codes
const languageVoiceMap: Record<Language, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  pt: 'pt-PT',
  ar: 'ar-SA',
  am: 'am-ET',
  sw: 'sw-KE',
  ln: 'fr-CD', // Lingala uses French as fallback
  yo: 'yo-NG',
  sn: 'sn-ZW',
  zu: 'zu-ZA',
  kmb: 'pt-AO', // Kimbundu uses Portuguese as fallback
  umb: 'pt-AO', // Umbundu uses Portuguese as fallback
  kg: 'pt-AO',  // Kikongo uses Portuguese as fallback
};

export class TextToSpeech {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private voicesLoaded = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
    } else {
      console.warn('Speech Synthesis API not supported in this browser');
    }
  }

  private loadVoices() {
    if (!this.synthesis) return;
    
    // Load voices
    const voices = this.synthesis.getVoices();
    
    if (voices.length > 0) {
      this.voicesLoaded = true;
      console.log('Voices loaded:', voices.length);
    }

    // Some browsers need this event
    if ('onvoiceschanged' in this.synthesis) {
      this.synthesis.onvoiceschanged = () => {
        const voices = this.synthesis.getVoices();
        this.voicesLoaded = true;
        console.log('Voices changed, loaded:', voices.length);
      };
    }
  }

  speak(text: string, language: Language, onEnd?: () => void) {
    if (!this.synthesis) {
      console.warn('Speech Synthesis not available');
      if (onEnd) onEnd();
      return;
    }
    
    console.log('Attempting to speak:', { text: text.substring(0, 50), language, voicesLoaded: this.voicesLoaded });
    
    // Cancel any ongoing speech
    this.stop();

    // Ensure voices are loaded
    if (!this.voicesLoaded) {
      this.loadVoices();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const langCode = languageVoiceMap[language];
    
    utterance.lang = langCode;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Try to find a voice for the specific language
    const voices = this.synthesis.getVoices();
    console.log('Available voices:', voices.length);
    
    const voice = voices.find(v => v.lang.startsWith(langCode.split('-')[0])) || voices[0];
    
    if (voice) {
      utterance.voice = voice;
      console.log('Using voice:', voice.name, voice.lang);
    }

    utterance.onstart = () => {
      console.log('Speech started');
    };

    utterance.onend = () => {
      console.log('Speech ended');
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
      this.currentUtterance = null;
    };

    this.currentUtterance = utterance;
    this.isSpeaking = true;
    
    console.log('Starting speech synthesis');
    this.synthesis.speak(utterance);
  }

  stop() {
    if (this.isSpeaking && this.synthesis) {
      console.log('Stopping speech');
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  pause() {
    if (this.isSpeaking && this.synthesis) {
      console.log('Pausing speech');
      this.synthesis.pause();
    }
  }

  resume() {
    if (this.isSpeaking && this.synthesis) {
      console.log('Resuming speech');
      this.synthesis.resume();
    }
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

// Singleton instance
let ttsInstance: TextToSpeech | null = null;

export const getTextToSpeech = (): TextToSpeech => {
  if (!ttsInstance) {
    ttsInstance = new TextToSpeech();
  }
  return ttsInstance;
};
