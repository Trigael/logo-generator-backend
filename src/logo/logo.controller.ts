/* eslint-disable prettier/prettier */
import { Body, Controller, Post } from '@nestjs/common';

import { LogoService } from './logo.service';

import { GenerateLogoDto } from './dto/generate-logo.dto';

@Controller('logo')
export class LogoController {
  constructor(private readonly logoService: LogoService) {}

  @Post('generate')
  generateLogo(@Body() body: GenerateLogoDto) {
    return this.logoService.generateLogo(body);
  }
}
