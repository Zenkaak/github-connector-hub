import { useRouter } from 'next/router';
import { AdminLayout } from '@/components/AdminLayout';

import { AdminOverviewModule } from '@/components/admin/AdminOverviewModule';
import { AdminUsersModule } from '@/components/admin/AdminUsersModule';
import { AdminKycModule } from '@/components/admin/AdminKycModule';
import { AdminLoansModule } from '@/components/admin/AdminLoansModule';
import { AdminTransfersModule } from '@/components/admin/AdminTransfersModule';
import { AdminMpesaModule } from '@/components/admin/AdminMpesaModule';
import { AdminChamasModule } from '@/components/admin/AdminChamasModule';
import { AdminMgrModule } from '@/components/admin/AdminMgrModule';
import { AdminWithdrawalsModule } from '@/components/admin/AdminWithdrawalsModule';
import { AdminAuditModule } from '@/components/admin/AdminAuditModule';

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

export default function AdminDashboardPage() {
  const router = useRouter();
  const { tab } = router.query;

  const ActiveModule =
    moduleMap[tab as keyof typeof moduleMap] || AdminOverviewModule;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <ActiveModule />
      </div>
    </AdminLayout>
  );
}
