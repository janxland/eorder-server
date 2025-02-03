import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from './resource.entity';
import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Resource)
    private readonly resourceRepository: Repository<Resource>,
  ) {}

  /**
   * 计算文件的 MD5 值
   * @param file 文件
   * @returns 文件的 MD5 值
   */
  private calculateMd5(fileBuffer: Buffer): string {
    const hash = crypto.createHash('md5');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  /**
   * 上传文件
   * @param file 文件
   * @param resourceType 资源类型
   * @returns 上传后的资源信息
   */
  async uploadFile(file: Express.Multer.File, resourceType: string): Promise<Resource> {
    // 计算文件的 MD5 值
    const md5 = this.calculateMd5(file.buffer);

    // 检查文件是否已存在
    const existingResource = await this.resourceRepository.findOne({ where: { md5 } });
    if (existingResource) {
      return existingResource; // 如果文件已存在，直接返回已存在的资源信息
    }

    const uploadDir = path.join(__dirname, '..', 'static', resourceType);
    const fileName = uuidv4() + path.extname(file.originalname); // 使用 UUID 防止文件名冲突
    const filePath = path.join(uploadDir, fileName);

    // 确保目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 将文件保存到指定目录
    fs.writeFileSync(filePath, file.buffer);

    // 将文件信息保存到数据库
    const resource = new Resource();
    resource.fileName = fileName;
    resource.filePath = filePath;
    resource.resourceType = resourceType;
    resource.md5 = md5;
    resource.description = file.originalname;

    return this.resourceRepository.save(resource);
  }

  /**
   * 上传网络资源
   * @param url 网络资源 URL
   * @param resourceType 资源类型
   * @returns 上传后的资源信息
   */
  async uploadUrlResource(url: string, resourceType: string): Promise<Resource> {
    const resource = new Resource();
    resource.url = url;
    resource.resourceType = resourceType;

    return this.resourceRepository.save(resource);
  }

  /**
   * 删除资源
   * @param id 资源ID
   */
  async deleteResource(id: number): Promise<void> {
    const resource = await this.resourceRepository.findOne({ where: { id } });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    // 如果是文件类型，删除文件
    if (resource.filePath && fs.existsSync(resource.filePath)) {
      fs.unlinkSync(resource.filePath);
    }

    // 删除数据库中的记录
    await this.resourceRepository.remove(resource);
  }

  /**
   * 获取资源的 URL
   * @param id 资源ID
   * @returns 资源的 URL
   */
  async getResourceUrl(id: number): Promise<string> {
    const resource = await this.resourceRepository.findOne({ where: { id } });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    // 如果是文件类型，返回文件的相对路径
    if (resource.filePath) {
      return `/static/${resource.resourceType}/${resource.fileName}`;
    }

    // 如果是网络资源，返回其 URL
    if (resource.url) {
      return resource.url;
    }

    throw new Error('Resource has no URL or file path');
  }
}
