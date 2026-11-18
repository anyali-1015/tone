import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<div className="w-[232px] shrink-0" />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1 px-10 py-12">
        <div className="mx-auto max-w-[1120px]">{children}</div>
      </main>
    </div>
  );
}
