import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download, Mail, MessageSquare, Search, CheckCircle, XCircle, AlertCircle, TrendingUp, Calendar, ArrowLeft } from "lucide-react";
import { LevelGate } from "@/components/LevelGate";
import type { Database } from "@/integrations/supabase/types";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type ContractDownload = Database["public"]["Tables"]["witness_contract_downloads"]["Row"];

interface DownloadWithProfile extends ContractDownload {
  downloader_name?: string;
}

export default function AdminContractDownloads() {
  const [downloads, setDownloads] = useState<DownloadWithProfile[]>([]);
  const [filteredDownloads, setFilteredDownloads] = useState<DownloadWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    filterDownloads();
  }, [searchQuery, downloads]);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/login");
      return;
    }

    loadDownloads();
  };

  const loadDownloads = async () => {
    try {
      const { data: downloadsData, error: downloadsError } = await supabase
        .from("witness_contract_downloads")
        .select("*")
        .order("downloaded_at", { ascending: false });

      if (downloadsError) throw downloadsError;

      // Fetch downloader profiles
      if (downloadsData && downloadsData.length > 0) {
        const userIds = [...new Set(downloadsData.map(d => d.downloaded_by_user_id))];
        
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const profileMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

        const enrichedDownloads = downloadsData.map(download => ({
          ...download,
          downloader_name: profileMap.get(download.downloaded_by_user_id) || t('contractdl_unknown')
        }));

        setDownloads(enrichedDownloads);
        setFilteredDownloads(enrichedDownloads);
      } else {
        setDownloads([]);
        setFilteredDownloads([]);
      }
    } catch (error: any) {
      toast({
        title: t('contractdl_error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterDownloads = () => {
    if (!searchQuery.trim()) {
      setFilteredDownloads(downloads);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = downloads.filter(download => 
      download.afroloc_code.toLowerCase().includes(query) ||
      download.witness_afro_id.toLowerCase().includes(query) ||
      download.downloader_name?.toLowerCase().includes(query)
    );
    setFilteredDownloads(filtered);
  };

  const getNotificationBadge = (sent: boolean, status?: string | null) => {
    if (sent) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          {t('contractdl_sent')}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {t('contractdl_failed')}
      </Badge>
    );
  };

  const stats = {
    total: downloads.length,
    emailSuccess: downloads.filter(d => d.email_sent).length,
    whatsappSuccess: downloads.filter(d => d.whatsapp_sent).length,
    bothSuccess: downloads.filter(d => d.email_sent && d.whatsapp_sent).length,
  };

  // Calculate time-based analytics
  const getFilteredByTimeRange = () => {
    const now = new Date();
    const cutoffDate = new Date();
    
    switch(timeRange) {
      case "7d":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case "all":
        return downloads;
    }
    
    return downloads.filter(d => new Date(d.downloaded_at) >= cutoffDate);
  };

  const timeFilteredDownloads = getFilteredByTimeRange();

  // Downloads over time (daily aggregation)
  const downloadsOverTime = () => {
    const grouped = new Map<string, number>();
    
    timeFilteredDownloads.forEach(download => {
      const date = new Date(download.downloaded_at).toLocaleDateString();
      grouped.set(date, (grouped.get(date) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([date, count]) => ({ date, downloads: count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 data points
  };

  // Notification success rates
  const notificationSuccessData = [
    { 
      name: "Email", 
      successful: timeFilteredDownloads.filter(d => d.email_sent).length,
      failed: timeFilteredDownloads.filter(d => !d.email_sent).length
    },
    { 
      name: "WhatsApp", 
      successful: timeFilteredDownloads.filter(d => d.whatsapp_sent).length,
      failed: timeFilteredDownloads.filter(d => !d.whatsapp_sent).length
    },
  ];

  // Success rate pie chart data
  const successRatePieData = [
    { name: t('contractdl_both_sent'), value: timeFilteredDownloads.filter(d => d.email_sent && d.whatsapp_sent).length, color: "#10b981" },
    { name: t('contractdl_email_only'), value: timeFilteredDownloads.filter(d => d.email_sent && !d.whatsapp_sent).length, color: "#3b82f6" },
    { name: t('contractdl_whatsapp_only'), value: timeFilteredDownloads.filter(d => !d.email_sent && d.whatsapp_sent).length, color: "#8b5cf6" },
    { name: t('contractdl_both_failed'), value: timeFilteredDownloads.filter(d => !d.email_sent && !d.whatsapp_sent).length, color: "#ef4444" },
  ].filter(item => item.value > 0);

  // Calculate success rates
  const emailSuccessRate = timeFilteredDownloads.length > 0 
    ? ((timeFilteredDownloads.filter(d => d.email_sent).length / timeFilteredDownloads.length) * 100).toFixed(1)
    : "0";
  
  const whatsappSuccessRate = timeFilteredDownloads.length > 0
    ? ((timeFilteredDownloads.filter(d => d.whatsapp_sent).length / timeFilteredDownloads.length) * 100).toFixed(1)
    : "0";

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

  return (
    <LevelGate requiredLevel={2}>
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
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
                    <h1 className="text-3xl font-bold text-foreground">{t('contractdl_title')}</h1>
                    <p className="text-muted-foreground">
                      {t('contractdl_subtitle')}
                    </p>
                  </div>
                </div>
                
                <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">{t('contractdl_last_7_days')}</SelectItem>
                    <SelectItem value="30d">{t('contractdl_last_30_days')}</SelectItem>
                    <SelectItem value="90d">{t('contractdl_last_90_days')}</SelectItem>
                    <SelectItem value="all">{t('contractdl_all_time')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('contractdl_total_downloads')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">{timeFilteredDownloads.length}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('contractdl_email_success_rate')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-green-600" />
                      <span className="text-2xl font-bold">{emailSuccessRate}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeFilteredDownloads.filter(d => d.email_sent).length} / {timeFilteredDownloads.length} {t('contractdl_sent_suffix')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('contractdl_whatsapp_success_rate')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                      <span className="text-2xl font-bold">{whatsappSuccessRate}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeFilteredDownloads.filter(d => d.whatsapp_sent).length} / {timeFilteredDownloads.length} {t('contractdl_sent_suffix')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('contractdl_both_notifications')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-2xl font-bold">
                        {timeFilteredDownloads.filter(d => d.email_sent && d.whatsapp_sent).length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeFilteredDownloads.length > 0 
                        ? ((timeFilteredDownloads.filter(d => d.email_sent && d.whatsapp_sent).length / timeFilteredDownloads.length) * 100).toFixed(1)
                        : "0"}% {t('contractdl_success_rate_suffix')}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Analytics Charts */}
              <Tabs defaultValue="trends" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="trends">{t('contractdl_tab_trends')}</TabsTrigger>
                  <TabsTrigger value="notifications">{t('contractdl_tab_notifications')}</TabsTrigger>
                  <TabsTrigger value="distribution">{t('contractdl_tab_distribution')}</TabsTrigger>
                </TabsList>

                <TabsContent value="trends" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {t('contractdl_downloads_over_time')}
                      </CardTitle>
                      <CardDescription>{t('contractdl_downloads_over_time_desc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={downloadsOverTime()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="downloads" 
                            stroke="#8b5cf6" 
                            strokeWidth={2}
                            dot={{ fill: "#8b5cf6" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        {t('contractdl_notification_delivery_success')}
                      </CardTitle>
                      <CardDescription>{t('contractdl_notification_delivery_success_desc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={notificationSuccessData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="successful" fill="#10b981" name={t('contractdl_successful')} />
                          <Bar dataKey="failed" fill="#ef4444" name={t('contractdl_failed')} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="distribution" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {t('contractdl_notification_success_distribution')}
                      </CardTitle>
                      <CardDescription>{t('contractdl_notification_success_distribution_desc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col md:flex-row items-center gap-8">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={successRatePieData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {successRatePieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          {successRatePieData.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded" 
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-sm">
                                {item.name}: <strong>{item.value}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Search */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('contractdl_download_history')}</CardTitle>
                  <CardDescription>
                    {t('contractdl_search_desc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('contractdl_search_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Downloads Table */}
              {loading ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">{t('contractdl_loading')}</p>
                  </CardContent>
                </Card>
              ) : filteredDownloads.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Download className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery ? t('contractdl_no_results') : t('contractdl_no_downloads')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredDownloads.map((download) => (
                    <Card key={download.id}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {/* Download Info */}
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">AFROLOC</label>
                              <p className="font-mono font-semibold">{download.afroloc_code}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">{t('contractdl_witness_afroloc')}</label>
                              <p className="font-mono">{download.witness_afro_id}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">{t('contractdl_downloaded_by')}</label>
                              <p>{download.downloader_name}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">{t('contractdl_downloaded_at')}</label>
                              <p className="text-sm">
                                {new Date(download.downloaded_at).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Email Status */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <label className="text-xs font-medium text-muted-foreground">{t('contractdl_email_notification')}</label>
                            </div>
                            {getNotificationBadge(download.email_sent, download.email_status)}
                            {download.email_status && (
                              <div className="rounded-md bg-muted p-2">
                                <p className="text-xs text-muted-foreground break-words">
                                  {download.email_status}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* WhatsApp Status */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <label className="text-xs font-medium text-muted-foreground">{t('contractdl_whatsapp_notification')}</label>
                            </div>
                            {getNotificationBadge(download.whatsapp_sent, download.whatsapp_status)}
                            {download.whatsapp_status && (
                              <div className="rounded-md bg-muted p-2">
                                <p className="text-xs text-muted-foreground break-words">
                                  {download.whatsapp_status}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
      </DashboardLayout>
    </LevelGate>
  );
}
