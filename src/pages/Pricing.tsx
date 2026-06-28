import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Sparkles, Zap, Crown, Building2, ArrowLeft, Shield, MapPin, Users, TrendingUp } from "lucide-react";
import afrolocSymbol from "@/assets/afroloc-symbol-brand.webp";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Pricing() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const plans = [
    {
      nameKey: "plan_citizen",
      descKey: "plan_citizen_desc",
      priceKey: "free",
      period: "",
      icon: MapPin,
      gradient: "from-primary/20 to-accent/20",
      borderGradient: "from-primary to-accent",
      features: [
        { textKey: "feature_personal_afroloc", included: true, prefix: "1 " },
        { textKey: "feature_community_validation", included: true },
        { textKey: "feature_gps_georef", included: true },
        { textKey: "feature_mobile_app", included: true },
        { textKey: "feature_email_support", included: true },
        { textKey: "feature_multiple_addresses", included: false },
        { textKey: "feature_api_access", included: false },
        { textKey: "feature_priority_support", included: false },
      ],
      ctaKey: "start_free",
      popular: false,
    },
    {
      nameKey: "plan_validator",
      descKey: "plan_validator_desc",
      priceKey: "free",
      period: "",
      icon: Shield,
      gradient: "from-secondary/20 to-primary/20",
      borderGradient: "from-secondary to-primary",
      features: [
        { textKey: "feature_up_to_afrolocs", included: true },
        { textKey: "feature_validation_system", included: true },
        { textKey: "feature_authorization_levels", included: true },
        { textKey: "feature_validation_rewards", included: true },
        { textKey: "feature_advanced_dashboard", included: true },
        { textKey: "feature_validation_history", included: true },
        { textKey: "feature_basic_api", included: true },
        { textKey: "feature_priority_support", included: false },
      ],
      ctaKey: "become_validator",
      popular: true,
    },
    {
      nameKey: "plan_enterprise",
      descKey: "plan_enterprise_desc",
      priceKey: "on_request",
      period: "",
      icon: Building2,
      gradient: "from-accent/20 to-brown/20",
      borderGradient: "from-accent to-brown",
      features: [
        { textKey: "feature_unlimited_afrolocs", included: true },
        { textKey: "feature_full_api", included: true },
        { textKey: "feature_custom_integration", included: true },
        { textKey: "feature_white_label", included: true },
        { textKey: "feature_sla", included: true },
        { textKey: "feature_24_7_support", included: true },
        { textKey: "feature_team_training", included: true },
        { textKey: "feature_dedicated_manager", included: true },
      ],
      ctaKey: "contact_sales",
      popular: false,
    },
  ];

  const comparisonFeatures = [
    {
      categoryKey: "category_main_features",
      features: [
        { nameKey: "afroloc_creation", citizen: "1", validator: "5", enterpriseKey: "unlimited" },
        { nameKey: "feature_community_validation", citizen: true, validator: true, enterprise: true },
        { nameKey: "feature_gps_georef", citizen: true, validator: true, enterprise: true },
        { nameKey: "feature_mobile_app", citizen: true, validator: true, enterprise: true },
      ],
    },
    {
      categoryKey: "category_validation_security",
      features: [
        { nameKey: "level_system", citizen: false, validator: true, enterprise: true },
        { nameKey: "rewards", citizen: false, validator: true, enterprise: true },
        { nameKey: "feature_advanced_dashboard", citizen: false, validator: true, enterprise: true },
        { nameKey: "complete_history", citizen: false, validator: true, enterprise: true },
      ],
    },
    {
      categoryKey: "category_integrations_api",
      features: [
        { nameKey: "feature_api_access", citizen: false, validatorKey: "basic", enterpriseKey: "complete" },
        { nameKey: "webhooks", citizen: false, validator: false, enterprise: true },
        { nameKey: "feature_white_label", citizen: false, validator: false, enterprise: true },
        { nameKey: "feature_custom_integration", citizen: false, validator: false, enterprise: true },
      ],
    },
    {
      categoryKey: "category_support",
      features: [
        { nameKey: "feature_email_support", citizen: true, validator: true, enterprise: true },
        { nameKey: "feature_priority_support", citizen: false, validator: false, enterprise: true },
        { nameKey: "feature_24_7_support", citizen: false, validator: false, enterprise: true },
        { nameKey: "feature_dedicated_manager", citizen: false, validator: false, enterprise: true },
      ],
    },
  ];

  const handlePlanSelect = (planNameKey: string) => {
    if (planNameKey === "plan_enterprise") {
      window.location.href = "mailto:sales@afroid.com";
    } else {
      navigate("/pre-signup");
    }
  };

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
            <span className="text-xl font-display font-bold text-primary">{t('app_name')}</span>
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
            <Sparkles className="h-4 w-4 text-primary animate-pulse-glow" />
            <span className="text-sm font-medium">{t("pricing_title")}</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            {t("pricing_subtitle")}
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("pricing_description")}
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid gap-8 lg:grid-cols-3 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.nameKey}
                className={`relative animate-fade-in`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-primary text-white shadow-glow px-4 py-1 animate-pulse-glow">
                      <Crown className="h-3 w-3 mr-1" />
                      {t("most_popular")}
                    </Badge>
                  </div>
                )}
                
                <Card 
                  className={`glass-strong border-2 h-full flex flex-col relative overflow-hidden group hover:scale-105 transition-all duration-500 ${
                    plan.popular 
                      ? 'border-primary shadow-premium hover:shadow-xl' 
                      : 'border-border/50 shadow-elegant hover:shadow-glow'
                  }`}
                >
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${plan.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`}></div>
                  
                  <CardHeader className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${plan.borderGradient} animate-float shadow-elegant group-hover:shadow-glow transition-all`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    
                    <CardTitle className="text-2xl font-display">{t(plan.nameKey)}</CardTitle>
                    <CardDescription className="text-base">{t(plan.descKey)}</CardDescription>
                    
                    <div className="pt-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-display font-bold">{t(plan.priceKey)}</span>
                        {plan.period && <span className="text-muted-foreground">/{plan.period}</span>}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          {feature.included ? (
                            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={feature.included ? 'text-foreground' : 'text-muted-foreground/60'}>
                            {feature.prefix || ""}{t(feature.textKey)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      size="lg"
                      className={`w-full font-semibold ${
                        plan.popular
                          ? 'bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow'
                          : 'glass border-2 border-border/50 hover:border-primary hover:shadow-glow'
                      } transition-all duration-300`}
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handlePlanSelect(plan.nameKey)}
                    >
                      {t(plan.ctaKey)}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              {t("detailed_comparison")}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t("see_all_features")}
            </p>
          </div>

          <div className="glass-strong border border-border/50 rounded-2xl overflow-hidden shadow-premium animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left p-4 sm:p-6 font-display text-base sm:text-lg">{t("features")}</th>
                    <th className="text-center p-4 sm:p-6 font-display text-base sm:text-lg min-w-[120px]">{t("plan_citizen")}</th>
                    <th className="text-center p-4 sm:p-6 font-display text-base sm:text-lg min-w-[120px] bg-primary/5">
                      <div className="flex items-center justify-center gap-2">
                        {t("plan_validator")}
                        <Crown className="h-4 w-4 text-primary" />
                      </div>
                    </th>
                    <th className="text-center p-4 sm:p-6 font-display text-base sm:text-lg min-w-[120px]">{t("plan_enterprise")}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((category, catIndex) => (
                    <>
                      <tr key={`cat-${catIndex}`} className="border-b border-border/30 bg-muted/10">
                        <td colSpan={4} className="p-4 sm:p-6">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <span className="font-display font-semibold">{t(category.categoryKey)}</span>
                          </div>
                        </td>
                      </tr>
                      {category.features.map((feature, featIndex) => (
                        <tr 
                          key={`feat-${catIndex}-${featIndex}`}
                          className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                        >
                          <td className="p-4 sm:p-6 text-sm">{t(feature.nameKey)}</td>
                          <td className="p-4 sm:p-6 text-center">
                            {typeof feature.citizen === 'boolean' ? (
                              feature.citizen ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm font-medium">{feature.citizen}</span>
                            )}
                          </td>
                          <td className="p-4 sm:p-6 text-center bg-primary/5">
                            {typeof feature.validator === 'boolean' ? (
                              feature.validator ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                              )
                            ) : feature.validatorKey ? (
                              <span className="text-sm font-medium">{t(feature.validatorKey)}</span>
                            ) : (
                              <span className="text-sm font-medium">{feature.validator}</span>
                            )}
                          </td>
                          <td className="p-4 sm:p-6 text-center">
                            {typeof feature.enterprise === 'boolean' ? (
                              feature.enterprise ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                              )
                            ) : feature.enterpriseKey ? (
                              <span className="text-sm font-medium">{t(feature.enterpriseKey)}</span>
                            ) : (
                              <span className="text-sm font-medium">{feature.enterprise}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-4xl mx-auto">
          <Card className="glass-strong border-2 border-primary/50 shadow-premium overflow-hidden animate-scale-in">
            <div className="absolute inset-0 bg-gradient-hero opacity-10 -z-10"></div>
            <CardContent className="p-8 sm:p-12 text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50 shadow-soft mb-4">
                <Users className="h-4 w-4 text-primary animate-pulse-glow" />
                <span className="text-sm font-medium">{t("join_thousands")}</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-display font-bold">
                {t("ready_create_afroloc")}
              </h2>
              
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("start_free_revolution")}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/pre-signup")}
                  className="bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all px-8"
                >
                  <MapPin className="mr-2 h-5 w-5" />
                  {t("create_afroloc_free")}
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="glass-strong border-2 border-border/50 hover:border-primary hover:shadow-glow transition-all px-8"
                >
                  <TrendingUp className="mr-2 h-5 w-5" />
                  {t("learn_more")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 AFROLOC. {t("all_rights_reserved") || "All rights reserved."}</p>
        </div>
      </footer>
    </div>
  );
}