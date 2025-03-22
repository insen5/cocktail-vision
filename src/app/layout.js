import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Cocktail Vision with AI',
  description: 'by insen',
  openGraph: {
    title: 'Cocktail Vision with AI',
    description: 'by insen',
    siteName: 'Cocktail Vision with AI'
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}