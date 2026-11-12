import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Modo Dev - Revolution X',
  description: 'Ambiente de desenvolvimento e demonstração',
};

export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}