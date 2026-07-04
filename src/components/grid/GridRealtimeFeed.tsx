/**
 * AFROLOC - African Digital Address Identification System
 * Grid Realtime Feed - Live event stream display
 */

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Plus, 
  RefreshCw, 
  CheckCircle,
  XCircle,
  Trash2
} from 'lucide-react';
import { GridRealtimeEvent } from '@/hooks/useGridRealtime';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface GridRealtimeFeedProps {
  events: GridRealtimeEvent[];
  isConnected: boolean;
  lastEventTime: Date | null;
  onClear: () => void;
}

export default function GridRealtimeFeed({ 
  events, 
  isConnected, 
  lastEventTime,
  onClear 
}: GridRealtimeFeedProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const getEventIcon = (event: GridRealtimeEvent) => {
    if (event.type === 'INSERT') {
      return <Plus className="h-3 w-3 text-primary" />;
    }
    if (event.type === 'UPDATE') {
      if (event.payload.new_status === 'approved') {
        return <CheckCircle className="h-3 w-3 text-primary" />;
      }
      if (event.payload.new_status === 'rejected') {
        return <XCircle className="h-3 w-3 text-destructive" />;
      }
      return <RefreshCw className="h-3 w-3 text-secondary-foreground" />;
    }
    return <Trash2 className="h-3 w-3 text-destructive" />;
  };

  const getEventLabel = (event: GridRealtimeEvent) => {
    if (event.type === 'INSERT') {
      return t('realtimefeed_cell_created');
    }
    if (event.type === 'UPDATE') {
      if (event.payload.old_status && event.payload.new_status) {
        return `${t('realtimefeed_status_label')}: ${event.payload.old_status} → ${event.payload.new_status}`;
      }
      return t('realtimefeed_cell_updated');
    }
    return t('realtimefeed_cell_removed');
  };

  const getEventBadge = (event: GridRealtimeEvent) => {
    switch (event.type) {
      case 'INSERT':
        return <Badge className="bg-primary/10 text-primary border-primary/20">{t('realtimefeed_badge_creation')}</Badge>;
      case 'UPDATE':
        return <Badge className="bg-secondary text-secondary-foreground border-secondary">{t('realtimefeed_badge_update')}</Badge>;
      case 'DELETE':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">{t('realtimefeed_badge_removal')}</Badge>;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{t('realtimefeed_title')}</CardTitle>
              <CardDescription className="text-xs">
                {lastEventTime
                  ? `${t('realtimefeed_last')}: ${formatDistanceToNow(lastEventTime, { addSuffix: true, locale: pt })}`
                  : t('realtimefeed_waiting_events')}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Wifi className="h-3 w-3 mr-1" />
                {t('realtimefeed_connected')}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                <WifiOff className="h-3 w-3 mr-1" />
                {t('realtimefeed_disconnected')}
              </Badge>
            )}
            {events.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                {t('realtimefeed_clear')}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]" ref={scrollRef}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <Activity className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{t('realtimefeed_no_events')}</p>
              <p className="text-xs">{t('realtimefeed_events_appear_here')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50 animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <div className="mt-0.5">
                    {getEventIcon(event)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getEventBadge(event)}
                      {event.payload.zone && (
                        <Badge variant="secondary" className="text-xs">
                          {event.payload.zone === 'urban' ? 'ZU' : 'ZR'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">
                      {getEventLabel(event)}
                    </p>
                    {event.payload.afroloc_code && (
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {event.payload.afroloc_code}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: pt })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
