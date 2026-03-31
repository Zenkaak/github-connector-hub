import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoanProductCard } from '@/components/LoanProductCard';
import { loanProducts, LoanProduct } from '@/lib/loan-products';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function LoanProductsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleApply = (product: LoanProduct) => {
    if (!profile?.is_active) {
      toast.info('Please activate your account first');
      navigate('/dashboard/applications', { state: { showActivation: true, product } });
      return;
    }
    navigate('/dashboard/apply', { state: { product } });
  };

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-6 max-w-[1200px]">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Loan Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore our range of flexible loan products designed for your needs
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {loanProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <LoanProductCard product={product} onApply={handleApply} />
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
