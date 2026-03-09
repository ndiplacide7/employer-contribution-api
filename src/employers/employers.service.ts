import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employer } from '../entities/employer.entity';
import { User } from '../entities/user.entity';
import { CreateEmployerDto, UpdateEmployerDto } from './dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { UserRole } from '../common/enums';

@Injectable()
export class EmployersService {
  constructor(
    @InjectRepository(Employer)
    private employerRepository: Repository<Employer>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(
    createEmployerDto: CreateEmployerDto,
    userId: string,
  ): Promise<Employer> {
    // Check if TIN already exists
    const existingEmployer = await this.employerRepository.findOne({
      where: { tin: createEmployerDto.tin },
    });

    if (existingEmployer) {
      throw new ConflictException('errors.employer.tin_exists');
    }

    // Check if user already has an employer profile
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['employer'],
    });

    if (user.employer) {
      throw new ConflictException('errors.employer.profile_exists');
    }

    const employer = this.employerRepository.create({
      ...createEmployerDto,
      userId,
    });

    return this.employerRepository.save(employer);
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<Employer>> {
    const { offset, limit } = paginationDto;

    const [data, total] = await this.employerRepository.findAndCount({
      skip: offset,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, offset, limit };
  }

  async findOne(id: string, userId?: string, userRole?: string): Promise<Employer> {
    const employer = await this.employerRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!employer) {
      throw new NotFoundException('errors.employer.not_found');
    }

    // Employers can only access their own data
    if (userRole === UserRole.EMPLOYER && employer.userId !== userId) {
      throw new ForbiddenException('errors.employer.access_denied');
    }

    return employer;
  }

  async update(
    id: string,
    updateEmployerDto: UpdateEmployerDto,
    userId: string,
    userRole: string,
  ): Promise<Employer> {
    const employer = await this.findOne(id, userId, userRole);

    // Check if TIN is being updated and if it already exists
    if (updateEmployerDto.tin && updateEmployerDto.tin !== employer.tin) {
      const existingEmployer = await this.employerRepository.findOne({
        where: { tin: updateEmployerDto.tin },
      });

      if (existingEmployer) {
        throw new ConflictException('errors.employer.tin_exists');
      }
    }

    Object.assign(employer, updateEmployerDto);
    return this.employerRepository.save(employer);
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const employer = await this.findOne(id, userId, userRole);
    await this.employerRepository.remove(employer);
  }
}
