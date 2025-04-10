/**
 * 주문번호로 거래 정보를 조회하는 함수
 * @param orderNumber 주문번호
 * @returns 거래 정보
 */
export async function getTransactionByOrderNumber(orderNumber: string) {
  try {
    const response = await fetch(`/api/purchase/${orderNumber}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('거래 정보를 불러오는데 실패했습니다.');
    }

    return await response.json();
  } catch (error) {
    console.error('거래 정보 조회 오류:', error);
    return null;
  }
} 