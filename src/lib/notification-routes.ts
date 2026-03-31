/**
 * Determine the correct route to navigate to based on notification title/message.
 */
export function getNotificationRoute(title: string, message: string): string {
  const t = title.toLowerCase();
  const m = message.toLowerCase();

  // Chama-related
  if (t.includes('chama') || t.includes('harambee') || t.includes('join request') || 
      t.includes('leave request') || t.includes('group dissolved') || t.includes('new member') || 
      t.includes('member removed') || t.includes('savings reminder') || t.includes('meeting')) {
    return '/dashboard/chama';
  }

  // Withdrawal
  if (t.includes('withdrawal') || m.includes('withdrawal')) {
    return '/dashboard/wallet';
  }

  // Loan
  if (t.includes('loan') || m.includes('loan')) {
    return '/dashboard/applications';
  }

  // Money transfer
  if (t.includes('money sent') || t.includes('money received') || t.includes('transfer') || t.includes('money request')) {
    return '/dashboard/wallet';
  }

  // Document
  if (t.includes('document') || m.includes('document')) {
    return '/dashboard/account';
  }

  // Support
  if (t.includes('support') || t.includes('admin message')) {
    return '/dashboard/support';
  }

  // Settings
  if (t.includes('settings updated') || t.includes('group settings')) {
    return '/dashboard/chama';
  }

  // Default
  return '/dashboard/notifications';
}
