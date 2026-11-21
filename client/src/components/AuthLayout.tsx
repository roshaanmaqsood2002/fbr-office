import type { ReactNode } from 'react';

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-fbr-green p-12 text-white lg:flex">
        <div className="font-serif text-2xl">
          FBR <span className="text-fbr-gold">Compliance</span>
        </div>
        <div>
          <h2 className="font-serif text-4xl leading-tight">
            Invoicing and FBR submissions, <span className="text-fbr-gold">in one place.</span>
          </h2>
          <p className="mt-4 max-w-md text-white/70">
            Manage your business clients, generate compliant invoices and track FBR submission status from a single
            dashboard.
          </p>
        </div>
        <p className="text-sm text-white/50">© {new Date().getFullYear()} FBR Compliance SaaS</p>
      </div>

      <div className="flex-center p-6">
        <div className="animate-fade-in w-full max-w-md">
          <h1 className="font-serif text-3xl">{title}</h1>
          <p className="mb-8 mt-1 text-sm text-fbr-text-light">{subtitle}</p>
          {children}
        </div>
      </div>
        </div>
    );
}