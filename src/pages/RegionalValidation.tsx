import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardHeader from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle, XCircle, Clock, MapPin, User, Hash, Bell, BellOff, Users, ArrowLeft } from "lucide-react";
import { requestNotificationPermission, showBrowserNotification, playNotificationSound } from "@/utils/notifications";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ValidatorActivityTimeline } from "@/components/ValidatorActivityTimeline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ValidationRequest {
  id: string;
  afroloc_record_id: string;
  witness_user_id: string;
  witness_afro_id: string;
  otp_code: string;
  otp_sent_at: string;
  otp_expires_at: string;
  status: string;
  created_at: string;
  afroloc_record: {
    code: string;
    country: string;
    level1_name: string;
    level2_name: string;
    level3_name: string;
    level4_name: string;
    street_name: string;
    number: string;
  };
}

interface ValidatorPresence {
  user_id: string;
  email: string;
  online_at: string;
  region?: string;
}

const RegionalValidation = () => {
  const [requests, setRequests] = useState<ValidationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ValidationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [onlineValidators, setOnlineValidators] = useState<ValidatorPresence[]>([]);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Request notification permission on mount
  useEffect(() => {
    const setupNotifications = async () => {
      const permission = await requestNotificationPermission();
      setNotificationsEnabled(permission === "granted");
      
      if (permission === "granted") {
        toast({
          title: t('regionval_notifications_enabled'),
          description: t('regionval_notifications_enabled_desc'),
        });
      } else if (permission === "denied") {
        toast({
          title: t('regionval_notifications_blocked'),
          description: t('regionval_notifications_blocked_desc'),
          variant: "destructive",
        });
      }
    };

    setupNotifications();
  }, []);

  // Set up presence tracking
  useEffect(() => {
    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's validation region
      const { data: validationNumbers } = await supabase
        .from("validation_phone_numbers")
        .select("administrative_division_id, administrative_divisions(name)")
        .eq("validator_user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      const region = validationNumbers?.administrative_divisions?.name || "Unknown";

      const presenceChannel = supabase.channel('validators-presence', {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          console.log('Presence sync:', state);
          
          const validators: ValidatorPresence[] = [];
          Object.keys(state).forEach((key) => {
            const presences = state[key] as any[];
            presences.forEach((presence) => {
              validators.push({
                user_id: presence.user_id,
                email: presence.email,
                online_at: presence.online_at,
                region: presence.region,
              });
            });
          });
          
          setOnlineValidators(validators);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('Validator joined:', key, newPresences);
          
          const newValidator = newPresences[0] as any;
          if (newValidator.user_id !== user.id) {
            toast({
              title: t('regionval_validator_online'),
              description: `${newValidator.email} ${t('regionval_validator_online_desc')}`,
              duration: 3000,
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('Validator left:', key, leftPresences);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to validators presence');
            
            // Track this user's presence
            await presenceChannel.track({
              user_id: user.id,
              email: user.email,
              online_at: new Date().toISOString(),
              region: region,
            });
          }
        });

      return () => {
        presenceChannel.unsubscribe();
      };
    };

    setupPresence();
  }, []);

  useEffect(() => {
    fetchValidationRequests();

    // Set up real-time subscription for new validation requests
    const channel = supabase
      .channel('validation-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'afroloc_witnesses',
          filter: 'status=eq.pending'
        },
        async (payload) => {
          console.log('New validation request received:', payload);
          
          // Fetch the full record with AFROLOC details
          const { data: fullRecord } = await supabase
            .from("afroloc_witnesses")
            .select(`
              *,
              afroloc_record:afroloc_records(code)
            `)
            .eq("id", payload.new.id)
            .single();

          const afrolocCode = fullRecord?.afroloc_record?.code || payload.new.witness_afro_id;
          
          // Play notification sound
          playNotificationSound();
          
          // Show browser notification
          if (notificationsEnabled) {
            showBrowserNotification(
              `🔔 ${t('regionval_new_request')}`,
              {
                body: `${t('regionval_new_request_notif_body')}: ${afrolocCode}`,
                tag: `validation-${payload.new.id}`,
                requireInteraction: false,
              }
            );
          }
          
          // Show toast notification
          toast({
            title: t('regionval_new_request'),
            description: `${t('regionval_new_request_toast_desc')} ${afrolocCode}`,
            duration: 5000,
          });

          // Refresh the list
          fetchValidationRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'afroloc_witnesses',
          filter: 'status=eq.confirmed'
        },
        (payload) => {
          console.log('Validation request confirmed:', payload);
          
          // Refresh the list to remove confirmed items
          fetchValidationRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'afroloc_witnesses',
          filter: 'status=eq.rejected'
        },
        (payload) => {
          console.log('Validation request rejected:', payload);
          
          // Refresh the list to remove rejected items
          fetchValidationRequests();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to validation requests realtime updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to validation requests realtime updates');
          toast({
            title: t('regionval_connection_error'),
            description: t('regionval_connection_error_desc'),
            variant: "destructive",
          });
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('Unsubscribing from validation requests realtime updates');
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchValidationRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("afroloc_witnesses")
        .select(`
          *,
          afroloc_record:afroloc_records(
            code,
            country,
            level1_name,
            level2_name,
            level3_name,
            level4_name,
            street_name,
            number
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching validation requests:", error);
      toast({
        title: t('regionval_error'),
        description: t('regionval_load_failed'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: ValidationRequest) => {
    try {
      const { error } = await supabase
        .from("afroloc_witnesses")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          validated_at: new Date().toISOString(),
          validated_by_user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", request.id);

      if (error) throw error;

      toast({
        title: t('regionval_approved'),
        description: t('regionval_approved_desc'),
      });

      fetchValidationRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: t('regionval_error'),
        description: t('regionval_approve_failed'),
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast({
        title: t('regionval_error'),
        description: t('regionval_provide_reason'),
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("afroloc_witnesses")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          validated_at: new Date().toISOString(),
          validated_by_user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: t('regionval_rejected'),
        description: t('regionval_rejected_desc'),
      });

      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedRequest(null);
      fetchValidationRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: t('regionval_error'),
        description: t('regionval_reject_failed'),
        variant: "destructive",
      });
    }
  };

  const openRejectDialog = (request: ValidationRequest) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.href = "/dashboard"}
                className="flex-shrink-0 mt-1"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">{t('regionval_title')}</h1>
                <p className="text-muted-foreground">
                  {t('regionval_subtitle')}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                {notificationsEnabled ? (
                  <Badge variant="outline" className="gap-2">
                    <Bell className="h-4 w-4" />
                    {t('regionval_notifications_active')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-2">
                    <BellOff className="h-4 w-4" />
                    {t('regionval_notifications_disabled')}
                  </Badge>
                )}
              </div>
              
              {/* Online Validators */}
              {onlineValidators.length > 0 && (
                <Card className="w-80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('regionval_online_validators')} ({onlineValidators.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {onlineValidators.map((validator) => (
                      <div key={validator.user_id} className="flex items-center gap-3 text-sm">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-green-100 text-green-700">
                            {validator.email.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{validator.email}</p>
                          {validator.region && (
                            <p className="text-xs text-muted-foreground truncate">
                              {validator.region}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Validation Requests - Takes 2 columns */}
            <div className="lg:col-span-2">
              {requests.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {t('regionval_empty_title')}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {t('regionval_empty_desc')}
                    </p>
                    <Badge variant="outline" className="mt-4 gap-2">
                      <Bell className="h-4 w-4" />
                      {t('regionval_empty_badge')}
                    </Badge>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6">
                  {requests.map((request) => (
                    <Card key={request.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                              <Hash className="h-5 w-5" />
                              {request.afroloc_record.code}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {[
                                request.afroloc_record.street_name,
                                request.afroloc_record.number,
                                request.afroloc_record.level4_name,
                                request.afroloc_record.level3_name,
                                request.afroloc_record.level2_name,
                                request.afroloc_record.level1_name,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </CardDescription>
                          </div>
                          <Badge variant={isExpired(request.otp_expires_at) ? "destructive" : "default"}>
                            {isExpired(request.otp_expires_at) ? t('regionval_expired') : t('regionval_active')}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('regionval_witness_afroloc')}</p>
                              <p className="font-mono">{request.witness_afro_id}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('regionval_otp_code')}</p>
                              <p className="text-2xl font-bold text-primary">{request.otp_code}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('regionval_requested_at')}</p>
                              <p>{new Date(request.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('regionval_expires_at')}</p>
                              <p>{new Date(request.otp_expires_at).toLocaleString()}</p>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-4 border-t">
                            <Button
                              onClick={() => handleApprove(request)}
                              disabled={isExpired(request.otp_expires_at)}
                              className="flex-1"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {t('regionval_approve')}
                            </Button>
                            <Button
                              onClick={() => openRejectDialog(request)}
                              variant="destructive"
                              className="flex-1"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {t('regionval_reject')}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Timeline - Takes 1 column */}
            <div className="lg:col-span-1">
              <ValidatorActivityTimeline />
            </div>
          </div>
        )}

        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('regionval_reject_dialog_title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('regionval_reject_dialog_desc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Textarea
                placeholder={t('regionval_reject_placeholder')}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setRejectionReason("");
                setSelectedRequest(null);
              }}>
                {t('regionval_cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReject}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('regionval_reject')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default RegionalValidation;
