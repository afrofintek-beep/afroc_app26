import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, X, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const NotificationCenter = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const { isSupported, isSubscribed, loading: pushLoading, subscribeToPush, unsubscribeFromPush } = 
    usePushNotifications();
  const [open, setOpen] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  useEffect(() => {
    // Show push notification prompt if supported and not subscribed
    if (isSupported && !isSubscribed && notifications.length > 0) {
      const hasSeenPrompt = localStorage.getItem('push-prompt-seen');
      if (!hasSeenPrompt) {
        setShowPushPrompt(true);
      }
    }
  }, [isSupported, isSubscribed, notifications.length]);

  const handleEnablePush = async () => {
    const success = await subscribeToPush();
    if (success) {
      setShowPushPrompt(false);
      localStorage.setItem('push-prompt-seen', 'true');
    }
  };

  const handleDismissPushPrompt = () => {
    setShowPushPrompt(false);
    localStorage.setItem('push-prompt-seen', 'true');
  };

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribeFromPush();
    } else {
      await subscribeToPush();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-destructive";
      case "high":
        return "bg-orange-500";
      case "normal":
        return "bg-primary";
      case "low":
        return "bg-muted";
      default:
        return "bg-primary";
    }
  };

  const getNotificationIcon = (type: string) => {
    // Add custom icons based on notification type
    return <Bell className="h-4 w-4" />;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Notificações</h3>
          <div className="flex items-center gap-2">
            {isSupported && (
              <Button
                variant={isSubscribed ? "secondary" : "outline"}
                size="sm"
                onClick={handleTogglePush}
                disabled={pushLoading}
                className="h-8 px-2 text-xs"
                title={isSubscribed ? "Desativar notificações push" : "Ativar notificações push"}
              >
                <BellRing className="h-4 w-4 mr-1" />
                Push
              </Button>
            )}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 px-2 text-xs"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Marcar todas
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showPushPrompt && isSupported && !isSubscribed && (
          <div className="p-4 bg-primary/10 border-b">
            <div className="flex items-start gap-3">
              <BellRing className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">Ativar notificações push?</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Receba alertas mesmo quando o app estiver fechado
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleEnablePush}
                    disabled={pushLoading}
                    className="h-7 text-xs"
                  >
                    Ativar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismissPushPrompt}
                    className="h-7 text-xs"
                  >
                    Agora não
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-accent/50 transition-colors cursor-pointer group",
                    !notification.read && "bg-accent/30"
                  )}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex-shrink-0 h-2 w-2 rounded-full mt-2",
                        getPriorityColor(notification.priority)
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        {!notification.read && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            Nova
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  setOpen(false);
                  // Navigate to notifications page if exists
                }}
              >
                Ver todas as notificações
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
