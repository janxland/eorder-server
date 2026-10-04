-- 构建中心 · 版本回收（build_center_cleanup 表 + 审批权限码）
-- 配套代码：feat/build-center-cleanup 分支（基于 feat/build-center @ f54186e）
-- 幂等：可重复执行。上线顺序：先执行本 DDL → 再部署新 bundle → 构建中心 UI 出现「版本回收」面板

-- 1) 回收计划表（扫描只落计划，删除必须人工审批）
CREATE TABLE IF NOT EXISTS `build_center_cleanup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `appId` varchar(64) NOT NULL COMMENT '应用 ID',
  `version` varchar(64) NOT NULL COMMENT '版本目录名（www/micro/{app}/{version}/）',
  `status` varchar(16) NOT NULL DEFAULT 'pending' COMMENT 'pending待批/review人工确认/protected保留中/deleted已清理/missing目录已消失',
  `objectCount` int NOT NULL DEFAULT 0 COMMENT '版本目录内对象数',
  `bytes` int NOT NULL DEFAULT 0 COMMENT '版本目录总体积（字节）',
  `reason` varchar(255) DEFAULT NULL COMMENT '分类原因（给人看）',
  `detail` text DEFAULT NULL COMMENT '审批记录/中断原因/目录年龄等',
  `deletedObjects` int DEFAULT NULL COMMENT '实际删除对象数',
  `decidedBy` varchar(64) DEFAULT NULL COMMENT '审批人',
  `decidedAt` datetime DEFAULT NULL COMMENT '审批时间',
  `scannedAt` datetime NOT NULL COMMENT '本次扫描时间',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_cleanup_app_version` (`appId`, `version`),
  KEY `IDX_cleanup_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='构建中心版本回收计划（扫描不删除，删除需人工审批）';
-- 注意：COLLATE 必须与既有 build_center_* 表一致（utf8mb4_unicode_ci），
-- 否则 listVersions 的 NOT EXISTS 关联会报 Illegal mix of collations

-- 2) 审批权限码（幂等：已存在则跳过）
--    注意：若使用非超管角色审批，需在「角色管理」里把该权限码绑定到对应角色
INSERT INTO `permission` (`name`, `code`, `type`, `parentId`)
SELECT '版本回收（审批清理无用版本）', 'CLEANUP_BUILD_CENTER_VERSION', 'BUTTON', NULL
WHERE NOT EXISTS (SELECT 1 FROM `permission` WHERE `code` = 'CLEANUP_BUILD_CENTER_VERSION');

-- 3) 可调保留窗口（可选，写入 .env；不配则用代码默认值）
-- CLEANUP_CANDIDATE_DAYS=7      # 未上产 success 构建候选期（实习生场景：7 天没被 promote/绑定即列待批）
-- CLEANUP_ROLLBACK_DAYS=14      # 退役生产版本回滚窗口
-- CLEANUP_FAILED_DAYS=2         # 失败/悬账构建窗口
-- CLEANUP_SCAN_INTERVAL_HOURS=24 # 定时扫描间隔
-- BUILD_CENTER_CLEANUP_AUTO=false # 关闭自动扫描（默认开启；扫描只落计划，永不删除）
