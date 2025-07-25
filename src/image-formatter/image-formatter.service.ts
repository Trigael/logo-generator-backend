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
}
