import { Currencies } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  Max,
  Min,
  IsInt
} from 'class-validator';

export class BuyLogoDto {
  @IsInt()
  @IsNotEmpty()
  logo_url: string

  @IsEnum(Currencies)
  @IsOptional()
  currency?:  Currencies

  @IsEmail()
  @IsNotEmpty()
  email: string
  
  @IsNotEmpty()
  @IsInt()
  logo_id: number
}