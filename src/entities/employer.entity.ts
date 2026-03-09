import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EmployerStatus } from '../common/enums';
import { Employee } from './employee.entity';
import { Declaration } from './declaration.entity';
import { User } from './user.entity';

@Entity('employers')
export class Employer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  @Index()
  tin: string;

  @Column()
  sector: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  registrationDate: Date;

  @Column({
    type: 'enum',
    enum: EmployerStatus,
    default: EmployerStatus.ACTIVE,
  })
  status: EmployerStatus;

  @OneToOne(() => User, (user) => user.employer)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Employee, (employee) => employee.employer)
  employees: Employee[];

  @OneToMany(() => Declaration, (declaration) => declaration.employer)
  declarations: Declaration[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
