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
  BeforeInsert,
} from 'typeorm';
import { DeclarationStatus } from '../common/enums';
import { Employer } from './employer.entity';
import { ContributionLine } from './contribution-line.entity';

@Entity('declarations')
@Index(['employerId', 'period'], { unique: true })
export class Declaration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  paymentNumber: string;

  @ManyToOne(() => Employer, (employer) => employer.declarations)
  @JoinColumn({ name: 'employerId' })
  employer: Employer;

  @Column()
  @Index()
  employerId: string;

  @Column({ length: 6 })
  @Index()
  period: string; // Format: YYYYMM

  @Column({
    type: 'enum',
    enum: DeclarationStatus,
    default: DeclarationStatus.DRAFT,
  })
  status: DeclarationStatus;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @OneToMany(() => ContributionLine, (contribution) => contribution.declaration, {
    cascade: true,
  })
  contributions: ContributionLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generatePaymentNumber() {
    // Generate unique payment number: PREFIX-TIMESTAMP-RANDOM
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    this.paymentNumber = `PAY-${timestamp}-${random}`;
  }
}
