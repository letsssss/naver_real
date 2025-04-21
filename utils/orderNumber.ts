import { supabase } from '@/lib/supabase';

export async function createUniqueOrderNumber(): Promise<string> {
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 12; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  while (true) {
    const newCode = generateCode()
    
    const { data: existing, error } = await supabase
      .from('purchases')
      .select('id')
      .eq('order_number', newCode)
      .maybeSingle()
      
    if (error) {
      console.error('주문 번호 조회 오류:', error)
    }
    
    if (!existing) {
      return newCode
    }
  }
} 