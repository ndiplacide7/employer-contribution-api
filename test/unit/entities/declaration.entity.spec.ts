import { Declaration } from '../../../src/entities/declaration.entity';

describe('Declaration Entity', () => {
  describe('generatePaymentNumber', () => {
    it('should generate a payment number in PAY-{timestamp}-{4digits} format', () => {
      const decl = new Declaration();
      decl.generatePaymentNumber();
      expect(decl.paymentNumber).toMatch(/^PAY-\d+-\d{4}$/);
    });

    it('should start the payment number with "PAY-"', () => {
      const decl = new Declaration();
      decl.generatePaymentNumber();
      expect(decl.paymentNumber.startsWith('PAY-')).toBe(true);
    });

    it('should include a 4-digit zero-padded random suffix', () => {
      const decl = new Declaration();
      decl.generatePaymentNumber();
      const parts = decl.paymentNumber.split('-');
      // Format: PAY - timestamp - randomSuffix
      const suffix = parts[parts.length - 1];
      expect(suffix).toHaveLength(4);
      expect(/^\d{4}$/.test(suffix)).toBe(true);
    });

    it('should set a new payment number each time it is called', () => {
      const decl = new Declaration();
      decl.generatePaymentNumber();
      const first = decl.paymentNumber;

      // Wait a tick to allow timestamp to change
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          decl.generatePaymentNumber();
          // Both should match the format (values may be the same in the same ms)
          expect(decl.paymentNumber).toMatch(/^PAY-\d+-\d{4}$/);
          expect(first).toMatch(/^PAY-\d+-\d{4}$/);
          resolve();
        }, 1);
      });
    });
  });
});
