/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as transactionNotification } from './transaction-notification.tsx'
import { template as passwordRecoveryOtp } from './password-recovery-otp.tsx'
import { template as loginOtp } from './login-otp.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'transaction-notification': transactionNotification,
  'password-recovery-otp': passwordRecoveryOtp,
  'login-otp': loginOtp,
}
