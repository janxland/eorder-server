import { Exclude } from 'class-transformer';
import {
  Allow
} from 'class-validator';




export class GetTypeDto {
  @Allow()
  pageSize?: number;

  @Allow()
  pageNo?: number;

  @Allow()
  name?: string;

  @Allow()
  status?: string;
}
