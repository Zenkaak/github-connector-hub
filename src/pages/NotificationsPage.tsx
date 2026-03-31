import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Inbox, Upload, Trash2, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getNotificationRoute } from '@/lib/notification-routes';

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (error) {
      console.error('Error marking notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAllRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id)
        .eq('is_read', true);
      if (error) throw error;
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      toast.success('Read notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const readCount = notifications.filter((n) => n.is_read).length;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-6 max-w-[800px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCheck size={14} />
                Mark All Read
              </Button>
            )}
            {readCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllRead} className="text-destructive hover:text-destructive">
                <Trash2 size={14} />
                Clear Read
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner w-8 h-8 border-primary border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Inbox className="text-muted-foreground" size={28} />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">No Notifications</h3>
              <p className="text-muted-foreground text-sm text-center max-w-sm">
                You're all caught up! We'll notify you about loan updates and account activity.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification, i) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    notification.is_read
                      ? 'bg-card border-border/40 opacity-70'
                      : 'bg-card border-l-4 border-l-accent border-border/50 shadow-sm'
                  }`}
                  onClick={() => {
                    markAsRead(notification.id);
                    navigate(getNotificationRoute(notification.title, notification.message));
                  }}
                >
                  {(() => {
                    const isDocRequest = notification.message.startsWith('[DOCUMENT_REQUEST]');
                    const payNowMatch = notification.message.match(/^\[PAY_NOW:(\d+)(?::([^:]+):([^\]]+))?\]\s*/);
                    const isPayNow = !!payNowMatch;
                    const payAmount = payNowMatch ? Number(payNowMatch[1]) : 0;
                    const payPurpose = payNowMatch?.[2] || undefined;
                    const payGroupId = payNowMatch?.[3] || undefined;
                    const displayMessage = isDocRequest
                      ? notification.message.replace('[DOCUMENT_REQUEST] ', '')
                      : isPayNow
                      ? notification.message.replace(payNowMatch![0], '')
                      : notification.message;
                    return (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isDocRequest ? 'bg-primary/10' : isPayNow ? 'bg-accent/10' : notification.is_read ? 'bg-muted' : 'bg-accent/10'
                          }`}>
                            {isDocRequest ? <Upload size={16} className="text-primary" /> : isPayNow ? <Smartphone size={16} className="text-accent" /> : <Bell size={16} className={notification.is_read ? 'text-muted-foreground' : 'text-accent'} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-sm">{notification.title}</h3>
                              {!notification.is_read && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{displayMessage}</p>
                            {isDocRequest && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 text-xs h-7"
                                onClick={() => navigate('/dashboard/account')}
                              >
                                <Upload size={12} className="mr-1" /> Upload Documents
                              </Button>
                            )}
                            {isPayNow && (
                              <Button
                                variant="gold"
                                size="sm"
                                className="mt-2 text-xs h-7"
                                onClick={async () => {
                                  try {
                                    const { data: profile } = await supabase.from('profiles').select('phone').eq('user_id', user?.id).maybeSingle();
                                    if (!profile?.phone) { toast.error('Phone number not found'); return; }
                                    toast.info(`Sending M-Pesa prompt of KES ${payAmount}...`);
                                    await supabase.functions.invoke('initiate-stk-push', {
                                      body: {
                                        phone: profile.phone,
                                        amount: payAmount,
                                        userId: user?.id,
                                        ...(payPurpose && { purpose: payPurpose }),
                                        ...(payGroupId && { groupId: payGroupId }),
                                      },
                                    });
                                    toast.success('M-Pesa prompt sent! Check your phone.');
                                  } catch (err: any) {
                                    toast.error(err.message || 'Payment failed');
                                  }
                                }}
                              >
                                <Smartphone size={12} className="mr-1" /> Pay KES {payAmount.toLocaleString()}
                              </Button>
                            )}
                            <p className="text-[11px] text-muted-foreground/60 mt-2">{timeAgo(notification.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!notification.is_read && (
                            <Button variant="ghost" size="sm" className="text-xs h-8 w-8 p-0" onClick={() => markAsRead(notification.id)} title="Mark as read">
                              <Check size={14} />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-xs h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteNotification(notification.id)} title="Delete">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
