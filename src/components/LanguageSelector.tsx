import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage, Language } from "@/contexts/LanguageContext";

const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'am', name: 'አማርኛ', flag: '🇪🇹' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  { code: 'ln', name: 'Lingála', flag: '🇨🇩' },
  { code: 'yo', name: 'Yorùbá', flag: '🇳🇬' },
  { code: 'sn', name: 'ChiShona', flag: '🇿🇼' },
  { code: 'zu', name: 'isiZulu', flag: '🇿🇦' },
  { code: 'kmb', name: 'Kimbundu', flag: '🇦🇴' },
  { code: 'umb', name: 'Umbundu', flag: '🇦🇴' },
  { code: 'kg', name: 'Kikongo', flag: '🇦🇴' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const currentLanguage = languages.find(lang => lang.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2 sm:px-3 h-8">
          <Globe className="h-4 w-4 hidden sm:block" />
          <span className="text-base">{currentLanguage?.flag}</span>
          <span className="hidden sm:inline text-sm">{currentLanguage?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? "bg-accent" : ""}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
