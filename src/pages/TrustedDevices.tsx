import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Smartphone, Monitor, Tablet, Shield, XCircle, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { format } from "date-fns";

interface Device {
  id: string;
  device_name: string;
  device_type: string;
  device_fingerprint: string;
  browser: string | null;
  os: string | null;
  is_trusted: boolean;
  last_active_at: string;
  created_at: string;
  revoked_at: string | null;
}

export default function TrustedDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .order('last_active_at', { ascending: false });

      if (error) throw error;

      setDevices(data || []);

      // Identify current device (most recently active)
      if (data && data.length > 0) {
        setCurrentDeviceId(data[0].id);
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('user_devices')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', deviceId);

      if (error) throw error;

      toast({
        title: t('success'),
        description: "Dispositivo desconectado com sucesso",
      });

      loadDevices();
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  return (
    <DashboardLayout>
      <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{t('devices_sessions')}</h1>
                <p className="text-muted-foreground">
                  {t('manage_devices')}
                </p>
              </div>
            </div>

            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                </CardContent>
              </Card>
            ) : devices.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Nenhum dispositivo ativo encontrado
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {devices.map((device) => (
                  <Card key={device.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            {getDeviceIcon(device.device_type)}
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {device.device_name}
                              {device.id === currentDeviceId && (
                                <Badge variant="secondary" className="text-xs">
                                  {t('this_device')}
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription>
                              {device.browser} • {device.os}
                            </CardDescription>
                          </div>
                        </div>
                        {device.id !== currentDeviceId && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => revokeDevice(device.id)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            {t('revoke_access')}
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {device.is_trusted ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-muted-foreground">
                                  {t('trusted_device')}
                                </span>
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  Dispositivo padrão
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-medium">{t('last_active')}:</span>{" "}
                          {format(new Date(device.last_active_at), "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
    </DashboardLayout>
  );
}
