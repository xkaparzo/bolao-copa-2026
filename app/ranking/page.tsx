'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

export default function RankingPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<any>(null)
  const [userId, setUserId] = useState<string>('')
  const [ranking, setRanking] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalParticipantes, setTotalParticipantes] = useState(0)

  const loadData = useCallback(async (uid: string) => {
    const [
      { data: perfilData },
      { data: saldos },
      { data: configs },
    ] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', uid).single(),
      supabase.from('saldos_usuarios').select('*'),
      supabase.from('config').select('*'),
    ])

    setPerfil(perfilData)
    setRanking(saldos ?? [])

    const total = configs?.find(c => c.chave === 'total_participantes')
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

  if (loading) {
    return (
      <div className="page-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="loading-spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--color-primary)' }} />
        </div>
      </div>
    )
  }

  const myPosition = ranking.findIndex(r => r.user_id === userId) + 1

  return (
    <div className="page-wrapper">
      <Navbar isAdmin={perfil?.is_admin} userName={perfil?.nome} />

      <main className="main-content" style={{ paddingBottom: '5rem' }}>
        <div className="container">
          {/* Header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Ranking 🏆</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Classificação geral por saldo financeiro ({totalParticipantes} participante{totalParticipantes !== 1 ? 's' : ''})
            </p>
          </div>

          {/* Minha posição */}
          {myPosition > 0 && (
            <div className="card" style={{
              marginBottom: '1.5rem',
              background: 'rgba(34,197,94,0.05)',
              borderColor: 'rgba(34,197,94,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
            }}>
              <div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Sua posição</div>
                <div style={{ fontSize: '2rem', fontFamily: 'Outfit', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {myPosition === 1 ? '🥇' : myPosition === 2 ? '🥈' : myPosition === 3 ? '🥉' : `${myPosition}º`}
                  <span style={{ fontSize: '1rem', marginLeft: '0.5rem' }}>de {ranking.length}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Seu saldo</div>
                {(() => {
                  const me = ranking[myPosition - 1]
                  if (!me) return null
                  const saldo = me.saldo_final
                  return (
                    <div style={{ fontSize: '1.5rem', fontFamily: 'Outfit', fontWeight: 800, color: saldo >= 0 ? 'var(--color-primary)' : 'var(--color-red)' }}>
                      {saldo >= 0 ? '+' : ''}R$ {Math.abs(saldo).toFixed(2)}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Pódio top 3 */}
          {ranking.length >= 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {[ranking[1], ranking[0], ranking[2]].map((r, visualIdx) => {
                if (!r) return <div key={visualIdx} />
                const realIdx = visualIdx === 0 ? 1 : visualIdx === 1 ? 0 : 2
                const medals = ['🥈', '🥇', '🥉']
                const medal = medals[visualIdx]
                const heights = ['180px', '220px', '160px']
                const isMe = r.user_id === userId
                const saldo = r.saldo_final
                const initials = r.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

                return (
                  <div key={r.user_id} style={{
                    background: isMe ? 'rgba(34,197,94,0.08)' : 'var(--color-surface)',
                    border: `1px solid ${isMe ? 'rgba(34,197,94,0.3)' : realIdx === 0 ? 'rgba(251,191,36,0.3)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem 1rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minHeight: heights[visualIdx],
                    justifyContent: 'center',
                    boxShadow: realIdx === 0 ? '0 0 30px rgba(251,191,36,0.15)' : undefined,
                    transition: 'var(--transition)',
                  }}>
                    <div style={{ fontSize: '2.5rem' }}>{medal}</div>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: realIdx === 0 ? 'linear-gradient(135deg, #fbbf24, #d97706)' : 'var(--gradient-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '1rem', color: 'white'
                    }}>
                      {initials}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{r.nome.split(' ')[0]}</div>
                    <div style={{
                      fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.125rem',
                      color: saldo >= 0 ? 'var(--color-primary)' : 'var(--color-red)'
                    }}>
                      {saldo >= 0 ? '+' : ''}R$ {Math.abs(saldo).toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tabela completa */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {ranking.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🏆</div>
                <div className="empty-state-title">Ranking ainda vazio</div>
                <div className="empty-state-desc">O ranking aparece após o primeiro jogo ser processado</div>
              </div>
            ) : (
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th style={{ width: 60, textAlign: 'center' }}>#</th>
                    <th>Participante</th>
                    <th style={{ textAlign: 'right' }}>Ganhou</th>
                    <th style={{ textAlign: 'right' }}>Pagou</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const isMe = r.user_id === userId
                    const saldo = r.saldo_final
                    const posClass = i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'
                    const initials = r.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

                    return (
                      <tr key={r.user_id} style={isMe ? { background: 'rgba(34,197,94,0.04)' } : {}}>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`ranking-position ${posClass}`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                          </span>
                        </td>
                        <td>
                          <div className="ranking-user">
                            <div className="ranking-avatar" style={isMe ? { background: 'var(--gradient-gold)' } : {}}>
                              {initials}
                            </div>
                            <div>
                              <div className="ranking-name">
                                {r.nome} {isMe && <span className="badge badge-green" style={{ fontSize: '0.625rem' }}>você</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="amount-positive">R$ {r.total_ganho?.toFixed(2)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="amount-negative">R$ {r.total_pago?.toFixed(2)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={saldo >= 0 ? 'amount-positive' : 'amount-negative'}>
                            {saldo >= 0 ? '+' : ''}R$ {Math.abs(saldo).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
