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
import { Plus, Edit, Trash2, Phone, AlertCircle, Save, Shield, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { COUNTRIES } from "@/utils/countryConfig";

interface ValidationNumber {
  id: string;
  phone_number: string;
  country_code: string;
  administrative_division_id: string;
  is_active: boolean;
  verification_status: string;
  usage_count: number;
  last_used_at: string | null;
  division?: {
    name: string;
    level: number;
    code: string;
  };
}

interface AdminDivision {
  id: string;
  country_code: string;
  level: number;
  code: string;
  name: string;
}

export default function AdminValidationNumbers() {
  const { t } = useLanguage();
  const [numbers, setNumbers] = useState<ValidationNumber[]>([]);
  const [divisions, setDivisions] = useState<AdminDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<ValidationNumber | null>(null);
  
  const [formData, setFormData] = useState({
    phone_number: '',
    country_code: '',
    administrative_division_id: '',
    is_active: true,
    verification_status: 'verified'
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    Promise.all([loadNumbers(), loadDivisions()]);
  };

  const loadNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from("validation_phone_numbers")
        .select(`
          *,
          division:administrative_divisions(name, level, code)
        `)
        .order("country_code", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const formatted = data?.map(item => ({
        ...item,
        division: Array.isArray(item.division) ? item.division[0] : item.division
      })) || [];
      
      setNumbers(formatted);
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

  const loadDivisions = async () => {
    try {
      const { data, error } = await supabase
        .from("administrative_divisions")
        .select("id, country_code, level, code, name")
        .order("country_code", { ascending: true })
        .order("level", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setDivisions(data || []);
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      phone_number: '',
      country_code: '',
      administrative_division_id: '',
      is_active: true,
      verification_status: 'verified'
    });
    setEditingNumber(null);
  };

  const handleEdit = (number: ValidationNumber) => {
    setEditingNumber(number);
    setFormData({
      phone_number: number.phone_number,
      country_code: number.country_code,
      administrative_division_id: number.administrative_division_id,
      is_active: number.is_active,
      verification_status: number.verification_status
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingNumber) {
        const { error } = await supabase
          .from("validation_phone_numbers")
          .update({
            phone_number: formData.phone_number,
            administrative_division_id: formData.administrative_division_id,
            is_active: formData.is_active,
            verification_status: formData.verification_status
          })
          .eq('id', editingNumber.id);

        if (error) throw error;
        toast({
          title: t("success"),
          description: t("number_updated"),
        });
      } else {
        const { error } = await supabase
          .from("validation_phone_numbers")
          .insert({
            phone_number: formData.phone_number,
            country_code: formData.country_code,
            administrative_division_id: formData.administrative_division_id,
            is_active: formData.is_active,
            verification_status: formData.verification_status
          });

        if (error) throw error;
        toast({
          title: t("success"),
          description: t("number_added"),
        });
      }

      setDialogOpen(false);
      resetForm();
      loadNumbers();
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
    if (!confirm(t("confirm_delete_number"))) return;

    try {
      const { error } = await supabase
        .from("validation_phone_numbers")
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("number_deleted"),
      });
      loadNumbers();
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredDivisions = divisions.filter(d => d.country_code === formData.country_code);

  const groupedNumbers = numbers.reduce((acc, number) => {
    if (!acc[number.country_code]) {
      acc[number.country_code] = [];
    }
    acc[number.country_code].push(number);
    return acc;
  }, {} as Record<string, ValidationNumber[]>);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'suspended': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Shield className="h-4 w-4 text-yellow-500" />;
    }
  };

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
                  <h1 className="text-3xl font-bold text-foreground">{t("validation_numbers")}</h1>
                  <p className="text-muted-foreground">
                    {t("preallocate_numbers")}
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
                    {t("add_number")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>
                        {editingNumber ? t("edit_validation_number") : t("add_validation_number")}
                      </DialogTitle>
                      <DialogDescription>
                        {t("allocate_phone_number")}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="phone_number">{t("phone_number")}</Label>
                        <Input
                          id="phone_number"
                          value={formData.phone_number}
                          onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                          placeholder="+244 923 456 789"
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("include_country_code")}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="country">{t("country")}</Label>
                        <Select 
                          value={formData.country_code} 
                          onValueChange={(value) => setFormData({...formData, country_code: value, administrative_division_id: ''})}
                          required
                          disabled={!!editingNumber}
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
                        <Label htmlFor="division">{t("administrative_division")}</Label>
                        <Select 
                          value={formData.administrative_division_id} 
                          onValueChange={(value) => setFormData({...formData, administrative_division_id: value})}
                          required
                          disabled={!formData.country_code}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("select_division")} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredDivisions.map((division) => (
                              <SelectItem key={division.id} value={division.id}>
                                {division.name} (Level {division.level} - {division.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="status">{t("verification_status")}</Label>
                        <Select 
                          value={formData.verification_status} 
                          onValueChange={(value) => setFormData({...formData, verification_status: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="verified">{t("verified")}</SelectItem>
                            <SelectItem value="pending">{t("pending")}</SelectItem>
                            <SelectItem value="suspended">{t("suspended")}</SelectItem>
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
                        {editingNumber ? t("update") : t("add")} {t("number")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("antifraud_system")}
              </AlertDescription>
            </Alert>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{t("loading_validation_numbers")}</p>
              </div>
            ) : Object.keys(groupedNumbers).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Phone className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t("no_validation_numbers")}</h3>
                  <p className="text-muted-foreground mb-6 text-center max-w-md">
                    {t("add_validation_hint")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedNumbers).map(([countryCode, countryNumbers]) => {
                  const country = COUNTRIES.find(c => c.code === countryCode);
                  return (
                    <Card key={countryCode}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {country?.name || countryCode}
                          <Badge variant="outline">{countryNumbers.length} {t("numbers")}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {countryNumbers.map((number) => (
                            <div 
                              key={number.id}
                              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold font-mono">{number.phone_number}</h3>
                                  {getStatusIcon(number.verification_status)}
                                  <Badge variant="secondary" className="capitalize">
                                    {number.verification_status}
                                  </Badge>
                                  {!number.is_active && (
                                    <Badge variant="destructive">Inactive</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div>
                                    <strong>{t("division_label")}</strong> {number.division?.name} (Level {number.division?.level})
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span>
                                      <strong>{t("used_label")}</strong> {number.usage_count} {t("times")}
                                    </span>
                                    {number.last_used_at && (
                                      <span>
                                        <strong>{t("last_label")}</strong> {new Date(number.last_used_at).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(number)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(number.id)}
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