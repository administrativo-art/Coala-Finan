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
    return `${watchedValues.installments} parcelas`;
  }

  return (
    <Card className="sticky top-20 shadow-lg">
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
        <div className="flex justify-between">
          <span className="text-muted-foreground">Parcelamento:</span>
          <span className="font-medium">
            {getInstallmentSummary()}
          </span>
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
        <Button onClick={handleGenerateInsights} disabled={isLoading || !form.formState.isValid}>
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
