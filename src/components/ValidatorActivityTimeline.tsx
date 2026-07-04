import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLanguage } from '@/contexts/LanguageContext';

interface ValidationActivity {
  id: string;
  status: string;
  validated_at: string;
  validated_by_user_id: string;
  witness_afro_id: string;
  rejection_reason: string | null;
  validator_email: string;
  afroloc_code: string;
  region: string | null;
}

export const ValidatorActivityTimeline = () => {
  const { t } = useLanguage();
  const [activities, setActivities] = useState<ValidationActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentActivities = async () => {
    try {
      // Get recent validations (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: validations, error } = await supabase
        .from("afroloc_witnesses")
        .select(`
          id,
          status,
          validated_at,
          validated_by_user_id,
          witness_afro_id,
          rejection_reason,
          afroloc_record:afroloc_records(
            code,
            level1_name,
            level2_name,
            level3_name,
            level4_name
          )
        `)
        .in("status", ["confirmed", "rejected"])
        .not("validated_at", "is", null)
        .gte("validated_at", yesterday.toISOString())
        .order("validated_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get validator profiles
      const validatorIds = [...new Set(validations?.map(v => v.validated_by_user_id).filter(Boolean))];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", validatorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      
      const activities: ValidationActivity[] = (validations || []).map((validation) => {
        const validatorName = validation.validated_by_user_id 
          ? profileMap.get(validation.validated_by_user_id) || "Unknown Validator"
          : "Unknown Validator";

        const region = [
          validation.afroloc_record?.level4_name,
          validation.afroloc_record?.level3_name,
          validation.afroloc_record?.level2_name,
          validation.afroloc_record?.level1_name,
        ]
          .filter(Boolean)
          .join(", ") || null;

        return {
          id: validation.id,
          status: validation.status,
          validated_at: validation.validated_at!,
          validated_by_user_id: validation.validated_by_user_id!,
          witness_afro_id: validation.witness_afro_id,
          rejection_reason: validation.rejection_reason,
          validator_email: validatorName,
          afroloc_code: validation.afroloc_record?.code || "Unknown",
          region,
        };
      });

      setActivities(activities);
    } catch (error) {
      console.error("Error fetching validation activities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivities();

    // Set up real-time subscription for activity updates
    const channel = supabase
      .channel('validation-activities-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'afroloc_witnesses',
          filter: 'status=in.(confirmed,rejected)'
        },
        (payload) => {
          console.log('Validation activity updated:', payload);
          fetchRecentActivities();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to validation activities realtime updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-4">{t('validatoractivity_loading')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('validatoractivity_title')}
        </CardTitle>
        <CardDescription>
          {t('validatoractivity_description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('validatoractivity_empty')}
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
                >
                  <div className="flex-shrink-0 mt-1">
                    {activity.status === "confirmed" ? (
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle className="h-4 w-4 text-red-600" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {activity.status === "confirmed" ? t('validatoractivity_approved') : t('validatoractivity_rejected')} {t('validatoractivity_by')}{" "}
                          <span className="text-primary">{activity.validator_email}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.validated_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant={activity.status === "confirmed" ? "default" : "destructive"}>
                        {activity.status === "confirmed" ? t('validatoractivity_approved') : t('validatoractivity_rejected')}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-2">
                        <span className="text-muted-foreground">AFROLOC:</span>
                        <span className="font-mono font-medium">{activity.afroloc_code}</span>
                      </p>
                      
                      {activity.region && (
                        <p className="flex items-center gap-2">
                          <span className="text-muted-foreground">{t('validatoractivity_region')}</span>
                          <span className="text-xs">{activity.region}</span>
                        </p>
                      )}
                      
                      {activity.rejection_reason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-xs text-red-800">
                            <strong>{t('validatoractivity_reason')}</strong> {activity.rejection_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
