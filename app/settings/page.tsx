import SettingsDashboard from '@/components/SettingsDashboard';
import { Suspense } from 'react';

export default function SettingsPage() {
  return (
    <main className="min-h-screen">
      <Suspense
        fallback={
          <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12 text-slate-100">
            正在加载设置...
          </section>
        }
      >
        <SettingsDashboard />
      </Suspense>
    </main>
  );
}
