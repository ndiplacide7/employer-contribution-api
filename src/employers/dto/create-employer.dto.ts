import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateEmployerDto {
  @ApiProperty({ example: 'ABC Corporation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'TIN123456789' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tin: string;

  @ApiProperty({ example: 'Technology' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sector: string;
}
