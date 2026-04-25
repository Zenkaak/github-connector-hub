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

export type AdminTab =
  | 'overview' | 'users' | 'kyc' | 'loans' | 'transfers' | 'mpesa'
  | 'chama' | 'mgr' | 'withdrawals' | 'audit';

interface Props { defaultTab?: AdminTab }

export default function AdminDashboardPage({ defaultTab = 'overview' }: Props) {
  const renderModule = () => {
    switch (defaultTab) {
      case 'users': return <AdminUsersModule />;
      case 'kyc': return <AdminKycModule />;
      case 'loans': return <AdminLoansModule />;
      case 'transfers': return <AdminTransfersModule />;
      case 'mpesa': return <AdminMpesaModule />;
      case 'chama': return <AdminChamasModule />;
      case 'mgr': return <AdminMgrModule />;
      case 'withdrawals': return <AdminWithdrawalsModule />;
      case 'audit': return <AdminAuditModule />;
      default: return <AdminOverviewModule />;
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {renderModule()}
      </div>
    </AdminLayout>
  );
}
