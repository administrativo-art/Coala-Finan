import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, CircleDollarSign, LineChart, Wallet } from 'lucide-react';

const indicators = [
  {
    title: 'Caixa',
    value: 'R$ 12.450,78',
    icon: Wallet,
    color: 'text-sky-500',
  },
  {
    title: 'DRE (Lucro/Prejuízo)',
    value: 'R$ 2.890,12',
    icon: LineChart,
    color: 'text-emerald-500',
  },
  {
    title: 'Despesas em Aberto',
    value: 'R$ 4.320,50',
    icon: CircleDollarSign,
    color: 'text-amber-500',
  },
  {
    title: 'Próximos Vencimentos',
    value: 'R$ 1.280,00',
    icon: CalendarClock,
    color: 'text-rose-500',
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline text-3xl font-bold tracking-tight">Painel</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicators.map((indicator) => (
          <Card key={indicator.title} className="shadow-lg transition-transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{indicator.title}</CardTitle>
              <indicator.icon className={`h-5 w-5 ${indicator.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{indicator.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-md border-2 border-dashed">
            <p className="text-muted-foreground">Gráfico de atividade em breve.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
