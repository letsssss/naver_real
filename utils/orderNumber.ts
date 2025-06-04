import { getSupabaseClient } from '@/lib/supabase';

export async function generateUniqueOrderNumber(): Promise<string> {
  const supabase = await getSupabaseClient();
  
  let orderNumber: string;
  let isUnique = false;
  
  while (!isUnique) {
    // 현재 날짜와 시간을 기반으로 주문번호 생성
    const now = new Date();
    const timestamp = now.getTime().toString();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    orderNumber = `ORD${timestamp}${randomSuffix}`;
    
    // 중복 체크
    const { data } = await supabase
      .from('orders')
      .select('order_number')
      .eq('order_number', orderNumber)
      .single();
    
    if (!data) {
      isUnique = true;
    }
  }
  
  return orderNumber!;
} 