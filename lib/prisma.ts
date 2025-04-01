/**
 * DEPRECATED: Prisma에서 Supabase로 마이그레이션 진행 중
 * 이 파일은 레거시 코드와의 호환성을 위해 유지됩니다.
 * 새로운 코드는 lib/supabase.ts를 직접 사용해야 합니다.
 */

import { supabase } from './supabase';

// Prisma API를 에뮬레이션하는 래퍼 클래스
class SupabaseWrapper {
  // 사용자 관련 메서드
  user = {
    findUnique: async (args: any) => {
      const { where, select } = args;
      
      console.log('Prisma 호환 래퍼: user.findUnique 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('users')
          .select(this._formatSelect(select))
          .eq('id', where.id)
          .single();
          
        return data;
      }
      
      if (where.email) {
        const { data, error } = await supabase
          .from('users')
          .select(this._formatSelect(select))
          .eq('email', where.email.toLowerCase())
          .single();
          
        return data;
      }
      
      return null;
    },
    
    findMany: async (args: any) => {
      const { where, select, orderBy } = args || {};
      
      console.log('Prisma 호환 래퍼: user.findMany 호출');
      
      let query = supabase
        .from('users')
        .select(this._formatSelect(select));
      
      // 조건 적용
      if (where) {
        if (where.id) query = query.eq('id', where.id);
        if (where.email) query = query.eq('email', where.email.toLowerCase());
        // 다른 조건들...
      }
      
      // 정렬 적용
      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field] === 'desc' ? false : true;
        query = query.order(field, { ascending: direction });
      }
      
      const { data, error } = await query;
      return data || [];
    },
    
    update: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: user.update 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', where.id)
          .select()
          .single();
          
        return data;
      }
      
      if (where.email) {
        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('email', where.email.toLowerCase())
          .select()
          .single();
          
        return data;
      }
      
      return null;
    },
    
    create: async (args: any) => {
      const { data: createData } = args;
      
      console.log('Prisma 호환 래퍼: user.create 호출');
      
      const { data, error } = await supabase
        .from('users')
        .insert(createData)
        .select()
        .single();
        
      return data;
    }
  };
  
  // 게시물 관련 메서드
  post = {
    findUnique: async (args: any) => {
      const { where, select } = args;
      
      console.log('Prisma 호환 래퍼: post.findUnique 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('posts')
          .select(this._formatSelect(select))
          .eq('id', where.id)
          .single();
          
        return data;
      }
      
      return null;
    },
    
    findMany: async (args: any) => {
      const { where, select, orderBy, take, skip } = args || {};
      
      console.log('Prisma 호환 래퍼: post.findMany 호출');
      
      let query = supabase
        .from('posts')
        .select(this._formatSelect(select));
      
      // 조건 적용
      if (where) {
        if (where.id) query = query.eq('id', where.id);
        if (where.authorId) query = query.eq('author_id', where.authorId);
        if (where.category) query = query.eq('category', where.category);
        // 다른 조건들...
      }
      
      // 정렬 적용
      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field] === 'desc' ? false : true;
        query = query.order(field, { ascending: direction });
      }
      
      // 페이지네이션
      if (skip) query = query.range(skip, skip + (take || 10) - 1);
      else if (take) query = query.limit(take);
      
      const { data, error } = await query;
      return data || [];
    },
    
    create: async (args: any) => {
      const { data: createData } = args;
      
      console.log('Prisma 호환 래퍼: post.create 호출');
      
      const { data, error } = await supabase
        .from('posts')
        .insert(createData)
        .select()
        .single();
        
      return data;
    },
    
    update: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: post.update 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('posts')
          .update(updateData)
          .eq('id', where.id)
          .select()
          .single();
          
        return data;
      }
      
      return null;
    }
  };
  
  // 다른 테이블에 대한 유사한 래퍼 메서드...
  
  // 연결 해제 함수 (호환성을 위한 더미 함수)
  async $disconnect() {
    console.log('Prisma 호환 래퍼: $disconnect 호출');
    return true;
  }
  
  // 선택 필드 포맷팅
  _formatSelect(select: any): string {
    if (!select) return '*';
    
    return Object.keys(select)
      .filter(key => select[key] === true)
      .join(', ');
  }
}

// 싱글톤 패턴으로 인스턴스 생성
const prisma = new SupabaseWrapper();

export { prisma as default, prisma }; 