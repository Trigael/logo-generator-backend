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
  Min
} from 'class-validator';

export class VerifyPaymentDto {
    @IsNotEmpty()
    session_id: string
}