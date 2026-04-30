/**
 * 权限CODE枚举
 * 统一管理所有权限代码，方便维护和使用
 */
export enum PermissionCode {
  // ==================== 应用配置权限 ====================
  /** 创建应用配置 */
  CREATE_APP_CONFIG = 'CREATE_APP_CONFIG',
  /** 查看应用配置列表 */
  SHOW_APP_CONFIG_LIST = 'SHOW_APP_CONFIG_LIST',
  /** 查看应用配置详情 */
  SHOW_APP_CONFIG_DETAIL = 'SHOW_APP_CONFIG_DETAIL',
  /** 更新应用配置 */
  UPDATE_APP_CONFIG = 'UPDATE_APP_CONFIG',
  /** 删除应用配置 */
  DELETE_APP_CONFIG = 'DELETE_APP_CONFIG',

  // ==================== 云存储配置权限 ====================
  /** 创建云存储配置 */
  CREATE_STORAGE_CONFIG = 'CREATE_STORAGE_CONFIG',
  /** 查看云存储配置列表 */
  SHOW_STORAGE_CONFIG_LIST = 'SHOW_STORAGE_CONFIG_LIST',
  /** 查看云存储配置详情 */
  SHOW_STORAGE_CONFIG_DETAIL = 'SHOW_STORAGE_CONFIG_DETAIL',
  /** 更新云存储配置 */
  UPDATE_STORAGE_CONFIG = 'UPDATE_STORAGE_CONFIG',
  /** 删除云存储配置 */
  DELETE_STORAGE_CONFIG = 'DELETE_STORAGE_CONFIG',

  // ==================== AI模型配置权限 ====================
  /** 创建AI模型配置 */
  CREATE_AI_MODEL_CONFIG = 'CREATE_AI_MODEL_CONFIG',
  /** 查看AI模型配置列表 */
  SHOW_AI_MODEL_CONFIG_LIST = 'SHOW_AI_MODEL_CONFIG_LIST',
  /** 查看AI模型配置详情 */
  SHOW_AI_MODEL_CONFIG_DETAIL = 'SHOW_AI_MODEL_CONFIG_DETAIL',
  /** 更新AI模型配置 */
  UPDATE_AI_MODEL_CONFIG = 'UPDATE_AI_MODEL_CONFIG',
  /** 删除AI模型配置 */
  DELETE_AI_MODEL_CONFIG = 'DELETE_AI_MODEL_CONFIG',

  // ==================== 权限管理权限 ====================
  /** 创建权限 */
  CREATE_PERMISSION = 'CREATE_PERMISSION',
  /** 批量创建权限 */
  BATCH_CREATE_PERMISSION = 'BATCH_CREATE_PERMISSION',
  /** 查看权限列表 */
  SHOW_PERMISSION_LIST = 'SHOW_PERMISSION_LIST',
  /** 查看权限树 */
  SHOW_PERMISSION_TREE = 'SHOW_PERMISSION_TREE',
  /** 查看菜单树 */
  SHOW_PERMISSION_MENU_TREE = 'SHOW_PERMISSION_MENU_TREE',
  /** 查看权限详情 */
  SHOW_PERMISSION_DETAIL = 'SHOW_PERMISSION_DETAIL',
  /** 更新权限 */
  UPDATE_PERMISSION = 'UPDATE_PERMISSION',
  /** 删除权限 */
  DELETE_PERMISSION = 'DELETE_PERMISSION',
  /** 查看按钮权限 */
  SHOW_PERMISSION_BUTTON = 'SHOW_PERMISSION_BUTTON',
  /** 验证菜单路径 */
  VALIDATE_MENU_PATH = 'VALIDATE_MENU_PATH',
  /** 修复空类型权限 */
  FIX_EMPTY_TYPES = 'FIX_EMPTY_TYPES',

  // ==================== 角色管理权限 ====================
  /** 查看角色权限树 */
  SHOW_ROLE_PERMISSIONS_TREE = 'SHOW_ROLE_PERMISSIONS_TREE',

  // ==================== 系统管理权限 ====================
  /** 创建系统 */
  CREATE_SYSTEM = 'CREATE_SYSTEM',
  /** 查看系统列表 */
  SHOW_SYSTEM_LIST = 'SHOW_SYSTEM_LIST',
  /** 查看系统详情 */
  SHOW_SYSTEM_DETAIL = 'SHOW_SYSTEM_DETAIL',
  /** 更新系统 */
  UPDATE_SYSTEM = 'UPDATE_SYSTEM',
  /** 删除系统 */
  DELETE_SYSTEM = 'DELETE_SYSTEM',

  // ==================== 订单管理权限 ====================
  /** 创建订单 */
  CREATE_ORDER = 'CREATE_ORDER',
  /** 查看订单列表 */
  SHOW_ORDER_LIST = 'SHOW_ORDER_LIST',
  /** 查看订单详情 */
  SHOW_ORDER_DETAIL = 'SHOW_ORDER_DETAIL',
  /** 更新订单 */
  UPDATE_ORDER = 'UPDATE_ORDER',
  /** 查询订单 */
  QUERY_ORDER = 'QUERY_ORDER',

  // ==================== LLM管理权限 ====================
  /** 使用LLM预测 */
  USE_LLM_PREDICT = 'USE_LLM_PREDICT',
  /** 使用LLM流式预测 */
  USE_LLM_PREDICT_STREAM = 'USE_LLM_PREDICT_STREAM',

  // ==================== 键值对管理权限 ====================
  /** 创建键值对 */
  CREATE_KEY_VALUE = 'CREATE_KEY_VALUE',
  /** 查看键值对列表 */
  SHOW_KEY_VALUE_LIST = 'SHOW_KEY_VALUE_LIST',
  /** 查看键值对详情 */
  SHOW_KEY_VALUE_DETAIL = 'SHOW_KEY_VALUE_DETAIL',
  /** 更新键值对 */
  UPDATE_KEY_VALUE = 'UPDATE_KEY_VALUE',
  /** 删除键值对 */
  DELETE_KEY_VALUE = 'DELETE_KEY_VALUE',

  // ==================== 支付管理权限 ====================
  /** 创建支付订单 */
  CREATE_PAY_ORDER = 'CREATE_PAY_ORDER',
  /** 查看支付订单列表 */
  SHOW_PAY_ORDER_LIST = 'SHOW_PAY_ORDER_LIST',
  /** 查看支付订单详情 */
  SHOW_PAY_ORDER_DETAIL = 'SHOW_PAY_ORDER_DETAIL',
  /** 查询支付订单 */
  QUERY_PAY_ORDER = 'QUERY_PAY_ORDER',
  /** 获取支付链接 */
  GET_PAY_LINK = 'GET_PAY_LINK',
  /** 验证支付回调 */
  VERIFY_PAY_NOTIFY = 'VERIFY_PAY_NOTIFY',

  // ==================== 产品管理权限 ====================
  /** 创建产品 */
  CREATE_PRODUCT = 'CREATE_PRODUCT',
  /** 查看产品列表 */
  SHOW_PRODUCT_LIST = 'SHOW_PRODUCT_LIST',
  /** 查看产品详情 */
  SHOW_PRODUCT_DETAIL = 'SHOW_PRODUCT_DETAIL',
  /** 更新产品 */
  UPDATE_PRODUCT = 'UPDATE_PRODUCT',
  /** 删除产品 */
  DELETE_PRODUCT = 'DELETE_PRODUCT',

  // ==================== 资源管理权限 ====================
  /** 上传资源 */
  UPLOAD_RESOURCE = 'UPLOAD_RESOURCE',
  /** 查看资源列表 */
  SHOW_RESOURCE_LIST = 'SHOW_RESOURCE_LIST',
  /** 查看资源详情 */
  SHOW_RESOURCE_DETAIL = 'SHOW_RESOURCE_DETAIL',
  /** 删除资源 */
  DELETE_RESOURCE = 'DELETE_RESOURCE',
  /** 获取资源URL */
  GET_RESOURCE_URL = 'GET_RESOURCE_URL',

  // ==================== 用户管理权限 ====================
  /** 创建用户 */
  CREATE_USER = 'CREATE_USER',
  /** 查看用户列表 */
  SHOW_USER_LIST = 'SHOW_USER_LIST',
  /** 查看用户详情 */
  SHOW_USER_DETAIL = 'SHOW_USER_DETAIL',
  /** 更新用户 */
  UPDATE_USER = 'UPDATE_USER',
  /** 删除用户 */
  DELETE_USER = 'DELETE_USER',
  /** 更新用户密码 */
  UPDATE_USER_PASSWORD = 'UPDATE_USER_PASSWORD',
  /** 分配用户角色 */
  ASSIGN_USER_ROLES = 'ASSIGN_USER_ROLES',
  /** 移除用户角色 */
  REMOVE_USER_ROLES = 'REMOVE_USER_ROLES',
  /** 查看用户权限 */
  SHOW_USER_PERMISSIONS = 'SHOW_USER_PERMISSIONS',
  /** 更新用户权限 */
  UPDATE_USER_PERMISSIONS = 'UPDATE_USER_PERMISSIONS',
  /** 查看用户角色权限树 */
  SHOW_USER_ROLE_PERMISSIONS = 'SHOW_USER_ROLE_PERMISSIONS',
  /** 查看自己的权限 */
  SHOW_MY_PERMISSIONS = 'SHOW_MY_PERMISSIONS',
  /** 查看自己的角色权限 */
  SHOW_MY_ROLE_PERMISSIONS = 'SHOW_MY_ROLE_PERMISSIONS',
  /** 查看用户资料 */
  SHOW_USER_PROFILE = 'SHOW_USER_PROFILE',
  /** 更新用户资料 */
  UPDATE_USER_PROFILE = 'UPDATE_USER_PROFILE',

  // ==================== 云存储管理权限 ====================
  /** 获取上传凭证 */
  GET_UPLOAD_TOKEN = 'GET_UPLOAD_TOKEN',
  /** 获取上传URL */
  GET_UPLOAD_URL = 'GET_UPLOAD_URL',
  /** 获取临时密钥 */
  GET_TEMP_CREDENTIALS = 'GET_TEMP_CREDENTIALS',
  /** 获取文件URL */
  GET_FILE_URL = 'GET_FILE_URL',
  /** 删除文件 */
  DELETE_FILE = 'DELETE_FILE',

  // ==================== 灰度发布管理权限 ====================
  /** 创建灰度白名单绑定 */
  CREATE_GRAY_RELEASE = 'CREATE_GRAY_RELEASE',
  /** 查看灰度白名单列表 */
  SHOW_GRAY_RELEASE_LIST = 'SHOW_GRAY_RELEASE_LIST',
  /** 查看灰度白名单详情 */
  SHOW_GRAY_RELEASE_DETAIL = 'SHOW_GRAY_RELEASE_DETAIL',
  /** 更新灰度白名单 */
  UPDATE_GRAY_RELEASE = 'UPDATE_GRAY_RELEASE',
  /** 删除灰度白名单 */
  DELETE_GRAY_RELEASE = 'DELETE_GRAY_RELEASE',
  /** 批量绑定灰度白名单 */
  BATCH_BIND_GRAY_RELEASE = 'BATCH_BIND_GRAY_RELEASE',
  /** 批量删除灰度白名单 */
  BATCH_DELETE_GRAY_RELEASE = 'BATCH_DELETE_GRAY_RELEASE',
  /** 清理应用灰度白名单 */
  CLEAR_APP_GRAY_RELEASE = 'CLEAR_APP_GRAY_RELEASE',

  // ==================== CDN 脚本授权 ====================
  /** 根据设备指纹与脚本名签发 CDN 许可证密钥（管理后台） */
  ISSUE_CDN_SCRIPT_LICENSE = 'ISSUE_CDN_SCRIPT_LICENSE',
}

/**
 * 权限CODE映射表（用于显示权限名称）
 */
export const PermissionCodeMap: Record<PermissionCode, string> = {
  // 应用配置权限
  [PermissionCode.CREATE_APP_CONFIG]: '创建应用配置',
  [PermissionCode.SHOW_APP_CONFIG_LIST]: '查看应用配置列表',
  [PermissionCode.SHOW_APP_CONFIG_DETAIL]: '查看应用配置详情',
  [PermissionCode.UPDATE_APP_CONFIG]: '更新应用配置',
  [PermissionCode.DELETE_APP_CONFIG]: '删除应用配置',

  // 云存储配置权限
  [PermissionCode.CREATE_STORAGE_CONFIG]: '创建云存储配置',
  [PermissionCode.SHOW_STORAGE_CONFIG_LIST]: '查看云存储配置列表',
  [PermissionCode.SHOW_STORAGE_CONFIG_DETAIL]: '查看云存储配置详情',
  [PermissionCode.UPDATE_STORAGE_CONFIG]: '更新云存储配置',
  [PermissionCode.DELETE_STORAGE_CONFIG]: '删除云存储配置',

  // AI模型配置权限
  [PermissionCode.CREATE_AI_MODEL_CONFIG]: '创建AI模型配置',
  [PermissionCode.SHOW_AI_MODEL_CONFIG_LIST]: '查看AI模型配置列表',
  [PermissionCode.SHOW_AI_MODEL_CONFIG_DETAIL]: '查看AI模型配置详情',
  [PermissionCode.UPDATE_AI_MODEL_CONFIG]: '更新AI模型配置',
  [PermissionCode.DELETE_AI_MODEL_CONFIG]: '删除AI模型配置',

  // 权限管理权限
  [PermissionCode.CREATE_PERMISSION]: '创建权限',
  [PermissionCode.BATCH_CREATE_PERMISSION]: '批量创建权限',
  [PermissionCode.SHOW_PERMISSION_LIST]: '查看权限列表',
  [PermissionCode.SHOW_PERMISSION_TREE]: '查看权限树',
  [PermissionCode.SHOW_PERMISSION_MENU_TREE]: '查看菜单树',
  [PermissionCode.SHOW_PERMISSION_DETAIL]: '查看权限详情',
  [PermissionCode.UPDATE_PERMISSION]: '更新权限',
  [PermissionCode.DELETE_PERMISSION]: '删除权限',
  [PermissionCode.SHOW_PERMISSION_BUTTON]: '查看按钮权限',
  [PermissionCode.VALIDATE_MENU_PATH]: '验证菜单路径',
  [PermissionCode.FIX_EMPTY_TYPES]: '修复空类型权限',

  // 角色管理权限
  [PermissionCode.SHOW_ROLE_PERMISSIONS_TREE]: '查看角色权限树',

  // 系统管理权限
  [PermissionCode.CREATE_SYSTEM]: '创建系统',
  [PermissionCode.SHOW_SYSTEM_LIST]: '查看系统列表',
  [PermissionCode.SHOW_SYSTEM_DETAIL]: '查看系统详情',
  [PermissionCode.UPDATE_SYSTEM]: '更新系统',
  [PermissionCode.DELETE_SYSTEM]: '删除系统',

  // 订单管理权限
  [PermissionCode.CREATE_ORDER]: '创建订单',
  [PermissionCode.SHOW_ORDER_LIST]: '查看订单列表',
  [PermissionCode.SHOW_ORDER_DETAIL]: '查看订单详情',
  [PermissionCode.UPDATE_ORDER]: '更新订单',
  [PermissionCode.QUERY_ORDER]: '查询订单',

  // LLM管理权限
  [PermissionCode.USE_LLM_PREDICT]: '使用LLM预测',
  [PermissionCode.USE_LLM_PREDICT_STREAM]: '使用LLM流式预测',

  // 键值对管理权限
  [PermissionCode.CREATE_KEY_VALUE]: '创建键值对',
  [PermissionCode.SHOW_KEY_VALUE_LIST]: '查看键值对列表',
  [PermissionCode.SHOW_KEY_VALUE_DETAIL]: '查看键值对详情',
  [PermissionCode.UPDATE_KEY_VALUE]: '更新键值对',
  [PermissionCode.DELETE_KEY_VALUE]: '删除键值对',

  // 支付管理权限
  [PermissionCode.CREATE_PAY_ORDER]: '创建支付订单',
  [PermissionCode.SHOW_PAY_ORDER_LIST]: '查看支付订单列表',
  [PermissionCode.SHOW_PAY_ORDER_DETAIL]: '查看支付订单详情',
  [PermissionCode.QUERY_PAY_ORDER]: '查询支付订单',
  [PermissionCode.GET_PAY_LINK]: '获取支付链接',
  [PermissionCode.VERIFY_PAY_NOTIFY]: '验证支付回调',

  // 产品管理权限
  [PermissionCode.CREATE_PRODUCT]: '创建产品',
  [PermissionCode.SHOW_PRODUCT_LIST]: '查看产品列表',
  [PermissionCode.SHOW_PRODUCT_DETAIL]: '查看产品详情',
  [PermissionCode.UPDATE_PRODUCT]: '更新产品',
  [PermissionCode.DELETE_PRODUCT]: '删除产品',

  // 资源管理权限
  [PermissionCode.UPLOAD_RESOURCE]: '上传资源',
  [PermissionCode.SHOW_RESOURCE_LIST]: '查看资源列表',
  [PermissionCode.SHOW_RESOURCE_DETAIL]: '查看资源详情',
  [PermissionCode.DELETE_RESOURCE]: '删除资源',
  [PermissionCode.GET_RESOURCE_URL]: '获取资源URL',

  // 用户管理权限
  [PermissionCode.CREATE_USER]: '创建用户',
  [PermissionCode.SHOW_USER_LIST]: '查看用户列表',
  [PermissionCode.SHOW_USER_DETAIL]: '查看用户详情',
  [PermissionCode.UPDATE_USER]: '更新用户',
  [PermissionCode.DELETE_USER]: '删除用户',
  [PermissionCode.UPDATE_USER_PASSWORD]: '更新用户密码',
  [PermissionCode.ASSIGN_USER_ROLES]: '分配用户角色',
  [PermissionCode.REMOVE_USER_ROLES]: '移除用户角色',
  [PermissionCode.SHOW_USER_PERMISSIONS]: '查看用户权限',
  [PermissionCode.UPDATE_USER_PERMISSIONS]: '更新用户权限',
  [PermissionCode.SHOW_USER_ROLE_PERMISSIONS]: '查看用户角色权限树',
  [PermissionCode.SHOW_MY_PERMISSIONS]: '查看自己的权限',
  [PermissionCode.SHOW_MY_ROLE_PERMISSIONS]: '查看自己的角色权限',
  [PermissionCode.SHOW_USER_PROFILE]: '查看用户资料',
  [PermissionCode.UPDATE_USER_PROFILE]: '更新用户资料',

  // 云存储管理权限
  [PermissionCode.GET_UPLOAD_TOKEN]: '获取上传凭证',
  [PermissionCode.GET_UPLOAD_URL]: '获取上传URL',
  [PermissionCode.GET_TEMP_CREDENTIALS]: '获取临时密钥',
  [PermissionCode.GET_FILE_URL]: '获取文件URL',
  [PermissionCode.DELETE_FILE]: '删除文件',

  // 灰度发布管理权限
  [PermissionCode.CREATE_GRAY_RELEASE]: '创建灰度白名单绑定',
  [PermissionCode.SHOW_GRAY_RELEASE_LIST]: '查看灰度白名单列表',
  [PermissionCode.SHOW_GRAY_RELEASE_DETAIL]: '查看灰度白名单详情',
  [PermissionCode.UPDATE_GRAY_RELEASE]: '更新灰度白名单',
  [PermissionCode.DELETE_GRAY_RELEASE]: '删除灰度白名单',
  [PermissionCode.BATCH_BIND_GRAY_RELEASE]: '批量绑定灰度白名单',
  [PermissionCode.BATCH_DELETE_GRAY_RELEASE]: '批量删除灰度白名单',
  [PermissionCode.CLEAR_APP_GRAY_RELEASE]: '清理应用灰度白名单',

  [PermissionCode.ISSUE_CDN_SCRIPT_LICENSE]: '签发 CDN 脚本许可证密钥',
};

/**
 * 获取权限名称
 * @param code 权限CODE
 * @returns 权限名称
 */
export function getPermissionName(code: PermissionCode): string {
  return PermissionCodeMap[code] || code;
}

