/**
 * Prisma에서 Supabase로 마이그레이션 스크립트
 * 
 * 이 스크립트는 Prisma를 사용하는 애플리케이션을 Supabase로 마이그레이션합니다.
 * 주요 기능:
 * 1. 기존 API 종속성 분석
 * 2. Prisma 참조 검색 및 대체
 * 3. 패키지 종속성 정리
 * 
 * 사용법: node prisma-to-supabase-migration.js
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execSync } from 'child_process';

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

// 설정 옵션
const config = {
  apiDir: './app/api',
  libDir: './lib',
  utilsDir: './utils',
  dependencyCheck: true,
  updatePackageJson: true,
  dryRun: false,
};

// Prisma에서 Supabase로의 매핑 패턴
const replacementPatterns = [
  {
    search: /import\s+.*?prisma.*?from\s+['"]@\/lib\/prisma['"]/g,
    replace: 'import { supabase } from \'@/lib/supabase\'',
  },
  {
    search: /const\s+.*?\s*=\s*new\s+PrismaClient\(\)/g,
    replace: '// Prisma 클라이언트 제거됨, Supabase 사용',
  },
  {
    search: /await\s+prisma\.user\.findUnique\(\s*\{\s*where:\s*\{\s*email:\s*([^}]+)\s*\}/g,
    replace: 'await supabase.from(\'users\').select(\'*\').eq(\'email\', $1.toLowerCase())',
  },
  // 다른 패턴들...
];

/**
 * 디렉토리 내 모든 파일을 재귀적으로 탐색
 */
async function getAllFiles(directory) {
  const files = [];
  
  async function traverse(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }
  
  await traverse(directory);
  return files;
}

/**
 * 파일 내에서 Prisma 관련 패턴 검색 및 대체
 */
async function replaceInFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    let updatedContent = content;
    let hasChanges = false;
    
    for (const pattern of replacementPatterns) {
      if (pattern.search.test(updatedContent)) {
        updatedContent = updatedContent.replace(pattern.search, pattern.replace);
        hasChanges = true;
      }
    }
    
    if (hasChanges && !config.dryRun) {
      await writeFile(filePath, updatedContent, 'utf-8');
      console.log(`Updated: ${filePath}`);
    } else if (hasChanges) {
      console.log(`Would update (dry run): ${filePath}`);
    }
    
    return hasChanges;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

/**
 * package.json 업데이트
 */
async function updatePackageJson() {
  try {
    const packageJsonPath = './package.json';
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    // Prisma 관련 의존성 및 스크립트 제거
    if (packageJson.dependencies['@prisma/client']) {
      console.log('Removing @prisma/client dependency');
      delete packageJson.dependencies['@prisma/client'];
    }
    
    if (packageJson.devDependencies['prisma']) {
      console.log('Removing prisma devDependency');
      delete packageJson.devDependencies['prisma'];
    }
    
    // prisma 관련 스크립트 제거
    Object.keys(packageJson.scripts).forEach(key => {
      if (key.includes('prisma') || packageJson.scripts[key].includes('prisma')) {
        console.log(`Removing script: ${key}`);
        delete packageJson.scripts[key];
      }
    });
    
    // 새 package.json 저장
    if (!config.dryRun) {
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
      console.log('Updated package.json');
    } else {
      console.log('Would update package.json (dry run)');
    }
  } catch (error) {
    console.error('Error updating package.json:', error);
  }
}

/**
 * 메인 함수
 */
async function main() {
  try {
    console.log('Starting Prisma to Supabase migration...');
    
    // 1. API 디렉토리 내 모든 파일 수집
    console.log('Collecting files...');
    const apiFiles = await getAllFiles(config.apiDir);
    const libFiles = await getAllFiles(config.libDir);
    const utilsFiles = await getAllFiles(config.utilsDir);
    
    const allFiles = [...apiFiles, ...libFiles, ...utilsFiles];
    console.log(`Found ${allFiles.length} files to process`);
    
    // 2. 각 파일에서 Prisma 관련 코드 대체
    console.log('Processing files...');
    let updatedFilesCount = 0;
    
    for (const file of allFiles) {
      const updated = await replaceInFile(file);
      if (updated) updatedFilesCount++;
    }
    
    console.log(`Processed ${updatedFilesCount} files with changes`);
    
    // 3. package.json 업데이트
    if (config.updatePackageJson) {
      console.log('Updating package.json...');
      await updatePackageJson();
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// 스크립트 실행
main(); 