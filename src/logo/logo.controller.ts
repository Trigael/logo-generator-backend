/* eslint-disable prettier/prettier */
import { Body, Controller, Post, Headers } from '@nestjs/common';

// Services
import { LogoService } from './logo.service';
import { PricesService } from 'src/prices/prices.service';

// DTOs
import { GenerateLogoDto } from './dto/generate-logo.dto';
import { BuyLogoDto } from './dto/buy-logo.dto';
import { currencies } from '@prisma/client';
import { BuyLogoResponseDto } from './dto/responses/buy-logo-response.dto';
import { ApiCreatedResponse, ApiResponse } from '@nestjs/swagger';

@Controller('logo')
export class LogoController {
  constructor(
    private readonly logoService: LogoService,
    private readonly pricesService: PricesService,
  ) {}

  @Post('generate')
  generateLogo(@Headers('x-session-id') session_id: string, @Body() body: GenerateLogoDto) {
    // return this.logoService.generateLogo(body, session_id);
    return this.logoService.generateLogoWithPromptRefactoring(body, session_id)
  }

  @Post('buy')
  @ApiCreatedResponse({
    description: "Successful payment intent created to buy specified logos",
    type: BuyLogoResponseDto
  })
  async buyLogo(@Body() body: BuyLogoDto) {
    return this.logoService.buyLogo(body)
  }

  @Post('price')
  async getGeneratedLogoPrice(@Body() body: { currency: currencies }) {
    const price = await this.pricesService.getPriceOfGeneratedLogo(body.currency)

    return {
      product: 'generated_logo',
      price,
    }
  }
}
