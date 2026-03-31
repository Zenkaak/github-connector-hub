import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function StatCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <Skeleton className="w-10 h-10 rounded-xl mb-3" />
        <Skeleton className="h-7 w-16 mb-1" />
        <Skeleton className="h-3 w-24 mt-2" />
      </CardContent>
    </Card>
  );
}

export function ApplicationRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div>
          <Skeleton className="h-4 w-32 mb-1.5" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="p-5 lg:p-8 space-y-6 max-w-[1200px] animate-in fade-in duration-300">
      {/* Greeting */}
      <div className="flex justify-between items-start">
        <div>
          <Skeleton className="h-7 w-56 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-card border border-border/50">
            <Skeleton className="w-10 h-10 rounded-xl mb-3" />
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Bottom Row */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-2 w-full rounded-full" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <ApplicationRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
