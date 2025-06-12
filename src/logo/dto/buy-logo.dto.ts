import { Currencies } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class BuyLogoDto {
  @IsEnum(Currencies)
  @IsOptional()
  currency?:  Currencies

  @IsEmail()
  @IsNotEmpty()
  email: string
  
  @IsNotEmpty()
  logo_ids: number[]
}