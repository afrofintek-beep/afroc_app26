import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Shield, AlertTriangle, Activity, Search, Check, X, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SecurityEvent {
  id: string;
  created_at: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  endpoint: string | null;
  details: any;
  resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
}

interface SecurityStats {
  event_type: string;
  severity: string;
  event_count: number;
  unique_ips: number;
  unique_users: number;
}

interface BruteForceAttempt {
  ip_address: string;
  failed_attempts: number;
  last_attempt: string;
  user_ids: string[];
}

export default function SecurityMonitoring() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats[]>([]);
  const [bruteForce, setBruteForce] = useState<BruteForceAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("unresolved");
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    fetchSecurityData();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('security_events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'security_events'
        },
        () => {
          fetchSecurityData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);

      // Fetch recent events
      const { data: eventsData, error: eventsError } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      // Fetch statistics
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_security_stats', {
          p_start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          p_end_date: new Date().toISOString()
        });

      if (statsError) throw statsError;
      setStats(statsData || []);

      // Fetch brute force attempts
      const { data: bruteForceData, error: bruteForceError } = await supabase
        .rpc('detect_brute_force_attempts');

      if (bruteForceError) throw bruteForceError;
      setBruteForce(bruteForceData || []);
    } catch (error: any) {
      console.error("Error fetching security data:", error);
      toast.error(t("failed_load_security"));
    } finally {
      setLoading(false);
    }
  };

  const handleResolveEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('security_events')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          notes: resolutionNotes
        })
        .eq('id', eventId);

      if (error) throw error;

      toast.success(t("event_resolved"));
      setSelectedEvent(null);
      setResolutionNotes("");
      fetchSecurityData();
    } catch (error: any) {
      console.error("Error resolving event:", error);
      toast.error(t("failed_resolve"));
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: "bg-blue-100 text-blue-800 border-blue-300",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
      high: "bg-orange-100 text-orange-800 border-orange-300",
      critical: "bg-red-100 text-red-800 border-red-300"
    };
    return colors[severity as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getEventTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      rate_limit: t("rate_limit"),
      auth_failure: t("auth_failure"),
      suspicious_activity: t("suspicious_activity"),
      brute_force: t("brute_force")
    };
    return typeMap[type] || type;
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.endpoint?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.user_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || event.severity === severityFilter;
    const matchesType = typeFilter === "all" || event.event_type === typeFilter;
    const matchesResolved = 
      resolvedFilter === "all" ||
      (resolvedFilter === "resolved" && event.resolved) ||
      (resolvedFilter === "unresolved" && !event.resolved);

    return matchesSearch && matchesSeverity && matchesType && matchesResolved;
  });

  const totalEvents = stats.reduce((sum, stat) => sum + stat.event_count, 0);
  const criticalEvents = events.filter(e => e.severity === 'critical' && !e.resolved).length;
  const unresolvedEvents = events.filter(e => !e.resolved).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                {t("security_monitoring_title")}
              </h1>
              <p className="text-muted-foreground">
                {t("realtime_monitoring")}
              </p>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("total_events_24h")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEvents}</div>
              <p className="text-xs text-muted-foreground">{t("last_24_hours")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("critical_events")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{criticalEvents}</div>
              <p className="text-xs text-muted-foreground">{t("unresolved")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("unresolved_label")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{unresolvedEvents}</div>
              <p className="text-xs text-muted-foreground">{t("requires_attention")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("brute_force_attempts")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{bruteForce.length}</div>
              <p className="text-xs text-muted-foreground">{t("last_hour")}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events">
              <Activity className="h-4 w-4 mr-2" />
              {t("events")}
            </TabsTrigger>
            <TabsTrigger value="statistics">
              <Shield className="h-4 w-4 mr-2" />
              {t("statistics")}
            </TabsTrigger>
            <TabsTrigger value="threats">
              <AlertTriangle className="h-4 w-4 mr-2" />
              {t("active_threats")}
            </TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("filters")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("search_ip_endpoint")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("severity")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all_severities")}</SelectItem>
                      <SelectItem value="low">{t("low")}</SelectItem>
                      <SelectItem value="medium">{t("medium")}</SelectItem>
                      <SelectItem value="high">{t("high")}</SelectItem>
                      <SelectItem value="critical">{t("critical")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("event_type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all_types")}</SelectItem>
                      <SelectItem value="rate_limit">{t("rate_limit")}</SelectItem>
                      <SelectItem value="auth_failure">{t("auth_failure")}</SelectItem>
                      <SelectItem value="suspicious_activity">{t("suspicious_activity")}</SelectItem>
                      <SelectItem value="brute_force">{t("brute_force")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("secmon_status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all")}</SelectItem>
                      <SelectItem value="unresolved">{t("unresolved_label")}</SelectItem>
                      <SelectItem value="resolved">{t("resolved")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Events List */}
            <Card>
              <CardHeader>
                <CardTitle>{t("security_events")} ({filteredEvents.length})</CardTitle>
                <CardDescription>
                  {t("detected_security_history")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t("loading_events")}
                    </div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t("no_events")}
                    </div>
                  ) : (
                    filteredEvents.map((event) => (
                      <div
                        key={event.id}
                        className="border rounded-lg p-4 hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getSeverityColor(event.severity)}>
                                {event.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">
                                {getEventTypeLabel(event.event_type)}
                              </Badge>
                              {event.resolved && (
                                <Badge variant="outline" className="bg-green-100 text-green-800">
                                  <Check className="h-3 w-3 mr-1" />
                                  {t("resolved")}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">{t("secmon_ip")}:</span>{" "}
                                <span className="font-mono">{event.ip_address || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{t("secmon_endpoint")}:</span>{" "}
                                <span className="font-mono text-xs">{event.endpoint || "N/A"}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">{t("secmon_date")}:</span>{" "}
                                {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss")}
                              </div>
                            </div>

                            {event.details && Object.keys(event.details).length > 0 && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{t("secmon_details")}:</span>{" "}
                                <code className="bg-muted px-2 py-1 rounded text-xs">
                                  {JSON.stringify(event.details)}
                                </code>
                              </div>
                            )}

                            {event.notes && (
                              <div className="text-sm bg-green-50 p-2 rounded">
                                <span className="text-muted-foreground">{t("secmon_notes")}:</span> {event.notes}
                              </div>
                            )}
                          </div>

                          {!event.resolved && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedEvent(event)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  {t("resolve")}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>{t("resolve_security_event")}</DialogTitle>
                                  <DialogDescription>
                                    {t("add_resolution_notes")}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Textarea
                                    placeholder={t("describe_actions")}
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    rows={4}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedEvent(null);
                                        setResolutionNotes("");
                                      }}
                                    >
                                      {t("cancel")}
                                    </Button>
                                    <Button
                                      onClick={() => handleResolveEvent(event.id)}
                                      disabled={!resolutionNotes.trim()}
                                    >
                                      {t("mark_resolved")}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics">
            <Card>
              <CardHeader>
                <CardTitle>{t("security_stats_by_type")}</CardTitle>
                <CardDescription>
                  {t("aggregated_stats")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t("no_stats")}
                    </div>
                  ) : (
                    stats.map((stat, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(stat.severity)}>
                              {stat.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium">
                              {getEventTypeLabel(stat.event_type)}
                            </span>
                          </div>
                          <span className="text-2xl font-bold">{stat.event_count}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>{t("unique_ips")}: {stat.unique_ips}</div>
                          <div>{t("unique_users")}: {stat.unique_users}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Threats Tab */}
          <TabsContent value="threats">
            <Card>
              <CardHeader>
                <CardTitle>{t("detected_brute_force")}</CardTitle>
                <CardDescription>
                  {t("multiple_failed_attempts")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bruteForce.length === 0 ? (
                    <div className="text-center py-8 text-green-600">
                      ✓ {t("no_threats")}
                    </div>
                  ) : (
                    bruteForce.map((threat, index) => (
                      <div key={index} className="border border-red-300 rounded-lg p-4 bg-red-50">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                              <span className="font-mono font-bold">{threat.ip_address}</span>
                              <Badge variant="destructive">
                                {threat.failed_attempts} {t("failed_attempts").toLowerCase()}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {t("last_attempt")}: {format(new Date(threat.last_attempt), "dd/MM/yyyy HH:mm:ss")}
                            </div>
                            {threat.user_ids.length > 0 && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{t("targeted_users")}:</span>{" "}
                                <code className="bg-white px-2 py-1 rounded text-xs">
                                  {threat.user_ids.join(", ")}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
