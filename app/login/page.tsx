import LoginForm from './LoginForm';

export const metadata = {
  title: 'Entrar',
  robots: { index: true, follow: true },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-[#05020A]">
      <LoginForm />
    </main>
  );
}
