import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { InternalErrorException } from 'src/utils/exceptios';

import { getSecret } from 'src/utils/helpers.util';

@Injectable()
export class S3Service {
  private readonly bucket_endpoint = 'https://nbg1.your-objectstorage.com'
  private readonly bucket_name = 'logonest-ai'

  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = this.bucket_name;
    this.s3 = new S3Client({
      region: 'us-east-1',
      endpoint: this.bucket_endpoint,
      credentials: {
        accessKeyId: getSecret(process.env.HETZNER_ACCESS_KEY ?? ''),
        secretAccessKey: getSecret(process.env.HETZNER_SECRET_KEY ?? ''),
      },
      forcePathStyle: true, 
    });
  }

  async uploadImage(buffer: Buffer, key: string, contentType = 'image/png') {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      });

      await this.s3.send(command);

      return `${this.bucket_endpoint}/${this.bucket_name}/${key}`;
    } catch (error) {
      throw new InternalErrorException(`[S3] Internal error occured: ${error}`)
    }
  }

  async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3.send(command);
  }

  async moveObject(oldKey: string, newKey: string): Promise<void> {
    try {
      const cleanedOldKey = oldKey.replace(/^\/+/, '');
      const cleanedNewKey = newKey.replace(/^\/+/, '');

      // Copy object
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${cleanedOldKey}`, 
        Key: cleanedNewKey,
        // ACL: 'public-read', 
      });
      
      await this.s3.send(copyCommand);
    
      // Delete original
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanedOldKey,
      });
    
      await this.s3.send(deleteCommand);
    } catch (error) {
      console.log(`[S3] Error occured during moving object: ${JSON.stringify(error)}`)

      throw new InternalErrorException(`[S3] Error occured during moving object: ${JSON.stringify(error)}`)
    }
  }
}
