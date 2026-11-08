import { RegisterClient } from './RegisterClient';
import { Toaster } from 'react-hot-toast';
import { RegisterClientProvider } from './RegisterClientProvider';

export const metadata = {
  title: 'Criar conta',
  robots: { index: true, follow: true },
};

export default function RegisterPage() {
  return (
    <RegisterClientProvider>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <RegisterClient />
    </RegisterClientProvider>
  );
}
