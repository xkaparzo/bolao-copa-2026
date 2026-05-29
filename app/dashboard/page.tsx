'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Stats {
  totalJogos: number
  jogosEncerrados: number
  totalAcertos: number
  saldoFinal: number
  poteAcumulado: number
  proximoJogo: any
}

interface RecentGame {
  id: string
  time_casa: string
  time_fora: string
  bandeira_casa: string
  bandeira_fora: string
  gols_casa: number | null
  gols_fora: number | null
  data_hora: string
  status: string
  fase: string
  pote_total: number
  palpite?: { palpite_casa: number; palpite_fora: number; acertou_exato: boolean | null }
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentGames, setRecentGames] = useState<RecentGame[]>([])
  const [topRanking, setTopRanking] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (userId: string) => {
    try {
      // Buscar perfil
      const { data: perfilData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()
      setPerfil(perfilData)

      // Stats dos jogos
      const { data: jogos } = await supabase.from('jogos').select('*').order('data_hora', { ascending: true })
      const { data: palpites } = await supabase.from('palpites').select('*').eq('user_id', userId)
      const { data: financeiro } = await supabase.from('financeiro').select('*').eq('user_id', userId)

      const jogosEncerrados = jogos?.filter(j => j.status === 'ENCERRADO') ?? []
      const acertos = palpites?.filter(p => p.acertou_exato) ?? []

      const creditos = financeiro?.filter(f => f.tipo === 'CREDITO').reduce((sum, f) => sum + f.valor, 0) ?? 0
      const debitos = financeiro?.filter(f => f.tipo === 'DEBITO').reduce((sum, f) => sum + f.valor, 0) ?? 0

      const poteAcumulado = jogos?.reduce((sum, j) => sum + (j.pote_acumulado || 0), 0) ?? 0
      const proximoJogo = jogos?.find(j => j.status === 'AGENDADO' && new Date(j.data_hora) > new Date())

      setStats({
        totalJogos: jogos?.length ?? 0,
        jogosEncerrados: jogosEncerrados.length,
        totalAcertos: acertos.length,
        saldoFinal: creditos - debitos,
        poteAcumulado,
        proximoJogo,
      })

      // Jogos recentes (últimos 3 encerrados + próximos 3)
      const recent = [
        ...(jogos?.filter(j => j.status === 'ENCERRADO').slice(-2) ?? []),
        ...(jogos?.filter(j => j.status === 'AGENDADO').slice(0, 3) ?? []),
      ]

      const palpitesMap = new Map(palpites?.map(p => [p.jogo_id, p]))
      setRecentGames(recent.map(j => ({ ...j, palpite: palpitesMap.get(j.id) })))

      // Top ranking
      const { data: saldos } = await supabase.from('saldos_usuarios').select('*').limit(5)
      setTopRanking(saldos ?? [])

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      setUser(session.user)
      loadData(session.user.id)
    })
  }, [router, loadData])

  if (loading) {
    return (
      <div className="page-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>⚽</div>
          <div className="loading-spinner" style={{ width: 32, height: 32, borderTopColor: 'var(--color-primary)' }} />
        </div>
      </div>
    )
  }

  const saldo = stats?.saldoFinal ?? 0

  return (
    <div className="page-wrapper">
      <Navbar isAdmin={perfil?.is_admin} userName={perfil?.nome} />

      <main className="main-content" style={{ paddingBottom: '5rem' }}>
        <div className="container">
          {/* Hero greeting */}
          <div className="hero" style={{ textAlign: 'left', padding: '2rem 0 1.5rem' }}>
            <div className="hero-eyebrow">⚽ Copa do Mundo 2026</div>
            <h1 className="hero-title" style={{ fontSize: 'clamp(1.75rem,4vw,2.5rem)' }}>
              Olá, {perfil?.nome?.split(' ')[0] ?? 'Participante'}! 👋
            </h1>
            <p style={{ color: 'var(--color-text-subtle)', marginTop: '0.5rem' }}>
              Aqui está o resumo do seu bolão
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid-4" style={{ marginBottom: '2rem' }}>
            <div className="stat-card green">
              <div className="stat-icon green">🎯</div>
              <div className="stat-value green">{stats?.totalAcertos ?? 0}</div>
              <div className="stat-label">Placares exatos</div>
            </div>
            <div className={`stat-card ${saldo >= 0 ? 'green' : 'red'}`}>
              <div className={`stat-icon ${saldo >= 0 ? 'green' : 'red'}`}>
                {saldo >= 0 ? '💰' : '📉'}
              </div>
              <div className={`stat-value ${saldo >= 0 ? 'green' : 'red'}`}>
                {saldo >= 0 ? '+' : ''}R$ {Math.abs(saldo).toFixed(2)}
              </div>
              <div className="stat-label">
                {saldo >= 0 ? 'A receber' : 'A pagar'}
              </div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon blue">⚽</div>
              <div className="stat-value blue">{stats?.jogosEncerrados ?? 0}</div>
              <div className="stat-label">Jogos encerrados</div>
            </div>
            <div className="stat-card gold">
              <div className="stat-icon gold">🏆</div>
              <div className="stat-value gold">R$ {((stats?.poteAcumulado) ?? 0).toFixed(2)}</div>
              <div className="stat-label">Pote acumulado</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Próximo jogo */}
            <div>
              <div className="section-header">
                <h2 className="section-title">Próximo Jogo</h2>
                <Link href="/palpites" className="btn btn-sm btn-secondary">Ver todos →</Link>
              </div>
              {stats?.proximoJogo ? (
                <div className="game-card" style={{ marginBottom: '1rem' }}>
                  <div className="game-card-phase">
                    <span className={`phase-badge ${stats.proximoJogo.fase?.toLowerCase()}`}>
                      {stats.proximoJogo.fase} {stats.proximoJogo.grupo ? `- Grupo ${stats.proximoJogo.grupo}` : ''}
                    </span>
                    <div className="pot-display" style={{ fontSize: '0.75rem' }}>
                      🏆 R$ {stats.proximoJogo.pote_total?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div className="game-teams">
                    <div className="team">
                      <span className="team-flag">{getFlagEmoji(stats.proximoJogo.bandeira_casa)}</span>
                      <span className="team-name">{stats.proximoJogo.time_casa}</span>
                    </div>
                    <div className="game-score">
                      <div className="score-display" style={{ fontSize: '1.25rem', padding: '0.25rem 0.75rem' }}>VS</div>
                      <span className="game-time">
                        {format(new Date(stats.proximoJogo.data_hora), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="team">
                      <span className="team-flag">{getFlagEmoji(stats.proximoJogo.bandeira_fora)}</span>
                      <span className="team-name">{stats.proximoJogo.time_fora}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Link href="/palpites" className="btn btn-primary btn-sm">
                      🎯 Fazer palpite
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="card empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-title">Nenhum jogo agendado</div>
                  <div className="empty-state-desc">Todos os jogos foram encerrados</div>
                </div>
              )}

              {/* Jogos recentes encerrados */}
              <div className="section-header" style={{ marginTop: '1.5rem' }}>
                <h2 className="section-title">Resultados Recentes</h2>
              </div>
              {recentGames.filter(g => g.status === 'ENCERRADO').map(jogo => (
                <div key={jogo.id} className="game-card encerrado" style={{ marginBottom: '0.75rem' }}>
                  <div className="game-card-phase">
                    <span className={`phase-badge ${jogo.fase?.toLowerCase()}`}>{jogo.fase}</span>
                    {jogo.palpite?.acertou_exato && (
                      <span className="badge badge-green">🎉 Acertou!</span>
                    )}
                    {jogo.palpite && !jogo.palpite?.acertou_exato && (
                      <span className="badge badge-gray">Errou</span>
                    )}
                  </div>
                  <div className="game-teams">
                    <div className="team">
                      <span className="team-flag">{getFlagEmoji(jogo.bandeira_casa)}</span>
                      <span className="team-name">{jogo.time_casa}</span>
                    </div>
                    <div className="game-score">
                      <div className="score-display">
                        {jogo.gols_casa} – {jogo.gols_fora}
                      </div>
                      {jogo.palpite && (
                        <span className="game-time">
                          Seu palpite: {jogo.palpite.palpite_casa}–{jogo.palpite.palpite_fora}
                        </span>
                      )}
                    </div>
                    <div className="team">
                      <span className="team-flag">{getFlagEmoji(jogo.bandeira_fora)}</span>
                      <span className="team-name">{jogo.time_fora}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top ranking */}
            <div>
              <div className="section-header">
                <h2 className="section-title">Ranking</h2>
                <Link href="/ranking" className="btn btn-sm btn-secondary">Ver completo →</Link>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {topRanking.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">🏆</div>
                    <div className="empty-state-title">Nenhum resultado ainda</div>
                    <div className="empty-state-desc">O ranking aparece após o primeiro jogo</div>
                  </div>
                ) : (
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Participante</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRanking.map((p, i) => {
                        const isMe = p.user_id === user?.id
                        const posClass = i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'
                        const initials = p.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                        return (
                          <tr key={p.user_id} style={isMe ? { background: 'rgba(34,197,94,0.05)' } : {}}>
                            <td>
                              <span className={`ranking-position ${posClass}`}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                              </span>
                            </td>
                            <td>
                              <div className="ranking-user">
                                <div className="ranking-avatar" style={isMe ? { background: 'var(--gradient-gold)' } : {}}>
                                  {initials}
                                </div>
                                <span className="ranking-name">
                                  {p.nome} {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>(você)</span>}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={p.saldo_final > 0 ? 'amount-positive' : p.saldo_final < 0 ? 'amount-negative' : 'amount-neutral'}>
                                {p.saldo_final > 0 ? '+' : ''}R$ {Math.abs(p.saldo_final).toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Saldo pessoal */}
              <div className="card" style={{ marginTop: '1rem', background: saldo >= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', borderColor: saldo >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                      Seu saldo final
                    </div>
                    <div style={{ fontSize: '2rem', fontFamily: 'Outfit', fontWeight: 800, color: saldo >= 0 ? 'var(--color-primary)' : 'var(--color-red)' }}>
                      {saldo >= 0 ? '+' : ''}R$ {Math.abs(saldo).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      {saldo >= 0 ? '✅ Você tem a receber' : '❗ Você tem a pagar'}
                    </div>
                  </div>
                  <div style={{ fontSize: '3rem' }}>{saldo >= 0 ? '💰' : '💸'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function getFlagEmoji(code: string | null) {
  if (!code) return '🏳️'
  const flags: Record<string, string> = {
    BR: '🇧🇷', AR: '🇦🇷', FR: '🇫🇷', DE: '🇩🇪', ES: '🇪🇸', PT: '🇵🇹',
    IT: '🇮🇹', GB: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', US: '🇺🇸', MX: '🇲🇽', UY: '🇺🇾', CO: '🇨🇴',
    JP: '🇯🇵', KR: '🇰🇷', NG: '🇳🇬', MA: '🇲🇦', SN: '🇸🇳', EG: '🇪🇬',
    AU: '🇦🇺', NZ: '🇳🇿', CA: '🇨🇦', NL: '🇳🇱', BE: '🇧🇪', HR: '🇭🇷',
    RS: '🇷🇸', CH: '🇨🇭', DK: '🇩🇰', SE: '🇸🇪', NO: '🇳🇴', PL: '🇵🇱',
    CZ: '🇨🇿', AT: '🇦🇹', TR: '🇹🇷', IR: '🇮🇷', SA: '🇸🇦', QA: '🇶🇦',
    EC: '🇪🇨', PE: '🇵🇪', VE: '🇻🇪', CL: '🇨🇱', BO: '🇧🇴', PY: '🇵🇾',
    CM: '🇨🇲', GH: '🇬🇭', CI: '🇨🇮', TN: '🇹🇳',
  }
  return flags[code.toUpperCase()] ?? '🏳️'
}
