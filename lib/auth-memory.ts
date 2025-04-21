// 타입스크립트 인터페이스 정의
interface MemoryUser {
  id: number;
  email: string;
  password: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

// 메모리 기반 사용자 저장소 (독립적으로 유지)
export const memoryUsers: MemoryUser[] = [];

// 개발 환경에서 메모리 사용자 추가 함수
export function addMemoryUser(user: Omit<MemoryUser, 'id' | 'createdAt' | 'updatedAt'>) {
  const newUser: MemoryUser = {
    ...user,
    id: memoryUsers.length + 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  memoryUsers.push(newUser);
  console.log(`메모리 사용자 추가됨: ${newUser.email}, ID: ${newUser.id}`);
  return newUser;
} 