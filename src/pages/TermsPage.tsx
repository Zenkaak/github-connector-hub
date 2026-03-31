import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
  const sections = [
    { title: '1. Acceptance of Terms', content: 'By accessing or using the Nyota Foundation platform, you agree to be bound by these Terms of Service. If you do not agree, you may not use our services. These terms apply to all users, including borrowers, visitors, and any person accessing the platform.' },
    { title: '2. Eligibility', content: 'You must be at least 18 years old and a Kenyan citizen or legal resident to use our services. You must provide accurate, complete information during registration, including a valid National ID number, phone number, and email address.' },
    { title: '3. Account Activation', content: 'A one-time activation fee of KES 349 is required to access loan products. This fee is non-refundable and covers account setup, initial credit assessment, and platform access. Payment is processed securely via M-Pesa.' },
    { title: '4. Loan Products & Terms', content: 'Loan amounts, interest rates, and repayment terms vary by product. All terms are clearly displayed before you apply. Interest rates range from 8% to 14% per annum. Approval is subject to our credit assessment criteria and is not guaranteed.' },
    { title: '5. Repayment Obligations', content: 'Borrowers are required to make timely repayments as per the agreed schedule. Late payments may incur additional charges as outlined in your loan agreement. We encourage early repayment, which carries no penalties.' },
    { title: '6. Data Privacy', content: 'We collect and process personal data in accordance with the Kenya Data Protection Act, 2019. Your information is encrypted and stored securely. We do not sell or share personal data with third parties without your explicit consent.' },
    { title: '7. Account Termination', content: 'We reserve the right to suspend or terminate accounts that violate these terms, provide false information, or engage in fraudulent activity. Outstanding loan balances remain due regardless of account status.' },
    { title: '8. Limitation of Liability', content: 'Nyota Foundation shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services. Our total liability is limited to the amount of the loan disbursed.' },
    { title: '9. Changes to Terms', content: 'We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms. Material changes will be communicated via email or SMS.' },
    { title: '10. Contact', content: 'For questions about these terms, contact us at info@nyotafoundation.co.ke or call +254 700 000 000.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-border/40">
        <div className="container flex items-center justify-between h-16 px-4 md:px-6">
          <Link to="/"><Logo size="md" /></Link>
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft size={14} /> Back Home</Button></Link>
        </div>
      </header>

      <div className="pt-28 pb-20 px-4">
        <div className="container max-w-3xl">
          <div className="mb-12">
            <span className="section-label mb-4 inline-block">Legal</span>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>

          <div className="space-y-8">
            {sections.map((section, i) => (
              <div key={i} className="prose prose-sm max-w-none">
                <h2 className="font-display text-lg font-bold mb-2">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="py-8 border-t border-border/50 text-center">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nyota Foundation. All rights reserved.</p>
      </footer>
    </div>
  );
}
