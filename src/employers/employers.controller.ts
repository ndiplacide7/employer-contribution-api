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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmployersService } from './employers.service';
import { CreateEmployerDto, UpdateEmployerDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Employers')
@Controller('employers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployersController {
  constructor(private readonly employersService: EmployersService) {}

  @Post()
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create employer profile' })
  @ApiResponse({ status: 201, description: 'Employer created successfully' })
  @ApiResponse({ status: 409, description: 'TIN already exists' })
  create(@Body() createEmployerDto: CreateEmployerDto, @CurrentUser() user: any) {
    return this.employersService.create(createEmployerDto, user.userId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all employers (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employers retrieved successfully' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.employersService.findAll(paginationDto);
  }

  @Get(':id')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get employer by ID' })
  @ApiResponse({ status: 200, description: 'Employer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Employer not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.employersService.findOne(id, user.userId, user.role);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update employer' })
  @ApiResponse({ status: 200, description: 'Employer updated successfully' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployerDto: UpdateEmployerDto,
    @CurrentUser() user: any,
  ) {
    return this.employersService.update(
      id,
      updateEmployerDto,
      user.userId,
      user.role,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete employer (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employer deleted successfully' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.employersService.remove(id, user.userId, user.role);
  }
}
