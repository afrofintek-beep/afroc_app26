import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, MapPin } from "lucide-react";
import {
  getConflictItems,
  resolveConflict,
  resolveAllConflicts,
  SyncOutboxItem,
  ConflictResolution,
} from "@/utils/offlineStorage";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from '@/contexts/LanguageContext';

interface ConflictResolutionPanelProps {
  onResolved?: () => void;
}

export default function ConflictResolutionPanel({ onResolved }: ConflictResolutionPanelProps) {
  const [conflicts, setConflicts] = useState<SyncOutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const loadConflicts = useCallback(async () => {
    setLoading(true);
    const items = await getConflictItems();
    setConflicts(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const handleResolve = async (itemId: string, resolution: ConflictResolution) => {
    setResolving(itemId);
    try {
      await resolveConflict(itemId, resolution);
      toast({
        title: t('conflictres_toast_resolved_title'),
        description: resolution === "server_wins"
          ? t('conflictres_toast_server_accepted')
          : resolution === "client_wins"
          ? t('conflictres_toast_local_resubmit')
          : t('conflictres_toast_record_discarded'),
      });
      await loadConflicts();
      onResolved?.();
    } catch (error: any) {
      toast({ title: t('conflictres_toast_error_title'), description: error.message, variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  const handleResolveAll = async (resolution: ConflictResolution) => {
    setResolving("all");
    try {
      const count = await resolveAllConflicts(resolution);
      toast({
        title: t('conflictres_toast_all_resolved_title'),
        description: `${count} ${t('conflictres_toast_conflicts_resolved_suffix')}`,
      });
      await loadConflicts();
      onResolved?.();
    } catch (error: any) {
      toast({ title: t('conflictres_toast_error_title'), description: error.message, variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  if (loading) return null;
  if (conflicts.length === 0) return null;

  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          {t('conflictres_title')} ({conflicts.length})
        </CardTitle>
        <CardDescription>
          {t('conflictres_description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bulk actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            disabled={resolving !== null}
            onClick={() => handleResolveAll("server_wins")}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('conflictres_accept_all_server')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={resolving !== null}
            onClick={() => handleResolveAll("client_wins")}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('conflictres_retry_all_local')}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={resolving !== null}
            onClick={() => handleResolveAll("discard")}
          >
            <XCircle className="h-3 w-3 mr-1" />
            {t('conflictres_discard_all')}
          </Button>
        </div>

        {/* Individual conflicts */}
        <div className="space-y-3">
          {conflicts.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-destructive/30 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono font-semibold">
                      {item.payload?.code || t('conflictres_unknown')}
                    </code>
                    <Badge variant="destructive" className="text-xs">{t('conflictres_badge_conflict')}</Badge>
                  </div>
                  {item.last_error && (
                    <p className="text-xs text-muted-foreground">{item.last_error}</p>
                  )}
                  {item.payload?.geo_lat && item.payload?.geo_lon && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {item.payload.geo_lat.toFixed(5)}, {item.payload.geo_lon.toFixed(5)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('conflictres_attempts_label')}: {item.attempts} · {t('conflictres_created_label')}: {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={resolving === item.id}
                  onClick={() => handleResolve(item.id, "server_wins")}
                >
                  {t('conflictres_keep_server')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolving === item.id}
                  onClick={() => handleResolve(item.id, "client_wins")}
                >
                  {t('conflictres_retry_local')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={resolving === item.id}
                  onClick={() => handleResolve(item.id, "discard")}
                >
                  {t('conflictres_discard')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}