import { currencies } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BuyLogoDto {
  @IsEnum(currencies)
  @IsOptional()
  @Transform(({ value }) => value ?? currencies.EUR)
  @ApiProperty({
    example: currencies.EUR,
    description: "Specifies what currency will be used in payment",
    enum: currencies,
    required: false,
    default: currencies.EUR
  })
  currency?:  currencies

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    example: "john.doe@gmail.com",
    description: "Specifies email of the client",
    required: true,
  })
  email: string
  
  @IsNotEmpty()
  @ApiProperty({
    example: [1, 35],
    description: "Specifies what logos you want to buy",
    required: true,
  })
  logo_ids: number[]
}