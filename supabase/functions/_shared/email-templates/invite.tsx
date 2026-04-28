/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Text, Link } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, styles } from './_brand.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, confirmationUrl }: InviteEmailProps) => (
  <BrandLayout preview={`You've been invited to join ${siteName}`}>
    <Text style={styles.h1}>You're invited 🎊</Text>
    <Text style={styles.text}>
      You've been invited to join <strong>{siteName}</strong>, Kenya's trusted chama and savings platform.
      Accept your invitation to create your account.
    </Text>
    <Link href={confirmationUrl} style={styles.button}>Accept Invitation</Link>
    <Text style={styles.muted}>
      This invitation was sent to your email. If you weren't expecting it, you can ignore this message.
    </Text>
  </BrandLayout>
)

export default InviteEmail
