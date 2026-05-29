import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FOOTBALL_API_URL = 'https://api.football-data.org/v4'
// Copa do Mundo 2026 - ID da competição na football-data.org
const WORLD_CUP_ID = 2000

function mapStatus(status: string): 'AGENDADO' | 'AO_VIVO' | 'ENCERRADO' {
  if (['FINISHED', 'AWARDED'].includes(status)) return 'ENCERRADO'
  if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(status)) return 'AO_VIVO'
  return 'AGENDADO'
}

export async function POST(req: NextRequest) {
  // Verificar secret para segurança
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Permitir chamada do admin (sem secret) ou do cron (com secret)
  const isFromAdmin = req.headers.get('x-admin') === 'true'
  const isFromCron = authHeader === `Bearer ${cronSecret}`

  if (!isFromAdmin && !isFromCron && cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.FOOTBALL_DATA_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'API token not configured' }, { status: 500 })
  }

  try {
    // Buscar partidas da Copa do Mundo na API
    const res = await fetch(`${FOOTBALL_API_URL}/competitions/${WORLD_CUP_ID}/matches`, {
      headers: { 'X-Auth-Token': token },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const matches = data.matches ?? []

    let updated = 0
    let processed = 0

    for (const match of matches) {
      const apiId = match.id
      const status = mapStatus(match.status)
      const goalsCasa = match.score?.fullTime?.home ?? null
      const goalsFora = match.score?.fullTime?.away ?? null

      // Buscar jogo correspondente no banco pelo api_match_id
      const { data: jogoDB } = await supabaseAdmin
        .from('jogos')
        .select('*')
        .eq('api_match_id', apiId)
        .single()

      if (!jogoDB) continue

      // Só atualizar se mudou algo relevante
      if (jogoDB.status === status && jogoDB.gols_casa === goalsCasa && jogoDB.gols_fora === goalsFora) {
        continue
      }

      // Atualizar jogo
      await supabaseAdmin
        .from('jogos')
        .update({
          status,
          gols_casa: goalsCasa,
          gols_fora: goalsFora,
        })
        .eq('id', jogoDB.id)

      updated++

      // Processar resultado se recém-encerrado
      if (status === 'ENCERRADO' && jogoDB.status !== 'ENCERRADO' && goalsCasa !== null && goalsFora !== null) {
        const { error: procError } = await supabaseAdmin.rpc('processar_resultado_jogo', {
          p_jogo_id: jogoDB.id,
        })
        if (!procError) processed++
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      processed,
      message: `${updated} jogos atualizados, ${processed} resultados processados`,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
