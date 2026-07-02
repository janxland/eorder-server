/**
 * CDN 配置实体
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'cdn_configs', timestamps: true })
export class CdnConfig {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, maxlength: 50 })
  name: string;

  @Prop({ required: true, maxlength: 500 })
  baseUrl: string;

  @Prop({ required: true, maxlength: 500 })
  apiKey: string;

  @Prop({ maxlength: 100 })
  model?: string;

  @Prop({ default: false })
  isDefault: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CdnConfigSchema = SchemaFactory.createForClass(CdnConfig);

CdnConfigSchema.index({ userId: 1 });

export type CdnConfigDocument = CdnConfig & Document;
