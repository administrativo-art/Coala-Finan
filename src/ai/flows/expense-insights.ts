'use server';
/**
 * @fileOverview Generates expense insights using GenAI to aid in decision-making.
 *
 * - generateExpenseInsights - A function that generates insights for an expense.
 * - ExpenseInsightsInput - The input type for the generateExpenseInsights function.
 * - ExpenseInsightsOutput - The return type for the generateExpenseInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExpenseInsightsInputSchema = z.object({
  costCenter: z.string().describe('The cost center for the expense.'),
  costCenterPath: z.string().describe('The full path of the cost center in the hierarchical structure.'),
  resultCenters: z.array(
    z.object({
      name: z.string().describe('The name of the result center.'),
      percentage: z.number().describe('The allocation percentage for the result center (0-100).'),
    })
  ).describe('The result centers and their allocation percentages.'),
  totalValue: z.number().describe('The total value of the expense.'),
  competenceDate: z.string().describe('The competence date of the expense.'),
  dueDate: z.string().describe('The due date of the expense.'),
  installmentSummary: z.string().describe('A summary of the installment plan, if applicable.'),
  description: z.string().describe('A description of the expense.'),
});
export type ExpenseInsightsInput = z.infer<typeof ExpenseInsightsInputSchema>;

const ExpenseInsightsOutputSchema = z.object({
  summary: z.string().describe('A summary of the expense insights.'),
});
export type ExpenseInsightsOutput = z.infer<typeof ExpenseInsightsOutputSchema>;

export async function generateExpenseInsights(input: ExpenseInsightsInput): Promise<ExpenseInsightsOutput> {
  return expenseInsightsFlow(input);
}

const expenseInsightsPrompt = ai.definePrompt({
  name: 'expenseInsightsPrompt',
  input: {schema: ExpenseInsightsInputSchema},
  output: {schema: ExpenseInsightsOutputSchema},
  prompt: `You are an AI assistant that analyzes expense data and provides insights to help users make better decisions.

  Analyze the following expense data and provide a concise summary of key insights, including potential impacts on cost allocation, and economic forecasting.

  Description: {{{description}}}
  Cost Center: {{{costCenter}}}
  Cost Center Path: {{{costCenterPath}}}
  Result Centers: {{#each resultCenters}}{{{name}}} ({{{percentage}}}%){{#unless @last}}, {{/unless}}{{/each}}
  Total Value: {{{totalValue}}}
  Competence Date: {{{competenceDate}}}
  Due Date: {{{dueDate}}}
  Installment Summary: {{{installmentSummary}}}

  Summary:`,
});

const expenseInsightsFlow = ai.defineFlow(
  {
    name: 'expenseInsightsFlow',
    inputSchema: ExpenseInsightsInputSchema,
    outputSchema: ExpenseInsightsOutputSchema,
  },
  async input => {
    const {output} = await expenseInsightsPrompt(input);
    return output!;
  }
);
