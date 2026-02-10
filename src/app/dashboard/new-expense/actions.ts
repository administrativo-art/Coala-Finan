'use server';

import { generateExpenseInsights, ExpenseInsightsInput } from '@/ai/flows/expense-insights';
import { expenseFormSchema, ExpenseFormValues } from '@/lib/schemas';

export async function getExpenseInsightsAction(
  data: ExpenseFormValues
): Promise<{ success: true, data: { summary: string } } | { success: false, error: string }> {
  const validation = expenseFormSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Dados do formulário inválidos.' };
  }

  const formData = validation.data;

  try {
    const insightInput: ExpenseInsightsInput = {
      costCenter: formData.costCenter,
      costCenterPath: formData.costCenter,
      resultCenters: formData.isApportioned
        ? formData.apportionments!.map(a => ({ name: a.resultCenter, percentage: a.percentage }))
        : [{ name: formData.resultCenter!, percentage: 100 }],
      totalValue: formData.totalValue,
      competenceDate: formData.competenceDate.toISOString(),
      dueDate: formData.dueDate.toISOString(),
      installmentSummary: formData.paymentMethod === 'installments' 
        ? `${formData.installments || 0} parcelas` 
        : 'Pagamento único',
      description: formData.description,
    };

    const insights = await generateExpenseInsights(insightInput);
    return { success: true, data: insights };
  } catch (error) {
    console.error('Error generating expense insights:', error);
    return { success: false, error: 'Falha ao conectar com o serviço de IA. Tente novamente mais tarde.' };
  }
}
