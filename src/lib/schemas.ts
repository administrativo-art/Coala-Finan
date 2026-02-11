import { z } from 'zod';

export const expenseFormSchema = z
  .object({
    costCenter: z.string().min(1, 'Centro de custo é obrigatório.'),
    description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
    totalValue: z.coerce.number().positive('O valor total deve ser positivo.'),
    competenceDate: z.date({
      required_error: 'Data de competência é obrigatória.',
    }),
    dueDate: z.date({
      required_error: 'Data de vencimento é obrigatória.',
    }),
    isApportioned: z.boolean().default(false),
    resultCenter: z.string().optional(),
    apportionments: z
      .array(
        z.object({
          resultCenter: z.string().min(1, 'Centro de resultado é obrigatório.'),
          percentage: z.coerce.number().min(1, 'Porcentagem deve ser maior que 0.'),
        })
      )
      .optional(),
    paymentMethod: z.enum(['single', 'installments']).default('single'),
    installments: z.coerce.number().int().positive('Número de parcelas inválido.').optional(),
    installmentDetails: z
      .array(
        z.object({
          value: z.coerce.number().positive('Valor da parcela deve ser positivo.'),
          dueDate: z.date({ required_error: 'Data de vencimento da parcela é obrigatória.' }),
        })
      )
      .optional(),
    supplier: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.isApportioned) {
        return data.apportionments && data.apportionments.length > 0;
      }
      return !!data.resultCenter;
    },
    {
      message: 'Defina o centro de resultado ou o rateio.',
      path: ['isApportioned'],
    }
  )
  .refine(
    (data) => {
      if (data.isApportioned && data.apportionments) {
        const totalPercentage = data.apportionments.reduce((sum, item) => sum + item.percentage, 0);
        return Math.abs(totalPercentage - 100) < 0.001;
      }
      return true;
    },
    {
      message: 'A soma dos percentuais do rateio deve ser 100%.',
      path: ['apportionments'],
    }
  )
  .refine(
    (data) => {
      if (data.paymentMethod === 'installments') {
        return data.installments && data.installments > 1;
      }
      return true;
    },
    {
      message: 'O número de parcelas deve ser maior que 1.',
      path: ['installments'],
    }
  );

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
