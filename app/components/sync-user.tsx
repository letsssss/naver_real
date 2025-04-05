"use client"

import { useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

export function SyncUser() {
  useEffect(() => {
    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Supabase 환경 변수가 설정되지 않았습니다. 사용자 동기화를 건너뜁니다.')
      return
    }

    try {
      const supabase = createClientComponentClient()
      
      const sync = async () => {
        try {
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          
          if (userError || !user) {
            console.log('🔍 로그인한 사용자가 없거나 오류 발생:', userError?.message)
            return
          }

          const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle()

          if (error) {
            console.error('❌ 사용자 조회 중 오류 발생:', error.message)
            return
          }

          if (!data) {
            try {
              const insertResult = await supabase.from('users').insert({
                id: user.id,
                email: user.email,
                name: user.user_metadata?.name ?? '',
                role: 'USER',
              })
              
              if (insertResult.error) {
                console.error('❌ 사용자 등록 중 오류 발생:', insertResult.error.message)
                return
              }
              
              console.log('✅ users 테이블에 유저 자동 등록됨')
            } catch (insertError) {
              console.error('❌ 사용자 등록 중 예외 발생:', insertError)
            }
          } else {
            console.log('✅ users 테이블에 이미 유저 있음')
          }
        } catch (syncError) {
          console.error('❌ 사용자 동기화 중 예외 발생:', syncError)
        }
      }

      sync()
    } catch (initError) {
      console.error('❌ Supabase 클라이언트 초기화 중 오류:', initError)
    }
  }, [])

  return null
} 