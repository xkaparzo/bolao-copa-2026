import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string
          nome: string
          email: string
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id: string
          nome: string
          email: string
          is_admin?: boolean
        }
        Update: {
          nome?: string
          is_admin?: boolean
        }
      }
      jogos: {
        Row: {
          id: string
          fase: string
          grupo: string | null
          time_casa: string
          time_fora: string
          bandeira_casa: string | null
          bandeira_fora: string | null
          data_hora: string
          gols_casa: number | null
          gols_fora: number | null
          status: 'AGENDADO' | 'AO_VIVO' | 'ENCERRADO'
          valor_por_participante: number
          pote_acumulado: number
          pote_total: number
          api_match_id: number | null
          created_at: string
        }
        Insert: {
          fase: string
          grupo?: string
          time_casa: string
          time_fora: string
          bandeira_casa?: string
          bandeira_fora?: string
          data_hora: string
          valor_por_participante: number
          pote_acumulado?: number
          api_match_id?: number
          status?: 'AGENDADO' | 'AO_VIVO' | 'ENCERRADO'
        }
        Update: {
          gols_casa?: number
          gols_fora?: number
          status?: 'AGENDADO' | 'AO_VIVO' | 'ENCERRADO'
          pote_acumulado?: number
          pote_total?: number
        }
      }
      palpites: {
        Row: {
          id: string
          user_id: string
          jogo_id: string
          palpite_casa: number
          palpite_fora: number
          acertou_exato: boolean | null
          ganho: number | null
          created_at: string
        }
        Insert: {
          user_id: string
          jogo_id: string
          palpite_casa: number
          palpite_fora: number
        }
        Update: {
          palpite_casa?: number
          palpite_fora?: number
          acertou_exato?: boolean
          ganho?: number
        }
      }
      financeiro: {
        Row: {
          id: string
          user_id: string
          jogo_id: string
          tipo: 'DEBITO' | 'CREDITO'
          valor: number
          descricao: string
          created_at: string
        }
        Insert: {
          user_id: string
          jogo_id: string
          tipo: 'DEBITO' | 'CREDITO'
          valor: number
          descricao: string
        }
      }
      config: {
        Row: {
          chave: string
          valor: string
        }
        Insert: {
          chave: string
          valor: string
        }
        Update: {
          valor?: string
        }
      }
    }
  }
}
