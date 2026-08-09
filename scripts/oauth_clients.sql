-- ============================================================
-- OAuth2.0 客户端注册表（多 client 通用基础设施）
-- 用途：roginx-cli / web-* / deploy-server 等 client 注册
-- 部署：在 eorder-server 数据库执行本脚本（幂等）
-- ⚠️ 注意：本项目 TypeORM 无 snake_case naming strategy，
--    实体属性名即列名（驼峰），与 refresh_token 等现有表约定一致。
-- ============================================================

CREATE TABLE IF NOT EXISTS `oauth_clients` (
  `clientId` varchar(64) NOT NULL COMMENT '客户端标识',
  `clientSecret` varchar(255) DEFAULT NULL COMMENT 'confidential client 密钥；public(PKCE) 可空',
  `clientName` varchar(100) NOT NULL COMMENT '展示名',
  `type` enum('public','confidential') NOT NULL DEFAULT 'public' COMMENT 'public=PKCE；confidential=带secret',
  `allowedRedirectUris` json NOT NULL COMMENT '合法回调地址白名单，支持 * 通配',
  `allowedScopes` json NOT NULL COMMENT '可申请 scope，如 ["storage:write"]',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`clientId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OAuth2.0 客户端注册表';

-- 初始 client：roginx-cli（本地 CLI，public + PKCE）
INSERT IGNORE INTO `oauth_clients`
  (`clientId`, `clientName`, `type`, `allowedRedirectUris`, `allowedScopes`)
VALUES
  ('roginx-cli', 'roginx 本地 CLI', 'public',
   JSON_ARRAY('http://127.0.0.1:*'),
   JSON_ARRAY('storage:write'));
