'use client';

export default function EnvTest() {
  return (
    <div className="border p-4 rounded-lg bg-gray-50">
      <p>✅ URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ 없음'}</p>
      <p>✅ KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 8) || '❌ 없음'}...</p>
    </div>
  );
} 