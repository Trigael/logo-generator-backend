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

export class GenerateLogoDto {
    @IsString()
    @IsNotEmpty()
    brand_name: string;

    @IsString()
    @IsOptional()
    slogan: string;

    @IsString()
    @IsOptional()
    industry: string;
    
    @IsOptional()
    brand_colors: string[];

    @IsOptional()
    logo_style: string[];

    @IsOptional()
    @IsString()
    similiar_style: string;

    @IsOptional()
    @IsString()
    things_to_exclude: string;

    @IsOptional()
    @IsString()
    additional_details: string;

    @IsOptional()
    @IsString()
    logo_resolution: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    amount_to_generate: number;
}
