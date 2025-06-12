import { Currencies } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BuyLogoDto {
  @IsEnum(Currencies)
  @IsOptional()
  @Transform(({ value }) => value ?? Currencies.EUR)
  @ApiProperty({
    example: Currencies.EUR,
    description: "Specifies what currency will be used in payment",
    enum: Currencies,
    required: false,
    default: Currencies.EUR
  })
  currency?:  Currencies

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