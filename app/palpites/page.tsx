'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const FASES = ['TODOS', 'GRUPOS', 'OITAVAS', 'QUARTAS', 'SEMI', 'TERCEIRO', 'FINAL']

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

export default function PalpitesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [jogos, setJogos] = useState<any[]>([])
  const [palpites, setPalpites] = useState<Map<string, any>>(new Map())
  const [inputValues, setInputValues] = useState<Map<string, { casa: string; fora: string }>>(new Map())
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [faseFilter, setFaseFilter] = useState('TODOS')
  const [loading, setLoading] = useState(true)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function isDeadlinePassed(dataHora: string) {
    return new Date(dataHora).getTime() - Date.now() < 5 * 60 * 1000
  }

  const loadData = useCallback(async (userId: string) => {
    const [{ data: jogosData }, { data: palpitesData }, { data: perfilData }] = await Promise.all([
      supabase.from('jogos').select('*').order('data_hora', { ascending: true }),
      supabase.from('palpites').select('*').eq('user_id', userId),
      supabase.from('usuarios').select('*').eq('id', userId).single(),
    ])

    setJogos(jogosData ?? [])
    setPerfil(perfilData)

    const pMap = new Map(palpitesData?.map(p => [p.jogo_id, p]))
    setPalpites(pMap)

    // Preencher inputs com palpites existentes
    const inputs = new Map<string, { casa: string; fora: string }>()
    palpitesData?.forEach(p => {
      inputs.set(p.jogo_id, { casa: String(p.palpite_casa), fora: String(p.palpite_fora) })
    })
    setInputValues(inputs)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      setUser(session.user)
      loadData(session.user.id)
    })
  }, [router, loadData])

  async function handleSavePalpite(jogoId: string) {
    const vals = inputValues.get(jogoId)
    if (!vals) return

    const casa = parseInt(vals.casa)
    const fora = parseInt(vals.fora)

    if (isNaN(casa) || isNaN(fora) || casa < 0 || fora < 0) {
      showToast('Informe um placar válido (números ≥ 0)', 'error')
      return
    }

    setSaving(prev => new Set(prev).add(jogoId))

    const existing = palpites.get(jogoId)

    if (existing) {
      const { error } = await supabase
        .from('palpites')
        .update({ palpite_casa: casa, palpite_fora: fora })
        .eq('id', existing.id)
      if (error) { showToast('Erro ao salvar palpite', 'error') }
      else { showToast('Palpite atualizado! ✅') }
    } else {
      const { error } = await supabase
        .from('palpites')
        .insert({ user_id: user.id, jogo_id: jogoId, palpite_casa: casa, palpite_fora: fora })
      if (error) { showToast('Erro ao salvar palpite', 'error') }
      else { showToast('Palpite salvo! 🎯') }
    }

    setSaving(prev => { const s = new Set(prev); s.delete(jogoId); return s })
    loadData(user.id)
  }

  const filteredJogos = faseFilter === 'TODOS'
    ? jogos
    : jogos.filter(j => j.fase === faseFilter)

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

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        </div>
      )}

      <main className="main-content" style={{ paddingBottom: '5rem' }}>
        <div className="container">
          <div className="section-header" style={{ marginBottom: '0.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Meus Palpites 🎯</h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Insira o placar exato do tempo regular. Prazo: 5 minutos antes de cada jogo.
              </p>
            </div>
          </div>

          {/* Filtro por fase */}
          <div className="tabs" style={{ flexWrap: 'wrap', width: '100%', marginBottom: '1.5rem' }}>
            {FASES.map(fase => (
              <button
                key={fase}
                id={`tab-${fase.toLowerCase()}`}
                className={`tab-btn ${faseFilter === fase ? 'active' : ''}`}
                onClick={() => setFaseFilter(fase)}
              >
                {fase}
              </button>
            ))}
          </div>

          {filteredJogos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚽</div>
              <div className="empty-state-title">Nenhum jogo nessa fase</div>
              <div className="empty-state-desc">Selecione outra fase ou aguarde o cadastro dos jogos</div>
            </div>
          ) : (
            <div className="games-grid">
              {filteredJogos.map(jogo => {
                const palpite = palpites.get(jogo.id)
                const inputs = inputValues.get(jogo.id) ?? { casa: '', fora: '' }
                const blocked = jogo.status !== 'AGENDADO' || isDeadlinePassed(jogo.data_hora)
                const isSaving = saving.has(jogo.id)
                const hasPalpite = !!palpite
                const acertou = palpite?.acertou_exato === true

                return (
                  <div key={jogo.id} className={`game-card ${hasPalpite && !blocked ? 'has-bet' : ''} ${jogo.status === 'ENCERRADO' ? 'encerrado' : ''}`}>
                    {/* Header */}
                    <div className="game-card-phase">
                      <span className={`phase-badge ${jogo.fase?.toLowerCase()}`}>
                        {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {jogo.pote_acumulado > 0 && (
                          <div className="pot-display accumulated" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6875rem' }}>
                            🔥 Acumulado
                          </div>
                        )}
                        <div className="pot-display" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6875rem' }}>
                          🏆 R$ {(jogo.pote_total || jogo.valor_por_participante)?.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Times */}
                    <div className="game-teams">
                      <div className="team">
                        <span className="team-flag">{getFlagEmoji(jogo.bandeira_casa)}</span>
                        <span className="team-name">{jogo.time_casa}</span>
                      </div>
                      <div className="game-score">
                        {jogo.status === 'ENCERRADO' ? (
                          <div className="score-display">{jogo.gols_casa} – {jogo.gols_fora}</div>
                        ) : jogo.status === 'AO_VIVO' ? (
                          <div className="score-display" style={{ color: 'var(--color-red)' }}>
                            {jogo.gols_casa ?? 0} – {jogo.gols_fora ?? 0}
                          </div>
                        ) : (
                          <div className="score-display" style={{ fontSize: '0.875rem' }}>VS</div>
                        )}
                        <span className="game-time">
                          {format(new Date(jogo.data_hora), "dd/MM · HH:mm", { locale: ptBR })}
                        </span>
                        <span className={`game-status-badge ${jogo.status === 'AO_VIVO' ? 'ao-vivo' : jogo.status === 'ENCERRADO' ? 'encerrado' : 'agendado'}`}>
                          {jogo.status === 'AO_VIVO' ? '🔴 Ao Vivo' : jogo.status === 'ENCERRADO' ? 'Encerrado' : 'Agendado'}
                        </span>
                      </div>
                      <div className="team">
                        <span className="team-flag">{getFlagEmoji(jogo.bandeira_fora)}</span>
                        <span className="team-name">{jogo.time_fora}</span>
                      </div>
                    </div>

                    {/* Palpite */}
                    <div className="palpite-section">
                      <div className="palpite-label">
                        {blocked && jogo.status === 'ENCERRADO' ? 'Resultado final' :
                          blocked ? '🔒 Palpites encerrados' : '🎯 Seu palpite'}
                      </div>

                      {jogo.status === 'ENCERRADO' && palpite ? (
                        <div className={`palpite-result ${acertou ? 'acertou' : 'errou'}`}>
                          {acertou
                            ? `🎉 Acertou! Palpite: ${palpite.palpite_casa}–${palpite.palpite_fora} • Ganhou R$ ${palpite.ganho?.toFixed(2)}`
                            : `❌ Palpite: ${palpite.palpite_casa}–${palpite.palpite_fora}`
                          }
                        </div>
                      ) : jogo.status === 'ENCERRADO' && !palpite ? (
                        <div className="palpite-result errou">❌ Sem palpite — R$ {jogo.valor_por_participante?.toFixed(2)} debitado</div>
                      ) : blocked ? (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          {palpite ? `Seu palpite: ${palpite.palpite_casa} – ${palpite.palpite_fora}` : 'Sem palpite registrado'}
                        </div>
                      ) : (
                        <>
                          <div className="palpite-inputs">
                            <input
                              id={`palpite-casa-${jogo.id}`}
                              type="number"
                              className="palpite-input"
                              min={0}
                              max={99}
                              placeholder="0"
                              value={inputs.casa}
                              onChange={e => setInputValues(prev => new Map(prev).set(jogo.id, { ...inputs, casa: e.target.value }))}
                              disabled={blocked}
                            />
                            <span className="palpite-sep">×</span>
                            <input
                              id={`palpite-fora-${jogo.id}`}
                              type="number"
                              className="palpite-input"
                              min={0}
                              max={99}
                              placeholder="0"
                              value={inputs.fora}
                              onChange={e => setInputValues(prev => new Map(prev).set(jogo.id, { ...inputs, fora: e.target.value }))}
                              disabled={blocked}
                            />
                          </div>
                          <div className="palpite-actions">
                            <button
                              id={`save-palpite-${jogo.id}`}
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSavePalpite(jogo.id)}
                              disabled={isSaving || blocked}
                            >
                              {isSaving ? <span className="loading-spinner" /> : hasPalpite ? '✏️ Atualizar' : '💾 Salvar'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
