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
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from './ui/button';

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
        <div
          data-sidebar="header-content"
          className="flex items-center gap-2 overflow-hidden px-2 transition-all duration-300"
        >
          <PiggyBank className="h-7 w-7 shrink-0 text-primary" />
          <span className="font-headline text-lg font-semibold text-sidebar-foreground">
            Architect
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={{ children: item.label }}
                  className="justify-start"
                >
                  <span>
                    <item.icon />
                    <span>{item.label}</span>
                  </span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
