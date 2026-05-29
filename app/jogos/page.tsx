'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function getFlagEmoji(code: string | null) {
  if (!code) return '🏳️'
  const flags: Record<string, string> = {
    BR: '🇧🇷', AR: '🇦🇷', FR: '🇫🇷', DE: '🇩🇪', ES: '🇪🇸', PT: '🇵🇹',
    IT: '🇮🇹', GB: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', US: '🇺🇸', MX: '🇲🇽', UY: '🇺🇾', CO: '🇨🇴',
    JP: '🇯🇵', KR: '🇰🇷', NG: '🇳🇬', MA: '🇲🇦', SN: '🇸🇳', EG: '🇪🇬',
    AU: '🇦🇺', CA: '🇨🇦', NL: '🇳🇱', BE: '🇧🇪', HR: '🇭🇷', CH: '🇨🇭',
    EC: '🇪🇨', PE: '🇵🇪', CL: '🇨🇱', CM: '🇨🇲', GH: '🇬🇭', TN: '🇹🇳',
  }
  return flags[code.toUpperCase()] ?? '🏳️'
}

export default function JogosPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<any>(null)
  const [jogos, setJogos] = useState<any[]>([])
  const [allPalpites, setAllPalpites] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJogo, setSelectedJogo] = useState<string | null>(null)
  const [faseFilter, setFaseFilter] = useState('TODOS')

  const loadData = useCallback(async (userId: string) => {
    const [
      { data: perfilData },
      { data: jogosData },
      { data: palpitesData },
      { data: usersData },
    ] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', userId).single(),
      supabase.from('jogos').select('*').order('data_hora', { ascending: true }),
      supabase.from('palpites').select('*'),
      supabase.from('usuarios').select('id, nome'),
    ])

    setPerfil(perfilData)
    setJogos(jogosData ?? [])
    setAllPalpites(palpitesData ?? [])
    setUsuarios(usersData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      loadData(session.user.id)
    })
  }, [router, loadData])

  const fases = ['TODOS', ...Array.from(new Set(jogos.map(j => j.fase)))]
  const filteredJogos = faseFilter === 'TODOS' ? jogos : jogos.filter(j => j.fase === faseFilter)

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
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Tabela de Jogos ⚽</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Todos os jogos da Copa — clique para ver os palpites dos participantes
            </p>
          </div>

          {/* Filtros */}
          <div className="tabs" style={{ flexWrap: 'wrap', width: '100%' }}>
            {fases.map(fase => (
              <button
                key={fase}
                className={`tab-btn ${faseFilter === fase ? 'active' : ''}`}
                onClick={() => setFaseFilter(fase)}
              >
                {fase}
              </button>
            ))}
          </div>

          <div className="games-grid">
            {filteredJogos.map(jogo => {
              const jogoPalpites = allPalpites.filter(p => p.jogo_id === jogo.id)
              const isOpen = selectedJogo === jogo.id
              const acertadores = jogoPalpites.filter(p => p.acertou_exato)

              return (
                <div key={jogo.id}>
                  <div
                    className={`game-card ${jogo.status === 'ENCERRADO' ? 'encerrado' : ''}`}
                    style={{ cursor: jogo.status === 'ENCERRADO' ? 'pointer' : 'default' }}
                    onClick={() => jogo.status === 'ENCERRADO' && setSelectedJogo(isOpen ? null : jogo.id)}
                  >
                    {/* Header */}
                    <div className="game-card-phase">
                      <span className={`phase-badge ${jogo.fase?.toLowerCase()}`}>
                        {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {jogo.pote_acumulado > 0 && (
                          <span className="badge badge-gold">🔥 Acumulado</span>
                        )}
                        <span className={`game-status-badge ${jogo.status === 'AO_VIVO' ? 'ao-vivo' : jogo.status === 'ENCERRADO' ? 'encerrado' : 'agendado'}`}>
                          {jogo.status === 'AO_VIVO' ? '🔴 Ao Vivo' : jogo.status === 'ENCERRADO' ? '✅ Enc.' : '📅 Agend.'}
                        </span>
                      </div>
                    </div>

                    {/* Times e placar */}
                    <div className="game-teams">
                      <div className="team">
                        <span className="team-flag">{getFlagEmoji(jogo.bandeira_casa)}</span>
                        <span className="team-name">{jogo.time_casa}</span>
                      </div>
                      <div className="game-score">
                        {jogo.status !== 'AGENDADO' ? (
                          <div className="score-display" style={{ color: jogo.status === 'AO_VIVO' ? 'var(--color-red)' : undefined }}>
                            {jogo.gols_casa ?? 0} – {jogo.gols_fora ?? 0}
                          </div>
                        ) : (
                          <div className="score-display" style={{ fontSize: '0.875rem' }}>VS</div>
                        )}
                        <span className="game-time">
                          {format(new Date(jogo.data_hora), "dd/MM · HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="team">
                        <span className="team-flag">{getFlagEmoji(jogo.bandeira_fora)}</span>
                        <span className="team-name">{jogo.time_fora}</span>
                      </div>
                    </div>

                    {/* Pote e info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                      <div className="pot-display" style={{ fontSize: '0.75rem' }}>
                        🏆 Pote: R$ {jogo.pote_total?.toFixed(2) || jogo.valor_por_participante?.toFixed(2) || '0.00'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {jogoPalpites.length} palpite{jogoPalpites.length !== 1 ? 's' : ''}
                        {jogo.status === 'ENCERRADO' && <span style={{ marginLeft: '0.25rem' }}>• clique para ver</span>}
                      </div>
                    </div>

                    {/* Palpites expandidos (só jogos encerrados) */}
                    {isOpen && (
                      <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Palpites dos participantes
                        </div>
                        {usuarios.map(u => {
                          const p = jogoPalpites.find(pp => pp.user_id === u.id)
                          const initials = u.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                          return (
                            <div key={u.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div className="ranking-avatar" style={{ width: 28, height: 28, fontSize: '0.6875rem' }}>{initials}</div>
                                <span style={{ fontSize: '0.875rem' }}>{u.nome}</span>
                              </div>
                              {p ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{
                                    fontFamily: 'Outfit', fontWeight: 700,
                                    color: p.acertou_exato ? 'var(--color-primary)' : 'var(--color-text-subtle)'
                                  }}>
                                    {p.palpite_casa} – {p.palpite_fora}
                                  </span>
                                  {p.acertou_exato && <span>🎉</span>}
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-red)' }}>Sem palpite</span>
                              )}
                            </div>
                          )
                        })}
                        {acertadores.length > 0 && (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--color-primary-dim)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                            🏆 Pote de R$ {jogo.pote_total?.toFixed(2)} dividido entre {acertadores.length} ganhador{acertadores.length > 1 ? 'es' : ''}
                          </div>
                        )}
                        {acertadores.length === 0 && (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--color-gold-dim)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                            🔥 Ninguém acertou — pote acumulado!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
