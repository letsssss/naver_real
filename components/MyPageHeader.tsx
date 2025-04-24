'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function MyPageHeader() {
  const router = useRouter();

  const handleHomeClick = () => {
    router.push('/');
  };

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-6">
        <button 
          onClick={handleHomeClick}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          <span>홈으로 돌아가기</span>
        </button>
        <h1 className="text-3xl font-bold mt-4">마이페이지</h1>
      </div>
    </header>
  );
} 