'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Inserir perfil na tabela usuarios
      const { error: profileError } = await supabase
        .from('usuarios')
        .insert({ id: data.user.id, nome, email })

      if (profileError) {
        setError('Erro ao criar perfil. Tente novamente.')
        setLoading(false)
        return
      }

      // Atualizar total de participantes
      const { data: configData } = await supabase
        .from('config')
        .select('valor')
        .eq('chave', 'total_participantes')
        .single()

      const current = parseInt(configData?.valor || '0')
      await supabase
        .from('config')
        .update({ valor: String(current + 1) })
        .eq('chave', 'total_participantes')

      router.push('/dashboard')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🏆</div>
          <h1 className="auth-title">Criar Conta</h1>
          <p className="auth-subtitle">Participe do bolão da Copa 2026</p>
        </div>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label" htmlFor="register-nome">Seu nome</label>
            <input
              id="register-nome"
              type="text"
              className="form-input"
              placeholder="Nome completo"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              className="form-input"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">Senha</label>
            <input
              id="register-password"
              type="password"
              className="form-input"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="form-error" style={{ marginBottom: '1rem', padding: '0.625rem', background: 'var(--color-red-dim)', borderRadius: 'var(--radius-sm)' }}>
              ⚠️ {error}
            </div>
          )}

          <button
            id="register-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <span className="loading-spinner" /> : '🎯'} Entrar no Bolão
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Já tem conta?{' '}
          <Link href="/auth/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}
