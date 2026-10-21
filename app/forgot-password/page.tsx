import { ForgotPasswordClient } from './ForgotPasswordClient';

export const metadata = {
  title: 'Recuperar senha',
  robots: { index: true, follow: true },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
