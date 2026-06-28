import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  XCircle, 
  Shield, 
  AlertTriangle,
  Clock,
  Award,
  Users,
  Info,
  ArrowLeft,
  Flag,
  AlertOctagon,
  MapPin,
  Zap,
  UserX
} from "lucide-react";
import { format } from "date-fns";
import { pt, enUS } from "date-fns/locale";

interface ReputationHistory {
  id: string;
  action_type: string;
  score_change: number;
  previous_score: number;
  new_score: number;
  reason: string | null;
  created_at: string;
  afroloc_record_id: string | null;
}

interface WitnessRecord {
  id: string;
  afroloc_record_id: string;
  witness_afro_id: string;
  status: string;
  confirmed_at: string | null;
  validated_at: string | null;
  witness_reputation_score: number | null;
  created_at: string;
}

interface FraudFlag {
  id: string;
  flag_type: string;
  severity: string;
  description: string | null;
  metadata: unknown;
  resolved: boolean;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

const WitnessReputation = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentScore, setCurrentScore] = useState<number>(50);
  const [history, setHistory] = useState<ReputationHistory[]>([]);
  const [witnessRecords, setWitnessRecords] = useState<WitnessRecord[]>([]);
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [stats, setStats] = useState({
    totalConfirmations: 0,
    totalValidations: 0,
    totalRejections: 0,
    totalRecords: 0,
    activeFraudFlags: 0
  });

  const dateLocale = language === 'pt' ? pt : enUS;

  useEffect(() => {
    loadReputationData();
  }, []);

  const loadReputationData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      // Fetch reputation history
      const { data: historyData, error: historyError } = await supabase
        .from('witness_reputation_history')
        .select('*')
        .eq('witness_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (historyError) {
        console.error('Error fetching history:', historyError);
      } else {
        setHistory(historyData || []);
      }

      // Fetch witness records for this user
      const { data: witnessData, error: witnessError } = await supabase
        .from('afroloc_witnesses')
        .select('*')
        .eq('witness_user_id', user.id)
        .order('created_at', { ascending: false });

      if (witnessError) {
        console.error('Error fetching witnesses:', witnessError);
      } else {
        setWitnessRecords(witnessData || []);
        
        // Get current score from the most recent witness record
        const latestWithScore = witnessData?.find(w => w.witness_reputation_score !== null);
        if (latestWithScore) {
          setCurrentScore(latestWithScore.witness_reputation_score || 50);
        }
      }

      // Fetch fraud flags for this user
      const { data: fraudData, error: fraudError } = await supabase
        .from('witness_fraud_flags')
        .select('*')
        .eq('witness_user_id', user.id)
        .order('created_at', { ascending: false });

      if (fraudError) {
        console.error('Error fetching fraud flags:', fraudError);
      } else {
        setFraudFlags(fraudData || []);
      }

      // Calculate stats
      const confirmed = witnessData?.filter(w => w.status === 'confirmed').length || 0;
      const validated = witnessData?.filter(w => w.validated_at !== null).length || 0;
      const rejected = witnessData?.filter(w => w.status === 'rejected').length || 0;
      const activeFlags = fraudData?.filter(f => !f.resolved).length || 0;
      
      setStats({
        totalConfirmations: confirmed,
        totalValidations: validated,
        totalRejections: rejected,
        totalRecords: witnessData?.length || 0,
        activeFraudFlags: activeFlags
      });
    } catch (error) {
      console.error('Error loading reputation data:', error);
      toast({
        title: t('error'),
        description: "Erro ao carregar dados de reputação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getReputationLevel = (score: number) => {
    if (score >= 80) return { level: t('witness_reputation_excellent'), color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900' };
    if (score >= 60) return { level: t('witness_reputation_good'), color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900' };
    if (score >= 40) return { level: t('witness_reputation_average'), color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900' };
    return { level: t('witness_reputation_low'), color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900' };
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'confirmation':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'validation':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'rejection':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'fraud_flag':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'confirmation':
        return t('fraud_action_confirmation');
      case 'validation':
        return t('fraud_action_validation');
      case 'rejection':
        return t('fraud_action_rejection');
      case 'fraud_flag':
        return t('fraud_action_flag');
      case 'invalidation':
        return t('fraud_action_invalidation');
      default:
        return actionType;
    }
  };

  const getFlagTypeIcon = (flagType: string) => {
    switch (flagType) {
      case 'rapid_confirmations':
        return <Zap className="h-4 w-4 text-orange-500" />;
      case 'cross_region':
        return <MapPin className="h-4 w-4 text-yellow-500" />;
      case 'collusion':
        return <UserX className="h-4 w-4 text-red-500" />;
      case 'gps_spoofing':
        return <AlertOctagon className="h-4 w-4 text-red-600" />;
      case 'identity_mismatch':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Flag className="h-4 w-4 text-orange-500" />;
    }
  };

  const getFlagTypeLabel = (flagType: string) => {
    switch (flagType) {
      case 'rapid_confirmations':
        return t('fraud_type_rapid');
      case 'cross_region':
        return t('fraud_type_cross_region');
      case 'collusion':
        return t('fraud_type_collusion');
      case 'gps_spoofing':
        return t('fraud_type_gps_spoofing');
      case 'identity_mismatch':
        return t('fraud_type_identity_mismatch');
      default:
        return flagType;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">{t('fraud_severity_critical')}</Badge>;
      case 'high':
        return <Badge className="bg-orange-500 hover:bg-orange-600">{t('fraud_severity_high')}</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">{t('fraud_severity_medium')}</Badge>;
      case 'low':
        return <Badge variant="secondary">{t('fraud_severity_low')}</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const reputationLevel = getReputationLevel(currentScore);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Star className="h-6 w-6 text-primary" />
                  {t('witness_reputation_score')}
                </h1>
                <p className="text-muted-foreground">{t('witness_reputation_description')}</p>
              </div>
            </div>

            {/* Main Score Card */}
            <Card className="border-2 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-full ${reputationLevel.bgColor}`}>
                      <Award className={`h-12 w-12 ${reputationLevel.color}`} />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-5xl font-bold ${reputationLevel.color}`}>
                          {currentScore.toFixed(0)}
                        </span>
                        <span className="text-2xl text-muted-foreground">/100</span>
                      </div>
                      <Badge className={`mt-2 ${reputationLevel.bgColor} ${reputationLevel.color} border-0`}>
                        {reputationLevel.level}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-1/3">
                    <Progress value={currentScore} className="h-4" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalRecords}</p>
                    <p className="text-sm text-muted-foreground">Total de Testemunhos</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalConfirmations}</p>
                    <p className="text-sm text-muted-foreground">Confirmações</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                    <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalValidations}</p>
                    <p className="text-sm text-muted-foreground">Validações Oficiais</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalRejections}</p>
                    <p className="text-sm text-muted-foreground">{t('fraud_stat_rejections')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className={stats.activeFraudFlags > 0 ? "border-destructive" : ""}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-3 rounded-full ${stats.activeFraudFlags > 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-muted'}`}>
                    <Flag className={`h-5 w-5 ${stats.activeFraudFlags > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.activeFraudFlags}</p>
                    <p className="text-sm text-muted-foreground">{t('fraud_stat_active_flags')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="history" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="history">{t('witness_reputation_history')}</TabsTrigger>
                <TabsTrigger value="witnesses">{t('fraud_tab_witnesses')}</TabsTrigger>
                <TabsTrigger value="flags" className="relative">
                  {t('fraud_tab_flags')}
                  {stats.activeFraudFlags > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {stats.activeFraudFlags}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Reputation History Tab */}
              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      {t('witness_reputation_history')}
                    </CardTitle>
                    <CardDescription>{t('fraud_history_description')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {history.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{t('fraud_no_history')}</p>
                        <p className="text-sm">{t('fraud_no_history_hint')}</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                          {history.map((item, index) => (
                            <div key={item.id}>
                              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                <div className="mt-0.5">
                                  {getActionIcon(item.action_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">
                                      {getActionLabel(item.action_type)}
                                    </span>
                                    <Badge 
                                      variant={item.score_change >= 0 ? "default" : "destructive"}
                                      className="text-xs"
                                    >
                                      {item.score_change >= 0 ? (
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                      ) : (
                                        <TrendingDown className="h-3 w-3 mr-1" />
                                      )}
                                      {item.score_change >= 0 ? '+' : ''}{item.score_change.toFixed(1)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {item.previous_score.toFixed(0)} → {item.new_score.toFixed(0)} {t('fraud_points')}
                                  </p>
                                  {item.reason && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">
                                      {item.reason}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    <Clock className="h-3 w-3 inline mr-1" />
                                    {format(new Date(item.created_at), "dd MMM yyyy, HH:mm", { locale: dateLocale })}
                                  </p>
                                </div>
                              </div>
                              {index < history.length - 1 && <Separator className="my-2" />}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Witnesses Tab */}
              <TabsContent value="witnesses">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {t('fraud_recent_witnesses')}
                    </CardTitle>
                    <CardDescription>{t('fraud_witnesses_description')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {witnessRecords.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{t('fraud_no_witnesses')}</p>
                        <p className="text-sm">{t('fraud_no_witnesses_hint')}</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                          {witnessRecords.slice(0, 20).map((record, index) => (
                            <div key={record.id}>
                              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center gap-3">
                                  <Badge 
                                    variant={
                                      record.status === 'confirmed' ? 'default' :
                                      record.status === 'rejected' ? 'destructive' : 
                                      'secondary'
                                    }
                                  >
                                    {record.status === 'confirmed' ? t('status_confirmed') :
                                     record.status === 'rejected' ? t('status_rejected') :
                                     record.status === 'pending' ? t('status_pending') : record.status}
                                  </Badge>
                                  <div>
                                    <p className="text-sm font-medium">{record.witness_afro_id}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(record.created_at), "dd MMM yyyy", { locale: dateLocale })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {record.validated_at && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Shield className="h-4 w-4 text-purple-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {t('fraud_validated_officially')}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {record.confirmed_at && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {t('fraud_confirmed_on')} {format(new Date(record.confirmed_at), "dd/MM/yyyy")}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </div>
                              {index < Math.min(witnessRecords.length, 20) - 1 && <Separator className="my-2" />}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Fraud Flags Tab */}
              <TabsContent value="flags">
                <Card className={stats.activeFraudFlags > 0 ? "border-destructive" : ""}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className={`h-5 w-5 ${stats.activeFraudFlags > 0 ? 'text-destructive' : ''}`} />
                      {t('fraud_flags_title')}
                    </CardTitle>
                    <CardDescription>{t('fraud_flags_description')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {fraudFlags.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                        <p className="text-green-600 dark:text-green-400 font-medium">{t('fraud_no_flags')}</p>
                        <p className="text-sm">{t('fraud_no_flags_hint')}</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                          {fraudFlags.map((flag, index) => (
                            <div key={flag.id}>
                              <div className={`p-4 rounded-lg border ${flag.resolved ? 'bg-muted/30 border-muted' : 'bg-destructive/5 border-destructive/20'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                      {getFlagTypeIcon(flag.flag_type)}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm">{getFlagTypeLabel(flag.flag_type)}</span>
                                        {getSeverityBadge(flag.severity)}
                                        {flag.resolved && (
                                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            {t('fraud_resolved')}
                                          </Badge>
                                        )}
                                      </div>
                                      {flag.description && (
                                        <p className="text-sm text-muted-foreground mt-2">{flag.description}</p>
                                      )}
                                      <p className="text-xs text-muted-foreground mt-2">
                                        <Clock className="h-3 w-3 inline mr-1" />
                                        {format(new Date(flag.created_at), "dd MMM yyyy, HH:mm", { locale: dateLocale })}
                                      </p>
                                      {flag.resolved && flag.resolution_notes && (
                                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs">
                                          <p className="font-medium text-green-700 dark:text-green-400">{t('fraud_resolution_notes')}:</p>
                                          <p className="text-muted-foreground">{flag.resolution_notes}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {index < fraudFlags.length - 1 && <Separator className="my-2" />}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Info Card */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">{t('fraud_how_it_works')}</h4>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• <strong>{t('fraud_base_score')}:</strong> {t('fraud_base_score_desc')}</li>
                      <li>• <strong>+2 {t('fraud_points')}:</strong> {t('fraud_points_confirmation')}</li>
                      <li>• <strong>+5 {t('fraud_points')}:</strong> {t('fraud_points_validation')}</li>
                      <li>• <strong>-3 {t('fraud_points')}:</strong> {t('fraud_points_rejection')}</li>
                      <li>• <strong>-15 {t('fraud_points')}:</strong> {t('fraud_points_flag')}</li>
                      <li>• <strong>-25 {t('fraud_points')}:</strong> {t('fraud_points_critical_flag')}</li>
                      <li>• {t('fraud_reputation_influence')}</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
    </DashboardLayout>
  );
};

export default WitnessReputation;