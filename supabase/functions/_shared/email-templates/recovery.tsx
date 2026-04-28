/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Text, Link } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, styles } from './_brand.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <BrandLayout preview={`Reset your ${siteName} password`}>
    <Text style={styles.h1}>Reset your password</Text>
    <Text style={styles.text}>
      We received a request to reset the password for your <strong>{siteName}</strong> account.
      Click the button below to choose a new one.
    </Text>
    <Link href={confirmationUrl} style={styles.button}>Reset Password</Link>
    <Text style={styles.muted}>
      🔒 If you didn't request this, no action is needed — your password stays the same.
    </Text>
  </BrandLayout>
)

export default RecoveryEmail
