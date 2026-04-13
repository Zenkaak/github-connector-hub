import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoanProductCard } from '@/components/LoanProductCard';
import { loanProducts, LoanProduct } from '@/lib/loan-products';
import { allProducts, productCategories, Product } from '@/lib/products';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, Users, PiggyBank } from 'lucide-react';
import { cn } from '@/lib/utils';

function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (product.comingSoon) {
      toast.info(`${product.name} is coming soon! We'll notify you when it's available.`);
      return;
    }
    if (product.category === 'savings') {
      navigate('/dashboard/savings');
    } else if (product.category === 'chama') {
      navigate('/dashboard/chama');
    }
  };

  return (
    <Card className={cn(
      "border-border/50 h-full flex flex-col overflow-hidden transition-all hover:border-accent/30 hover:shadow-md cursor-pointer",
      product.comingSoon && "opacity-75"
    )} onClick={handleClick}>
      <CardContent className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">
            {product.icon}
          </div>
          {product.highlight && (
            <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              {product.highlight}
            </span>
          )}
          {product.comingSoon && (
            <Badge variant="secondary" className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0">
              Coming Soon
            </Badge>
          )}
        </div>
        <h3 className="font-display font-bold text-sm mb-1">{product.name}</h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-3 flex-1">{product.description}</p>
        <ul className="space-y-1">
          {product.features.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <Check size={10} className="text-emerald-500 mt-0.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50">
        <Button variant={product.comingSoon ? "outline" : "gold"} size="sm" className="w-full text-[11px] h-8" disabled={product.comingSoon}>
          {product.comingSoon ? 'Notify Me' : product.category === 'chama' ? 'Get Started' : 'Learn More'}
          <ArrowRight size={12} />
        </Button>
      </div>
    </Card>
  );
}

export default function LoanProductsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>('loans');

  const handleApply = (product: LoanProduct) => {
    if (!profile?.is_active) {
      toast.info('Please activate your account first');
      navigate('/dashboard/applications', { state: { showActivation: true, product } });
      return;
    }
    navigate('/dashboard/apply', { state: { product } });
  };

  const filteredProducts = allProducts.filter(p => p.category === activeCategory);

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-5 max-w-[1200px]">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Products & Services</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Explore our full range of financial products designed for your needs
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {productCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all shrink-0",
                activeCategory === cat.id
                  ? "bg-accent text-accent-foreground shadow-gold"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="text-sm">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Category Description */}
        <motion.p
          key={activeCategory}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[13px] text-muted-foreground"
        >
          {productCategories.find(c => c.id === activeCategory)?.description}
        </motion.p>

        {/* Loan Products (original cards) */}
        {activeCategory === 'loans' && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loanProducts.map((product) => (
              <LoanProductCard
                key={product.id}
                product={product}
                onApply={() => handleApply(product)}
              />
            ))}
          </div>
        )}

        {/* Other Products */}
        {activeCategory !== 'loans' && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
 
