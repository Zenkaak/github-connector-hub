import { z } from 'zod';

export const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^(?:\+254|0)7\d{8}$/, 'Enter a valid Kenyan phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  county: z.string().min(1, 'County is required'),
  subCounty: z.string().min(1, 'Sub-county is required'),
  ward: z.string().min(1, 'Ward is required'),
  address: z.string().min(5, 'Physical address must be at least 5 characters'),
  idNumber: z.string().regex(/^\d{7,8}$/, 'Enter a valid National ID number (7-8 digits)'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

export const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const loanApplicationSchema = z.object({
  loanType: z.enum(['biashara', 'elimu', 'jiunge', 'youth_fund', 'enterprise']),
  employmentStatus: z.enum(['employed', 'self_employed', 'not_employed']),
  monthlyIncome: z.number().min(1000, 'Monthly income must be at least KES 1,000'),
  existingLoans: z.boolean(),
  existingLoanAmount: z.number().optional(),
  monthlyExpenses: z.number().min(0, 'Monthly expenses cannot be negative'),
  nextOfKinName: z.string().min(2, 'Next of kin name is required'),
  nextOfKinPhone: z.string().regex(/^(?:\+254|0)7\d{8}$/, 'Enter a valid Kenyan phone number'),
  businessSector: z.string().optional(),
  numberOfDependents: z.number().optional(),
  educationLevel: z.string().optional(),
});

export const stkPushSchema = z.object({
  phone: z.string().regex(/^(?:\+254|0)7\d{8}$/, 'Enter a valid Kenyan phone number'),
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type OtpFormData = z.infer<typeof otpSchema>;
export type LoanApplicationFormData = z.infer<typeof loanApplicationSchema>;
export type StkPushFormData = z.infer<typeof stkPushSchema>;
