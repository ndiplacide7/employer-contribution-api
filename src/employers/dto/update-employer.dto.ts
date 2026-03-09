import { PartialType } from '@nestjs/swagger';
import { CreateEmployerDto } from './create-employer.dto';

export class UpdateEmployerDto extends PartialType(CreateEmployerDto) {}
