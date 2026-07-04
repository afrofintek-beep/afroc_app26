/**
 * AFROLOC - African Digital Address Identification System
 * Batch Operations Panel - Manage bulk grid operations
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Layers, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  FileUp,
  Settings
} from 'lucide-react';

interface BatchJob {
  id: string;
  type: 'qgsq_assign' | 'zone_import' | 'cell_generation';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startedAt?: string;
  completedAt?: string;
  countryCode: string;
  createdBy: string;
}

interface BatchOperationsPanelProps {
  countryCode: string;
}

export default function BatchOperationsPanel({ countryCode }: BatchOperationsPanelProps) {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [batchLimit, setBatchLimit] = useState('100');
  const [dryRun, setDryRun] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, [countryCode]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cadastral_batch_generations')
        .select('id, country_code, total_cells_generated, urban_cells_count, rural_cells_count, status, created_at, area_hectares, level1_name')
        .eq('country_code', countryCode)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const mappedJobs: BatchJob[] = (data || []).map((row) => ({
        id: row.id,
        type: 'cell_generation' as const,
        status: row.status === 'completed' ? 'completed' as const
          : row.status === 'failed' ? 'failed' as const
          : row.status === 'running' ? 'running' as const
          : 'pending' as const,
        progress: row.status === 'completed' ? 100 : row.status === 'failed' ? 0 : 50,
        totalItems: row.total_cells_generated || 0,
        processedItems: row.status === 'completed' ? (row.total_cells_generated || 0) : 0,
        failedItems: 0,
        startedAt: row.created_at,
        completedAt: row.status === 'completed' ? row.created_at : undefined,
        countryCode: row.country_code,
        createdBy: row.level1_name || 'system',
      }));

      setJobs(mappedJobs);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      toast.error(t('batchops_toast_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartBatch = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-assign-qgsq', {
        body: {
          countryCode,
          limit: parseInt(batchLimit),
          dryRun,
        },
      });

      if (error) throw error;

      toast.success(
        dryRun
          ? `${t('batchops_toast_simulation_prefix')}: ${data.processed} ${t('batchops_toast_would_be_processed')}`
          : `${data.successful} ${t('batchops_toast_processed_success')}`
      );
      
      fetchJobs();
    } catch (err) {
      toast.error(t('batchops_toast_run_error'));
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const getStatusBadge = (status: BatchJob['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{t('batchops_status_pending')}</Badge>;
      case 'running':
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t('batchops_status_running')}</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />{t('batchops_status_completed')}</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{t('batchops_status_failed')}</Badge>;
    }
  };

  const getTypeLabel = (type: BatchJob['type']) => {
    switch (type) {
      case 'qgsq_assign': return t('batchops_type_qgsq_assign');
      case 'zone_import': return t('batchops_type_zone_import');
      case 'cell_generation': return t('batchops_type_cell_generation');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          {t('batchops_title')}
        </CardTitle>
        <CardDescription>
          {t('batchops_description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="new">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">{t('batchops_tab_new')}</TabsTrigger>
            <TabsTrigger value="history">{t('batchops_tab_history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('batchops_operation_type_label')}</Label>
                <Select defaultValue="qgsq_assign">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qgsq_assign">{t('batchops_option_assign_qgsq')}</SelectItem>
                    <SelectItem value="zone_recalc">{t('batchops_option_recalc_zones')}</SelectItem>
                    <SelectItem value="validate_codes">{t('batchops_option_validate_codes')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('batchops_record_limit_label')}</Label>
                <Input
                  type="number"
                  value={batchLimit}
                  onChange={(e) => setBatchLimit(e.target.value)}
                  placeholder="100"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('batchops_dry_run_label')}</span>
              </label>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleStartBatch} 
                disabled={running}
                className="flex-1"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('batchops_processing')}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {t('batchops_start_batch')}
                  </>
                )}
              </Button>
            </div>

            {running && (
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{t('batchops_processing')}</span>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <Progress value={45} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  45 {t('batchops_of')} 100 {t('batchops_records_processed')}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {jobs.map(job => (
                    <div key={job.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getTypeLabel(job.type)}</span>
                          {getStatusBadge(job.status)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {job.startedAt && new Date(job.startedAt).toLocaleString('pt')}
                        </span>
                      </div>
                      
                      <Progress value={job.progress} className="h-2 mb-2" />
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {job.processedItems} {t('batchops_processed')}
                        </span>
                        {job.failedItems > 0 && (
                          <span className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-red-500" />
                            {job.failedItems} {t('batchops_failed')}
                          </span>
                        )}
                        <span>{t('batchops_total')}: {job.totalItems}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Layers className="h-8 w-8 mb-2 opacity-50" />
                <p>{t('batchops_empty')}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
