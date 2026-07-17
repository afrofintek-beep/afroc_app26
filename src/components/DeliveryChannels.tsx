/**
 * AFROLOC Delivery Channels Component
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { authedInvoke } from "@/lib/authedInvoke";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Package, 
  Mail, 
  MapPin, 
  Plus, 
  Star, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Loader2
} from "lucide-react";

interface Operator {
  id: string;
  code: string;
  name: string;
  operator_type: string;
  logo_path?: string;
}

interface DeliveryPoint {
  id: string;
  afroloc_record_id: string;
  point_type: "po_box" | "locker" | "pickup";
  point_code: string;
  point_name?: string;
  point_address?: string;
  geo_lat?: number;
  geo_lon?: number;
  is_primary: boolean;
  status: "pending_otp" | "active" | "revoked" | "expired";
  confirmed_at?: string;
  created_at: string;
  operator: Operator;
}

interface DeliveryChannelsProps {
  afrolocRecordId?: string;
  onDeliveryPointAdded?: (point: DeliveryPoint) => void;
}

const POINT_TYPE_CONFIG = {
  po_box: { 
    label: "Caixa Postal", 
    icon: Mail, 
    description: "Caixa postal tradicional nos correios" 
  },
  locker: { 
    label: "Locker", 
    icon: Package, 
    description: "Armário automático de recolha" 
  },
  pickup: { 
    label: "Ponto de Recolha", 
    icon: MapPin, 
    description: "Loja ou ponto de recolha parceiro" 
  },
};

const STATUS_CONFIG = {
  pending_otp: { 
    label: "Pendente OTP", 
    variant: "outline" as const, 
    icon: Clock 
  },
  active: { 
    label: "Ativo", 
    variant: "default" as const, 
    icon: CheckCircle2 
  },
  revoked: { 
    label: "Revogado", 
    variant: "destructive" as const, 
    icon: XCircle 
  },
  expired: { 
    label: "Expirado", 
    variant: "secondary" as const, 
    icon: XCircle 
  },
};

export default function DeliveryChannels({ 
  afrolocRecordId, 
  onDeliveryPointAdded 
}: DeliveryChannelsProps) {
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Add form state
  const [selectedOperator, setSelectedOperator] = useState("");
  const [pointType, setPointType] = useState<"po_box" | "locker" | "pickup">("po_box");
  const [pointCode, setPointCode] = useState("");
  const [pointName, setPointName] = useState("");
  const [pointAddress, setPointAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // OTP confirmation state
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [pendingDeliveryPointId, setPendingDeliveryPointId] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const { toast } = useToast();
  const { t } = useLanguage();

  const POINT_TYPE_LABELS: Record<string, string> = {
    po_box: t('delivery_type_po_box'),
    locker: t('delivery_type_locker'),
    pickup: t('delivery_type_pickup'),
  };

  const STATUS_LABELS: Record<string, string> = {
    pending_otp: t('delivery_status_pending_otp'),
    active: t('delivery_status_active'),
    revoked: t('delivery_status_revoked'),
    expired: t('delivery_status_expired'),
  };

  useEffect(() => {
    if (afrolocRecordId) {
      loadDeliveryPoints();
    }
    loadOperators();
  }, [afrolocRecordId]);

  const loadDeliveryPoints = async () => {
    if (!afrolocRecordId) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await authedInvoke("delivery-list", { afroloc_record_id: afrolocRecordId });

      if (error) throw error;
      setDeliveryPoints(data.delivery_points || []);
    } catch (error) {
      console.error("Error loading delivery points:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadOperators = async () => {
    try {
      const { data } = await supabase
        .from("afroloc_operators")
        .select("id, code, name, operator_type, logo_path")
        .eq("is_active", true)
        .order("name");
      setOperators(data || []);
    } catch (error) {
      console.error("Error loading operators:", error);
    }
  };

  const handleAddDeliveryPoint = async () => {
    if (!afrolocRecordId || !selectedOperator || !pointCode) {
      toast({
        title: t('delivery_toast_required_fields_title'),
        description: t('delivery_toast_required_fields_desc'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await authedInvoke("delivery-register", {
        afroloc_record_id: afrolocRecordId,
        operator_id: selectedOperator,
        point_type: pointType,
        point_code: pointCode,
        point_name: pointName || undefined,
        point_address: pointAddress || undefined,
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t('delivery_toast_registered_title'),
          description: t('delivery_toast_registered_desc'),
        });
        
        // Store pending point ID and show OTP dialog
        setPendingDeliveryPointId(data.delivery_point_id);
        if (data.otp_dev) {
          setDevOtp(data.otp_dev);
        }
        setShowOtpDialog(true);
        
        // Reset form
        setShowAddForm(false);
        setSelectedOperator("");
        setPointCode("");
        setPointName("");
        setPointAddress("");
        setPointType("po_box");
      }
    } catch (error: any) {
      toast({
        title: t('delivery_toast_error_title'),
        description: error.message || t('delivery_toast_register_failed'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!pendingDeliveryPointId || otpValue.length !== 6) return;

    setIsConfirming(true);
    try {
      const { data, error } = await authedInvoke("delivery-confirm", {
        delivery_point_id: pendingDeliveryPointId,
        otp: otpValue,
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t('delivery_toast_confirmed_title'),
          description: t('delivery_toast_confirmed_desc'),
        });
        
        setShowOtpDialog(false);
        setOtpValue("");
        setPendingDeliveryPointId(null);
        setDevOtp(null);
        
        // Reload delivery points
        await loadDeliveryPoints();
      } else if (data.error) {
        toast({
          title: t('delivery_toast_invalid_code_title'),
          description: data.message || t('delivery_toast_invalid_code_desc'),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: t('delivery_toast_error_title'),
        description: error.message || t('delivery_toast_confirm_failed'),
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSetPrimary = async (deliveryPointId: string) => {
    try {
      const { data, error } = await authedInvoke("delivery-set-primary", { delivery_point_id: deliveryPointId });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t('delivery_toast_primary_set_title'),
          description: t('delivery_toast_primary_set_desc'),
        });
        await loadDeliveryPoints();
      }
    } catch (error: any) {
      toast({
        title: t('delivery_toast_error_title'),
        description: error.message || t('delivery_toast_primary_failed'),
        variant: "destructive",
      });
    }
  };

  const handleRevoke = async (deliveryPointId: string) => {
    try {
      const { data, error } = await authedInvoke("delivery-revoke", {
        delivery_point_id: deliveryPointId,
        reason: "Revogado pelo utilizador",
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t('delivery_toast_revoked_title'),
          description: t('delivery_toast_revoked_desc'),
        });
        await loadDeliveryPoints();
      }
    } catch (error: any) {
      toast({
        title: t('delivery_toast_error_title'),
        description: error.message || t('delivery_toast_revoke_failed'),
        variant: "destructive",
      });
    }
  };

  const PointTypeIcon = POINT_TYPE_CONFIG[pointType]?.icon || Package;

  return (
    <div className="space-y-4">
      <Card className="border-dashed border-2 border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t('delivery_card_title')}
          </CardTitle>
          <CardDescription>
            {t('delivery_card_description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing delivery points */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : deliveryPoints.length > 0 ? (
            <div className="space-y-3">
              {deliveryPoints.map((point) => {
                const TypeIcon = POINT_TYPE_CONFIG[point.point_type]?.icon || Package;
                const statusConfig = STATUS_CONFIG[point.status];
                const StatusIcon = statusConfig?.icon || Clock;
                
                return (
                  <div
                    key={point.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      point.is_primary ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        point.is_primary ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <TypeIcon className={`h-5 w-5 ${
                          point.is_primary ? "text-primary" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{point.operator.name}</span>
                          {point.is_primary && (
                            <Badge variant="default" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              {t('delivery_badge_primary')}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {POINT_TYPE_LABELS[point.point_type]}: {point.point_code}
                        </div>
                        {point.point_name && (
                          <div className="text-xs text-muted-foreground">{point.point_name}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={statusConfig?.variant || "secondary"}
                        className="text-xs"
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {STATUS_LABELS[point.status]}
                      </Badge>
                      {point.status === "active" && !point.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetPrimary(point.id)}
                          title={t('delivery_action_set_primary')}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      {point.status !== "revoked" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(point.id)}
                          title={t('delivery_action_revoke')}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                {t('delivery_empty_state')}
              </AlertDescription>
            </Alert>
          )}

          {/* Add form */}
          {showAddForm ? (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('delivery_label_operator')}</Label>
                  <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('delivery_placeholder_select_operator')} />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('delivery_label_type')}</Label>
                  <Select 
                    value={pointType} 
                    onValueChange={(v) => setPointType(v as "po_box" | "locker" | "pickup")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(POINT_TYPE_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-4 w-4" />
                            {POINT_TYPE_LABELS[key]}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('delivery_label_code')}</Label>
                  <Input
                    value={pointCode}
                    onChange={(e) => setPointCode(e.target.value)}
                    placeholder={t('delivery_placeholder_code')}
                  />
                </div>
                <div>
                  <Label>{t('delivery_label_name')}</Label>
                  <Input
                    value={pointName}
                    onChange={(e) => setPointName(e.target.value)}
                    placeholder={t('delivery_placeholder_name')}
                  />
                </div>
              </div>

              <div>
                <Label>{t('delivery_label_address')}</Label>
                <Input
                  value={pointAddress}
                  onChange={(e) => setPointAddress(e.target.value)}
                  placeholder={t('delivery_placeholder_address')}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  disabled={isSubmitting}
                >
                  {t('delivery_button_cancel')}
                </Button>
                <Button
                  onClick={handleAddDeliveryPoint}
                  disabled={isSubmitting || !selectedOperator || !pointCode}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('delivery_button_registering')}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('delivery_button_add')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setShowAddForm(true)}
              disabled={!afrolocRecordId}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('delivery_button_add_channel')}
            </Button>
          )}

          {!afrolocRecordId && (
            <p className="text-xs text-muted-foreground text-center">
              {t('delivery_save_address_first')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* OTP Confirmation Dialog */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('delivery_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('delivery_dialog_description')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {devOtp && (
              <Alert>
                <AlertDescription className="font-mono text-center text-lg">
                  {t('delivery_dev_otp_label')} <strong>{devOtp}</strong>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex justify-center">
              <InputOTP
                value={otpValue}
                onChange={setOtpValue}
                maxLength={6}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowOtpDialog(false);
                  setOtpValue("");
                  setPendingDeliveryPointId(null);
                  setDevOtp(null);
                }}
                disabled={isConfirming}
              >
                {t('delivery_button_cancel')}
              </Button>
              <Button
                onClick={handleConfirmOtp}
                disabled={isConfirming || otpValue.length !== 6}
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('delivery_button_confirming')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('delivery_button_confirm')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
