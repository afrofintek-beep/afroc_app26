import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { MapPin, Navigation, Clock, AlertTriangle, CheckCircle, Camera, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGPSHistory, GPSHistoryEntry } from '@/hooks/useGPSHistory';
import { formatDistance, GPS_VALIDATION_THRESHOLDS } from '@/utils/gpsDistance';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
interface GPSHistoryTimelineProps {
  afrolocRecordId: string;
}

export function GPSHistoryTimeline({ afrolocRecordId }: GPSHistoryTimelineProps) {
  const { history, loading, fetchHistory } = useGPSHistory();

  useEffect(() => {
    if (afrolocRecordId) {
      fetchHistory(afrolocRecordId);
    }
  }, [afrolocRecordId, fetchHistory]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Histórico GPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Histórico GPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Nenhum histórico de atualização GPS disponível.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          Histórico GPS
          <Badge variant="secondary">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {history.map((entry, index) => (
                <GPSHistoryItem 
                  key={entry.id} 
                  entry={entry} 
                  isFirst={index === 0}
                  isLast={index === history.length - 1}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function GPSHistoryItem({ 
  entry, 
  isFirst,
  isLast 
}: { 
  entry: GPSHistoryEntry; 
  isFirst: boolean;
  isLast: boolean;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  
  const distance = entry.distance_meters;
  const hasWarning = distance !== null && distance > GPS_VALIDATION_THRESHOLDS.WARNING_DISTANCE;
  const hasSuspicious = distance !== null && distance > GPS_VALIDATION_THRESHOLDS.SUSPICIOUS_DISTANCE;

  // Load photo if available
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!entry.photo_path) {
        setPhotoUrl(null);
        return;
      }

      setPhotoLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('property-photos')
          .createSignedUrl(entry.photo_path, 3600);

        if (error) throw error;
        if (!cancelled) setPhotoUrl(data?.signedUrl ?? null);
      } catch (e) {
        console.error('Failed to load GPS history photo:', e);
        if (!cancelled) setPhotoUrl(null);
      } finally {
        if (!cancelled) setPhotoLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [entry.photo_path]);

  return (
    <>
      <div className="relative pl-10">
        {/* Timeline dot */}
        <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
          hasSuspicious 
            ? 'bg-destructive border-destructive' 
            : hasWarning 
              ? 'bg-warning border-warning' 
              : 'bg-primary border-primary'
        }`} />
        
        <div className={`p-3 rounded-lg border ${
          isFirst ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {format(new Date(entry.created_at), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                </span>
                {isFirst && (
                  <Badge variant="default" className="text-xs">Atual</Badge>
                )}
              </div>
              
              <div className="mt-2 flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs">
                  {entry.new_lat.toFixed(6)}, {entry.new_lon.toFixed(6)}
                </span>
              </div>

              {entry.accuracy_meters && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Precisão: ±{Math.round(entry.accuracy_meters)}m
                </div>
              )}

              {entry.update_reason && (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  "{entry.update_reason}"
                </div>
              )}

              {/* Photo thumbnail */}
              {entry.photo_path && (
                <div className="mt-2">
                  {photoLoading ? (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : photoUrl ? (
                    <button
                      onClick={() => setShowPhotoDialog(true)}
                      className="relative group"
                    >
                      <img 
                        src={photoUrl} 
                        alt="Foto da propriedade" 
                        className="w-16 h-16 object-cover rounded border border-border hover:border-primary transition-colors"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <Camera className="h-4 w-4 text-white" />
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Camera className="h-3 w-3" />
                      <span>Foto indisponível</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {distance !== null && (
              <div className="text-right">
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  hasSuspicious 
                    ? 'text-destructive' 
                    : hasWarning 
                      ? 'text-warning' 
                      : 'text-success'
                }`}>
                  {hasSuspicious ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {formatDistance(distance)}
                </div>
                <div className="text-xs text-muted-foreground">
                  da posição anterior
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <button
            onClick={() => setShowPhotoDialog(false)}
            className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {photoUrl && (
            <div className="relative">
              <img 
                src={photoUrl} 
                alt="Foto da propriedade" 
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-white text-sm">
                  {format(new Date(entry.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}
                </p>
                <p className="text-white/80 text-xs font-mono">
                  {entry.new_lat.toFixed(6)}, {entry.new_lon.toFixed(6)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
