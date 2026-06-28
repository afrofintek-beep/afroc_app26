import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AddressTypeBadge } from "@/components/AddressTypeBadge";

export default function EditAddress() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<any>(null);
  const [streetName, setStreetName] = useState("");
  const [number, setNumber] = useState("");
  const [streetCode, setStreetCode] = useState("");

  useEffect(() => {
    loadRecord();
  }, [id]);

  const loadRecord = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('common.error'));
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("afroloc_records")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      
      setRecord(data);
      setStreetName(data.street_name || "");
      setNumber(data.number || "");
      setStreetCode(data.street_code || "");
    } catch (error) {
      console.error("Error loading record:", error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from("afroloc_records")
        .update({
          street_name: streetName || null,
          number: number || null,
          street_code: streetCode || null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success(t('address_updated_success'));
      navigate(`/identity/${id}`);
    } catch (error) {
      console.error("Error updating record:", error);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate(`/identity/${id}`)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('back')}
        </Button>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('update_address')}
            </CardTitle>
            <CardDescription className="space-y-1">
              <span className="font-mono">{record?.code}</span>
              {record && (
                <span className="block text-muted-foreground">
                  {[
                    record.country?.toUpperCase(),
                    record.level1_name,
                    record.level2_name,
                    record.level3_name,
                    record.level4_name,
                  ].filter(Boolean).join(", ")}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <AlertDescription>
                <strong>{t('address_update_title')}:</strong> {t('address_update_description')}
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="streetName">
                  {t('street_name')}
                  <span className="text-muted-foreground text-sm ml-2">
                    ({t('official_name_by_admin')})
                  </span>
                </Label>
                <Input
                  id="streetName"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                  placeholder={t('street_name_placeholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="number">
                  {t('house_number')}
                  <span className="text-muted-foreground text-sm ml-2">
                    ({t('official_number_by_admin')})
                  </span>
                </Label>
                <Input
                  id="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder={t('house_number_placeholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="streetCode">
                  {t('street_code')}
                  <span className="text-muted-foreground text-sm ml-2">
                    ({t('official_code_if_available')})
                  </span>
                </Label>
                <Input
                  id="streetCode"
                  value={streetCode}
                  onChange={(e) => setStreetCode(e.target.value)}
                  placeholder={t('street_code_placeholder')}
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <strong className="text-sm text-muted-foreground">{t('current_address_type')}:</strong>
                  <AddressTypeBadge addressType={record?.address_type} isCertified={record?.status === "certified"} size="sm" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('address_type_explanation')}
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/identity/${id}`)}
                  disabled={saving}
                  className="flex-1"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? t('saving') : t('save_changes')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
