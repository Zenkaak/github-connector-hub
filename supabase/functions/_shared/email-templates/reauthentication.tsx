/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout, styles } from './_brand.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandLayout preview="Your verification code">
    <Text style={styles.h1}>Verification required</Text>
    <Text style={styles.text}>
      Please use the verification code below to confirm this sensitive action on your account:
    </Text>
    <div style={styles.codeBox}>
      <Text style={styles.code}>{token}</Text>
    </div>
    <Text style={styles.muted}>
      🔒 This code expires in 10 minutes. Never share it with anyone — DASNET staff will never ask for your code.
    </Text>
  </BrandLayout>
)

export default ReauthenticationEmail
