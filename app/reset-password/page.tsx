import { Suspense } from 'react';
import ResetForm from './ResetForm';

export const metadata = {
  // Página de token de uso único: herda o noindex do layout de propósito.
  title: 'Redefinir senha',
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-[#05020A]">
      <div className="w-full max-w-md p-8 space-y-6 bg-[#0D0915] border border-white/10 rounded-2xl shadow-2xl">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Redefinir senha</h1>
          <p className="text-gray-400">Escolha uma nova senha segura.</p>
        </div>
        <Suspense fallback={<div className="text-sm text-gray-500">Carregando…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
