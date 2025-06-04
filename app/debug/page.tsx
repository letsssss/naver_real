"use client"

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        const supabase = await getSupabaseClient()
        
        // 세션 정보 가져오기
        const { data: { session }, error } = await supabase.auth.getSession()
        
        setDebugInfo({
          session: session ? {
            user: session.user,
            access_token: session.access_token ? session.access_token.substring(0, 20) + '...' : null,
            expires_at: session.expires_at
          } : null,
          error: error?.message || null,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        setDebugInfo({
          error: 'Debug info loading failed',
          timestamp: new Date().toISOString()
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDebugInfo()
  }, [])

  if (loading) {
    return <div className="p-4">Loading debug info...</div>
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  )
} 