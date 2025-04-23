'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 판매자 정보 타입 정의
interface Seller {
  id: string;
  name: string;
  profileImage?: string;
  email?: string;
  phoneNumber?: string;
  createdAt: string;
}

export default function SellerPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSellerData() {
      try {
        setLoading(true);
        
        // Supabase에서 판매자 정보 조회
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, profileImage, phoneNumber, created_at')
          .eq('id', id)
          .single();

        if (error) {
          console.error('판매자 정보 조회 오류:', error);
          throw new Error('판매자 정보를 불러오는 중 오류가 발생했습니다.');
        }

        if (!data) {
          throw new Error('판매자를 찾을 수 없습니다.');
        }

        // 데이터 형식 변환
        setSeller({
          id: data.id,
          name: data.name || '이름 없음',
          profileImage: data.profileImage,
          email: data.email,
          phoneNumber: data.phoneNumber,
          createdAt: data.created_at
        });
      } catch (err) {
        console.error('판매자 정보 로드 중 오류:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchSellerData();
  }, [id]);

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">판매자 정보를 불러오는 중...</h2>
          <div className="animate-pulse w-16 h-16 rounded-full bg-gray-300 mx-auto"></div>
        </div>
      </div>
    );
  }

  // 오류 발생 시 표시
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">오류 발생</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // 판매자를 찾을 수 없는 경우
  if (!seller) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            {seller.profileImage ? (
              <img 
                src={seller.profileImage} 
                alt={`${seller.name}의 프로필`} 
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-2xl text-gray-500">{seller.name.charAt(0)}</span>
              </div>
            )}
            
            <div>
              <h1 className="text-2xl font-bold">{seller.name}</h1>
              <p className="text-gray-500">판매자 ID: {seller.id}</p>
              <p className="text-gray-500">가입일: {new Date(seller.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h2 className="text-xl font-semibold mb-4">판매자 정보</h2>
            <div className="space-y-2">
              <p><span className="font-medium">이메일:</span> {seller.email || '비공개'}</p>
              <p><span className="font-medium">연락처:</span> {seller.phoneNumber || '비공개'}</p>
            </div>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h2 className="text-xl font-semibold mb-4">판매 목록</h2>
            <p className="text-gray-500">판매 목록을 불러오는 중입니다...</p>
            {/* 여기에 판매 목록 표시 컴포넌트 추가 예정 */}
          </div>
        </div>
      </div>
    </div>
  );
}
