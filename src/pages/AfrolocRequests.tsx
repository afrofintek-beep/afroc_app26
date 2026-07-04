import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthorizationLevel } from "@/hooks/useAuthorizationLevel";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  MapPin, 
  Phone, 
  User, 
  Clock, 
  CheckCircle, 
  XCircle, 
  UserPlus,
  FileText,
  Camera,
  Navigation,
  AlertCircle,
  Search,
  Filter,
  RefreshCcw
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

type RequestStatus = 
  | "pending_otp" 
  | "otp_verified" 
  | "pending_document" 
  | "pending_assignment" 
  | "assigned" 
  | "in_progress" 
  | "pending_site_visit" 
  | "completed" 
  | "rejected" 
  | "cancelled";

interface AfrolocRequest {
  id: string;
  requester_phone: string;
  requester_name: string | null;
  requester_document_type: string | null;
  requester_document_number: string | null;
  requester_document_path: string | null;
  street_name: string;
  house_number: string;
  neighborhood: string | null;
  city: string | null;
  country_code: string;
  level1_name: string | null;
  level2_name: string | null;
  level3_name: string | null;
  level4_name: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  facade_photo_path: string | null;
  status: RequestStatus;
  assigned_to_user_id: string | null;
  assigned_by_user_id: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
  resulting_afroloc_id: string | null;
  rejection_reason: string | null;
}

interface Subordinate {
  user_id: string;
  current_level: number;
  administrative_role: string | null;
  profiles: {
    full_name: string | null;
    phone: string | null;
  } | null;
}

const statusConfig: Record<RequestStatus, { labelKey: string; color: string; icon: React.ElementType }> = {
  pending_otp: { labelKey: "afrolocreq_status_pending_otp", color: "bg-yellow-500", icon: Clock },
  otp_verified: { labelKey: "afrolocreq_status_otp_verified", color: "bg-blue-500", icon: CheckCircle },
  pending_document: { labelKey: "afrolocreq_status_pending_document", color: "bg-orange-500", icon: FileText },
  pending_assignment: { labelKey: "afrolocreq_status_pending_assignment", color: "bg-purple-500", icon: UserPlus },
  assigned: { labelKey: "afrolocreq_status_assigned", color: "bg-indigo-500", icon: User },
  in_progress: { labelKey: "afrolocreq_status_in_progress", color: "bg-cyan-500", icon: Navigation },
  pending_site_visit: { labelKey: "afrolocreq_status_pending_site_visit", color: "bg-teal-500", icon: MapPin },
  completed: { labelKey: "afrolocreq_status_completed", color: "bg-green-500", icon: CheckCircle },
  rejected: { labelKey: "afrolocreq_status_rejected", color: "bg-red-500", icon: XCircle },
  cancelled: { labelKey: "afrolocreq_status_cancelled", color: "bg-gray-500", icon: XCircle },
};

const AfrolocRequests = () => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: authLevel } = useAuthorizationLevel();
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<AfrolocRequest | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [assignNotes, setAssignNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [siteVisitNotes, setSiteVisitNotes] = useState("");

  const userLevel = authLevel?.current_level || 1;
  const isLevel4Plus = userLevel >= 4;

  // Fetch requests
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ["afroloc-requests", activeTab],
    queryFn: async () => {
      let query = supabase
        .from("afroloc_requests")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by status based on tab
      if (activeTab === "pending") {
        query = query.in("status", ["pending_otp", "otp_verified", "pending_document", "pending_assignment"]);
      } else if (activeTab === "assigned") {
        query = query.in("status", ["assigned", "in_progress", "pending_site_visit"]);
      } else if (activeTab === "completed") {
        query = query.in("status", ["completed", "rejected", "cancelled"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AfrolocRequest[];
    },
  });

  // Fetch subordinates for assignment
  const { data: subordinates } = useQuery({
    queryKey: ["subordinates"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: authLevels, error } = await supabase
        .from("user_authorization_levels")
        .select("user_id, current_level, administrative_role")
        .in("current_level", [2, 3])
        .eq("jurisdiction_country", authLevel?.jurisdiction_country);

      if (error) throw error;
      if (!authLevels) return [];

      // Fetch profiles separately
      const userIds = authLevels.map(a => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);

      return authLevels.map(al => ({
        ...al,
        profiles: profiles?.find(p => p.user_id === al.user_id) || null,
      })) as Subordinate[];
    },
    enabled: isLevel4Plus,
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async ({ requestId, assignToUserId, notes }: { 
      requestId: string; 
      assignToUserId: string; 
      notes: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("assign-afroloc-request", {
        body: {
          request_id: requestId,
          assign_to_user_id: assignToUserId,
          notes,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("afrolocreq_toast_assign_success"));
      setAssignDialogOpen(false);
      setSelectedAssignee("");
      setAssignNotes("");
      queryClient.invalidateQueries({ queryKey: ["afroloc-requests"] });
    },
    onError: (error) => {
      toast.error(t("afrolocreq_toast_assign_error") + ": " + error.message);
    },
  });

  // Complete/Reject mutation
  const completeMutation = useMutation({
    mutationFn: async ({ requestId, action, rejectionReason, siteVisitNotes }: { 
      requestId: string; 
      action: "approve" | "reject";
      rejectionReason?: string;
      siteVisitNotes?: string;
    }) => {
      // Get current location
      let geo_lat, geo_lon;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        geo_lat = position.coords.latitude;
        geo_lon = position.coords.longitude;
      } catch (e) {
        console.warn("Could not get location:", e);
      }

      const { data, error } = await supabase.functions.invoke("complete-afroloc-request", {
        body: {
          request_id: requestId,
          action,
          rejection_reason: rejectionReason,
          site_visit_notes: siteVisitNotes,
          site_visit_geo_lat: geo_lat,
          site_visit_geo_lon: geo_lon,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.afroloc_code) {
        toast.success(`${t("afrolocreq_toast_afroloc_created")}: ${data.afroloc_code}`);
      } else {
        toast.success(t("afrolocreq_toast_request_processed"));
      }
      setProcessDialogOpen(false);
      setRejectionReason("");
      setSiteVisitNotes("");
      queryClient.invalidateQueries({ queryKey: ["afroloc-requests"] });
    },
    onError: (error) => {
      toast.error(t("afrolocreq_toast_process_error") + ": " + error.message);
    },
  });

  const filteredRequests = requests?.filter(req => 
    req.street_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.house_number.includes(searchTerm) ||
    req.requester_phone.includes(searchTerm) ||
    req.requester_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAssign = () => {
    if (!selectedRequest || !selectedAssignee) return;
    assignMutation.mutate({
      requestId: selectedRequest.id,
      assignToUserId: selectedAssignee,
      notes: assignNotes,
    });
  };

  const handleProcess = (action: "approve" | "reject") => {
    if (!selectedRequest) return;
    completeMutation.mutate({
      requestId: selectedRequest.id,
      action,
      rejectionReason: action === "reject" ? rejectionReason : undefined,
      siteVisitNotes,
    });
  };

  const RequestCard = ({ request }: { request: AfrolocRequest }) => {
    const config = statusConfig[request.status];
    const StatusIcon = config.icon;
    const canAssign = isLevel4Plus && ["otp_verified", "pending_document", "pending_assignment"].includes(request.status);
    const canProcess = ["assigned", "in_progress", "pending_site_visit"].includes(request.status);

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge className={`${config.color} text-white`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {t(config.labelKey)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(request.created_at), "dd MMM yyyy HH:mm", { locale: pt })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {request.street_name} {request.house_number}
              </span>
            </div>

            {request.neighborhood && (
              <div className="text-sm text-muted-foreground pl-6">
                {request.neighborhood}
                {request.level4_name && `, ${request.level4_name}`}
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{request.requester_phone}</span>
              {request.requester_name && (
                <>
                  <User className="h-4 w-4 text-muted-foreground ml-2" />
                  <span>{request.requester_name}</span>
                </>
              )}
            </div>

            {request.geo_lat && request.geo_lon && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Navigation className="h-3 w-3" />
                <span>{request.geo_lat.toFixed(6)}, {request.geo_lon.toFixed(6)}</span>
              </div>
            )}

            {request.rejection_reason && (
              <div className="flex items-start gap-2 text-sm text-destructive mt-2 p-2 bg-destructive/10 rounded">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{request.rejection_reason}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            {canAssign && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedRequest(request);
                  setAssignDialogOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                {t("afrolocreq_btn_assign")}
              </Button>
            )}
            {canProcess && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedRequest(request);
                  setProcessDialogOpen(true);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {t("afrolocreq_btn_process")}
              </Button>
            )}
            {request.facade_photo_path && (
              <Button size="sm" variant="ghost">
                <Camera className="h-4 w-4" />
              </Button>
            )}
            {request.requester_document_path && (
              <Button size="sm" variant="ghost">
                <FileText className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("afrolocreq_page_title")}</h1>
            <p className="text-muted-foreground">
              {t("afrolocreq_page_subtitle")}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            {t("afrolocreq_btn_refresh")}
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("afrolocreq_search_placeholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              {t("afrolocreq_tab_pending")}
              {requests?.filter(r => ["pending_otp", "otp_verified", "pending_document", "pending_assignment"].includes(r.status)).length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {requests?.filter(r => ["pending_otp", "otp_verified", "pending_document", "pending_assignment"].includes(r.status)).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assigned">
              {t("afrolocreq_tab_assigned")}
              {requests?.filter(r => ["assigned", "in_progress", "pending_site_visit"].includes(r.status)).length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {requests?.filter(r => ["assigned", "in_progress", "pending_site_visit"].includes(r.status)).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">{t("afrolocreq_tab_completed")}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4 h-48 bg-muted" />
                  </Card>
                ))}
              </div>
            ) : filteredRequests && filteredRequests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("afrolocreq_empty_state")}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("afrolocreq_assign_dialog_title")}</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedRequest.street_name} {selectedRequest.house_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.neighborhood}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t("afrolocreq_assign_to_label")}</Label>
                  <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("afrolocreq_assign_select_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {subordinates?.map((sub) => (
                        <SelectItem key={sub.user_id} value={sub.user_id}>
                          {sub.profiles?.full_name || t("afrolocreq_no_name")} - {t("afrolocreq_level")} {sub.current_level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("afrolocreq_notes_optional_label")}</Label>
                  <Textarea
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder={t("afrolocreq_notes_placeholder")}
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                    {t("afrolocreq_btn_cancel")}
                  </Button>
                  <Button
                    onClick={handleAssign}
                    disabled={!selectedAssignee || assignMutation.isPending}
                  >
                    {assignMutation.isPending ? t("afrolocreq_btn_assigning") : t("afrolocreq_btn_assign")}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Process Dialog */}
        <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("afrolocreq_process_dialog_title")}</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedRequest.street_name} {selectedRequest.house_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.neighborhood}</p>
                  <p className="text-sm mt-2">
                    <Phone className="h-3 w-3 inline mr-1" />
                    {selectedRequest.requester_phone}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("afrolocreq_visit_notes_label")}</Label>
                  <Textarea
                    value={siteVisitNotes}
                    onChange={(e) => setSiteVisitNotes(e.target.value)}
                    placeholder={t("afrolocreq_visit_notes_placeholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("afrolocreq_rejection_reason_label")}</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={t("afrolocreq_rejection_reason_placeholder")}
                  />
                </div>

                <DialogFooter className="flex gap-2">
                  <Button variant="outline" onClick={() => setProcessDialogOpen(false)}>
                    {t("afrolocreq_btn_cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleProcess("reject")}
                    disabled={!rejectionReason || completeMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {t("afrolocreq_btn_reject")}
                  </Button>
                  <Button
                    onClick={() => handleProcess("approve")}
                    disabled={completeMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {completeMutation.isPending ? t("afrolocreq_btn_processing") : t("afrolocreq_btn_approve")}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AfrolocRequests;
