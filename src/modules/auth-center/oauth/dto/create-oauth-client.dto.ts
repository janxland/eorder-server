import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { OAuthClientType } from '../oauth-client.entity';

/**
 * 注册 OAuth Client DTO
 */
export class CreateOauthClientDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsOptional()
  @IsEnum(OAuthClientType)
  type?: OAuthClientType;

  @IsArray()
  @IsNotEmpty()
  allowedRedirectUris: string[];

  @IsOptional()
  @IsArray()
  allowedScopes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
