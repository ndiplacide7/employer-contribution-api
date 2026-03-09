import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  Patch,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DeclarationsService } from './declarations.service';
import { CreateDeclarationDto, ContributionSummaryQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Declarations')
@Controller('declarations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DeclarationsController {
  constructor(private readonly declarationsService: DeclarationsService) {}

  @Post()
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Create a new declaration (draft)' })
  @ApiResponse({ status: 201, description: 'Declaration created successfully' })
  @ApiResponse({ status: 409, description: 'Declaration for this period already exists' })
  create(
    @Body() createDeclarationDto: CreateDeclarationDto,
    @CurrentUser() user: any,
  ) {
    if (!user.employerId) {
      throw new ForbiddenException('errors.employer.profile_required');
    }
    return this.declarationsService.create(createDeclarationDto, user.employerId);
  }

  @Get()
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all declarations' })
  @ApiResponse({ status: 200, description: 'Declarations retrieved successfully' })
  findAll(@Query() paginationDto: PaginationDto, @CurrentUser() user: any) {
    const employerId =
      user.role === UserRole.EMPLOYER ? user.employerId : undefined;
    return this.declarationsService.findAll(paginationDto, employerId);
  }

  @Get('summary')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Get contribution summary grouped by month',
    description:
      'Returns total contributions grouped by month with optional date range filter',
  })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  getContributionSummary(
    @Query() query: ContributionSummaryQueryDto,
    @CurrentUser() user: any,
  ) {
    if (!user.employerId) {
      throw new ForbiddenException('errors.employer.profile_required');
    }
    return this.declarationsService.getContributionSummary(
      user.employerId,
      query,
    );
  }

  @Get(':id')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get declaration by ID' })
  @ApiResponse({ status: 200, description: 'Declaration retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.declarationsService.findOne(id, user.employerId, user.role);
  }

  @Patch(':id/submit')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Submit a declaration' })
  @ApiResponse({ status: 200, description: 'Declaration submitted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Only draft declarations can be submitted',
  })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.declarationsService.submit(id, user.employerId, user.role);
  }

  @Patch(':id/validate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Validate a declaration (Admin only)' })
  @ApiResponse({ status: 200, description: 'Declaration validated successfully' })
  validate(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.validate(id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a declaration (Admin only)' })
  @ApiResponse({ status: 200, description: 'Declaration rejected successfully' })
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.declarationsService.reject(id);
  }

  @Delete(':id')
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a declaration (only drafts)' })
  @ApiResponse({ status: 200, description: 'Declaration deleted successfully' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.declarationsService.remove(id, user.employerId, user.role);
  }
}
