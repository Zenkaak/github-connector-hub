import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { useNotificationListener } from "@/hooks/useNotificationListener";

/* CORE */
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import LoanProductsPage from "./pages/LoanProductsPage";
import LoanApplicationsPage from "./pages/LoanApplicationsPage";
import LoanApplyPage from "./pages/LoanApplyPage";
import NotificationsPage from "./pages/NotificationsPage";
import AboutPage from "./pages/AboutPage";
import TermsPage from "./pages/TermsPage";
import ContactPage from "./pages/ContactPage";
import MyAccountPage from "./pages/MyAccountPage";
import SettingsPage from "./pages/SettingsPage";
import SupportPage from "./pages/SupportPage";
import TransactionsPage from "./pages/TransactionsPage";
import WalletPage from "./pages/WalletPage";
import SavingsPage from "./pages/SavingsPage";
import CreateHarambeePage from "./pages/CreateHarambeePage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminChamaPage from "./pages/AdminChamaPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import ChamaGroupsPage from "./pages/ChamaGroupsPage";
import ChamaGroupDetailPage from "./pages/ChamaGroupDetailPage";
import ChamaExplorerPage from "./pages/ChamaExplorerPage";
import PublicHarambeePage from "./pages/PublicHarambeePage";
import NotFound from "./pages/NotFound";

/* SEO LANDING PAGES - Corrected to match exact filenames in screenshots */
import ChamaManagementKenyaPage from "./pages/ChamaManagementKenyaPage";
import HarambeeFundraisingPlatformPage from "./pages/HarambeeFundraisingPlatformPage";
import CommunityLoansKenyaPage from "./pages/CommunityLoansKenyaPage";
import DigitalSavingsGroupsKenya from "./pages/DigitalSavingsGroupsKenya";
import ChamaLoanManagement from "./pages/ChamaLoanManagement";
import OnlineChamaPlatform from "./pages/OnlineChamaPlatform";
import MpesaChamaManagement from "./pages/MpesaChamaManagement";
import ChamaInvestmentGroupsKenya from "./pages/ChamaInvestmentGroupsKenya";
import ChamaContributionTracking from "./pages/ChamaContributionTracking";
import OnlineFundraisingKenya from "./pages/OnlineFundraisingKenya";
import GroupSavingsAppKenya from "./pages/GroupSavingsAppKenya";
import TableBankingKenya from "./pages/TableBankingKenya";
import RotatingSavingsGroupsKenya from "./pages/RotatingSavingsGroupsKenya";
import ChamaRecordKeepingSoftware from "./pages/ChamaRecordKeepingSoftware";
import HarambeeDonationPlatform from "./pages/HarambeeDonationPlatform";
import GroupInvestmentManagement from "./pages/GroupInvestmentManagement";
import ChamaAccountingSoftware from "./pages/ChamaAccountingSoftware";
import SavingsCreditGroupsKenya from "./pages/SavingsCreditGroupsKenya";
import CommunityInvestmentPlatform from "./pages/CommunityInvestmentPlatform";
import MobileMoneyChamaPlatform from "./pages/MobileMoneyChamaPlatform";
import ChamaFinancialManagement from "./pages/ChamaFinancialManagement";
import DigitalChamaWallet from "./pages/DigitalChamaWallet";
import CommunitySavingsPlatform from "./pages/CommunitySavingsPlatform";
import ChamaMemberManagement from "./pages/ChamaMemberManagement";
import ChamaContributionApp from "./pages/ChamaContributionApp";
import OnlineInvestmentGroupsKenya from "./pages/OnlineInvestmentGroupsKenya";

const queryClient = new QueryClient();

function AppRoutes() {
  useInactivityTimeout();
  useNotificationListener();

  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/harambee/:orderNumber" element={<PublicHarambeePage />} />

      {/* SEO LANDING PAGES */}
      <Route path="/chama-management-kenya" element={<ChamaManagementKenyaPage />} />
      <Route path="/harambee-fundraising-platform" element={<HarambeeFundraisingPlatformPage />} />
      <Route path="/community-loans-kenya" element={<CommunityLoansKenyaPage />} />
      <Route path="/digital-savings-groups-kenya" element={<DigitalSavingsGroupsKenya />} />
      <Route path="/chama-loan-management" element={<ChamaLoanManagement />} />
      <Route path="/online-chama-platform" element={<OnlineChamaPlatform />} />
      <Route path="/mpesa-chama-management" element={<MpesaChamaManagement />} />
      <Route path="/chama-investment-groups-kenya" element={<ChamaInvestmentGroupsKenya />} />
      <Route path="/chama-contribution-tracking" element={<ChamaContributionTracking />} />
      <Route path="/online-fundraising-kenya" element={<OnlineFundraisingKenya />} />
      <Route path="/group-savings-app-kenya" element={<GroupSavingsAppKenya />} />
      <Route path="/table-banking-kenya" element={<TableBankingKenya />} />
      <Route path="/rotating-savings-groups-kenya" element={<RotatingSavingsGroupsKenya />} />
      <Route path="/chama-record-keeping-software" element={<ChamaRecordKeepingSoftware />} />
      <Route path="/harambee-donation-platform" element={<HarambeeDonationPlatform />} />
      <Route path="/group-investment-management" element={<GroupInvestmentManagement />} />
      <Route path="/chama-accounting-software" element={<ChamaAccountingSoftware />} />
      <Route path="/savings-and-credit-groups-kenya" element={<SavingsCreditGroupsKenya />} />
      <Route path="/community-investment-platform" element={<CommunityInvestmentPlatform />} />
      <Route path="/mobile-money-chama-platform" element={<MobileMoneyChamaPlatform />} />
      <Route path="/chama-financial-management" element={<ChamaFinancialManagement />} />
      <Route path="/digital-chama-wallet" element={<DigitalChamaWallet />} />
      <Route path="/community-savings-platform" element={<CommunitySavingsPlatform />} />
      <Route path="/chama-member-management" element={<ChamaMemberManagement />} />
      <Route path="/chama-contribution-app" element={<ChamaContributionApp />} />
      <Route path="/online-investment-groups-kenya" element={<OnlineInvestmentGroupsKenya />} />

      {/* DASHBOARD */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/dashboard/products" element={<ProtectedRoute><LoanProductsPage /></ProtectedRoute>} />
      <Route path="/dashboard/applications" element={<ProtectedRoute><LoanApplicationsPage /></ProtectedRoute>} />
      <Route path="/dashboard/apply" element={<ProtectedRoute><LoanApplyPage /></ProtectedRoute>} />
      <Route path="/dashboard/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/dashboard/account" element={<ProtectedRoute><MyAccountPage /></ProtectedRoute>} />
      <Route path="/dashboard/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
      <Route path="/dashboard/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
      <Route path="/dashboard/savings" element={<ProtectedRoute><SavingsPage /></ProtectedRoute>} />
      <Route path="/dashboard/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/dashboard/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
      <Route path="/dashboard/chama" element={<ProtectedRoute><ChamaGroupsPage /></ProtectedRoute>} />
      <Route path="/dashboard/chama/explore" element={<ProtectedRoute><ChamaExplorerPage /></ProtectedRoute>} />
      <Route path="/dashboard/chama/:groupId" element={<ProtectedRoute><ChamaGroupDetailPage /></ProtectedRoute>} />
      <Route path="/dashboard/create-fundraiser" element={<ProtectedRoute><CreateHarambeePage /></ProtectedRoute>} />

      {/* ADMIN */}
      <Route path="/dashboard/admin" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="/dashboard/admin/users" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="users" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/loans" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="loans" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/transactions" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="transactions" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/messages" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="messages" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/withdrawals" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="withdrawals" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/audit" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="audit" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/transfers" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="transfers" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/savings" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="savings" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/reports" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="reports" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/removals" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="removals" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/harambees" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="harambees" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/notifications" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="notifications" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/settings" element={<ProtectedRoute requireAdmin><AdminDashboardPage defaultTab="settings" /></ProtectedRoute>} />
      <Route path="/dashboard/admin/chama" element={<ProtectedRoute requireAdmin><AdminChamaPage /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PlatformSettingsProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </PlatformSettingsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
