'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  FilePlus2,
  LayoutDashboard,
  PiggyBank,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Painel',
  },
  {
    href: '/dashboard/new-expense',
    icon: FilePlus2,
    label: 'Lançar Despesa',
  },
  {
    href: '/dashboard/financial-flow',
    icon: ArrowLeftRight,
    label: 'Fluxo Financeiro',
  },
  {
    href: '/dashboard/settings',
    icon: Settings,
    label: 'Configurações',
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1">
          {/* Logo expandido — some quando colapsado */}
          <div className="flex items-center gap-2 overflow-hidden transition-all duration-300 group-data-[collapsible=icon]:hidden">
            <PiggyBank className="h-7 w-7 shrink-0 text-primary" />
            <span className="font-headline text-lg font-semibold text-sidebar-foreground">
              Coala
            </span>
          </div>

          {/* Ícone sozinho — aparece só quando colapsado */}
          <PiggyBank className="hidden h-7 w-7 shrink-0 text-primary group-data-[collapsible=icon]:block" />

          {/* Botão de toggle — sempre visível no desktop */}
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
