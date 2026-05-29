'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const FASES = ['GRUPOS', 'OITAVAS', 'QUARTAS', 'SEMI', 'TERCEIRO', 'FINAL']
const PAISES = [
  { code: 'BR', nome: 'Brasil' }, { code: 'AR', nome: 'Argentina' },
  { code: 'FR', nome: 'França' }, { code: 'DE', nome: 'Alemanha' },
  { code: 'ES', nome: 'Espanha' }, { code: 'PT', nome: 'Portugal' },
  { code: 'IT', nome: 'Itália' }, { code: 'GB', nome: 'Inglaterra' },
  { code: 'US', nome: 'Estados Unidos' }, { code: 'MX', nome: 'México' },
  { code: 'UY', nome: 'Uruguai' }, { code: 'CO', nome: 'Colômbia' },
  { code: 'JP', nome: 'Japão' }, { code: 'KR', nome: 'Coreia do Sul' },
  { code: 'NG', nome: 'Nigéria' }, { code: 'MA', nome: 'Marrocos' },
  { code: 'SN', nome: 'Senegal' }, { code: 'EG', nome: 'Egito' },
  { code: 'AU', nome: 'Austrália' }, { code: 'CA', nome: 'Canadá' },
  { code: 'NL', nome: 'Holanda' }, { code: 'BE', nome: 'Bélgica' },
  { code: 'HR', nome: 'Croácia' }, { code: 'RS', nome: 'Sérvia' },
  { code: 'CH', nome: 'Suíça' }, { code: 'DK', nome: 'Dinamarca' },
  { code: 'PL', nome: 'Polônia' }, { code: 'EC', nome: 'Equador' },
  { code: 'PE', nome: 'Peru' }, { code: 'CL', nome: 'Chile' },
  { code: 'CM', nome: 'Camarões' }, { code: 'GH', nome: 'Gana' },
  { code: 'TN', nome: 'Tunísia' }, { code: 'QA', nome: 'Catar' },
  { code: 'SA', nome: 'Arábia Saudita' }, { code: 'IR', nome: 'Irã' },
]

function getFlagEmoji(code: string | null) {
  if (!code) return '🏳️'
  const flags: Record<string, string> = {
    BR: '🇧🇷', AR: '🇦🇷', FR: '🇫🇷', DE: '🇩🇪', ES: '🇪🇸', PT: '🇵🇹',
    IT: '🇮🇹', GB: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', US: '🇺🇸', MX: '🇲🇽', UY: '🇺🇾', CO: '🇨🇴',
    JP: '🇯🇵', KR: '🇰🇷', NG: '🇳🇬', MA: '🇲🇦', SN: '🇸🇳', EG: '🇪🇬',
    AU: '🇦🇺', CA: '🇨🇦', NL: '🇳🇱', BE: '🇧🇪', HR: '🇭🇷', RS: '🇷🇸',
    CH: '🇨🇭', DK: '🇩🇰', PL: '🇵🇱', EC: '🇪🇨', PE: '🇵🇪', CL: '🇨🇱',
    CM: '🇨🇲', GH: '🇬🇭', TN: '🇹🇳', QA: '🇶🇦', SA: '🇸🇦', IR: '🇮🇷',
  }
  return flags[code.toUpperCase()] ?? '🏳️'
}

const initialForm = {
  time_casa: '', bandeira_casa: '', time_fora: '', bandeira_fora: '',
  fase: 'GRUPOS', grupo: '', data_hora: '', valor_por_participante: '',
}

export default function AdminPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<any>(null)
  const [jogos, setJogos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'jogos' | 'resultados' | 'config'>('jogos')
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [totalParticipantes, setTotalParticipantes] = useState('')
  const [syncing, setSyncing] = useState(false)

  // Resultados: placar manual
  const [scores, setScores] = useState<Map<string, { casa: string; fora: string }>>(new Map())

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async (userId: string) => {
    const [
      { data: perfilData },
      { data: jogosData },
      { data: configData },
    ] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', userId).single(),
      supabase.from('jogos').select('*').order('data_hora', { ascending: true }),
      supabase.from('config').select('*'),
    ])

    if (!perfilData?.is_admin) {
      router.push('/dashboard')
      return
    }

    setPerfil(perfilData)
    setJogos(jogosData ?? [])

    const total = configData?.find(c => c.chave === 'total_participantes')
    setTotalParticipantes(total?.valor ?? '0')
    setLoading(false)
  }, [router])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      loadData(session.user.id)
    })
  }, [router, loadData])

  async function handleAddJogo(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: configData } = await supabase
      .from('config')
      .select('valor')
      .eq('chave', 'total_participantes')
      .single()

    const totalPart = parseInt(configData?.valor ?? '0')
    const valorPart = parseFloat(form.valor_por_participante)
    const poteTotal = valorPart * totalPart

    const { error } = await supabase.from('jogos').insert({
      time_casa: form.time_casa,
      bandeira_casa: form.bandeira_casa,
      time_fora: form.time_fora,
      bandeira_fora: form.bandeira_fora,
      fase: form.fase,
      grupo: form.grupo || null,
      data_hora: form.data_hora,
      valor_por_participante: valorPart,
      pote_acumulado: 0,
      pote_total: poteTotal,
      status: 'AGENDADO',
    })

    if (error) { showToast('Erro ao adicionar jogo: ' + error.message, 'error') }
    else {
      showToast('Jogo adicionado! ⚽')
      setForm(initialForm)
      loadData(perfil.id)
    }
    setSaving(false)
  }

  async function handleUpdateScore(jogoId: string) {
    const s = scores.get(jogoId)
    if (!s) return
    const casa = parseInt(s.casa)
    const fora = parseInt(s.fora)
    if (isNaN(casa) || isNaN(fora)) { showToast('Placar inválido', 'error'); return }

    setUpdating(jogoId)
    const { error } = await supabase
      .from('jogos')
      .update({ gols_casa: casa, gols_fora: fora, status: 'ENCERRADO' })
      .eq('id', jogoId)

    if (error) {
      showToast('Erro ao atualizar placar', 'error')
    } else {
      // Processar resultado via function do banco
      const { error: procError } = await supabase.rpc('processar_resultado_jogo', { p_jogo_id: jogoId })
      if (procError) { showToast('Erro ao processar resultado: ' + procError.message, 'error') }
      else { showToast('Placar atualizado e resultado processado! ✅') }
      loadData(perfil.id)
    }
    setUpdating(null)
  }

  async function handleSetAoVivo(jogoId: string) {
    await supabase.from('jogos').update({ status: 'AO_VIVO' }).eq('id', jogoId)
    showToast('Jogo marcado como Ao Vivo 🔴')
    loadData(perfil.id)
  }

  async function handleSyncFromApi() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-scores', { method: 'POST' })
      const data = await res.json()
      showToast(`Sincronizado! ${data.updated ?? 0} jogos atualizados.`)
      loadData(perfil.id)
    } catch (err) {
      showToast('Erro ao sincronizar com a API', 'error')
    }
    setSyncing(false)
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase
      .from('config')
      .update({ valor: totalParticipantes })
      .eq('chave', 'total_participantes')

    if (error) { showToast('Erro ao salvar configuração', 'error') }
    else { showToast('Configuração salva! ✅') }
  }

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
      <Navbar isAdmin userName={perfil?.nome} />

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        </div>
      )}

      <main className="main-content" style={{ paddingBottom: '3rem' }}>
        <div className="container">
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="hero-eyebrow" style={{ display: 'inline-flex', marginBottom: '0.5rem' }}>⚙️ Painel Admin</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Administração</h1>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <button id="admin-tab-jogos" className={`tab-btn ${tab === 'jogos' ? 'active' : ''}`} onClick={() => setTab('jogos')}>
              ⚽ Cadastrar Jogo
            </button>
            <button id="admin-tab-resultados" className={`tab-btn ${tab === 'resultados' ? 'active' : ''}`} onClick={() => setTab('resultados')}>
              📝 Atualizar Placares
            </button>
            <button id="admin-tab-config" className={`tab-btn ${tab === 'config' ? 'active' : ''}`} onClick={() => setTab('config')}>
              ⚙️ Configurações
            </button>
          </div>

          {/* Cadastrar Jogo */}
          {tab === 'jogos' && (
            <form onSubmit={handleAddJogo} className="admin-form">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem' }}>Novo Jogo</h2>
              <div className="admin-form-grid">
                <div className="form-group">
                  <label className="form-label">Time Casa</label>
                  <input className="form-input" placeholder="Ex: Brasil" value={form.time_casa}
                    onChange={e => setForm(f => ({ ...f, time_casa: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Bandeira Casa (código ISO)</label>
                  <select className="form-input" value={form.bandeira_casa}
                    onChange={e => {
                      const code = e.target.value
                      const pais = PAISES.find(p => p.code === code)
                      setForm(f => ({ ...f, bandeira_casa: code, time_casa: f.time_casa || pais?.nome || '' }))
                    }}>
                    <option value="">Selecionar país</option>
                    {PAISES.map(p => (
                      <option key={p.code} value={p.code}>{getFlagEmoji(p.code)} {p.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Time Fora</label>
                  <input className="form-input" placeholder="Ex: Argentina" value={form.time_fora}
                    onChange={e => setForm(f => ({ ...f, time_fora: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Bandeira Fora (código ISO)</label>
                  <select className="form-input" value={form.bandeira_fora}
                    onChange={e => {
                      const code = e.target.value
                      const pais = PAISES.find(p => p.code === code)
                      setForm(f => ({ ...f, bandeira_fora: code, time_fora: f.time_fora || pais?.nome || '' }))
                    }}>
                    <option value="">Selecionar país</option>
                    {PAISES.map(p => (
                      <option key={p.code} value={p.code}>{getFlagEmoji(p.code)} {p.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fase</label>
                  <select className="form-input" value={form.fase}
                    onChange={e => setForm(f => ({ ...f, fase: e.target.value }))}>
                    {FASES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Grupo (opcional)</label>
                  <input className="form-input" placeholder="A, B, C..." value={form.grupo}
                    onChange={e => setForm(f => ({ ...f, grupo: e.target.value.toUpperCase() }))}
                    maxLength={1} />
                </div>
                <div className="form-group">
                  <label className="form-label">Data e Hora</label>
                  <input type="datetime-local" className="form-input" value={form.data_hora}
                    onChange={e => setForm(f => ({ ...f, data_hora: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Valor por participante (R$)</label>
                  <input type="number" className="form-input" placeholder="10.00" min="0.01" step="0.01"
                    value={form.valor_por_participante}
                    onChange={e => setForm(f => ({ ...f, valor_por_participante: e.target.value }))} required />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button id="add-jogo-btn" type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading-spinner" /> : '⚽'} Adicionar Jogo
                </button>
              </div>
            </form>
          )}

          {/* Atualizar Placares */}
          {tab === 'resultados' && (
            <div>
              <div className="admin-actions-bar">
                <div>
                  <div style={{ fontWeight: 600 }}>Atualização Automática</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Sincroniza placares com football-data.org
                  </div>
                </div>
                <button id="sync-api-btn" className="btn btn-primary" onClick={handleSyncFromApi} disabled={syncing}>
                  {syncing ? <span className="loading-spinner" /> : '🔄'} Sincronizar Agora
                </button>
              </div>

              <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--color-text-subtle)' }}>
                Ou atualize manualmente:
              </div>

              {jogos.filter(j => j.status !== 'ENCERRADO').length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-title">Todos os jogos encerrados</div>
                </div>
              ) : (
                <div className="games-grid">
                  {jogos.filter(j => j.status !== 'ENCERRADO').map(jogo => {
                    const s = scores.get(jogo.id) ?? { casa: '', fora: '' }
                    const isUpd = updating === jogo.id

                    return (
                      <div key={jogo.id} className="game-card">
                        <div className="game-card-phase">
                          <span className={`phase-badge ${jogo.fase?.toLowerCase()}`}>
                            {jogo.fase}{jogo.grupo ? ` · G${jogo.grupo}` : ''}
                          </span>
                          <span className={`game-status-badge ${jogo.status === 'AO_VIVO' ? 'ao-vivo' : 'agendado'}`}>
                            {jogo.status === 'AO_VIVO' ? '🔴 Ao Vivo' : '📅 Agendado'}
                          </span>
                        </div>
                        <div className="game-teams">
                          <div className="team">
                            <span className="team-flag">{getFlagEmoji(jogo.bandeira_casa)}</span>
                            <span className="team-name">{jogo.time_casa}</span>
                          </div>
                          <div className="game-score">
                            <div className="score-display" style={{ fontSize: '0.875rem' }}>VS</div>
                            <span className="game-time">
                              {format(new Date(jogo.data_hora), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="team">
                            <span className="team-flag">{getFlagEmoji(jogo.bandeira_fora)}</span>
                            <span className="team-name">{jogo.time_fora}</span>
                          </div>
                        </div>
                        <div className="palpite-section">
                          <div className="palpite-label">Placar final (tempo regular)</div>
                          <div className="palpite-inputs">
                            <input
                              id={`score-casa-${jogo.id}`}
                              type="number" className="palpite-input" min={0} max={99} placeholder="0"
                              value={s.casa}
                              onChange={e => setScores(prev => new Map(prev).set(jogo.id, { ...s, casa: e.target.value }))}
                            />
                            <span className="palpite-sep">×</span>
                            <input
                              id={`score-fora-${jogo.id}`}
                              type="number" className="palpite-input" min={0} max={99} placeholder="0"
                              value={s.fora}
                              onChange={e => setScores(prev => new Map(prev).set(jogo.id, { ...s, fora: e.target.value }))}
                            />
                          </div>
                          <div className="palpite-actions" style={{ gap: '0.5rem', flexDirection: 'column' }}>
                            {jogo.status === 'AGENDADO' && (
                              <button
                                id={`mark-live-${jogo.id}`}
                                className="btn btn-secondary btn-sm btn-full"
                                onClick={() => handleSetAoVivo(jogo.id)}
                              >
                                🔴 Marcar Ao Vivo
                              </button>
                            )}
                            <button
                              id={`save-score-${jogo.id}`}
                              className="btn btn-primary btn-sm btn-full"
                              onClick={() => handleUpdateScore(jogo.id)}
                              disabled={isUpd}
                            >
                              {isUpd ? <span className="loading-spinner" /> : '✅'} Encerrar e Processar
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Config */}
          {tab === 'config' && (
            <form onSubmit={handleSaveConfig} className="admin-form" style={{ maxWidth: 480 }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem' }}>Configurações Gerais</h2>
              <div className="form-group">
                <label className="form-label">Total de participantes no bolão</label>
                <input
                  id="config-total-participantes"
                  type="number" className="form-input" min={1}
                  value={totalParticipantes}
                  onChange={e => setTotalParticipantes(e.target.value)}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Este valor é usado para calcular o pote de cada jogo
                </span>
              </div>
              <button id="save-config-btn" type="submit" className="btn btn-primary">
                💾 Salvar Configurações
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
