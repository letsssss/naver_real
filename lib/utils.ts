import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * BigInt 값을 포함한 객체를 JSON으로 직렬화 가능한 형태로 변환합니다.
 * BigInt 값은 문자열로 변환됩니다.
 * 
 * @param obj 변환할 객체
 * @returns BigInt 값이 문자열로 변환된 객체
 */
export function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertBigIntToString(obj[key]);
    }
    return newObj;
  }
  
  return obj;
}

/**
 * BigInt 값을 처리할 수 있는 사용자 정의 JSON 직렬화 메서드입니다.
 * 
 * @param obj 직렬화할 객체
 * @returns 직렬화된 JSON 문자열
 */
export function safeJsonStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

/**
 * 숫자를 천 단위로 쉼표를 찍어 포맷팅합니다.
 * @param num 포맷팅할 숫자
 * @returns 포맷팅된 문자열
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

/**
 * 숫자를 천단위 구분 기호가 있는 가격 형식으로 변환
 * @param price 변환할 숫자
 * @returns 포맷팅된 가격 문자열
 * @example
 * formatPrice(1000000) // "1,000,000"
 */
export function formatPrice(price?: number): string {
  if (price === undefined || price === null) return "0";
  return price.toLocaleString('ko-KR');
}

