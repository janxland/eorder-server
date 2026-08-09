import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * OAuth Client 类型
 * public: 纯前端/CLI，无 client_secret，必须用 PKCE
 * confidential: 服务端应用，持有 client_secret
 */
export enum OAuthClientType {
  PUBLIC = 'public',
  CONFIDENTIAL = 'confidential',
}

/**
 * OAuth2.0 客户端注册表（通用多 client 基础设施）
 * 未来任何项目（前端 web / CLI / 后端服务 / CI）注册自己的 client_id 即可复用登录与 token 体系
 */
@Entity('oauth_clients')
export class OauthClient {
  @PrimaryColumn({ length: 64 })
  clientId: string;

  /** 仅 confidential client 需要；public client（PKCE）可空 */
  @Column({ length: 255, nullable: true })
  clientSecret: string;

  @Column({ length: 100 })
  clientName: string;

  @Column({
    type: 'enum',
    enum: OAuthClientType,
    default: OAuthClientType.PUBLIC,
  })
  type: OAuthClientType;

  /** 合法回调地址白名单，如 ["http://127.0.0.1:<port>/callback"]，支持 * 通配 */
  @Column({ type: 'json' })
  allowedRedirectUris: string[];

  /** 可申请的 scope，如 ["storage:write"] */
  @Column({ type: 'json' })
  allowedScopes: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
