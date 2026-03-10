
import { Timestamp } from 'firebase/firestore';

export type TransactionType =
  | 'revenue'
  | 'revenue_recurring'
  | 'expense_payment'
  | 'transfer_out'
  | 'transfer_in'
  | 'adjustment'
  | 'refund'
  | 'investment'
  | 'redemption';

export type Transaction = {
  id: string;
  type: TransactionType;
  direction: 'in' | 'out';
  accountId: string;
  accountName: string;
  paymentMethodId?: string;
  paymentMethodLabel?: string;
  toAccountId?: string;
  toAccountName?: string;
  toPaymentMethodId?: string;
  toPaymentMethodLabel?: string;
  expenseId?: string;
  amount: number;
  date: Timestamp;
  competenceDate?: Timestamp;
  revenueCategory?: string;
  revenueSource?: string;
  isRecurring?: boolean;
  recurringDay?: number;
  description: string;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  revenue:           'Receita',
  revenue_recurring: 'Receita recorrente',
  expense_payment:   'Pagamento de despesa',
  transfer_out:      'Transferência enviada',
  transfer_in:       'Transferência recebida',
  adjustment:        'Ajuste de saldo',
  refund:            'Reembolso',
  investment:        'Aplicação',
  redemption:        'Resgate',
};

export const REVENUE_CATEGORY_LABELS: Record<string, string> = {
  sale:              'Venda / serviço',
  subscription:      'Mensalidade / assinatura',
  refund:            'Devolução / estorno',
  investment_return: 'Rendimento de aplicação',
  other:             'Outro',
};
