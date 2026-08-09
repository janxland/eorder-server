-- ============================================================
-- 云存储配置中心迁移
-- 1) 新建 storage_accounts 表（永久密钥加密存储）
-- 2) storage_config 增加 account_id
-- 3) 把现有配置的密钥迁移到默认账号（加密后）
-- ⚠️ 需要先设置 KEY_VAULT_MASTER_KEY（32字节hex）到 .env
-- ============================================================

CREATE TABLE IF NOT EXISTS `storage_accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `provider` enum('cos','oss','qiniu') NOT NULL DEFAULT 'cos',
  `accessKeyEnc` blob,
  `secretKeyEnc` blob,
  `remark` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='云存储账号（永久密钥加密存储）';

-- storage_config 增加 account_id
ALTER TABLE `storage_config`
  ADD COLUMN `accountId` int(11) DEFAULT NULL AFTER `type`,
  ADD KEY `IDX_storage_config_accountId` (`accountId`);
