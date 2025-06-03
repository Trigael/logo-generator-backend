/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';

import { GenerateLogoDto } from './dto/generate-logo.dto';

import { ImageGeneratorService } from 'src/image-generator/image-generator.service';

@Injectable()
export class LogoService {
    constructor(
        private readonly imageGenerator: ImageGeneratorService
    ) {}

    async generateLogo(body: GenerateLogoDto) {
    async generateLogo(body: GenerateLogoDto, session_id?: string) {
        const response = await this.imageGenerator.generateLogo(body)

        // Save picture into DB
        const logo = await this.db.pics.create({ data: {
          url: response.data.url, 
          prompt: response.data.prompt,
          session_id: session_id ?? null
        }})

        response.data.id = logo.id_pics

        return response;
    }
}
