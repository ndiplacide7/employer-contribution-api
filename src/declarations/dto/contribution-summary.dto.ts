import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ContributionSummaryQueryDto {
  @ApiPropertyOptional({
    example: '202401',
    description: 'Start period in YYYYMM format',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Start period must be in YYYYMM format (e.g., 202401)',
  })
  startPeriod?: string;

  @ApiPropertyOptional({
    example: '202412',
    description: 'End period in YYYYMM format',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'End period must be in YYYYMM format (e.g., 202412)',
  })
  endPeriod?: string;
}
