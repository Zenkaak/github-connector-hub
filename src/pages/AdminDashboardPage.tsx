import { useLocation, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";

import { AdminOverviewModule } from "@/components/admin/AdminOverviewModule";
import { AdminUsersModule } from "@/components/admin/AdminUsersModule";
import { AdminKycModule } from "@/components/admin/AdminKycModule";
import { AdminLoansModule } from "@/components/admin/AdminLoansModule";
import { AdminTransfersModule } from "@/components/admin/AdminTransfersModule";
import { AdminMpesaModule } from "@/components/admin/AdminMpesaModule";
import { AdminChamasModule } from "@/components/admin/AdminChamasModule";
import { AdminMgrModule } from "@/components/admin/AdminMgrModule";
import { AdminWithdrawalsModule } from "@/components/admin/AdminWithdrawalsModule";
import { AdminAuditModule } from "@/components/admin/AdminAuditModule";

const moduleMap = {
  overview: AdminOverviewModule,
  users: AdminUsersModule,
  kyc: AdminKycModule,
  loans: AdminLoansModule,
  transfers: AdminTransfersModule,
  mpesa: AdminMpesaModule,
  chama: AdminChamasModule,
  mgr: AdminMgrModule,
  withdrawals: AdminWithdrawalsModule,
  audit: AdminAuditModule,
};

interface Props {
  defaultTab?: keyof typeof moduleMap;
}

// Map URL paths to tabs (source of truth — query string is fallback)
const PATH_TAB: Record<string, keyof typeof moduleMap> = {
  "/dashboard/admin": "overview",
  "/dashboard/admin/users": "users",
  "/dashboard/admin/wallets": "users",
  "/dashboard/admin/messages": "users",
  "/dashboard/admin/kyc": "kyc",
  "/dashboard/admin/loans": "loans",
  "/dashboard/admin/transfers": "transfers",
  "/dashboard/admin/mpesa": "mpesa",
  "/dashboard/admin/transactions": "mpesa",
  "/dashboard/admin/withdrawals": "withdrawals",
  "/dashboard/admin/savings": "withdrawals",
  "/dashboard/admin/mgr": "mgr",
  "/dashboard/admin/chama": "chama",
  "/dashboard/admin/audit": "audit",
};

export default function AdminDashboardPage({ defaultTab }: Props) {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const fromPath = PATH_TAB[location.pathname];
  const fromQuery = searchParams.get("tab") as keyof typeof moduleMap | null;
  const tab = fromPath || fromQuery || defaultTab || "overview";

  const ActiveModule = moduleMap[tab] || AdminOverviewModule;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <ActiveModule />
      </div>
    </AdminLayout>
  );
}
