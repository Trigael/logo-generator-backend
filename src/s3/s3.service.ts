import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { CONFIG_OPTIONS, ConfigService } from 'src/config/config.service';
import { LoggerService } from 'src/logger/logger.service';
import { InternalErrorException } from 'src/utils/exceptios';

import { getSecret } from 'src/utils/helpers.util';

type content_types = {
  'image/png'
}

@Injectable()
export class S3Service {
  private readonly bucket_endpoint = 'https://nbg1.your-objectstorage.com'

  private s3: S3Client;
  private bucket: string;
  private bucket_name: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    this.bucket_name = await this.config.get(CONFIG_OPTIONS.BUCKET_NAME) as string;
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

  async uploadImage(buffer: Buffer, key: string, contentType = 'image/png', is_public: boolean = false) {
    try {
      const command: any = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      if(is_public) command.ACL = 'public-read'

      await this.s3.send(command);

      if(is_public) return `${this.bucket_endpoint}/${this.bucket_name}/${key}`;

      return this.getImage(key)
    } catch (error) {
      this.logger.error(`[S3] Internal error occured during image upload: ${error}`, {
        metadata: { error }
      })

      throw new InternalErrorException(`[S3] Internal error occured during image upload: ${error.message}`)
    }
  }

  async getImage(key: string, expiration = 600): Promise<string> {
    try {
      const cleanedKey = key.replace(/^\/+/, '');
    
      // If image is from folder watermarked/, return public URL
      if (cleanedKey.startsWith('watermarked/')) {
        return `${this.bucket_endpoint}/${this.bucket_name}/${cleanedKey}`;
      }
    
      // Else return signed URL (works 10 mins)
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: cleanedKey,
      });
    
      // Checking if object exits
      await this.s3.send(command);
    
      const signedUrl = await getSignedUrl(this.s3, command, { expiresIn: expiration }); // default = 10 mins

      return signedUrl;
    } catch (error) {
      console.error(`[S3] Error while getting image URL for key "${key}":`, error);

      this.logger.error(`[S3] Error while getting image URL for key "${key}"`, {
        metadata: { error }
      })

      throw new InternalErrorException(`[S3] Cannot get image: ${error.message}`);
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

      this.logger.error(`[S3] Error occured during moving object: ${JSON.stringify(error)}`, {
        metadata: { error }
      })

      throw new InternalErrorException(`[S3] Error occured during moving object: ${JSON.stringify(error.message)}`)
    }
  }
}
