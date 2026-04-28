/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Text, Link } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, styles } from './_brand.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <BrandLayout preview={`Welcome to ${siteName} — confirm your email`}>
    <Text style={styles.h1}>Welcome aboard 🎉</Text>
    <Text style={styles.text}>
      Thank you for joining <strong>{siteName}</strong> — Kenya's trusted platform for chama management,
      group savings, loans, and community fundraising.
    </Text>
    <Text style={styles.text}>
      Please confirm your email <strong>{recipient}</strong> to activate your account and access your dashboard.
    </Text>
    <Link href={confirmationUrl} style={styles.button}>Activate My Account</Link>
    <Text style={styles.muted}>
      Didn't sign up? You can safely ignore this email — no account will be created.
    </Text>
  </BrandLayout>
)

export default SignupEmail
