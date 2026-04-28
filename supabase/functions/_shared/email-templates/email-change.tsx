/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Text, Link } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, styles } from './_brand.tsx'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <BrandLayout preview={`Confirm your new email for ${siteName}`}>
    <Text style={styles.h1}>Confirm your new email</Text>
    <Text style={styles.text}>
      A request was made to change the email on your <strong>{siteName}</strong> account
      from <strong>{email}</strong> to <strong>{newEmail}</strong>.
    </Text>
    <Text style={styles.text}>
      Click below to confirm this change.
    </Text>
    <Link href={confirmationUrl} style={styles.button}>Confirm New Email</Link>
    <Text style={styles.muted}>
      🔒 Didn't request this? Contact support@dasnett.site immediately.
    </Text>
  </BrandLayout>
)

export default EmailChangeEmail
