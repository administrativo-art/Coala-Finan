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
  const watchedValues = useWatch({ control: form.control });

  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateInsights = async () => {
    setIsLoading(true);
    setError(null);
    setInsights(null);

    const result = await getExpenseInsightsAction(watchedValues);

    if (result.success) {
      setInsights(result.data.summary);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };
  
  const getInstallmentSummary = () => {
    if (watchedValues.paymentMethod === 'single') return 'Pagamento único';
    if (!watchedValues.installments) return 'Não definido';
    
    const installments = watchedValues.installments || 0;
    let firstDueDate = '-';
    let lastDueDate = '-';

    if (watchedValues.installmentType === 'equal' && watchedValues.firstInstallmentDueDate && installments > 0) {
      const firstDate = watchedValues.firstInstallmentDueDate;
      firstDueDate = firstDate.toLocaleDateString('pt-BR');
      let lastDate = firstDate;
      if (watchedValues.installmentPeriodicity === 'monthly') {
        lastDate = addMonths(firstDate, installments - 1);
      } else if (watchedValues.installmentPeriodicity === 'weekly') {
        lastDate = addWeeks(firstDate, installments - 1);
      } else if (watchedValues.installmentPeriodicity === 'biweekly') {
        lastDate = addWeeks(firstDate, (installments - 1) * 2);
      }
      lastDueDate = lastDate.toLocaleDateString('pt-BR');
    } else if (watchedValues.installmentType === 'varied' && watchedValues.variedInstallments && watchedValues.variedInstallments.length > 0) {
        const dates = watchedValues.variedInstallments.map(v => v.dueDate).filter(Boolean);
        if (dates.length > 0) {
          firstDueDate = dates[0].toLocaleDateString('pt-BR');
          lastDueDate = dates[dates.length - 1].toLocaleDateString('pt-BR');
        }
    }
    
    return (
      <div className="space-y-1 text-right">
        <p className="font-medium">{installments} parcelas - Total R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(watchedValues.totalValue || 0)}</p>
        <p className="text-xs text-muted-foreground">1ª em: {firstDueDate}</p>
        <p className="text-xs text-muted-foreground">Última em: {lastDueDate}</p>
      </div>
    );
  }

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
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(watchedValues.totalValue || 0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Competência:</span>
          <span className="font-medium">
            {watchedValues.competenceDate ? watchedValues.competenceDate.toLocaleDateString('pt-BR') : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Vencimento:</span>
          <span className="font-medium">
            {watchedValues.dueDate ? watchedValues.dueDate.toLocaleDateString('pt-BR') : '-'}
          </span>
        </div>
        <div className="flex justify-between items-start">
          <span className="text-muted-foreground pt-1">Parcelamento:</span>
          {getInstallmentSummary()}
        </div>
        <Separator />
        <p className="font-medium text-muted-foreground">Centro de Custo:</p>
        <p>{watchedValues.costCenter || 'Não definido'}</p>
        <p className="font-medium text-muted-foreground">Centro(s) de Resultado:</p>
        {watchedValues.isApportioned ? (
          <ul className="list-disc pl-5">
            {(watchedValues.apportionments || []).map((app, i) => (
              <li key={i}>{app.resultCenter}: {app.percentage}%</li>
            ))}
          </ul>
        ) : (
          <p>{watchedValues.resultCenter || 'Não definido'}</p>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-4">
        <Button onClick={handleGenerateInsights} disabled={isLoading || !form.formState.isValid} className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/50 hover:opacity-90 transition-all hover:shadow-xl hover:shadow-purple-500/50">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Gerar Insights com IA
        </Button>
        {isLoading && (
          <div className="text-center text-sm text-muted-foreground">Analisando dados...</div>
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
                {insights}
              </ScrollArea>
            </AlertDescription>
          </Alert>
        )}
      </CardFooter>
    </Card>
  );
}
