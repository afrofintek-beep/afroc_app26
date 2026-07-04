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
    titleKey: "about_timeline_2023q1_title",
    descriptionKey: "about_timeline_2023q1_desc",
    icon: Sparkles,
    color: "from-primary to-primary-glow",
  },
  {
    year: "2023",
    quarter: "Q2",
    titleKey: "about_timeline_2023q2_title",
    descriptionKey: "about_timeline_2023q2_desc",
    icon: Rocket,
    color: "from-secondary to-accent",
  },
  {
    year: "2023",
    quarter: "Q4",
    titleKey: "about_timeline_2023q4_title",
    descriptionKey: "about_timeline_2023q4_desc",
    icon: Users,
    color: "from-accent to-brown",
  },
  {
    year: "2024",
    quarter: "Q1",
    titleKey: "about_timeline_2024q1_title",
    descriptionKey: "about_timeline_2024q1_desc",
    icon: Globe,
    color: "from-brown to-primary",
  },
  {
    year: "2024",
    quarter: "Q2",
    titleKey: "about_timeline_2024q2_title",
    descriptionKey: "about_timeline_2024q2_desc",
    icon: TrendingUp,
    color: "from-primary to-secondary",
  },
  {
    year: "2024",
    quarter: "Q3",
    titleKey: "about_timeline_2024q3_title",
    descriptionKey: "about_timeline_2024q3_desc",
    icon: Zap,
    color: "from-secondary to-accent",
  },
];

const values = [
  {
    icon: Heart,
    titleKey: "about_value_inclusion_title",
    descriptionKey: "about_value_inclusion_desc",
    gradient: "from-primary/20 to-primary-glow/20",
  },
  {
    icon: Shield,
    titleKey: "about_value_security_title",
    descriptionKey: "about_value_security_desc",
    gradient: "from-secondary/20 to-accent/20",
  },
  {
    icon: Users,
    titleKey: "about_value_community_title",
    descriptionKey: "about_value_community_desc",
    gradient: "from-accent/20 to-brown/20",
  },
  {
    icon: Globe,
    titleKey: "about_value_interoperability_title",
    descriptionKey: "about_value_interoperability_desc",
    gradient: "from-brown/20 to-primary/20",
  },
];

const team = [
  {
    name: "Dr. Amara Okonkwo",
    roleKey: "about_team_ceo_role",
    descriptionKey: "about_team_ceo_desc",
    avatar: "👩🏿‍💼",
  },
  {
    name: "Kwame Mensah",
    roleKey: "about_team_cto_role",
    descriptionKey: "about_team_cto_desc",
    avatar: "👨🏿‍💻",
  },
  {
    name: "Fatima Hassan",
    roleKey: "about_team_community_role",
    descriptionKey: "about_team_community_desc",
    avatar: "👩🏾‍🦱",
  },
  {
    name: "João Santos",
    roleKey: "about_team_engineering_role",
    descriptionKey: "about_team_engineering_desc",
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
            <span className="text-sm font-medium">{t('about_hero_badge')}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            {t('about_hero_title')}
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t('about_hero_subtitle')}
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
              <h2 className="text-3xl font-display font-bold mb-4">{t('about_mission_title')}</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {t('about_mission_desc')}
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
              <h2 className="text-3xl font-display font-bold mb-4">{t('about_vision_title')}</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {t('about_vision_desc')}
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
              <span className="text-sm font-medium">{t('about_values_badge')}</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold mb-4">
              {t('about_values_title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('about_values_subtitle')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card
                  key={value.titleKey}
                  className="glass-strong border border-border/50 shadow-elegant hover:shadow-glow hover:scale-105 transition-all duration-500 group animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-6 text-center">
                    <div className="mb-4 inline-block">
                      <div className={`p-4 rounded-2xl bg-gradient-to-br ${value.gradient} animate-float group-hover:scale-110 transition-transform`} style={{ animationDelay: `${index * 0.15}s` }}>
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-xl font-display font-bold mb-3">{t(value.titleKey)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(value.descriptionKey)}
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
              <span className="text-sm font-medium">{t('about_journey_badge')}</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold mb-4">
              {t('about_journey_title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('about_journey_subtitle')}
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
                            <h3 className="text-xl font-display font-bold mb-2">{t(item.titleKey)}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                              {t(item.descriptionKey)}
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
              <span className="text-sm font-medium">{t('about_team_badge')}</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold mb-4">
              {t('about_team_title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('about_team_subtitle')}
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
                    {t(member.roleKey)}
                  </Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(member.descriptionKey)}
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
                  <div className="text-sm text-muted-foreground">{t('about_stats_countries')}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-5xl font-display font-bold bg-gradient-to-br from-secondary to-accent bg-clip-text text-transparent">
                    50K+
                  </div>
                  <div className="text-sm text-muted-foreground">{t('about_stats_afrolocs')}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-5xl font-display font-bold bg-gradient-to-br from-accent to-brown bg-clip-text text-transparent">
                    98%
                  </div>
                  <div className="text-sm text-muted-foreground">{t('about_stats_validation')}</div>
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
                <span className="text-sm font-medium">{t('about_cta_badge')}</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-display font-bold">
                {t('about_cta_title')}
              </h2>

              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('about_cta_subtitle')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/pre-signup")}
                  className="bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all px-8"
                >
                  <MapPin className="mr-2 h-5 w-5" />
                  {t('about_cta_create')}
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/pricing")}
                  className="glass-strong border-2 border-border/50 hover:border-primary hover:shadow-glow transition-all px-8"
                >
                  {t('about_cta_plans')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 AFROLOC. {t('about_footer_rights')}</p>
        </div>
      </footer>
    </div>
  );
}
