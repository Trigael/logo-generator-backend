import { Injectable } from '@nestjs/common';
import { vectorize, Preset } from '@neplex/vectorizer'
import axios from 'axios';

// Services
import { S3Service } from 'src/s3/s3.service';
import { InternalErrorException } from 'src/utils/exceptios';

@Injectable()
export class ImageFormatterService {
    private readonly sharp = require('sharp');

    constructor(
        private readonly s3: S3Service,
    ) {}

    /**
     * Used to format images into PNG with transparent background
     * @param image_buffer 
     * @param name 
     * @returns 
     */
    async formatIntoTransparentPng(image_buffer: Buffer, name?: string) {
      const base = this.sharp(image_buffer, { failOn: 'none' }).rotate();
      const meta = await base.metadata();
      const W = meta.width ?? 0;
      const H = meta.height ?? 0;

      if (!W || !H) throw new Error('Unsupported or empty image buffer');
    
      const whiteThreshold = 235; // 0..255
      const feather = 0.8;
    
      // Creating 1-channel mask
      const mask = await base
        .clone()
        .removeAlpha()
        .greyscale()
        .blur(feather)
        .linear(1, -whiteThreshold)
        .normalize()     
        .negate()
        .toColourspace('b-w')
        .png()         
        .toBuffer();
    
      // Application of mask as alpha
      const out = await base
        .clone()
        .removeAlpha()
        .ensureAlpha()
        .composite([{ input: mask, blend: 'dest-in' }])
        .png({ compressionLevel: 9 })
        .toBuffer();
    
      if (name) {
        const key = `transparent/${name}.png`;
        
        return await this.s3.uploadImage(out, key, 'image/png', true);
      }

      return out;
    }

    /**
    * Resizes the image to given dimensions, preserving aspect ratio and format.
    * @param img_url URL to the image to resize
    * @param name new name for the resized image (without extension)
    * @param width max width
    * @param height max height
    * @returns URL to the resized image on the bucket
    */
    async resizeToSmallerImage(img_url: string, name: string, width: number, height: number): Promise<string> {
      // Download the image
      const response = await axios.get(img_url, { responseType: 'arraybuffer' });
      const originalBuffer = Buffer.from(response.data);
      const metadata = await this.sharp(originalBuffer).metadata();

      // If width or height return false
      if(metadata.height > height || metadata.width > width) 
        throw new InternalErrorException(`You can't use this function to resize the image to higher resolution than the origanals picture`)

      // What format the image is
      const format = metadata.format ?? 'png'; 

      // Resizing the picture
      const resizedBuffer = await this.sharp(originalBuffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })[format]() // example. .jpeg(), .png(), .webp(), ...
        .toBuffer();

      const contentType = `image/${format === 'jpg' ? 'jpeg' : format}`; // getting right MIME type
      const key = `resized/${name}.${format}`;

      // Upload onto bucket
      const url = await this.s3.uploadImage(resizedBuffer, key, contentType);

      return url;
    }

    async imageUrlToSvgBuffer(imgUrl: string): Promise<Buffer> {
      const res = await axios.get(imgUrl, { responseType: 'arraybuffer' })
      const png = Buffer.from(res.data)

      // VTracer vectorizes image by preset
      const svgString = await vectorize(png, Preset.Poster)

      // returning as Buffer
      return Buffer.from(svgString, 'utf8')
    }
}
