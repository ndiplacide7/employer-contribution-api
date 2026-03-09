import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeclarationsService } from './declarations.service';
import { DeclarationsController } from './declarations.controller';
import { Declaration } from '../entities/declaration.entity';
import { ContributionLine } from '../entities/contribution-line.entity';
import { Employee } from '../entities/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Declaration, ContributionLine, Employee])],
  controllers: [DeclarationsController],
  providers: [DeclarationsService],
  exports: [DeclarationsService],
})
export class DeclarationsModule {}
