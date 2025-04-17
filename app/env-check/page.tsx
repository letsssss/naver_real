'use client';

export default function EnvCheckPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">환경 변수 체크</h1>
      <div className="p-4 border rounded bg-gray-50 mb-4">
        <p>✅ URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
        <p>✅ KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 8)}...</p>
      </div>
      <div className="p-4 border rounded bg-gray-50">
        <p className="text-sm text-gray-600">
          위 값이 비어있지 않다면 환경 변수가 제대로 로드된 것입니다.
        </p>
      </div>
    </div>
  );
} 