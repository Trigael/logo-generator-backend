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
        const response = await this.imageGenerator.generateLogo(body)
        return response;
    }
}
