import { z } from 'zod';

export const expenseFormSchema = z
  .object({
    costCenter: z.string().min(1, 'Centro de custo é obrigatório.'),
    description: z
      .string()
      .min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
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
          percentage: z.coerce
            .number()
            .min(1, 'Porcentagem deve ser maior que 0.'),
        })
      )
      .optional(),
    paymentMethod: z.enum(['single', 'installments']).default('single'),
    installments: z.coerce
      .number()
      .int()
      .min(2, 'O número mínimo de parcelas é 2.')
      .optional(),
    installmentType: z.enum(['equal', 'varied']).optional(),
    firstInstallmentDueDate: z.date().optional(),
    installmentPeriodicity: z
      .enum(['monthly', 'weekly', 'biweekly'])
      .default('monthly')
      .optional(),
    variedInstallments: z
      .array(
        z.object({
          dueDate: z.date({ required_error: 'Data de vencimento é obrigatória.' }),
          value: z.coerce.number().positive('O valor deve ser positivo.'),
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
      path: ['resultCenter'],
    }
  )
  .refine(
    (data) => {
      if (data.isApportioned && data.apportionments) {
        const totalPercentage = data.apportionments.reduce(
          (sum, item) => sum + item.percentage,
          0
        );
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
        return data.installments && data.installments >= 2;
      }
      return true;
    },
    {
      message: 'O número de parcelas deve ser no mínimo 2.',
      path: ['installments'],
    }
  )
  .refine(
    (data) => {
      if (
        data.paymentMethod === 'installments' &&
        data.installmentType === 'equal'
      ) {
        return !!data.firstInstallmentDueDate;
      }
      return true;
    },
    {
      message: 'A data do primeiro vencimento é obrigatória.',
      path: ['firstInstallmentDueDate'],
    }
  )
  .refine(
    (data) => {
      if (
        data.paymentMethod === 'installments' &&
        data.installmentType === 'varied' &&
        data.variedInstallments &&
        data.installments
      ) {
        if (data.variedInstallments.length !== data.installments) return false;
        const total = data.variedInstallments.reduce(
          (acc, curr) => acc + (curr.value || 0),
          0
        );
        return Math.abs(total - (data.totalValue || 0)) < 0.01;
      }
      return true;
    },
    {
      message:
        'A soma dos valores deve ser igual ao valor total e a quantidade de parcelas deve ser a mesma.',
      path: ['variedInstallments'],
    }
  );

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export const profileFormSchema = z.object({
  name: z.string().min(3, 'O nome do perfil deve ter pelo menos 3 caracteres.'),
  description: z.string().optional(),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const costCenterFormSchema = z.object({
  name: z
    .string()
    .min(3, 'O nome do centro de custo deve ter pelo menos 3 caracteres.'),
  description: z.string().optional(),
});
export type CostCenterFormValues = z.infer<typeof costCenterFormSchema>;

export const resultCenterFormSchema = z.object({
  name: z
    .string()
    .min(3, 'O nome do centro de resultado deve ter pelo menos 3 caracteres.'),
  description: z.string().optional(),
});
export type ResultCenterFormValues = z.infer<typeof resultCenterFormSchema>;

export const userFormSchema = z.object({
  email: z.string().email('Email inválido.'),
  name: z.string().min(3, 'O nome do usuário deve ter pelo menos 3 caracteres.'),
  profile: z.string().min(1, 'O perfil de acesso é obrigatório.'),
});
export type UserFormValues = z.infer<typeof userFormSchema>;
