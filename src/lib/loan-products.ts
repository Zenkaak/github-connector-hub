// Loan product definitions for Nyota Foundation

export interface LoanProduct {
  id: string;
  type: 'biashara' | 'elimu' | 'jiunge' | 'youth_fund' | 'enterprise';
  name: string;
  description: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  term: string;
  features: string[];
  eligibility: string[];
  icon: string;
}

export const loanProducts: LoanProduct[] = [
  {
    id: 'biashara',
    type: 'biashara',
    name: 'Biashara Loan',
    description: 'Grow your business with flexible financing tailored for entrepreneurs and small business owners.',
    minAmount: 10000,
    maxAmount: 500000,
    interestRate: 12,
    term: '3-24 months',
    features: [
      'Quick disbursement within 24 hours',
      'Flexible repayment schedule',
      'No collateral required',
      'Grace period available',
    ],
    eligibility: [
      'Business operating for 6+ months',
      'Valid business registration',
      'Age 18-65 years',
      'Active bank account or M-Pesa',
    ],
    icon: '💼',
  },
  {
    id: 'elimu',
    type: 'elimu',
    name: 'Elimu Loan',
    description: 'Invest in education for yourself or your loved ones with our affordable education financing.',
    minAmount: 5000,
    maxAmount: 300000,
    interestRate: 10,
    term: '6-36 months',
    features: [
      'Cover school fees and supplies',
      'Low interest rates',
      'Payment aligned with school terms',
      'Direct payment to institutions',
    ],
    eligibility: [
      'Valid admission letter',
      'Kenyan citizen or resident',
      'Age 18+ (or guardian)',
      'Steady income source',
    ],
    icon: '🎓',
  },
  {
    id: 'jiunge',
    type: 'jiunge',
    name: 'Jiunge Loan',
    description: 'Start your financial journey with our entry-level loan designed for first-time borrowers.',
    minAmount: 3000,
    maxAmount: 50000,
    interestRate: 14,
    term: '1-12 months',
    features: [
      'Perfect for first-time borrowers',
      'Build credit history',
      'Simple application process',
      'Fast approval',
    ],
    eligibility: [
      'Kenyan citizen',
      'Age 18-55 years',
      'Valid National ID',
      'Active phone number',
    ],
    icon: '🚀',
  },
  {
    id: 'youth_fund',
    type: 'youth_fund',
    name: 'Youth Fund',
    description: 'Empowering young Kenyans with capital to start and grow their ventures.',
    minAmount: 5000,
    maxAmount: 200000,
    interestRate: 8,
    term: '6-24 months',
    features: [
      'Lowest interest rates',
      'Business mentorship included',
      'Networking opportunities',
      'Flexible terms',
    ],
    eligibility: [
      'Age 18-35 years',
      'Kenyan citizen',
      'Business plan required',
      'No active loan defaults',
    ],
    icon: '⚡',
  },
  {
    id: 'enterprise',
    type: 'enterprise',
    name: 'Enterprise Loan',
    description: 'Scale your established business with substantial capital for expansion and growth.',
    minAmount: 100000,
    maxAmount: 2000000,
    interestRate: 11,
    term: '12-48 months',
    features: [
      'High loan limits',
      'Competitive rates',
      'Dedicated relationship manager',
      'Customized repayment',
    ],
    eligibility: [
      'Business operating 2+ years',
      'Annual revenue 1M+ KES',
      'Valid tax compliance',
      'Audited financials preferred',
    ],
    icon: '🏢',
  },
];

export const getLoanProductByType = (type: string): LoanProduct | undefined => {
  return loanProducts.find(product => product.type === type);
};

// Kenya counties for registration
export const kenyaCounties = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
  'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu',
  'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa',
  'Murang\'a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua',
  'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
  'Trans-Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
];
