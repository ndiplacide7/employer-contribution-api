import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Register an employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 409, description: 'National ID already exists' })
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() user: any,
  ) {
    if (!user.employerId && user.role === UserRole.EMPLOYER) {
      throw new ForbiddenException('errors.employer.profile_required');
    }
    return this.employeesService.create(createEmployeeDto, user.employerId);
  }

  @Get()
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all employees' })
  @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
  findAll(@Query() paginationDto: PaginationDto, @CurrentUser() user: any) {
    const employerId =
      user.role === UserRole.EMPLOYER ? user.employerId : undefined;
    return this.employeesService.findAll(paginationDto, employerId);
  }

  @Get(':id')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.employeesService.findOne(id, user.employerId, user.role);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update employee' })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentUser() user: any,
  ) {
    return this.employeesService.update(
      id,
      updateEmployeeDto,
      user.employerId,
      user.role,
    );
  }

  @Delete(':id')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete employee' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.employeesService.remove(id, user.employerId, user.role);
  }
}
