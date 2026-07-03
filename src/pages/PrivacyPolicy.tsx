import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck } from "lucide-react";

/**
 * Política de Privacidade — MODELO INICIAL.
 * ⚠️ Rever com aconselhamento jurídico antes de produção. Ajustar às leis de
 * proteção de dados aplicáveis (ex.: Lei 22/11 de Angola, RGPD para a UE).
 */
export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-strong border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">Política de Privacidade</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-6 text-foreground/90">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <strong>Modelo inicial.</strong> Este documento deve ser revisto por aconselhamento
          jurídico e adaptado às leis de proteção de dados aplicáveis antes de utilização em produção.
        </div>
        <p className="text-sm text-muted-foreground">Última atualização: 3 de julho de 2026</p>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">1. Quem somos</h2>
          <p>A AFROLOC é operada pela AFROFINTEK GmbH. Esta política explica que dados recolhemos, para que os usamos e que direitos tem sobre eles.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">2. Dados que recolhemos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Identificação:</strong> nome, número de telemóvel e, quando aplicável, e-mail.</li>
            <li><strong>Localização:</strong> coordenadas GPS e metadados da foto (EXIF) usados para criar e verificar a sua morada AFROLOC.</li>
            <li><strong>Validação:</strong> confirmações de testemunhas e documentos que carregue.</li>
            <li><strong>Uso:</strong> registos técnicos para segurança e prevenção de fraude.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">3. Como usamos os seus dados</h2>
          <p>Para criar e verificar a sua morada digital, prevenir fraude, cumprir obrigações legais e melhorar o serviço. Não vendemos os seus dados pessoais.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">4. Partilha</h2>
          <p>Partilhamos dados apenas com fornecedores necessários ao funcionamento (ex.: envio de SMS, mapas) e com autoridades quando exigido por lei, sempre no mínimo indispensável.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">5. Segurança e retenção</h2>
          <p>Aplicamos medidas técnicas e organizativas para proteger os seus dados e conservamo-los apenas pelo tempo necessário às finalidades descritas ou exigido por lei.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">6. Os seus direitos</h2>
          <p>Pode aceder, corrigir, exportar ou pedir a eliminação dos seus dados, e retirar consentimentos. Para exercer estes direitos, contacte-nos.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">7. Contacto</h2>
          <p>Dúvidas de privacidade: <a href="mailto:privacy@afroloc.com" className="text-primary hover:underline">privacy@afroloc.com</a></p>
        </section>
      </main>
    </div>
  );
}
