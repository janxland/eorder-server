/**
 * 权限插入脚本
 * 
 * 功能：
 * 1. 根据 PermissionCode 枚举自动插入 type=API 的权限
 * 2. 先查询已存在的权限，了解需要哪些字段
 * 3. 更新已存在权限的中文名称，使其与 PermissionCodeMap 保持一致
 * 4. 确保所有权限的 type 都是 API
 * 
 * 使用方法：
 * npm run script:insert-permissions
 * 
 * 或者直接运行：
 * ts-node -r tsconfig-paths/register scripts/insert-api-permissions.ts
 * 
 * 注意：
 * - 需要先配置好 .env 或 .env.local 文件中的数据库连接信息
 * - 脚本会自动查询已存在的 API 类型权限作为参考，获取默认字段值
 * - 如果权限已存在，会更新其名称和类型
 * - 如果权限不存在，会创建新的权限记录
 */

import { DataSource } from 'typeorm';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PermissionCode, PermissionCodeMap } from '../src/common/enums/permission-code.enum';

// 简单的环境变量加载函数
function loadEnvFile(filePath: string) {
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // 移除引号
          const cleanValue = value.replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = cleanValue;
          }
        }
      }
    });
  }
}

// 加载环境变量
loadEnvFile(resolve(__dirname, '../.env.local'));
loadEnvFile(resolve(__dirname, '../.env'));

// 创建数据库连接
const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PWD || '',
  database: process.env.DB_DATABASE || '',
  timezone: '+08:00',
  extra: {
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  },
});

interface PermissionRow {
  id: number;
  name: string;
  code: string;
  type: string;
  parentId: number | null;
  path: string | null;
  redirect: string | null;
  icon: string | null;
  component: string | null;
  layout: string | null;
  keepAlive: number | null;
  method: string | null;
  description: string | null;
  show: number;
  enable: number;
  order: number | null;
}

async function main() {
  try {
    console.log('正在连接数据库...');
    await dataSource.initialize();
    console.log('✅ 数据库连接成功');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // 1. 先查询已存在的权限，了解需要哪些字段
    console.log('\n正在查询已存在的权限...');
    const allCodes = Object.values(PermissionCode);
    const placeholders = allCodes.map(() => '?').join(',');
    const existingPermissions = await queryRunner.query(
      `SELECT * FROM permission WHERE code IN (${placeholders})`,
      allCodes
    ) as PermissionRow[];

    console.log(`找到 ${existingPermissions.length} 个已存在的权限`);

    // 2. 获取所有权限 CODE
    const allPermissionCodes = Object.values(PermissionCode);
    const existingCodes = new Set(existingPermissions.map(p => p.code));

    // 3. 找出需要插入的权限（不存在的）
    const codesToInsert = allPermissionCodes.filter(code => !existingCodes.has(code));
    console.log(`\n需要插入 ${codesToInsert.length} 个新权限`);

    // 4. 找出需要更新名称的权限（已存在但名称不匹配）
    const codesToUpdate = allPermissionCodes.filter(code => {
      const existing = existingPermissions.find(p => p.code === code);
      if (!existing) return false;
      const expectedName = PermissionCodeMap[code as PermissionCode];
      return existing.name !== expectedName;
    });
    console.log(`需要更新 ${codesToUpdate.length} 个权限的名称`);

    // 5. 查询所有 MENU 类型的权限，用于查找父级权限
    console.log('\n正在查询菜单权限...');
    const menuPermissions = await queryRunner.query(
      'SELECT * FROM permission WHERE type = ?',
      ['MENU']
    ) as PermissionRow[];
    console.log(`找到 ${menuPermissions.length} 个菜单权限`);

    // 6. 根据权限代码推断父级权限的映射关系
    const getParentPermission = (code: string): number | null => {
      // 应用配置权限的父级
      if (code.includes('APP_CONFIG')) {
        const parent = menuPermissions.find(m => 
          m.name.includes('应用配置') || 
          m.code.includes('APP_CONFIG') ||
          m.path?.includes('/app-config')
        );
        return parent?.id || null;
      }
      
      // 云存储配置权限的父级
      if (code.includes('STORAGE_CONFIG')) {
        const parent = menuPermissions.find(m => 
          m.name.includes('云存储') || 
          m.name.includes('存储配置') ||
          m.code.includes('STORAGE') ||
          m.path?.includes('/cloud-storage') ||
          m.path?.includes('/storage')
        );
        return parent?.id || null;
      }
      
      // AI模型配置权限的父级
      if (code.includes('AI_MODEL_CONFIG')) {
        const parent = menuPermissions.find(m => 
          m.name.includes('AI模型') || 
          m.name.includes('模型配置') ||
          m.code.includes('AI_MODEL') ||
          m.path?.includes('/ai-model')
        );
        return parent?.id || null;
      }
      
      // 权限管理权限的父级
      if (code.includes('PERMISSION')) {
        const parent = menuPermissions.find(m => 
          m.name.includes('权限管理') || 
          m.code.includes('PERMISSION') ||
          m.path?.includes('/permission')
        );
        return parent?.id || null;
      }
      
      // 角色管理权限的父级
      if (code.includes('ROLE')) {
        const parent = menuPermissions.find(m => 
          m.name.includes('角色管理') || 
          m.code.includes('ROLE') ||
          m.path?.includes('/role')
        );
        return parent?.id || null;
      }
      
      return null;
    };

    // 7. 插入新权限
    if (codesToInsert.length > 0) {
      console.log('\n开始插入新权限...');
      for (const code of codesToInsert) {
        const name = PermissionCodeMap[code as PermissionCode];
        
        // 查询一个已存在的 API 类型权限作为参考，获取默认字段值
        let referencePermission: PermissionRow[] = [];
        try {
          referencePermission = await queryRunner.query(
            'SELECT * FROM permission WHERE type = ? LIMIT 1',
            ['API']
          ) as PermissionRow[];
        } catch (error) {
          // 如果没有 API 类型的权限，继续使用默认值
        }

        // 如果没有参考权限，使用默认值
        const defaultValues = referencePermission.length > 0 ? referencePermission[0] : null;
        
        // 查找父级权限
        const parentId = getParentPermission(code);
        if (parentId) {
          console.log(`  📍 找到父级权限: ${code} -> parentId: ${parentId}`);
        } else {
          console.log(`  ⚠️  未找到父级权限: ${code}`);
        }

        const insertQuery = `
          INSERT INTO permission (
            name, code, type, parentId, path, redirect, icon, component, 
            layout, keepAlive, method, description, \`show\`, \`enable\`, \`order\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
          name,                    // name
          code,                    // code
          'API',                   // type
          parentId || defaultValues?.parentId || null,  // parentId (优先使用推断的父级权限)
          defaultValues?.path || null,      // path
          defaultValues?.redirect || null,  // redirect
          defaultValues?.icon || null,      // icon
          defaultValues?.component || null, // component
          defaultValues?.layout || null,    // layout
          defaultValues?.keepAlive || null, // keepAlive
          defaultValues?.method || null,    // method
          name,                    // description (使用权限名称)
          defaultValues?.show ?? 1,         // show (默认 1)
          defaultValues?.enable ?? 1,       // enable (默认 1)
          defaultValues?.order || null,     // order
        ];

        await queryRunner.query(insertQuery, values);
        console.log(`  ✅ 插入权限: ${name} (${code})`);
      }
    }

    // 8. 更新已存在权限的名称和父级权限
    if (codesToUpdate.length > 0) {
      console.log('\n开始更新权限名称和父级权限...');
      for (const code of codesToUpdate) {
        const expectedName = PermissionCodeMap[code as PermissionCode];
        const existing = existingPermissions.find(p => p.code === code);
        
        if (existing) {
          // 查找父级权限
          const parentId = getParentPermission(code);
          const updates: string[] = [];
          const values: any[] = [];
          
          if (existing.name !== expectedName) {
            updates.push('name = ?');
            values.push(expectedName);
            updates.push('description = ?');
            values.push(expectedName);
          }
          
          if (parentId && existing.parentId !== parentId) {
            updates.push('parentId = ?');
            values.push(parentId);
            console.log(`  📍 更新父级权限: ${code} -> parentId: ${parentId}`);
          }
          
          if (updates.length > 0) {
            values.push(code);
            await queryRunner.query(
              `UPDATE permission SET ${updates.join(', ')} WHERE code = ?`,
              values
            );
            console.log(`  ✅ 更新权限: ${existing.name} -> ${expectedName} (${code})`);
          }
        }
      }
    }

    // 9. 确保所有权限的 type 都是 API（如果它们应该被标记为 API）
    console.log('\n检查权限类型...');
    for (const code of allPermissionCodes) {
      const existing = await queryRunner.query(
        'SELECT * FROM permission WHERE code = ?',
        [code]
      ) as PermissionRow[];

      if (existing.length > 0 && existing[0].type !== 'API') {
        await queryRunner.query(
          'UPDATE permission SET type = ? WHERE code = ?',
          ['API', code]
        );
        console.log(`  ✅ 更新权限类型: ${code} -> API`);
      }
    }
    
    // 10. 更新所有权限的父级权限（如果还没有设置）
    console.log('\n检查并更新权限的父级权限...');
    for (const code of allPermissionCodes) {
      const existing = await queryRunner.query(
        'SELECT * FROM permission WHERE code = ?',
        [code]
      ) as PermissionRow[];

      if (existing.length > 0) {
        const parentId = getParentPermission(code);
        if (parentId && existing[0].parentId !== parentId) {
          await queryRunner.query(
            'UPDATE permission SET parentId = ? WHERE code = ?',
            [parentId, code]
          );
          console.log(`  ✅ 更新父级权限: ${code} -> parentId: ${parentId}`);
        }
      }
    }

    console.log('\n✅ 所有操作完成！');
    console.log(`\n统计:`);
    console.log(`  - 插入新权限: ${codesToInsert.length} 个`);
    console.log(`  - 更新权限名称: ${codesToUpdate.length} 个`);
    console.log(`  - 总权限数: ${allPermissionCodes.length} 个`);

    await queryRunner.release();
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

main();

