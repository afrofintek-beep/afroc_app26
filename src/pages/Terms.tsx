import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

/**
 * Termos de Utilização — MODELO INICIAL.
 * ⚠️ Rever com aconselhamento jurídico antes de produção.
 */
export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-strong border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">Termos de Utilização</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-6 text-foreground/90">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <strong>Modelo inicial.</strong> Este documento deve ser revisto por aconselhamento
          jurídico antes de utilização em produção.
        </div>
        <p className="text-sm text-muted-foreground">Última atualização: 3 de julho de 2026</p>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">1. Aceitação</h2>
          <p>Ao criar uma conta ou usar a AFROLOC, aceita estes Termos. Se não concordar, não utilize o serviço.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">2. O serviço</h2>
          <p>A AFROLOC atribui uma morada digital única, georreferenciada e verificável. A morada resulta de dados que fornece (localização, foto) e de validação comunitária/administrativa.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">3. A sua conta</h2>
          <p>É responsável por manter a confidencialidade do seu acesso e pela veracidade dos dados que submete. Dados falsos ou fraudulentos podem levar à suspensão.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">4. Uso aceitável</h2>
          <p>Não pode usar o serviço para fins ilícitos, falsificar localizações, contornar mecanismos de verificação ou prejudicar terceiros.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">5. Propriedade intelectual</h2>
          <p>O software, os algoritmos de codificação de endereços e a marca AFROLOC são propriedade da AFROFINTEK GmbH. É proibida a cópia, engenharia inversa ou uso não autorizado.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">6. Limitação de responsabilidade</h2>
          <p>O serviço é fornecido "tal como está". Na medida permitida por lei, a AFROFINTEK não se responsabiliza por danos indiretos decorrentes do uso.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">7. Alterações e lei aplicável</h2>
          <p>Podemos atualizar estes Termos; notificaremos alterações relevantes. Os Termos regem-se pela lei aplicável à sede do operador, sem prejuízo de direitos imperativos do consumidor.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">8. Contacto</h2>
          <p>Questões: <a href="mailto:legal@afroloc.com" className="text-primary hover:underline">legal@afroloc.com</a></p>
        </section>
      </main>
    </div>
  );
}
