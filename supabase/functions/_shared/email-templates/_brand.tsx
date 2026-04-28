/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

const BRAND_NAME = 'DASNET VENTURES'
const BRAND_TAGLINE = 'Smarter Chama. Stronger Future.'
const NAVY = 'hsl(213, 72%, 12%)'
const NAVY_DEEP = 'hsl(213, 72%, 8%)'
const GOLD = 'hsl(42, 92%, 56%)'
const EMERALD = 'hsl(160, 84%, 39%)'
const TEXT = 'hsl(213, 16%, 28%)'
const MUTED = 'hsl(213, 12%, 50%)'
const BORDER = 'hsl(213, 20%, 90%)'
const BG = 'hsl(210, 30%, 97%)'

interface BrandLayoutProps {
  preview: string
  children: React.ReactNode
}

export const BrandLayout = ({ preview, children }: BrandLayoutProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: BG, fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif", margin: 0, padding: '24px 0' }}>
      <Container style={{ maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(15,23,42,0.06)' }}>

        {/* Header — navy with gold accent */}
        <Section style={{ background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 100%)`, padding: '28px 32px', textAlign: 'center' as const }}>
          <Text style={{ color: GOLD, fontSize: '11px', letterSpacing: '3px', fontWeight: 'bold' as const, margin: 0, textTransform: 'uppercase' as const }}>
            ◆ {BRAND_NAME} ◆
          </Text>
          <Text style={{ color: '#ffffff', fontSize: '13px', margin: '6px 0 0', opacity: 0.7 }}>
            {BRAND_TAGLINE}
          </Text>
        </Section>

        {/* Body */}
        <Section style={{ padding: '36px 32px 28px' }}>
          {children}
        </Section>

        {/* Footer */}
        <Hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: 0 }} />
        <Section style={{ padding: '20px 32px', backgroundColor: BG, textAlign: 'center' as const }}>
          <Text style={{ fontSize: '11px', color: MUTED, margin: 0, lineHeight: '1.6' }}>
            © {new Date().getFullYear()} {BRAND_NAME} LTD. All rights reserved.
            <br />
            Nairobi, Kenya · support@dasnett.site
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const styles = {
  h1: { fontSize: '22px', fontWeight: 'bold' as const, color: NAVY, margin: '0 0 16px', lineHeight: '1.3' },
  text: { fontSize: '15px', color: TEXT, lineHeight: '1.65', margin: '0 0 16px' },
  muted: { fontSize: '13px', color: MUTED, lineHeight: '1.6', margin: '24px 0 0' },
  button: {
    display: 'inline-block',
    backgroundColor: GOLD,
    color: NAVY_DEEP,
    fontSize: '15px',
    fontWeight: 'bold' as const,
    borderRadius: '10px',
    padding: '14px 32px',
    textDecoration: 'none',
    margin: '8px 0 16px',
  },
  codeBox: {
    backgroundColor: BG,
    border: `2px dashed ${GOLD}`,
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center' as const,
    margin: '20px 0',
  },
  code: {
    fontSize: '32px',
    fontWeight: 'bold' as const,
    color: NAVY,
    letterSpacing: '8px',
    margin: 0,
    fontFamily: 'monospace',
  },
  colors: { NAVY, NAVY_DEEP, GOLD, EMERALD, TEXT, MUTED, BORDER, BG },
}
