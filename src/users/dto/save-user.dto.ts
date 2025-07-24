import {
  IsEmail,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveUserDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    example: "john.doe@gmail.com",
    description: "Specifies email of the client",
    required: true,
  })
  email: string
}