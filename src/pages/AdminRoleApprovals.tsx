import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface RoleChangeRequest {
  id: string;
  user_id: string;
  requested_role: 'admin' | 'moderator' | 'citizen';
  current_role: 'admin' | 'moderator' | 'citizen';
  requested_by_user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  justification: string | null;
  created_at: string;
  user_name: string;
  requester_name: string;
}

export default function AdminRoleApprovals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedRequest, setSelectedRequest] = useState<RoleChangeRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch pending role change requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['role-change-requests'],
    queryFn: async () => {
      const { data: requestsData, error } = await supabase
        .from('user_role_change_requests' as any)
        .select(`
          id,
          user_id,
          requested_role,
          current_role,
          requested_by_user_id,
          status,
          justification,
          created_at
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user names separately
      const userIds = [...new Set([
        ...requestsData.map((r: any) => r.user_id),
        ...requestsData.map((r: any) => r.requested_by_user_id)
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]));

      return requestsData.map((req: any) => ({
        ...req,
        user_name: profileMap.get(req.user_id) || 'Desconhecido',
        requester_name: profileMap.get(req.requested_by_user_id) || 'Desconhecido'
      })) as RoleChangeRequest[];
    }
  });

  // Approve or reject mutation
  const processRequestMutation = useMutation({
    mutationFn: async ({ requestId, action, reason }: { 
      requestId: string; 
      action: 'approve' | 'reject';
      reason?: string;
    }) => {
      const request = requests?.find(r => r.id === requestId);
      if (!request) throw new Error('Solicitação não encontrada');

      if (action === 'approve') {
        // Delete existing roles
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', request.user_id);

        // Insert new role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: request.user_id, 
            role: request.requested_role 
          });

        if (insertError) throw insertError;

        // Update request status
        const { error: updateError } = await supabase
          .from('user_role_change_requests' as any)
          .update({
            status: 'approved',
            approved_by_user_id: user?.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (updateError) throw updateError;

        // Log the change
        await supabase.rpc('log_role_change' as any, {
          _user_id: request.user_id,
          _changed_by_user_id: user?.id,
          _old_role: request.current_role,
          _new_role: request.requested_role,
          _justification: request.justification || 'Aprovado por superior',
          _request_id: requestId
        });
      } else {
        // Reject request
        const { error } = await supabase
          .from('user_role_change_requests' as any)
          .update({
            status: 'rejected',
            rejected_by_user_id: user?.id,
            rejected_at: new Date().toISOString(),
            rejection_reason: reason
          })
          .eq('id', requestId);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === 'approve'
          ? t('roleapprovals_toast_approved')
          : t('roleapprovals_toast_rejected')
      );
      queryClient.invalidateQueries({ queryKey: ['role-change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDialogOpen(false);
      setRejectionReason("");
      setSelectedRequest(null);
    },
    onError: (error) => {
      toast.error(t('roleapprovals_toast_error'));
      console.error(error);
    }
  });

  const handleAction = (request: RoleChangeRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedRequest || !actionType) return;
    
    processRequestMutation.mutate({
      requestId: selectedRequest.id,
      action: actionType,
      reason: actionType === 'reject' ? rejectionReason : undefined
    });
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return t('roleapprovals_role_admin');
    if (role === 'moderator') return t('roleapprovals_role_moderator');
    return t('roleapprovals_role_citizen');
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'admin') return 'default';
    if (role === 'moderator') return 'secondary';
    return 'outline';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{t('roleapprovals_title')}</h1>
              <p className="text-muted-foreground">{t('roleapprovals_subtitle')}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('roleapprovals_back')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('roleapprovals_card_title')}</CardTitle>
            <CardDescription>
              {t('roleapprovals_card_description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : requests && requests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('roleapprovals_th_user')}</TableHead>
                    <TableHead>{t('roleapprovals_th_current_role')}</TableHead>
                    <TableHead>{t('roleapprovals_th_requested_role')}</TableHead>
                    <TableHead>{t('roleapprovals_th_requested_by')}</TableHead>
                    <TableHead>{t('roleapprovals_th_justification')}</TableHead>
                    <TableHead>{t('roleapprovals_th_date')}</TableHead>
                    <TableHead>{t('roleapprovals_th_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.user_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(request.current_role)}>
                          {getRoleLabel(request.current_role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(request.requested_role)}>
                          {getRoleLabel(request.requested_role)}
                        </Badge>
                      </TableCell>
                      <TableCell>{request.requester_name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {request.justification || '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(request.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAction(request, 'approve')}
                            disabled={processRequestMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {t('roleapprovals_approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(request, 'reject')}
                            disabled={processRequestMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {t('roleapprovals_reject')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t('roleapprovals_empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                {actionType === 'approve' ? t('roleapprovals_dialog_approve_title') : t('roleapprovals_dialog_reject_title')}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest && (
                  <>
                    {t('roleapprovals_dialog_confirm_prefix')}{" "}
                    {actionType === 'approve' ? t('roleapprovals_dialog_confirm_approve_verb') : t('roleapprovals_dialog_confirm_reject_verb')}{" "}
                    {t('roleapprovals_dialog_confirm_middle')}{" "}
                    <span className="font-semibold">{selectedRequest.user_name}</span> {t('roleapprovals_dialog_confirm_to')}{" "}
                    <span className="font-semibold">{getRoleLabel(selectedRequest.requested_role)}</span>.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {actionType === 'reject' && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">{t('roleapprovals_reject_reason_label')}</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder={t('roleapprovals_reject_reason_placeholder')}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    required
                  />
                </div>
              </div>
            )}

            {actionType === 'approve' && selectedRequest && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-1">{t('roleapprovals_original_justification')}</p>
                <p className="text-muted-foreground">{selectedRequest.justification}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setRejectionReason("");
                }}
              >
                {t('roleapprovals_cancel')}
              </Button>
              <Button
                variant={actionType === 'approve' ? 'default' : 'destructive'}
                onClick={confirmAction}
                disabled={
                  (actionType === 'reject' && !rejectionReason.trim()) ||
                  processRequestMutation.isPending
                }
              >
                {processRequestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {actionType === 'approve' ? t('roleapprovals_approve') : t('roleapprovals_reject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
