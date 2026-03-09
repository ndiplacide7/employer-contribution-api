import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { UserRole } from '../common/enums';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  async create(
    createEmployeeDto: CreateEmployeeDto,
    employerId: string,
  ): Promise<Employee> {
    // Check if national ID already exists
    const existingEmployee = await this.employeeRepository.findOne({
      where: { nationalId: createEmployeeDto.nationalId },
    });

    if (existingEmployee) {
      throw new ConflictException('errors.employee.national_id_exists');
    }

    const employee = this.employeeRepository.create({
      ...createEmployeeDto,
      employerId,
    });

    return this.employeeRepository.save(employee);
  }

  async findAll(
    paginationDto: PaginationDto,
    employerId?: string,
  ): Promise<PaginatedResponse<Employee>> {
    const { offset, limit } = paginationDto;

    const query = this.employeeRepository.createQueryBuilder('employee');

    if (employerId) {
      query.where('employee.employerId = :employerId', { employerId });
    }

    const [data, total] = await query
      .skip(offset)
      .take(limit)
      .orderBy('employee.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, offset, limit };
  }

  async findOne(
    id: string,
    employerId?: string,
    userRole?: string,
  ): Promise<Employee> {
    const query = this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.id = :id', { id });

    if (userRole === UserRole.EMPLOYER && employerId) {
      query.andWhere('employee.employerId = :employerId', { employerId });
    }

    const employee = await query.getOne();

    if (!employee) {
      throw new NotFoundException('errors.employee.not_found');
    }

    return employee;
  }

  async update(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
    employerId?: string,
    userRole?: string,
  ): Promise<Employee> {
    const employee = await this.findOne(id, employerId, userRole);

    // Check if national ID is being updated and if it already exists
    if (
      updateEmployeeDto.nationalId &&
      updateEmployeeDto.nationalId !== employee.nationalId
    ) {
      const existingEmployee = await this.employeeRepository.findOne({
        where: { nationalId: updateEmployeeDto.nationalId },
      });

      if (existingEmployee) {
        throw new ConflictException('errors.employee.national_id_exists');
      }
    }

    Object.assign(employee, updateEmployeeDto);
    return this.employeeRepository.save(employee);
  }

  async remove(
    id: string,
    employerId?: string,
    userRole?: string,
  ): Promise<void> {
    const employee = await this.findOne(id, employerId, userRole);
    await this.employeeRepository.remove(employee);
  }
}
