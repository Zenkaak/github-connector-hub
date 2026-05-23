/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'DASNET VENTURES'

interface Props {
  admin_name?: string
  sacco_name?: string
  login_url?: string
  email?: string
  password?: string
}

const TenantAdminInviteEmail = ({
  admin_name = '',
  sacco_name = 'your SACCO',
  login_url = 'https://dasnett.site',
  email = '',
  password = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {sacco_name} admin portal is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {admin_name ? `Welcome, ${admin_name}` : 'Welcome'}
        </Heading>
        <Text style={text}>
          Your <strong>{sacco_name}</strong> SACCO admin portal is ready on {SITE_NAME}. Use the credentials below to sign in and configure your SACCO.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}><strong>Login URL:</strong> {login_url}</Text>
          <Text style={detailRow}><strong>Email:</strong> {email}</Text>
          <Text style={detailRow}><strong>Temporary Password:</strong> {password}</Text>
        </Section>

        <Button style={button} href={login_url}>Open Admin Portal</Button>

        <Hr style={hr} />
        <Text style={footer}>
          For security, please change your password after first login. If you did not expect this invite, ignore this email or contact {SITE_NAME} support.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TenantAdminInviteEmail,
  subject: (data: Record<string, any>) =>
    `Your ${data.sacco_name || 'SACCO'} admin account is ready — ${SITE_NAME}`,
  displayName: 'Tenant admin invite',
  previewData: {
    admin_name: 'Timothy Cheruiyot',
    sacco_name: 'Wanainchi SACCO',
    login_url: 'https://dasnetventures.lovable.app/sacco/wanainchi/login',
    email: 'admin@example.com',
    password: 'Temp1234ab',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(213, 72%, 18%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(213, 16%, 40%)', lineHeight: '1.6', margin: '0 0 24px' }
const detailsBox = { backgroundColor: '#f8f9fa', borderRadius: '12px', padding: '20px', margin: '0 0 24px' }
const detailRow = { fontSize: '14px', color: 'hsl(213, 16%, 30%)', lineHeight: '1.8', margin: '0' }
const button = { backgroundColor: 'hsl(42, 92%, 56%)', color: 'hsl(213, 72%, 12%)', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const hr = { borderColor: '#eaeaea', margin: '28px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
