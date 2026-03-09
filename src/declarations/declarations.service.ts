import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Declaration } from '../entities/declaration.entity';
import { ContributionLine } from '../entities/contribution-line.entity';
import { Employee } from '../entities/employee.entity';
import { CreateDeclarationDto } from './dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { DeclarationStatus, UserRole } from '../common/enums';
import { ContributionSummaryQueryDto } from './dto/contribution-summary.dto';

@Injectable()
export class DeclarationsService {
  constructor(
    @InjectRepository(Declaration)
    private declarationRepository: Repository<Declaration>,
    @InjectRepository(ContributionLine)
    private contributionRepository: Repository<ContributionLine>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  async create(
    createDeclarationDto: CreateDeclarationDto,
    employerId: string,
  ): Promise<Declaration> {
    // Check for duplicate period
    const existingDeclaration = await this.declarationRepository.findOne({
      where: {
        employerId,
        period: createDeclarationDto.period,
      },
    });

    if (existingDeclaration) {
      throw new ConflictException('errors.declaration.period_exists');
    }

    // Validate that all employees belong to the employer
    const employeeIds = createDeclarationDto.contributions.map(
      (c) => c.employeeId,
    );
    const employees = await this.employeeRepository.find({
      where: employeeIds.map((id) => ({ id, employerId })),
    });

    if (employees.length !== employeeIds.length) {
      throw new BadRequestException('errors.employee.not_belong');
    }

    // Create declaration
    const declaration = this.declarationRepository.create({
      employerId,
      period: createDeclarationDto.period,
      status: DeclarationStatus.DRAFT,
    });

    const savedDeclaration = await this.declarationRepository.save(declaration);

    // Create contribution lines with auto-calculated amounts
    const contributions = createDeclarationDto.contributions.map((contrib) => {
      return this.contributionRepository.create({
        declarationId: savedDeclaration.id,
        employeeId: contrib.employeeId,
        grossSalaryForPeriod: contrib.grossSalaryForPeriod,
      });
    });

    await this.contributionRepository.save(contributions);

    // Return declaration with contributions
    return this.declarationRepository.findOne({
      where: { id: savedDeclaration.id },
      relations: ['contributions', 'contributions.employee'],
    });
  }

  async findAll(
    paginationDto: PaginationDto,
    employerId?: string,
  ): Promise<PaginatedResponse<Declaration>> {
    const { offset, limit } = paginationDto;

    const query = this.declarationRepository.createQueryBuilder('declaration');

    if (employerId) {
      query.where('declaration.employerId = :employerId', { employerId });
    }

    const [data, total] = await query
      .leftJoinAndSelect('declaration.contributions', 'contributions')
      .leftJoinAndSelect('contributions.employee', 'employee')
      .skip(offset)
      .take(limit)
      .orderBy('declaration.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, offset, limit };
  }

  async findOne(
    id: string,
    employerId?: string,
    userRole?: string,
  ): Promise<Declaration> {
    const query = this.declarationRepository
      .createQueryBuilder('declaration')
      .leftJoinAndSelect('declaration.contributions', 'contributions')
      .leftJoinAndSelect('contributions.employee', 'employee')
      .where('declaration.id = :id', { id });

    if (userRole === UserRole.EMPLOYER && employerId) {
      query.andWhere('declaration.employerId = :employerId', { employerId });
    }

    const declaration = await query.getOne();

    if (!declaration) {
      throw new NotFoundException('errors.declaration.not_found');
    }

    return declaration;
  }

  async submit(
    id: string,
    employerId?: string,
    userRole?: string,
  ): Promise<Declaration> {
    const declaration = await this.findOne(id, employerId, userRole);

    if (declaration.status !== DeclarationStatus.DRAFT) {
      throw new BadRequestException('errors.declaration.submit_requires_draft');
    }

    declaration.status = DeclarationStatus.SUBMITTED;
    declaration.submittedAt = new Date();

    return this.declarationRepository.save(declaration);
  }

  async validate(id: string): Promise<Declaration> {
    const declaration = await this.findOne(id);

    if (declaration.status !== DeclarationStatus.SUBMITTED) {
      throw new BadRequestException('errors.declaration.validate_requires_submitted');
    }

    declaration.status = DeclarationStatus.VALIDATED;
    return this.declarationRepository.save(declaration);
  }

  async reject(id: string): Promise<Declaration> {
    const declaration = await this.findOne(id);

    if (declaration.status !== DeclarationStatus.SUBMITTED) {
      throw new BadRequestException('errors.declaration.reject_requires_submitted');
    }

    declaration.status = DeclarationStatus.REJECTED;
    return this.declarationRepository.save(declaration);
  }

  async getContributionSummary(
    employerId: string,
    query: ContributionSummaryQueryDto,
  ): Promise<any[]> {
    const queryBuilder = this.declarationRepository
      .createQueryBuilder('declaration')
      .leftJoin('declaration.contributions', 'contribution')
      .select('declaration.period', 'period')
      .addSelect('SUM(contribution.pensionAmount)', 'totalPension')
      .addSelect('SUM(contribution.medicalAmount)', 'totalMedical')
      .addSelect('SUM(contribution.maternityAmount)', 'totalMaternity')
      .addSelect('SUM(contribution.total)', 'totalContributions')
      .addSelect('COUNT(contribution.id)', 'employeeCount')
      .where('declaration.employerId = :employerId', { employerId })
      .andWhere('declaration.status != :status', {
        status: DeclarationStatus.DRAFT,
      })
      .groupBy('declaration.period')
      .orderBy('declaration.period', 'DESC');

    if (query.startPeriod) {
      queryBuilder.andWhere('declaration.period >= :startPeriod', {
        startPeriod: query.startPeriod,
      });
    }

    if (query.endPeriod) {
      queryBuilder.andWhere('declaration.period <= :endPeriod', {
        endPeriod: query.endPeriod,
      });
    }

    const results = await queryBuilder.getRawMany();

    return results.map((result) => ({
      period: result.period,
      employeeCount: parseInt(result.employeeCount),
      totalPension: parseFloat(result.totalPension || 0),
      totalMedical: parseFloat(result.totalMedical || 0),
      totalMaternity: parseFloat(result.totalMaternity || 0),
      totalContributions: parseFloat(result.totalContributions || 0),
    }));
  }

  async remove(
    id: string,
    employerId?: string,
    userRole?: string,
  ): Promise<void> {
    const declaration = await this.findOne(id, employerId, userRole);

    if (
      declaration.status === DeclarationStatus.SUBMITTED ||
      declaration.status === DeclarationStatus.VALIDATED
    ) {
      throw new BadRequestException('errors.declaration.cannot_delete');
    }

    await this.declarationRepository.remove(declaration);
  }
}
