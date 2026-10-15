export const dynamic = 'force-dynamic';

import { AuthProvider } from '@/lib/auth/auth-context';
import { BottomNav } from '@/components/store/bottom-nav';
import { StoreHeader } from '@/components/store/store-header';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <StoreHeader />
        <main className="flex-1 pb-20">
          {children}
        </main>
        <BottomNav />
      </div>
    </AuthProvider>
  );
}
