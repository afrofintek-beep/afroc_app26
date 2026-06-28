import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, MapPin, Users, FileCheck, MessageSquare } from "lucide-react";

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: OnboardingStep[] = [
  {
    title: "Bem-vindo ao AFROLOC",
    description: "O AFROLOC é um sistema continental de endereçamento digital que permite criar endereços digitais verificáveis com georreferência precisa.",
    icon: <MapPin className="h-12 w-12 text-primary" />
  },
  {
    title: "Criar AFROLOC",
    description: "Crie o seu primeiro código AFROLOC informando o endereço completo e coordenadas GPS. Cada código AFROLOC é único e verificável.",
    icon: <MapPin className="h-12 w-12 text-primary" />
  },
  {
    title: "Adicionar Testemunhas",
    description: "Adicione testemunhas que podem confirmar o seu endereço via SMS. Elas receberão uma mensagem e poderão responder SIM ou NÃO.",
    icon: <Users className="h-12 w-12 text-primary" />
  },
  {
    title: "Validação por SMS",
    description: "As testemunhas receberão SMS com o endereço completo e coordenadas. Elas podem confirmar respondendo SIM ou rejeitar com NÃO.",
    icon: <MessageSquare className="h-12 w-12 text-primary" />
  },
  {
    title: "Verificação de Documentos",
    description: "Faça upload dos seus documentos de identificação para validação. Administradores revisarão e aprovarão os seus documentos.",
    icon: <FileCheck className="h-12 w-12 text-primary" />
  },
  {
    title: "Pronto para Começar!",
    description: "Está pronto para usar o AFROLOC. Comece criando o seu primeiro código de endereço digital.",
    icon: <CheckCircle className="h-12 w-12 text-green-500" />
  }
];

interface OnboardingTutorialProps {
  onComplete: () => void;
}

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('afroloc_onboarding_complete');
    if (!hasSeenOnboarding) {
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem('afroloc_onboarding_complete', 'true');
    setIsOpen(false);
    onComplete();
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{currentStepData.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Tutorial de introdução ao AFROLOC - Passo {currentStep + 1} de {steps.length}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-6">
          <div className="rounded-full bg-primary/10 p-6">
            {currentStepData.icon}
          </div>
          
          <p className="text-center text-muted-foreground leading-relaxed">
            {currentStepData.description}
          </p>

          {/* Progress dots */}
          <div className="flex gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === currentStep 
                    ? "bg-primary" 
                    : index < currentStep 
                    ? "bg-primary/50" 
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
          >
            Pular Tutorial
          </Button>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
              >
                Anterior
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? "Começar" : "Próximo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
