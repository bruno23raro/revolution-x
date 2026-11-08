'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Toaster } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(100, 'Senha muito longa')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos 1 letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos 1 número'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isLoading, isSubmitSuccessful },
    reset,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao criar a conta');
      setIsSent(true);
      queryClient.invalidateQueries({ queryKey: ['session'] });
      setTimeout(() => router.push('/verify-email'), 1200);
    } catch (err: any) {
      throw new Error(
        err.message === 'registration_failed'
          ? 'Não foi possível criar a conta. Tente novamente.'
          : err.message
      );
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-[#05020A]">
      <div className="w-full max-w-md p-8 space-y-6 bg-[#0D0915] border border-white/10 rounded-2xl shadow-2xl">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Criar conta</h1>
          <p className="text-gray-400">Registre-se no Revolution X</p>
        </div>

        {isSent ? (
          <div className="p-3 text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
            Conta criada! Verifique seu e-mail para confirmar. Redirecionando…
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-300">
                Nome
                <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                id="name"
                required
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                placeholder="Seu nome"
              />
              {errors.name && (
                <p className="text-sm text-red-400 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-300">
                E-mail
                <span className="text-red-500">*</span>
              </label>
              <input
                {...register('email')}
                id="email"
                type="email"
                required
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                placeholder="seu@email.com"
              />
              {errors.email && (
                <p className="text-sm text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                Senha
                <span className="text-red-500">*</span>
              </label>
              <input
                {...register('password')}
                id="password"
                type="password"
                required
                minLength={8}
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                placeholder="Senha forte"
              />
              {errors.password && (
                <p className="text-sm text-red-400 mt-1">{errors.password.message}</p>
              )}
              <p className="text-xs text-gray-400">
                Mínimo 8 caracteres, 1 maiúscula e 1 número.
              </p>
            </div>

            {errors && (
              <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
                {Object.values(errors).map((e: any) => e.message).join('. ')}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? 'Criando...' : 'Criar conta'}
            </button>
          </form>
        )}

        <div className="text-sm text-center text-gray-400">
          Já tem uma conta?{' '}
          <a href="/login" className="text-purple-400 underline hover:text-purple-300">Entrar</a>
        </div>
      </div>
    </main>
  );
}