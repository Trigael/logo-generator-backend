import { logo_resolutions } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class GenerateLogoDto {
    @IsString()
    @IsNotEmpty()
    brand_name: string;

    @IsString()
    @IsOptional()
    slogan: string;
    
    @IsOptional()
    brand_colors: string;

    @IsOptional()
    logo_style: string;

    @IsOptional()
    @IsString()
    things_to_exclude: string;

    @IsOptional()
    @IsString()
    additional_details: string;

    @IsOptional()
    @IsEnum(logo_resolutions)
    logo_resolution: logo_resolutions;
}
