import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Trash2, MapPin, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { 
  getAllOfflineAfrolocs, 
  getUnsyncedAfrolocs, 
  markAsSynced, 
  deleteOfflineAfroloc 
} from "@/utils/offlineStorage";
import { supabase } from "@/integrations/supabase/client";
import ConflictResolutionPanel from "@/components/ConflictResolutionPanel";
import { useLanguage } from "@/contexts/LanguageContext";

export default function OfflineSync() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();
  const { t } = useLanguage();
  
  const [records, setRecords] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const allRecords = await getAllOfflineAfrolocs(user.id);
      setRecords(allRecords);
    } catch (error) {
      console.error("Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncAllRecords = async () => {
    if (!isOnline) {
      toast({
        title: t('offlinesync_no_internet_title'),
        description: t('offlinesync_no_internet_desc'),
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      const unsynced = await getUnsyncedAfrolocs();
      let successCount = 0;
      let failCount = 0;

      for (const record of unsynced) {
        try {
          // Insert AFROLOC record into Supabase
          const { data: afrolocData, error: afrolocError } = await supabase
            .from('afroloc_records')
            .insert({
              user_id: record.user_id,
              registered_by_user_id: record.user_id,
              code: record.code,
              country: record.country,
              level1_name: record.level1_name,
              level1_code: record.level1_code,
              level2_name: record.level2_name,
              level2_code: record.level2_code,
              level3_name: record.level3_name,
              level3_code: record.level3_code,
              level4_name: record.level4_name,
              level4_code: record.level4_code,
              street_name: record.street_name,
              street_code: record.street_code,
              number: record.number,
              unit: record.unit,
              property_type: record.property_type,
              geo_lat: record.geo_lat,
              geo_lon: record.geo_lon,
              status: 'draft',
            })
            .select()
            .single();

          if (afrolocError) throw afrolocError;

          // Process witnesses
          if (record.witnesses && record.witnesses.length > 0) {
            for (const witness of record.witnesses) {
              try {
                // Insert witness record
                const { data: witnessData, error: witnessError } = await supabase
                  .from('afroloc_witnesses')
                  .insert({
                    afroloc_record_id: afrolocData.id,
                    witness_afro_id: witness.witness_afro_id,
                    witness_user_id: record.user_id, // Temporary, should lookup actual user
                    status: witness.validation_method === 'otp' ? 'pending' : 'confirmed',
                    signature: witness.signature,
                  })
                  .select()
                  .single();

                if (witnessError) {
                  console.error('Witness insert error:', witnessError);
                  continue;
                }

                // Send OTP if validation method is OTP and phone number provided
                if (witness.validation_method === 'otp' && witness.witness_phone) {
                  try {
                    await supabase.functions.invoke('send-witness-otp', {
                      body: {
                        witnessId: witnessData.id,
                        phone: witness.witness_phone,
                        afroidCode: record.code,
                      },
                    });
                    console.log(`OTP sent to witness: ${witness.witness_afro_id}`);
                  } catch (otpError) {
                    console.error('OTP send error:', otpError);
                  }
                }
              } catch (witnessError) {
                console.error('Witness processing error:', witnessError);
              }
            }
          }

          // Mark as synced
          await markAsSynced(record.id);
          successCount++;
        } catch (error) {
          console.error(`Failed to sync ${record.id}:`, error);
          failCount++;
        }
      }

      toast({
        title: t('offlinesync_sync_complete_title'),
        description: `${successCount} ${t('offlinesync_records_synced')}${failCount > 0 ? `, ${failCount} ${t('offlinesync_failed')}` : ''}`,
      });

      loadRecords();
    } catch (error: any) {
      toast({
        title: t('offlinesync_sync_failed_title'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      await deleteOfflineAfroloc(id);
      toast({
        title: t('offlinesync_record_deleted_title'),
        description: t('offlinesync_record_deleted_desc'),
      });
      loadRecords();
    } catch (error: any) {
      toast({
        title: t('offlinesync_delete_failed_title'),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const unsyncedCount = records.filter(r => !r.synced).length;

  if (loading) {
    return <div className="p-4">{t('offlinesync_loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/identities")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="gap-1">
                <Wifi className="h-3 w-3" />
                {t('offlinesync_online')}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" />
                {t('offlinesync_offline')}
              </Badge>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('offlinesync_records_title')}</CardTitle>
            <CardDescription>
              {records.length} {t('offlinesync_total_records')}
              {unsyncedCount > 0 && ` · ${unsyncedCount} ${t('offlinesync_pending_sync')}`}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Conflict Resolution */}
            <ConflictResolutionPanel onResolved={loadRecords} />

            {unsyncedCount > 0 && (
              <Button
                onClick={syncAllRecords}
                disabled={!isOnline || syncing}
                className="w-full"
              >
                <Upload className={`h-4 w-4 mr-2 ${syncing ? 'animate-bounce' : ''}`} />
                {syncing ? t('offlinesync_syncing') : `${t('offlinesync_sync_button')} ${unsyncedCount} ${t('offlinesync_records_label')}`}
              </Button>
            )}

            {records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('offlinesync_no_records')}</p>
                <Button
                  onClick={() => navigate("/offline-create")}
                  variant="outline"
                  className="mt-4"
                >
                  {t('offlinesync_create_first')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <Card key={record.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono font-semibold">
                              {record.code}
                            </code>
                            {record.synced ? (
                              <Badge variant="outline" className="text-xs">{t('offlinesync_synced_badge')}</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">{t('offlinesync_pending_badge')}</Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            {record.level1_name}
                            {record.level2_name && ` · ${record.level2_name}`}
                            {record.level3_name && ` · ${record.level3_name}`}
                            {record.level4_name && ` · ${record.level4_name}`}
                          </p>
                          
                          {record.street_name && (
                            <p className="text-sm text-muted-foreground">
                              {record.street_name}
                              {record.number && ` ${record.number}`}
                              {record.unit && ` ${t('offlinesync_unit_label')} ${record.unit}`}
                            </p>
                          )}
                          
                          {(record.geo_lat && record.geo_lon) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {/* Sem coordenadas nas UIs de utilizador — só indicamos que há localização. */}
                              Localização registada
                            </p>
                          )}

                          {record.witnesses && record.witnesses.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                {t('offlinesync_witnesses_label')} ({record.witnesses.length}):
                              </p>
                              {record.witnesses.map((w: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                  <span>
                                    • {w.witness_afro_id}
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {w.validation_method}
                                    </Badge>
                                  </span>
                                  {w.photo && (
                                    <Badge variant="secondary" className="text-xs">
                                      📸 {t('offlinesync_photo_badge')}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <p className="text-xs text-muted-foreground">
                            {t('offlinesync_created_label')}: {new Date(record.created_at).toLocaleString()}
                          </p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRecord(record.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={loadRecords}
          variant="outline"
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('offlinesync_refresh')}
        </Button>
      </div>
    </div>
  );
}
