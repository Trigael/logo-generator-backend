/* eslint-disable prettier/prettier */
import { Body, Controller, Post, Headers } from '@nestjs/common';

// Services
import { LogoService } from './logo.service';
import { PricesService } from 'src/prices/prices.service';

// DTOs
import { GenerateLogoDto } from './dto/generate-logo.dto';
import { BuyLogoDto } from './dto/buy-logo.dto';

@Controller('logo')
export class LogoController {
  constructor(
    private readonly logoService: LogoService,
    private readonly pricesService: PricesService,
  ) {}

  @Post('generate')
  generateLogo(@Headers('x-session-id') session_id: string, @Body() body: GenerateLogoDto) {
    return this.logoService.generateLogo(body, session_id);
  }

  @Post('buy')
  buyLogo(@Body() body: BuyLogoDto) {
    return this.logoService.buyLogo(body)
  }

  @Post('price')
  async getGeneratedLogoPrice() {
    // TODO: add multiple currencies to prices
    // TODO: returns price based on currency
    const price = await this.pricesService.getPriceOfGeneratedLogo()

    return {
      product: 'generated_logo',
      price
    }
  }
}
