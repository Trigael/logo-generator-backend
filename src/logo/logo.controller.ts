/* eslint-disable prettier/prettier */
import { Body, Controller, Post, Headers } from '@nestjs/common';

import { LogoService } from './logo.service';

import { GenerateLogoDto } from './dto/generate-logo.dto';
import { BuyLogoDto } from './dto/buy-logo.dto';

@Controller('logo')
export class LogoController {
  constructor(private readonly logoService: LogoService) {}

  @Post('generate')
  generateLogo(@Headers('x-session-id') session_id: string, @Body() body: GenerateLogoDto) {
    return this.logoService.generateLogo(body, session_id);
  }

  @Post('buy')
  buyLogo(@Body() body: BuyLogoDto) {
    return this.logoService.buyLogo(body)
  }
}
