'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  FilePlus2,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Building2,
  Receipt,
  BarChart2,
  Target,
  Users,
  ShieldCheck,
  Tag
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';

const mainNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Painel' },
  { href: '/dashboard/new-expense', icon: FilePlus2, label: 'Lançar despesa' },
];

const financialNavItems = [
  { href: '/dashboard/expenses', icon: Receipt, label: 'Painel de despesas' },
  { href: '/dashboard/financial-panel', icon: BarChart2, label: 'Painel financeiro' },
  { href: '/dashboard/cash-flow', icon: ArrowLeftRight, label: 'Fluxo de caixa' },
];

const adminNavItems = [
  { href: '/dashboard/settings/accounts', icon: Building2, label: 'Contas bancárias' },
  { href: '/dashboard/settings', icon: Settings, label: 'Configurações' },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex w-full items-center justify-between group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-7 w-7 shrink-0 text-primary" />
              <span className="font-headline text-lg font-semibold text-sidebar-foreground">
                Coala
              </span>
            </div>
            <SidebarTrigger />
          </div>
          <div className="hidden w-full flex-col items-center gap-4 group-data-[collapsible=icon]:flex">
            <PiggyBank className="h-7 w-7 text-primary" />
            <SidebarTrigger />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label} className="justify-start transition-all duration-200 hover:translate-x-1 hover:bg-sidebar-accent">
                    <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financialNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label} className="justify-start transition-all duration-200 hover:translate-x-1 hover:bg-sidebar-accent">
                    <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Administração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label} className="justify-start transition-all duration-200 hover:translate-x-1 hover:bg-sidebar-accent">
                    <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
