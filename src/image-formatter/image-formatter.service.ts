import { Injectable } from '@nestjs/common';
import axios from 'axios';

// Services
import { S3Service } from 'src/s3/s3.service';

@Injectable()
export class ImageFormatterService {
    private readonly sharp = require('sharp');

    constructor(
        private readonly s3: S3Service,
    ) {}

    /**
     * Used to format images into PNG with transparent background
     * @param img_url URL to the image, you want to be formatted
     * @param name new name for the picture
     * @returns URL to new image as PNG with transparent background
     */
    async formatIntoTransparentPng(img_url: string, name: string) {
        // Download image
        const response = await axios.get(img_url, { responseType: 'arraybuffer' });
        const originalBuffer = Buffer.from(response.data);

        // Background detection and mask creation
        const pngBuffer = await this.sharp(originalBuffer)
          .removeAlpha() 
          .flatten({ background: '#ffffff' }) 
          .toColourspace('b-w') 
          .threshold(240) 
          .toBuffer();

        const alpha = await this.sharp(pngBuffer)
          .toColourspace('b-w')
          .negate()
          .toBuffer();

        const transparentPng = await this.sharp(originalBuffer)
          .ensureAlpha()
          .joinChannel(alpha) 
          .png()
          .toBuffer();

        // Upload onto bucket
        const key = `transparent/${name}.png`;
        const url = await this.s3.uploadImage(transparentPng, key, 'image/png');

        return url;
    }

    /**
    * Resizes the image to given dimensions, preserving aspect ratio and format.
    * @param img_url URL to the image to resize
    * @param name new name for the resized image (without extension)
    * @param width max width
    * @param height max height
    * @returns URL to the resized image on the bucket
    */
    async resizeImage(img_url: string, name: string, width: number, height: number) {
      // Download the image
      const response = await axios.get(img_url, { responseType: 'arraybuffer' });
      const originalBuffer = Buffer.from(response.data);

      // What format the image is
      const metadata = await this.sharp(originalBuffer).metadata();
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
}
