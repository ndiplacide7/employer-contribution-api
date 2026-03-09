import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsPositive,
  MaxLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'NAT123456789' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nationalId: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: '1990-01-01' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ example: '2020-01-01' })
  @IsDateString()
  hireDate: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive()
  grossSalary: number;
}
