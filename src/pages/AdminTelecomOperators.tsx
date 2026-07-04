import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Phone, AlertCircle, Save, ArrowLeft } from "lucide-react";
import { COUNTRIES } from "@/utils/countryConfig";

interface TelecomOperator {
  id: string;
  country_code: string;
  operator_name: string;
  operator_code: string;
  phone_prefixes: string[];
  otp_provider: string;
  is_active: boolean;
}

export default function AdminTelecomOperators() {
  const { t } = useLanguage();
  const [operators, setOperators] = useState<TelecomOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<TelecomOperator | null>(null);
  
  const [formData, setFormData] = useState({
    country_code: '',
    operator_name: '',
    operator_code: '',
    phone_prefixes: '',
    otp_provider: 'twilio',
    is_active: true
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadOperators();
  }, []);

  const checkAuthAndLoadOperators = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    loadOperators();
  };

  const loadOperators = async () => {
    try {
      const { data, error } = await supabase
        .from("telecom_operators")
        .select("*")
        .order("country_code", { ascending: true })
        .order("operator_name", { ascending: true });

      if (error) throw error;
      setOperators(data || []);
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      country_code: '',
      operator_name: '',
      operator_code: '',
      phone_prefixes: '',
      otp_provider: 'twilio',
      is_active: true
    });
    setEditingOperator(null);
  };

  const handleEdit = (operator: TelecomOperator) => {
    setEditingOperator(operator);
    setFormData({
      country_code: operator.country_code,
      operator_name: operator.operator_name,
      operator_code: operator.operator_code,
      phone_prefixes: operator.phone_prefixes.join(', '),
      otp_provider: operator.otp_provider,
      is_active: operator.is_active
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const prefixes = formData.phone_prefixes
        .split(',')
        .map(p => p.trim())
        .filter(p => p);

      const operatorData = {
        country_code: formData.country_code,
        operator_name: formData.operator_name,
        operator_code: formData.operator_code,
        phone_prefixes: prefixes,
        otp_provider: formData.otp_provider,
        is_active: formData.is_active
      };

      if (editingOperator) {
        const { error } = await supabase
          .from("telecom_operators")
          .update(operatorData)
          .eq('id', editingOperator.id);

        if (error) throw error;
        toast({
          title: t("success"),
          description: t("operator_updated"),
        });
      } else {
        const { error } = await supabase
          .from("telecom_operators")
          .insert(operatorData);

        if (error) throw error;
        toast({
          title: t("success"),
          description: t("operator_added"),
        });
      }

      setDialogOpen(false);
      resetForm();
      loadOperators();
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirm_delete_operator"))) return;

    try {
      const { error } = await supabase
        .from("telecom_operators")
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("operator_deleted"),
      });
      loadOperators();
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const groupedOperators = operators.reduce((acc, operator) => {
    if (!acc[operator.country_code]) {
      acc[operator.country_code] = [];
    }
    acc[operator.country_code].push(operator);
    return acc;
  }, {} as Record<string, TelecomOperator[]>);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-start gap-4 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/dashboard")}
                  className="flex-shrink-0 mt-1"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{t("telecom_operators")}</h1>
                  <p className="text-muted-foreground">
                    {t("manage_phone_structures")}
                  </p>
                </div>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("add_operator")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>
                        {editingOperator ? t("edit_operator") : t("add_new_operator")}
                      </DialogTitle>
                      <DialogDescription>
                        {t("configure_telecom")}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="country">{t("country")}</Label>
                        <Select 
                          value={formData.country_code} 
                          onValueChange={(value) => setFormData({...formData, country_code: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("select_country")} />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="operator_name">{t("operator_name")}</Label>
                        <Input
                          id="operator_name"
                          value={formData.operator_name}
                          onChange={(e) => setFormData({...formData, operator_name: e.target.value})}
                          placeholder={t("telecom_operator_name_placeholder")}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="operator_code">{t("operator_code")}</Label>
                        <Input
                          id="operator_code"
                          value={formData.operator_code}
                          onChange={(e) => setFormData({...formData, operator_code: e.target.value})}
                          placeholder={t("telecom_operator_code_placeholder")}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="phone_prefixes">{t("phone_prefixes")}</Label>
                        <Input
                          id="phone_prefixes"
                          value={formData.phone_prefixes}
                          onChange={(e) => setFormData({...formData, phone_prefixes: e.target.value})}
                          placeholder={t("telecom_phone_prefixes_placeholder")}
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("phone_prefixes_hint")}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="otp_provider">{t("otp_provider")}</Label>
                        <Select 
                          value={formData.otp_provider} 
                          onValueChange={(value) => setFormData({...formData, otp_provider: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="twilio">Twilio</SelectItem>
                            <SelectItem value="other">{t("telecom_other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                          className="rounded"
                        />
                        <Label htmlFor="is_active" className="cursor-pointer">{t("active")}</Label>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="submit" disabled={loading}>
                        <Save className="mr-2 h-4 w-4" />
                        {editingOperator ? t("update") : t("add")} {t("operator")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("prefixes_info")}
              </AlertDescription>
            </Alert>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{t("loading_operators")}</p>
              </div>
            ) : Object.keys(groupedOperators).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Phone className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t("no_operators")}</h3>
                  <p className="text-muted-foreground mb-6 text-center max-w-md">
                    {t("add_operators_hint")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedOperators).map(([countryCode, countryOperators]) => {
                  const country = COUNTRIES.find(c => c.code === countryCode);
                  return (
                    <Card key={countryCode}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {country?.name || countryCode}
                          <Badge variant="outline">{countryOperators.length} {t("operators")}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {countryOperators.map((operator) => (
                            <div 
                              key={operator.id}
                              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{operator.operator_name}</h3>
                                  <Badge variant="secondary">{operator.operator_code}</Badge>
                                  {!operator.is_active && (
                                    <Badge variant="destructive">{t("telecom_inactive")}</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Phone className="h-3 w-3" />
                                    {operator.phone_prefixes.map((prefix, idx) => (
                                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                                        {prefix}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="mt-1">
                                    {t("otp_provider_label")} <span className="font-medium capitalize">{operator.otp_provider}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(operator)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(operator.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
    </DashboardLayout>
  );
}