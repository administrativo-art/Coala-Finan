'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import CostCentersManagement from './components/cost-centers-management';
import ProfilesManagement from './components/profiles-management';
import ResultCentersManagement from './components/result-centers-management';
import UsersManagement from './components/users-management';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline text-3xl font-bold tracking-tight">
        Configurações
      </h1>
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="profiles">Perfis de Acesso</TabsTrigger>
          <TabsTrigger value="cost-centers">Centros de Custo</TabsTrigger>
          <TabsTrigger value="result-centers">Centros de Resultado</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersManagement />
        </TabsContent>
        <TabsContent value="profiles">
          <ProfilesManagement />
        </TabsContent>
        <TabsContent value="cost-centers">
          <CostCentersManagement />
        </TabsContent>
        <TabsContent value="result-centers">
          <ResultCentersManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
