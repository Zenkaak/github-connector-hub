/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'DASNET VENTURES'

interface Props {
  code?: string
}

const PasswordRecoveryOtpEmail = ({ code = '000000' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} password reset code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <Text style={brandText}>{SITE_NAME}</Text>
        </Section>
        <Heading style={h1}>Password reset code</Heading>
        <Text style={text}>
          Use the 6-digit code below to reset your {SITE_NAME} password. This code expires in 10 minutes.
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code}</Text>
        </Section>
        <Text style={muted}>
          If you didn't request this, you can safely ignore this email — your password will not change.
        </Text>
        <Text style={footer}>© {new Date().getFullYear()} {SITE_NAME}. Trusted financial services for Kenya.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PasswordRecoveryOtpEmail,
  subject: `Your ${SITE_NAME} password reset code`,
  displayName: 'Password recovery OTP',
  previewData: { code: '482915' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { maxWidth: '480px', margin: '0 auto', padding: '32px 24px' }
const brand = { borderBottom: '3px solid hsl(42, 92%, 56%)', paddingBottom: '16px', marginBottom: '24px' }
const brandText = { fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', color: 'hsl(213,72%,18%)', margin: 0 }
const h1 = { fontSize: '22px', color: 'hsl(213,72%,18%)', margin: '0 0 12px', fontWeight: 'bold' }
const text = { fontSize: '14px', color: '#5b5f6b', lineHeight: '1.6', margin: '0 0 24px' }
const codeBox = { background: 'hsl(42, 92%, 96%)', border: '1px solid hsl(42, 92%, 80%)', borderRadius: '14px', padding: '20px', textAlign: 'center' as const, margin: '0 0 24px' }
const codeText = { fontSize: '34px', letterSpacing: '10px', fontWeight: 'bold', color: 'hsl(213,72%,18%)', fontFamily: 'monospace', margin: 0 }
const muted = { fontSize: '12px', color: '#9aa0ad', margin: '0 0 24px' }
const footer = { fontSize: '11px', color: '#aab0bb', borderTop: '1px solid #eaeaea', paddingTop: '16px', margin: 0 }
