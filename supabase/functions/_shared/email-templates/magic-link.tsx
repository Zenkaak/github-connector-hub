/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Text, Link } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, styles } from './_brand.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <BrandLayout preview={`Your secure login link for ${siteName}`}>
    <Text style={styles.h1}>Sign in securely</Text>
    <Text style={styles.text}>
      Tap the button below to securely sign in to your <strong>{siteName}</strong> account.
      For your protection, this link expires in 15 minutes.
    </Text>
    <Link href={confirmationUrl} style={styles.button}>Sign In Now</Link>
    <Text style={styles.muted}>
      🔒 If you didn't request this, ignore the email — your account remains secure.
    </Text>
  </BrandLayout>
)

export default MagicLinkEmail
