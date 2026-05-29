'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function FinanceiroPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<any>(null)
  const [userId, setUserId] = useState<string>('')
  const [extrato, setExtrato] = useState<any[]>([])
  const [saldos, setSaldos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'meu' | 'geral'>('meu')
  const [totalParticipantes, setTotalParticipantes] = useState(0)

  const loadData = useCallback(async (uid: string) => {
    const [
      { data: perfilData },
      { data: extratoData },
      { data: saldosData },
      { data: configData },
    ] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', uid).single(),
      supabase.from('financeiro').select('*, jogos(time_casa, time_fora, gols_casa, gols_fora)')
        .eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('saldos_usuarios').select('*'),
      supabase.from('config').select('*'),
    ])

    setPerfil(perfilData)
    setExtrato(extratoData ?? [])
    setSaldos(saldosData ?? [])

    const total = configData?.find(c => c.chave === 'total_participantes')
    setTotalParticipantes(parseInt(total?.valor ?? '0'))
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      setUserId(session.user.id)
      loadData(session.user.id)
    })
  }, [router, loadData])

  const mySaldo = saldos.find(s => s.user_id === userId)
  const totalCreditos = extrato.filter(e => e.tipo === 'CREDITO').reduce((sum, e) => sum + e.valor, 0)
  const totalDebitos = extrato.filter(e => e.tipo === 'DEBITO').reduce((sum, e) => sum + e.valor, 0)
  const saldoFinal = totalCreditos - totalDebitos

  if (loading) {
    return (
      <div className="page-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="loading-spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--color-primary)' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <Navbar isAdmin={perfil?.is_admin} userName={perfil?.nome} />

      <main className="main-content" style={{ paddingBottom: '5rem' }}>
        <div className="container">
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Financeiro 💰</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Extrato individual e saldos de todos os participantes
            </p>
          </div>

          {/* Resumo pessoal */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card green">
              <div className="stat-icon green">💵</div>
              <div className="stat-value green">R$ {totalCreditos.toFixed(2)}</div>
              <div className="stat-label">Total ganho</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon red">📤</div>
              <div className="stat-value red">R$ {totalDebitos.toFixed(2)}</div>
              <div className="stat-label">Total pago</div>
            </div>
            <div className={`stat-card ${saldoFinal >= 0 ? 'green' : 'red'}`}>
              <div className={`stat-icon ${saldoFinal >= 0 ? 'green' : 'red'}`}>
                {saldoFinal >= 0 ? '💰' : '💸'}
              </div>
              <div className={`stat-value ${saldoFinal >= 0 ? 'green' : 'red'}`}>
                {saldoFinal >= 0 ? '+' : ''}R$ {Math.abs(saldoFinal).toFixed(2)}
              </div>
              <div className="stat-label">{saldoFinal >= 0 ? 'A receber' : 'A pagar'}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              id="tab-meu-extrato"
              className={`tab-btn ${tab === 'meu' ? 'active' : ''}`}
              onClick={() => setTab('meu')}
            >
              📋 Meu Extrato
            </button>
            <button
              id="tab-geral"
              className={`tab-btn ${tab === 'geral' ? 'active' : ''}`}
              onClick={() => setTab('geral')}
            >
              👥 Saldos Gerais
            </button>
          </div>

          {tab === 'meu' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {extrato.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">Nenhuma movimentação ainda</div>
                  <div className="empty-state-desc">Seu extrato aparece após o primeiro jogo ser encerrado</div>
                </div>
              ) : (
                extrato.map((item) => {
                  const jogo = item.jogos
                  return (
                    <div key={item.id} className="extrato-item">
                      <div className="extrato-info">
                        <div className={`extrato-icon ${item.tipo.toLowerCase()}`}>
                          {item.tipo === 'CREDITO' ? '💰' : '💸'}
                        </div>
                        <div>
                          <div className="extrato-desc">{item.descricao}</div>
                          <div className="extrato-date">
                            {format(new Date(item.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        fontFamily: 'Outfit',
                        fontWeight: 800,
                        fontSize: '1rem',
                        color: item.tipo === 'CREDITO' ? 'var(--color-primary)' : 'var(--color-red)',
                      }}>
                        {item.tipo === 'CREDITO' ? '+' : '-'}R$ {item.valor.toFixed(2)}
                      </div>
                    </div>
                  )
                })
              )}

              {extrato.length > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1rem 1.25rem',
                  background: saldoFinal >= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  borderTop: '2px solid var(--color-border)',
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Saldo Final</span>
                  <span style={{
                    fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.25rem',
                    color: saldoFinal >= 0 ? 'var(--color-primary)' : 'var(--color-red)'
                  }}>
                    {saldoFinal >= 0 ? '+' : ''}R$ {Math.abs(saldoFinal).toFixed(2)}
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 500 }}>
                      {saldoFinal >= 0 ? '✅ a receber' : '❗ a pagar'}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === 'geral' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  💡 Saldo <span style={{ color: 'var(--color-primary)' }}>positivo</span> = participante tem a receber &nbsp;|&nbsp;
                  Saldo <span style={{ color: 'var(--color-red)' }}>negativo</span> = participante deve pagar
                </div>
              </div>
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>Participante</th>
                    <th style={{ textAlign: 'right' }}>Ganhou</th>
                    <th style={{ textAlign: 'right' }}>Pagou</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map(s => {
                    const isMe = s.user_id === userId
                    const saldo = s.saldo_final
                    const initials = s.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <tr key={s.user_id} style={isMe ? { background: 'rgba(34,197,94,0.04)' } : {}}>
                        <td>
                          <div className="ranking-user">
                            <div className="ranking-avatar" style={isMe ? { background: 'var(--gradient-gold)' } : {}}>
                              {initials}
                            </div>
                            <div>
                              <div className="ranking-name">
                                {s.nome} {isMe && <span className="badge badge-green" style={{ fontSize: '0.625rem' }}>você</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="amount-positive">R$ {s.total_ganho?.toFixed(2)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="amount-negative">R$ {s.total_pago?.toFixed(2)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={saldo >= 0 ? 'amount-positive' : 'amount-negative'} style={{ fontSize: '1rem' }}>
                            {saldo >= 0 ? '+' : ''}R$ {Math.abs(saldo).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${saldo >= 0 ? 'badge-green' : 'badge-red'}`}>
                            {saldo >= 0 ? '✅ Receber' : '❗ Pagar'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
