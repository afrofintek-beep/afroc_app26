import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Shield, Users, Globe, Heart, Target, Eye, Sparkles, TrendingUp, CheckCircle2, ArrowLeft, Zap, Award, Rocket } from "lucide-react";
import afrolocSymbol from "@/assets/afroloc-symbol.png";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";

const timeline = [
  {
    year: "2023",
    quarter: "Q1",
    title: "Concepção",
    description: "Início do desenvolvimento do conceito de endereçamento digital continental para África",
    icon: Sparkles,
    color: "from-primary to-primary-glow",
  },
  {
    year: "2023",
    quarter: "Q2",
    title: "Prototipagem",
    description: "Desenvolvimento do primeiro protótipo e testes com comunidades em Angola",
    icon: Rocket,
    color: "from-secondary to-accent",
  },
  {
    year: "2023",
    quarter: "Q4",
    title: "Validação Comunitária",
    description: "Implementação do sistema de validação por testemunhas e níveis de autorização",
    icon: Users,
    color: "from-accent to-brown",
  },
  {
    year: "2024",
    quarter: "Q1",
    title: "Expansão Regional",
    description: "Lançamento em múltiplos países africanos com suporte multilíngue",
    icon: Globe,
    color: "from-brown to-primary",
  },
  {
    year: "2024",
    quarter: "Q2",
    title: "Integração Financeira",
    description: "Parcerias com instituições financeiras para inclusão bancária",
    icon: TrendingUp,
    color: "from-primary to-secondary",
  },
  {
    year: "2024",
    quarter: "Q3",
    title: "API Pública",
    description: "Lançamento da API aberta para desenvolvedores e empresas",
    icon: Zap,
    color: "from-secondary to-accent",
  },
];

const values = [
  {
    icon: Heart,
    title: "Inclusão",
    description: "Acreditamos que todo africano merece um endereço digital verificável, independentemente de sua localização ou situação socioeconômica.",
    gradient: "from-primary/20 to-primary-glow/20",
  },
  {
    icon: Shield,
    title: "Segurança",
    description: "Protegemos a identidade e privacidade dos usuários através de validação comunitária e criptografia avançada.",
    gradient: "from-secondary/20 to-accent/20",
  },
  {
    icon: Users,
    title: "Comunidade",
    description: "O sistema é validado pela própria comunidade, garantindo autenticidade e fortalecendo laços sociais.",
    gradient: "from-accent/20 to-brown/20",
  },
  {
    icon: Globe,
    title: "Interoperabilidade",
    description: "Construímos um sistema continental que funciona além das fronteiras, conectando toda África.",
    gradient: "from-brown/20 to-primary/20",
  },
];

const team = [
  {
    name: "Dr. Amara Okonkwo",
    role: "CEO & Fundadora",
    description: "PhD em Sistemas de Informação Geográfica, 15 anos de experiência em infraestrutura digital africana.",
    avatar: "👩🏿‍💼",
  },
  {
    name: "Kwame Mensah",
    role: "CTO",
    description: "Ex-engenheiro principal do Google Maps, especialista em georreferenciação e sistemas distribuídos.",
    avatar: "👨🏿‍💻",
  },
  {
    name: "Fatima Hassan",
    role: "Head of Community",
    description: "Liderou projetos de inclusão digital em 12 países africanos, fluente em 6 idiomas africanos.",
    avatar: "👩🏾‍🦱",
  },
  {
    name: "João Santos",
    role: "Head of Engineering",
    description: "Arquiteto de sistemas com experiência em plataformas de larga escala e blockchain.",
    avatar: "👨🏽‍💼",
  },
];

export default function About() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-40 -z-10"></div>
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-float"></div>
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl -z-10 animate-float" style={{ animationDelay: '1s' }}></div>

      {/* Header */}
      <header className="glass-strong border-b border-border/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3 animate-fade-in">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="animate-float">
              <img src={afrolocSymbol} alt="AFROLOC" className="h-9 w-9 rounded-lg shadow-md ring-1 ring-primary/20" />
            </div>
            <span className="text-xl font-display font-bold text-foreground">{t('app_name')}</span>
          </div>
          <div className="flex gap-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <LanguageSelector />
            <Button variant="outline" size="sm" className="glass border-border/50 hover:shadow-glow" onClick={() => navigate("/login")}>
              {t('login')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="mx-auto max-w-4xl text-center space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-strong border border-border/50 shadow-soft mb-4 animate-scale-in">
            <Heart className="h-4 w-4 text-primary animate-pulse-glow" />
            <span className="text-sm font-medium">Nossa História</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            Sobre o AFROLOC
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Revolucionando o endereçamento digital em África através de tecnologia inclusiva, validação comunitária e georreferenciação precisa.
          </p>
        </div>
      </section>

      {/* Mission, Vision Section */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid gap-6 lg:grid-cols-2 max-w-6xl mx-auto">
          {/* Mission */}
          <Card className="glass-strong border border-border/50 shadow-premium hover:shadow-xl transition-all duration-500 group animate-fade-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardContent className="p-8 relative">
              <div className="mb-6">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-primary shadow-elegant animate-float">
                  <Target className="h-8 w-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-display font-bold mb-4">Nossa Missão</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Fornecer a cada cidadão africano um endereço digital único, verificável e permanente, promovendo inclusão financeira, acesso a serviços essenciais e fortalecimento da identidade continental.
              </p>
            </CardContent>
          </Card>

          {/* Vision */}
          <Card className="glass-strong border border-border/50 shadow-premium hover:shadow-xl transition-all duration-500 group animate-fade-in overflow-hidden" style={{ animationDelay: '0.1s' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardContent className="p-8 relative">
              <div className="mb-6">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-secondary shadow-elegant animate-float" style={{ animationDelay: '0.2s' }}>
                  <Eye className="h-8 w-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-display font-bold mb-4">Nossa Visão</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Tornar-se o sistema continental de endereçamento digital de referência, conectando mais de 1 bilhão de africanos e servindo como infraestrutura fundamental para o desenvolvimento sustentável do continente.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Values Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50 shadow-soft mb-6">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Nossos Valores</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold mb-4">
              O que nos guia
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Princípios fundamentais que norteiam cada decisão e ação
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card
                  key={value.title}
                  className="glass-strong border border-border/50 shadow-elegant hover:shadow-glow hover:scale-105 transition-all duration-500 group animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-6 text-center">
                    <div className="mb-4 inline-block">
                      <div className={`p-4 rounded-2xl bg-gradient-to-br ${value.gradient} animate-float group-hover:scale-110 transition-transform`} style={{ animationDelay: `${index * 0.15}s` }}>
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-xl font-display font-bold mb-3">{value.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {value.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50 shadow-soft mb-6">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Nossa Jornada</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold mb-4">
              Evolução do Projeto
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Do conceito à realidade continental
            </p>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-secondary to-accent hidden md:block"></div>

            <div className="space-y-8">
              {timeline.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={`${item.year}-${item.quarter}`}
                    className="relative animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Card className="glass-strong border border-border/50 shadow-elegant hover:shadow-glow hover:scale-[1.02] transition-all duration-500 group md:ml-20">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`p-3 rounded-xl bg-gradient-to-br ${item.color} shadow-elegant animate-float group-hover:scale-110 transition-transform flex-shrink-0`} style={{ animationDelay: `${index * 0.15}s` }}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>

                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="glass border-border/50 px-3 py-1">
                                {item.year} {item.quarter}
                              </Badge>
                            </div>
                            <h3 className="text-xl font-display font-bold mb-2">{item.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Timeline dot */}
                    <div className="absolute left-8 top-8 w-4 h-4 bg-gradient-primary rounded-full border-4 border-background shadow-glow hidden md:block -translate-x-1/2 animate-pulse-glow"></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50 shadow-soft mb-6">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Conheça a Equipe</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold mb-4">
              Liderança
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Especialistas dedicados a revolucionar o endereçamento digital em África
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {team.map((member, index) => (
              <Card
                key={member.name}
                className="glass-strong border border-border/50 shadow-elegant hover:shadow-glow hover:scale-105 transition-all duration-500 group animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6 text-center">
                  <div className="mb-4">
                    <div className="text-6xl mb-4 animate-float group-hover:scale-110 transition-transform" style={{ animationDelay: `${index * 0.15}s` }}>
                      {member.avatar}
                    </div>
                  </div>
                  <h3 className="text-lg font-display font-bold mb-1">{member.name}</h3>
                  <Badge variant="outline" className="mb-3 glass border-border/50">
                    {member.role}
                  </Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {member.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-6xl mx-auto">
          <Card className="glass-strong border-2 border-primary/50 shadow-premium overflow-hidden animate-scale-in">
            <div className="absolute inset-0 bg-gradient-hero opacity-10 -z-10"></div>
            <CardContent className="p-8 sm:p-12">
              <div className="grid gap-8 md:grid-cols-3 text-center">
                <div className="space-y-2">
                  <div className="text-5xl font-display font-bold bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent">
                    12+
                  </div>
                  <div className="text-sm text-muted-foreground">Países Cobertos</div>
                </div>
                <div className="space-y-2">
                  <div className="text-5xl font-display font-bold bg-gradient-to-br from-secondary to-accent bg-clip-text text-transparent">
                    50K+
                  </div>
                  <div className="text-sm text-muted-foreground">AFROLOCs Criados</div>
                </div>
                <div className="space-y-2">
                  <div className="text-5xl font-display font-bold bg-gradient-to-br from-accent to-brown bg-clip-text text-transparent">
                    98%
                  </div>
                  <div className="text-sm text-muted-foreground">Taxa de Validação</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-4xl mx-auto">
          <Card className="glass-strong border-2 border-primary/50 shadow-premium overflow-hidden animate-scale-in">
            <div className="absolute inset-0 bg-gradient-hero opacity-10 -z-10"></div>
            <CardContent className="p-8 sm:p-12 text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50 shadow-soft mb-4">
                <Sparkles className="h-4 w-4 text-primary animate-pulse-glow" />
                <span className="text-sm font-medium">Faça Parte</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-display font-bold">
                Junte-se à revolução do endereçamento digital
              </h2>
              
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Seja parte da transformação que está mudando a forma como África se conecta
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/pre-signup")}
                  className="bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all px-8"
                >
                  <MapPin className="mr-2 h-5 w-5" />
                  Criar AFROLOC
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/pricing")}
                  className="glass-strong border-2 border-border/50 hover:border-primary hover:shadow-glow transition-all px-8"
                >
                  Ver Planos
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 AFROLOC. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
