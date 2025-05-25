'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function AuthError() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorInfo, setErrorInfo] = useState({
    reason: '',
    message: '',
    title: '',
    description: '',
    suggestion: ''
  });

  useEffect(() => {
    const reason = searchParams.get('reason') || 'unknown';
    const message = searchParams.get('message') || '';

    let title = '';
    let description = '';
    let suggestion = '';

    switch (reason) {
      case 'no-code':
        title = '인증 코드 없음';
        description = '카카오에서 인증 코드를 받지 못했습니다.';
        suggestion = '카카오 로그인을 다시 시도해주세요.';
        break;
      case 'invalid-code':
        title = '잘못된 인증 코드';
        description = '카카오 인증 코드가 유효하지 않습니다.';
        suggestion = '로그인을 처음부터 다시 시도해주세요.';
        break;
      case 'code-expired':
        title = '인증 코드 만료';
        description = '카카오 인증 코드가 만료되었습니다.';
        suggestion = '시간이 지나 인증 코드가 만료되었습니다. 다시 로그인해주세요.';
        break;
      case 'exchange-fail':
        title = '세션 교환 실패';
        description = '인증 코드를 세션으로 교환하는 중 오류가 발생했습니다.';
        suggestion = '잠시 후 다시 시도하거나 관리자에게 문의하세요.';
        break;
      case 'no-session':
        title = '세션 생성 실패';
        description = '로그인 세션이 생성되지 않았습니다.';
        suggestion = '카카오 로그인을 다시 시도해주세요.';
        break;
      case 'server-error':
        title = '서버 오류';
        description = '서버에서 오류가 발생했습니다.';
        suggestion = '잠시 후 다시 시도하거나 관리자에게 문의하세요.';
        break;
      default:
        title = '알 수 없는 오류';
        description = '예상하지 못한 오류가 발생했습니다.';
        suggestion = '페이지를 새로고침하거나 다시 로그인해주세요.';
    }

    setErrorInfo({ reason, message, title, description, suggestion });

    // 콘솔에 오류 정보 로깅
    console.group('🔍 OAuth 인증 오류 정보');
    console.log('오류 유형:', reason);
    console.log('오류 메시지:', message);
    console.log('발생 시간:', new Date().toISOString());
    console.groupEnd();
  }, [searchParams]);

  const handleRetry = () => {
    router.push('/login');
  };

  const handleHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* 오류 아이콘 */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          {/* 오류 제목 */}
          <h1 className="text-xl font-semibold text-center text-gray-900 mb-2">
            {errorInfo.title}
          </h1>

          {/* 오류 설명 */}
          <p className="text-gray-600 text-center mb-4">
            {errorInfo.description}
          </p>

          {/* 해결 방법 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-6">
            <p className="text-sm text-blue-800">
              <strong>해결 방법:</strong> {errorInfo.suggestion}
            </p>
          </div>

          {/* 개발 환경에서만 상세 정보 표시 */}
          {process.env.NODE_ENV === 'development' && errorInfo.message && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-6">
              <p className="text-xs text-gray-600 font-semibold mb-1">개발자 정보:</p>
              <p className="text-xs text-gray-700 font-mono break-words">
                {errorInfo.message}
              </p>
            </div>
          )}

          {/* 액션 버튼들 */}
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full flex items-center justify-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              다시 로그인하기
            </button>
            
            <button
              onClick={handleHome}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 