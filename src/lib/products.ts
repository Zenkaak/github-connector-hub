// All product definitions for the platform

export interface Product {
  id: string;
  category: 'loans' | 'savings' | 'insurance' | 'investment' | 'chama';
  name: string;
  description: string;
  icon: string;
  features: string[];
  highlight?: string;
  comingSoon?: boolean;
}

export const productCategories = [
  { id: 'loans', label: 'Loans', icon: '💳', description: 'Flexible financing for every need' },
  { id: 'savings', label: 'Savings', icon: '🏦', description: 'Grow your money with great returns' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', description: 'Protect what matters most' },
  { id: 'investment', label: 'Investment', icon: '📈', description: 'Build wealth for the future' },
  { id: 'chama', label: 'Chama', icon: '👥', description: 'Group savings & investment tools' },
] as const;

export const allProducts: Product[] = [
  // — Savings —
  {
    id: 'target-savings',
    category: 'savings',
    name: 'Target Savings',
    description: 'Set a goal and save towards it with disciplined, locked savings that earn interest.',
    icon: '🎯',
    highlight: '8% p.a.',
    features: ['Set your own target amount', 'Earn 8% annual interest', 'Lock period for discipline', 'Withdraw at maturity'],
  },
  {
    id: 'emergency-fund',
    category: 'savings',
    name: 'Emergency Fund',
    description: 'Build a safety net for life\'s unexpected moments with easy access to your funds.',
    icon: '🆘',
    highlight: '5% p.a.',
    features: ['Flexible deposits anytime', 'Quick withdrawal access', 'Earn 5% annual interest', 'No lock-in period'],
  },
  {
    id: 'fixed-deposit',
    category: 'savings',
    name: 'Fixed Deposit',
    description: 'Lock your money for a fixed period and enjoy the highest returns guaranteed.',
    icon: '🔒',
    highlight: '12% p.a.',
    features: ['Highest interest rates', 'Terms from 3 to 12 months', 'Guaranteed returns', 'Auto-renewal option'],
  },

  // — Insurance —
  {
    id: 'crop-insurance',
    category: 'insurance',
    name: 'Crop Insurance',
    description: 'Protect your harvest against drought, floods, and pests with affordable premiums.',
    icon: '🌾',
    highlight: 'From KES 500',
    features: ['Weather-indexed payouts', 'Covers drought & floods', 'Affordable premiums', 'Fast claim settlement'],
    comingSoon: true,
  },
  {
    id: 'health-cover',
    category: 'insurance',
    name: 'Health Cover',
    description: 'Affordable health insurance for you and your family with nationwide hospital access.',
    icon: '🏥',
    highlight: 'Family plans',
    features: ['Outpatient & inpatient cover', 'Nationwide hospital network', 'Maternity benefits', 'Dental & optical add-ons'],
    comingSoon: true,
  },
  {
    id: 'livestock-insurance',
    category: 'insurance',
    name: 'Livestock Insurance',
    description: 'Protect your animals from disease, theft, and natural disasters.',
    icon: '🐄',
    highlight: 'From KES 300',
    features: ['Covers cattle, goats & poultry', 'Disease & theft protection', 'Quick mobile claims', 'Flexible premiums'],
    comingSoon: true,
  },

  // — Investment —
  {
    id: 'money-market',
    category: 'investment',
    name: 'Money Market Fund',
    description: 'Low-risk investment with daily interest accrual and flexible access to your money.',
    icon: '📊',
    highlight: '10-13% p.a.',
    features: ['Daily interest accrual', 'No lock-in period', 'Start from KES 1,000', 'Professional fund management'],
    comingSoon: true,
  },
  {
    id: 'bonds',
    category: 'investment',
    name: 'Government Bonds',
    description: 'Invest in treasury bonds and bills for guaranteed, risk-free returns.',
    icon: '🏛️',
    highlight: 'Risk-free',
    features: ['Government-backed security', 'Competitive interest rates', 'Various maturity periods', 'Secondary market trading'],
    comingSoon: true,
  },
  {
    id: 'group-investment',
    category: 'investment',
    name: 'Group Investment',
    description: 'Pool funds with your chama to invest in real estate, business, or securities.',
    icon: '🤝',
    highlight: 'Pool & grow',
    features: ['Invest as a group', 'Diversified portfolios', 'Professional advisory', 'Transparent reporting'],
    comingSoon: true,
  },

  // — Chama —
  {
    id: 'chama-savings-group',
    category: 'chama',
    name: 'Savings Group',
    description: 'Create or join a chama with automated contribution tracking and transparent reporting.',
    icon: '💰',
    features: ['Automated contribution reminders', 'Real-time balance tracking', 'Member management tools', 'Financial reports'],
  },
  {
    id: 'chama-merry-go-round',
    category: 'chama',
    name: 'Merry-Go-Round',
    description: 'Rotating fund where members take turns receiving pooled contributions.',
    icon: '🔄',
    features: ['Automated rotation schedule', 'Fair ordering system', 'Payment tracking', 'Penalty management'],
  },
  {
    id: 'harambee-fundraising',
    category: 'chama',
    name: 'Harambee Fundraising',
    description: 'Create public or private fundraisers with M-Pesa integration and real-time tracking.',
    icon: '🤲',
    features: ['Public shareable links', 'M-Pesa contributions', 'Real-time progress tracking', 'Donor management'],
  },
  {
    id: 'welfare-fund',
    category: 'chama',
    name: 'Welfare Fund',
    description: 'Set up a group welfare kitty for emergencies, funerals, and medical needs.',
    icon: '❤️',
    features: ['Emergency disbursements', 'Transparent fund tracking', 'Member voting on requests', 'Automated collections'],
    comingSoon: true,
  },
];
