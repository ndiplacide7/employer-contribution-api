import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Matches,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContributionLineDto {
  @ApiProperty({ example: 'employee-uuid' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive()
  grossSalaryForPeriod: number;
}

export class CreateDeclarationDto {
  @ApiProperty({ example: '202401', description: 'Period in YYYYMM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: 'Period must be in YYYYMM format (e.g., 202401)',
  })
  period: string;

  @ApiProperty({
    type: [ContributionLineDto],
    description: 'List of employee contributions',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContributionLineDto)
  contributions: ContributionLineDto[];
}
