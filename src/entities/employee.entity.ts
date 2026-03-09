import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Employer } from './employer.entity';
import { ContributionLine } from './contribution-line.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  nationalId: string;

  @Column()
  name: string;

  @Column({ type: 'date' })
  dateOfBirth: Date;

  @Column({ type: 'date' })
  hireDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossSalary: number;

  @ManyToOne(() => Employer, (employer) => employer.employees)
  @JoinColumn({ name: 'employerId' })
  employer: Employer;

  @Column()
  @Index()
  employerId: string;

  @OneToMany(() => ContributionLine, (contribution) => contribution.employee)
  contributions: ContributionLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
