'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function SessionDebugPage() {
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 브라우저 클라이언트 생성
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchSession = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 현재 세션 정보 가져오기
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }
      
      setSessionData(data);
      console.log('세션 데이터:', data);
    } catch (err: any) {
      console.error('세션 가져오기 오류:', err);
      setError(err.message || '세션을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      // 세션 갱신 시도
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }
      
      setSessionData(data);
      console.log('세션 갱신 후 데이터:', data);
    } catch (err: any) {
      console.error('세션 갱신 오류:', err);
      setError(err.message || '세션을 갱신하는 중 오류가 발생했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      fetchSession(); // 로그아웃 후 세션 정보 다시 가져오기
    } catch (err: any) {
      console.error('로그아웃 오류:', err);
      setError(err.message || '로그아웃 중 오류가 발생했습니다.');
    }
  };

  // 컴포넌트 마운트 시 세션 정보 가져오기
  useEffect(() => {
    fetchSession();
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">세션 디버그 페이지</h1>
      
      <div className="flex gap-4 mb-6">
        <Button onClick={fetchSession} disabled={loading}>
          {loading ? '로딩 중...' : '세션 확인'}
        </Button>
        <Button onClick={refreshSession} disabled={refreshing} variant="outline">
          {refreshing ? '갱신 중...' : '세션 갱신 시도'}
        </Button>
        <Button onClick={signOut} variant="destructive">
          로그아웃
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p><strong>오류:</strong> {error}</p>
        </div>
      )}
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>세션 상태</CardTitle>
          <CardDescription>
            현재 브라우저에 저장된 인증 세션 정보입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded bg-gray-100 p-4 overflow-auto max-h-96">
            <pre className="text-sm">
              {sessionData ? JSON.stringify(sessionData, null, 2) : '세션 정보가 없습니다.'}
            </pre>
          </div>
        </CardContent>
        <CardFooter className="text-sm text-gray-500">
          {sessionData?.session ? (
            <div>
              <p>사용자 ID: {sessionData.session.user.id}</p>
              <p>이메일: {sessionData.session.user.email}</p>
              <p>만료 시간: {new Date(sessionData.session.expires_at * 1000).toLocaleString()}</p>
            </div>
          ) : (
            <p>현재 로그인되어 있지 않습니다.</p>
          )}
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>쿠키 정보</CardTitle>
          <CardDescription>
            브라우저에 저장된 쿠키 정보 (인증 관련)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded bg-gray-100 p-4 overflow-auto max-h-96">
            <pre className="text-sm">
              {document?.cookie ? document.cookie : '쿠키 정보를 표시할 수 없습니다.'}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 