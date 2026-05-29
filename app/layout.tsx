import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bolão Copa do Mundo 2026 ⚽',
  description: 'Sistema de bolão para Copa do Mundo 2026. Faça seus palpites, acompanhe o ranking e gerencie o financeiro do seu grupo.',
  keywords: ['bolão', 'copa do mundo', '2026', 'futebol', 'palpites'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
