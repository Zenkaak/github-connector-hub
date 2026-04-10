/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
  Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'DASNET VENTURES'

interface TransactionNotificationProps {
  type?: string
  amount?: string
  reference?: string
  status?: string
  date?: string
  description?: string
  name?: string
}

const TransactionNotificationEmail = ({
  type = 'Transaction',
  amount = 'KES 0',
  reference = '',
  status = 'completed',
  date = '',
  description = '',
  name = '',
}: TransactionNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{type} of {amount} — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Hi ${name},` : 'Transaction Update'}
        </Heading>
        <Text style={text}>
          Your {type.toLowerCase()} has been processed successfully.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}>
            <strong>Type:</strong> {type}
          </Text>
          <Text style={detailRow}>
            <strong>Amount:</strong> {amount}
          </Text>
          {reference && (
            <Text style={detailRow}>
              <strong>Reference:</strong> {reference}
            </Text>
          )}
          <Text style={detailRow}>
            <strong>Status:</strong> {status}
          </Text>
          {date && (
            <Text style={detailRow}>
              <strong>Date:</strong> {date}
            </Text>
          )}
          {description && (
            <Text style={detailRow}>
              <strong>Details:</strong> {description}
            </Text>
          )}
        </Section>

        <Button style={button} href="https://dasnett.site/dashboard/transactions">
          View Transactions
        </Button>

        <Hr style={hr} />

        <Text style={footer}>
          This is an automated notification from {SITE_NAME}. If you did not initiate this transaction, please contact support immediately.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TransactionNotificationEmail,
  subject: (data: Record<string, any>) =>
    `${data.type || 'Transaction'}: ${data.amount || ''} — ${SITE_NAME}`,
  displayName: 'Transaction notification',
  previewData: {
    type: 'M-Pesa Deposit',
    amount: 'KES 5,000',
    reference: 'TXN-ABC123',
    status: 'Completed',
    date: '10 Apr 2026, 2:30 PM',
    description: 'Wallet top-up via M-Pesa',
    name: 'Grace',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(213, 72%, 18%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(213, 16%, 40%)',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const detailsBox = {
  backgroundColor: '#f8f9fa',
  borderRadius: '12px',
  padding: '20px',
  margin: '0 0 24px',
}
const detailRow = {
  fontSize: '14px',
  color: 'hsl(213, 16%, 30%)',
  lineHeight: '1.8',
  margin: '0',
}
const button = {
  backgroundColor: 'hsl(42, 92%, 56%)',
  color: 'hsl(213, 72%, 12%)',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const hr = { borderColor: '#eaeaea', margin: '28px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
