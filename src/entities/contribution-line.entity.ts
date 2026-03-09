import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Declaration } from './declaration.entity';

@Entity('contribution_lines')
export class ContributionLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, (employee) => employee.contributions)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column()
  employeeId: string;

  @ManyToOne(() => Declaration, (declaration) => declaration.contributions)
  @JoinColumn({ name: 'declarationId' })
  declaration: Declaration;

  @Column()
  declarationId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossSalaryForPeriod: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pensionAmount: number; // 6%

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  medicalAmount: number; // 7.5%

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  maternityAmount: number; // 0.3%

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateContributions() {
    // Calculate contributions based on gross salary
    this.pensionAmount = Number((this.grossSalaryForPeriod * 0.06).toFixed(2));
    this.medicalAmount = Number((this.grossSalaryForPeriod * 0.075).toFixed(2));
    this.maternityAmount = Number((this.grossSalaryForPeriod * 0.003).toFixed(2));
    this.total = Number(
      (this.pensionAmount + this.medicalAmount + this.maternityAmount).toFixed(2),
    );
  }
}
