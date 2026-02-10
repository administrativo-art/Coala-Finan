import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrafficCone } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline text-3xl font-bold tracking-tight">Configurações</h1>
      <Card className="flex flex-1 flex-col items-center justify-center border-2 border-dashed py-24">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-amber-100 p-4 dark:bg-amber-900/50">
            <TrafficCone className="h-12 w-12 text-amber-500" />
          </div>
          <CardTitle className="font-headline text-2xl">Em Construção</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta seção está sendo desenvolvida e estará disponível em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
