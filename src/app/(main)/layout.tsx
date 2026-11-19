import { Suspense } from "react";
import { MobileNav, Sidebar } from "@/components/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense fallback={<div className="hidden w-[232px] shrink-0 md:block" />}>
        <Sidebar />
        <MobileNav />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 pt-6 pb-[calc(88px+env(safe-area-inset-bottom))] md:px-10 md:py-12">
        <div className="mx-auto max-w-[1120px]">{children}</div>
      </main>
    </div>
  );
}
