import { createBrowserClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase.types";

export default async function TransactionPage({
  params: { order_number },
}: {
  params: { order_number: string };
}) {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  // 거래 정보 조회
  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .select('*')
    .eq('order_number', order_number)
    .single();

  if (transactionError || !transaction) {
    redirect('/');
  }

  // 사용자가 구매자나 판매자가 아니면 접근 불가
  if (transaction.buyer_id !== user.id && transaction.seller_id !== user.id) {
    redirect('/');
  }

  return (
    <div>
      <h1>거래 상세</h1>
      <pre>{JSON.stringify(transaction, null, 2)}</pre>
    </div>
  );
} 
