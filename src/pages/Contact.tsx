import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import LocationMap from "@/components/LocationMap";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Globe,
  Send,
  MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const Contact = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    region: "",
    subject: "",
    message: ""
  });

  const contactSchema = z.object({
    name: z.string().trim().min(2, t("validation_error")).max(100, t("validation_error")),
    email: z.string().trim().email(t("validation_error")).max(255, t("validation_error")),
    phone: z.string().trim().max(20, t("validation_error")).optional(),
    region: z.string().min(1, t("validation_error")),
    subject: z.string().trim().min(5, t("validation_error")).max(200, t("validation_error")),
    message: z.string().trim().min(10, t("validation_error")).max(2000, t("validation_error"))
  });

  const regions = [
    {
      id: "west",
      nameKey: "west_africa",
      countries: ["Senegal", "Mali", "Nigéria", "Gana", "Costa do Marfim"],
      email: "west-africa@afro-id.com",
      phone: "+221 33 XXX XXXX",
      hours: "09:00 - 18:00 GMT",
      center: [-4.0, 12.0] as [number, number]
    },
    {
      id: "central",
      nameKey: "central_africa",
      countries: ["RD Congo", "Angola", "Camarões", "Gabão"],
      email: "central-africa@afro-id.com",
      phone: "+243 XX XXX XXXX",
      hours: "08:00 - 17:00 WAT",
      center: [15.0, 0.0] as [number, number]
    },
    {
      id: "east",
      nameKey: "east_africa",
      countries: ["Quênia", "Tanzânia", "Etiópia", "Uganda"],
      email: "east-africa@afro-id.com",
      phone: "+254 XX XXX XXXX",
      hours: "09:00 - 18:00 EAT",
      center: [40.0, 0.0] as [number, number]
    },
    {
      id: "south",
      nameKey: "south_africa_region",
      countries: ["África do Sul", "Moçambique", "Zimbabwe", "Botsuana"],
      email: "south-africa@afro-id.com",
      phone: "+27 XX XXX XXXX",
      hours: "08:00 - 17:00 SAST",
      center: [25.0, -25.0] as [number, number]
    },
    {
      id: "north",
      nameKey: "north_africa",
      countries: ["Egito", "Marrocos", "Argélia", "Tunísia"],
      email: "north-africa@afro-id.com",
      phone: "+20 XX XXX XXXX",
      hours: "09:00 - 18:00 EET",
      center: [10.0, 30.0] as [number, number]
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = contactSchema.parse(formData);
      setIsSubmitting(true);

      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: validatedData
      });

      if (error) throw error;

      toast({
        title: t("message_sent"),
        description: t("will_contact_soon"),
      });

      setFormData({
        name: "",
        email: "",
        phone: "",
        region: "",
        subject: "",
        message: ""
      });
      setSelectedRegion("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t("validation_error"),
          description: error.issues[0].message,
          variant: "destructive"
        });
      } else {
        toast({
          title: t("error"),
          description: t("send_error"),
          variant: "destructive"
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRegion = regions.find(r => r.id === selectedRegion);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/landing")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            AFROLOC
          </h1>
        </div>
      </header>

      <main className="container py-12">
        {/* Hero Section */}
        <section className="text-center mb-16 animate-fade-in">
          <Badge className="mb-4 animate-float" variant="secondary">
            <MessageSquare className="h-3 w-3 mr-1" />
            {t("contact_us")}
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            {t("get_in_touch")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("contact_subtitle")}
          </p>
        </section>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Contact Form */}
          <Card className="glass-panel border-border/50 animate-scale-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                {t("send_message")}
              </CardTitle>
              <CardDescription>
                {t("fill_form")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("full_name")} *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("your_name")}
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("email")} *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
                    required
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("phone")}</label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+XXX XX XXX XXXX"
                    maxLength={20}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("region")} *</label>
                  <select
                    value={formData.region}
                    onChange={(e) => {
                      setFormData({ ...formData, region: e.target.value });
                      setSelectedRegion(e.target.value);
                    }}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                    required
                  >
                    <option value="">{t("select_region")}</option>
                    {regions.map(region => (
                      <option key={region.id} value={region.id}>
                        {t(region.nameKey)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("subject")} *</label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder={t("message_subject")}
                    required
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("message")} *</label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t("message_placeholder")}
                    rows={5}
                    required
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.message.length}/2000 {t("characters")}
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full premium-gradient"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("sending") : t("send")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Regional Information */}
          <div className="space-y-6">
            {regions.map((region, index) => (
              <Card 
                key={region.id}
                className={`glass-panel border-border/50 cursor-pointer transition-all hover:border-primary/50 animate-scale-in ${
                  selectedRegion === region.id ? "border-primary ring-2 ring-primary/20" : ""
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => setSelectedRegion(region.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5 text-primary" />
                    {t(region.nameKey)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {region.countries.map(country => (
                      <Badge key={country} variant="secondary" className="text-xs">
                        {country}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4 text-primary" />
                      {region.email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 text-primary" />
                      {region.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      {region.hours}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Interactive Map */}
        <section className="mb-12 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                {t("our_service_regions")}
              </CardTitle>
              <CardDescription>
                {currentRegion 
                  ? `${t("showing_region")}: ${t(currentRegion.nameKey)}` 
                  : t("select_region_map")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] rounded-lg overflow-hidden">
                <LocationMap
                  latitude={currentRegion?.center[1] || 0}
                  longitude={currentRegion?.center[0] || 20}
                  initialCenter={currentRegion?.center || [20, 0]}
                  initialZoom={currentRegion ? 4 : 2.5}
                  onLocationSelect={() => {}}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Support Information */}
        <section className="text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <Card className="glass-panel border-border/50 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>{t("global_support")}</CardTitle>
              <CardDescription>
                {t("support_multilingual")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-medium">24/7</p>
                  <p className="text-muted-foreground text-xs">{t("emergency_support")}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <MessageSquare className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-medium">12 {t("languages_count")}</p>
                  <p className="text-muted-foreground text-xs">{t("multilingual_support")}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <Globe className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-medium">54 {t("countries_count")}</p>
                  <p className="text-muted-foreground text-xs">{t("african_coverage")}</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                {t("avg_response_time")}: <span className="text-primary font-medium">2 {t("hours")}</span>
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Contact;