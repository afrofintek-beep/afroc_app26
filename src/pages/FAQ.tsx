import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, HelpCircle, MapPin, Shield, Users, Zap, Globe, CreditCard, ArrowLeft, Sparkles, MessageCircle } from "lucide-react";
import afrolocSymbol from "@/assets/afroloc-symbol-brand.webp";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FAQ() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const faqCategories = [
    {
      id: "general",
      nameKey: "faq_general",
      icon: HelpCircle,
      color: "from-primary to-primary-glow",
      questions: [
        { questionKey: "faq_q1", answerKey: "faq_a1" },
        { questionKey: "faq_q2", answerKey: "faq_a2" },
        { questionKey: "faq_q3", answerKey: "faq_a3" },
        { questionKey: "faq_q4", answerKey: "faq_a4" },
        { questionKey: "faq_q5", answerKey: "faq_a5" },
      ]
    },
    {
      id: "validation",
      nameKey: "faq_validation",
      icon: Users,
      color: "from-secondary to-accent",
      questions: [
        { questionKey: "faq_q1", answerKey: "faq_a1" },
      ]
    },
    {
      id: "security",
      nameKey: "faq_security",
      icon: Shield,
      color: "from-accent to-brown",
      questions: [
        { questionKey: "faq_q1", answerKey: "faq_a1" },
      ]
    },
    {
      id: "technical",
      nameKey: "faq_technical",
      icon: Zap,
      color: "from-brown to-primary",
      questions: [
        { questionKey: "faq_q1", answerKey: "faq_a1" },
      ]
    },
    {
      id: "financial",
      nameKey: "faq_financial",
      icon: CreditCard,
      color: "from-secondary to-primary",
      questions: [
        { questionKey: "faq_q1", answerKey: "faq_a1" },
      ]
    },
    {
      id: "international",
      nameKey: "faq_international",
      icon: Globe,
      color: "from-accent to-secondary",
      questions: [
        { questionKey: "faq_q1", answerKey: "faq_a1" },
      ]
    },
  ];

  // Filter questions based on search and category
  const filteredCategories = faqCategories
    .map(category => ({
      ...category,
      questions: category.questions.filter(q => {
        const question = t(q.questionKey);
        const answer = t(q.answerKey);
        const matchesSearch = searchQuery === "" || 
          question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          answer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === null || category.id === selectedCategory;
        return matchesSearch && matchesCategory;
      })
    }))
    .filter(category => category.questions.length > 0);

  const totalQuestions = faqCategories.reduce((acc, cat) => acc + cat.questions.length, 0);

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
            <HelpCircle className="h-4 w-4 text-primary animate-pulse-glow" />
            <span className="text-sm font-medium">{t("help_center")}</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            {t("faq_title")}
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("faq_subtitle")}
          </p>

          {/* Search Bar */}
          <div className="pt-6">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder={t("search_questions")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 glass-strong border-2 border-border/50 focus:border-primary text-base shadow-elegant"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {totalQuestions} {t("questions_available")}
            </p>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="container mx-auto px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-3 justify-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              className={selectedCategory === null 
                ? "bg-gradient-primary hover:scale-105 shadow-elegant" 
                : "glass border-border/50 hover:border-primary"
              }
            >
              {t("all_categories")}
            </Button>
            {faqCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`animate-fade-in ${
                    selectedCategory === category.id
                      ? "bg-gradient-primary hover:scale-105 shadow-elegant"
                      : "glass border-border/50 hover:border-primary hover:shadow-glow"
                  } transition-all duration-300`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {t(category.nameKey)}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24">
        <div className="max-w-4xl mx-auto space-y-8">
          {filteredCategories.length === 0 ? (
            <Card className="glass-strong border border-border/50 shadow-elegant animate-fade-in">
              <CardContent className="p-12 text-center">
                <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-display font-bold mb-2">{t("no_results")}</h3>
                <p className="text-muted-foreground">
                  {t("try_different_search")}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCategories.map((category, catIndex) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${catIndex * 0.1}s` }}
                >
                  <div className="mb-6 flex items-center gap-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${category.color} shadow-elegant animate-float`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-display font-bold">{t(category.nameKey)}</h2>
                      <p className="text-sm text-muted-foreground">{category.questions.length} {t("questions_available")}</p>
                    </div>
                  </div>

                  <Card className="glass-strong border border-border/50 shadow-elegant hover:shadow-glow transition-all duration-500">
                    <CardContent className="p-2">
                      <Accordion type="single" collapsible className="w-full">
                        {category.questions.map((item, qIndex) => (
                          <AccordionItem 
                            key={qIndex} 
                            value={`${category.id}-${qIndex}`}
                            className="border-b border-border/30 last:border-0"
                          >
                            <AccordionTrigger className="px-6 py-4 hover:bg-muted/20 rounded-lg transition-colors text-left">
                              <span className="font-semibold">{t(item.questionKey)}</span>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-4 pt-2 text-muted-foreground leading-relaxed">
                              {t(item.answerKey)}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Still Have Questions CTA */}
      <section className="container mx-auto px-4 py-16 sm:py-24 relative">
        <div className="max-w-4xl mx-auto">
          <Card className="glass-strong border-2 border-primary/50 shadow-premium overflow-hidden animate-scale-in">
            <div className="absolute inset-0 bg-gradient-hero opacity-10 -z-10"></div>
            <CardContent className="p-8 sm:p-12 text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50 shadow-soft mb-4">
                <MessageCircle className="h-4 w-4 text-primary animate-pulse-glow" />
                <span className="text-sm font-medium">{t("still_have_questions")}</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-display font-bold">
                {t("still_have_questions")}
              </h2>
              
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("contact_support_text")}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  size="lg" 
                  onClick={() => window.location.href = "mailto:support@afroid.com"}
                  className="bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all px-8"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  {t("contact_support")}
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/about")}
                  className="glass-strong border-2 border-border/50 hover:border-primary hover:shadow-glow transition-all px-8"
                >
                  {t("about")} AFROLOC
                </Button>
              </div>

              <div className="pt-8 border-t border-border/50 mt-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                  <div>
                    <p className="font-semibold mb-1">{t("email")}</p>
                    <p className="text-muted-foreground">support@afroid.com</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">{t("schedule") || "Horário"}</p>
                    <p className="text-muted-foreground">24/7</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">{t("avg_response_time")}</p>
                    <p className="text-muted-foreground">24 {t("hours")}</p>
                  </div>
                </div>
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