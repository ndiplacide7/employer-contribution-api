import { ContributionLine } from '../../../src/entities/contribution-line.entity';

describe('ContributionLine Entity', () => {
  describe('calculateContributions', () => {
    let line: ContributionLine;

    beforeEach(() => {
      line = new ContributionLine();
    });

    it('should calculate pension at 6% of gross salary', () => {
      line.grossSalaryForPeriod = 50000;
      line.calculateContributions();
      expect(line.pensionAmount).toBe(3000);
    });

    it('should calculate medical insurance at 7.5% of gross salary', () => {
      line.grossSalaryForPeriod = 50000;
      line.calculateContributions();
      expect(line.medicalAmount).toBe(3750);
    });

    it('should calculate maternity at 0.3% of gross salary', () => {
      line.grossSalaryForPeriod = 50000;
      line.calculateContributions();
      expect(line.maternityAmount).toBe(150);
    });

    it('should calculate total as the sum of pension, medical and maternity', () => {
      line.grossSalaryForPeriod = 50000;
      line.calculateContributions();
      expect(line.total).toBe(line.pensionAmount + line.medicalAmount + line.maternityAmount);
      expect(line.total).toBe(6900);
    });

    it('should round amounts to 2 decimal places', () => {
      line.grossSalaryForPeriod = 33333;
      line.calculateContributions();
      expect(line.pensionAmount).toBe(Number((33333 * 0.06).toFixed(2)));
      expect(line.medicalAmount).toBe(Number((33333 * 0.075).toFixed(2)));
      expect(line.maternityAmount).toBe(Number((33333 * 0.003).toFixed(2)));
    });

    it('should produce consistent results on repeated calls (BeforeUpdate)', () => {
      line.grossSalaryForPeriod = 80000;
      line.calculateContributions();
      const first = { pension: line.pensionAmount, medical: line.medicalAmount };
      line.calculateContributions();
      expect(line.pensionAmount).toBe(first.pension);
      expect(line.medicalAmount).toBe(first.medical);
    });

    it('should correctly calculate for zero salary', () => {
      line.grossSalaryForPeriod = 0;
      line.calculateContributions();
      expect(line.pensionAmount).toBe(0);
      expect(line.medicalAmount).toBe(0);
      expect(line.maternityAmount).toBe(0);
      expect(line.total).toBe(0);
    });
  });
});
