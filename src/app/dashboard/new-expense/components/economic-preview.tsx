
'use client';

import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getExpenseInsightsAction } from '../actions';
import type { ExpenseFormValues } from '@/lib/schemas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Sparkles, Terminal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { addMonths, addWeeks } from 'date-fns';

export function EconomicPreview() {
  const form = useFormContext<ExpenseFormValues>();
  
  // Otimizando useWatch para assistir apenas o necessário para o preview
  const watchedValues = useWatch({ 
    control: form.control,
    name: [
      'accountPlan', 'totalValue', 'competenceDate', 'dueDate', 
      'paymentMethod', 'installments', 'installmentType', 
      'firstInstallmentDueDate', 'installmentPeriodicity', 
      'variedInstallments', 'isApportioned', 'apportionments', 'resultCenter',
      'description'
    ]
  });

  // Mapeamento manual para facilitar o uso (useWatch com array de nomes retorna objeto com esses nomes)
  const values = {
    accountPlan: watchedValues[0],
    totalValue: watchedValues[1],
    competenceDate: watchedValues[2],
    dueDate: watchedValues[3],
    paymentMethod: watchedValues[4],
    installments: watchedValues[5],
    installmentType: watchedValues[6],
    firstInstallmentDueDate: watchedValues[7],
    installmentPeriodicity: watchedValues[8],
    variedInstallments: watchedValues[9],
    isApportioned: watchedValues[10],
    apportionments: watchedValues[11],
    resultCenter: watchedValues[12],
    description: watchedValues[13]
  };

  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateInsights = async () => {
    setIsLoading(true);
    setError(null);
    setInsights(null);

    const result = await getExpenseInsightsAction(form.getValues());

    if (result.success) {
      setInsights(result.data.summary);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };
  
  const getInstallmentSummary = () => {
    if (values.paymentMethod === 'single') return 'Pagamento único';
    if (!values.installments) return 'Não definido';
    
    const installments = values.installments || 0;
    let firstDueDate = '-';
    let lastDueDate = '-';

    if (values.installmentType === 'equal' && values.firstInstallmentDueDate && installments > 0) {
      const firstDate = values.firstInstallmentDueDate;
      firstDueDate = firstDate.toLocaleDateString('pt-BR');
      let lastDate = firstDate;
      if (values.installmentPeriodicity === 'monthly') {
        lastDate = addMonths(firstDate, installments - 1);
      } else if (values.installmentPeriodicity === 'weekly') {
        lastDate = addWeeks(firstDate, installments - 1);
      } else if (values.installmentPeriodicity === 'biweekly') {
        lastDate = addWeeks(firstDate, (installments - 1) * 2);
      }
      lastDueDate = lastDate.toLocaleDateString('pt-BR');
    } else if (values.installmentType === 'varied' && values.variedInstallments && values.variedInstallments.length > 0) {
        const dates = values.variedInstallments.map(v => v.dueDate).filter(Boolean);
        if (dates.length > 0) {
          firstDueDate = dates[0].toLocaleDateString('pt-BR');
          lastDueDate = dates[dates.length - 1].toLocaleDateString('pt-BR');
        }
    }
    
    return (
      <div className="space-y-1 text-right">
        <p className="font-medium">{installments} parcelas - Total R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(values.totalValue || 0)}</p>
        <p className="text-xs text-muted-foreground">1ª em: {firstDueDate}</p>
        <p className="text-xs text-muted-foreground">Última em: {lastDueDate}</p>
      </div>
    );
  }

  const hasRequiredFieldsForInsights = !!(
    values.accountPlan &&
    values.description &&
    values.totalValue &&
    values.competenceDate &&
    (values.resultCenter || values.isApportioned)
  );

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="font-headline">Preview Econômico</CardTitle>
        <CardDescription>Resumo da despesa em tempo real.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor Total:</span>
          <span className="font-medium">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(values.totalValue || 0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Competência:</span>
          <span className="font-medium">
            {values.competenceDate ? values.competenceDate.toLocaleDateString('pt-BR') : '-'}
          </span>
        </div>
        {values.paymentMethod === 'single' && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vencimento:</span>
            <span className="font-medium">
              {values.dueDate ? values.dueDate.toLocaleDateString('pt-BR') : '-'}
            </span>
          </div>
        )}
        <div className="flex justify-between items-start">
          <span className="text-muted-foreground pt-1">Parcelamento:</span>
          {getInstallmentSummary()}
        </div>
        <Separator />
        <p className="font-medium text-muted-foreground">Plano de Contas:</p>
        <p>{values.accountPlan || 'Não definido'}</p>
        <p className="font-medium text-muted-foreground">Centro(s) de Resultado:</p>
        {values.isApportioned ? (
          <ul className="list-disc pl-5">
            {(values.apportionments || []).map((app, i) => (
              <li key={i}>{app.resultCenter}: {app.percentage}%</li>
            ))}
          </ul>
        ) : (
          <p>{values.resultCenter || 'Não definido'}</p>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-4">
        <div className="space-y-2">
          <Button 
            onClick={handleGenerateInsights} 
            disabled={isLoading || !hasRequiredFieldsForInsights} 
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/50 hover:opacity-90 transition-all hover:shadow-xl hover:shadow-purple-500/50"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Gerar Insights com IA
          </Button>
          {!hasRequiredFieldsForInsights && !isLoading && (
            <p className="text-center text-xs text-muted-foreground italic px-2">
              Preencha plano de contas, descrição, valor e centro de resultado para habilitar a IA.
            </p>
          )}
        </div>
        {isLoading && (
          <div className="text-center text-sm text-muted-foreground">Analisando dados financeiros...</div>
        )}
        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Erro na Análise</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {insights && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle className="font-headline">Insights Gerados</AlertTitle>
            <AlertDescription>
              <ScrollArea className="h-32">
                <p className="text-xs leading-relaxed">{insights}</p>
              </ScrollArea>
            </AlertDescription>
          </Alert>
        )}
      </CardFooter>
    </Card>
  );
}
