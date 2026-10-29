import { BedDouble, ChevronsUpDown, LayoutDashboard, MessageSquareWarning, Receipt, Users } from 'lucide-react';
import type { AdminProfile } from './api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { name: 'Dashboard', Icon: LayoutDashboard },
  { name: 'Kamar', Icon: BedDouble },
  { name: 'Penghuni', Icon: Users },
  { name: 'Tagihan', Icon: Receipt },
  { name: 'Keluhan', Icon: MessageSquareWarning },
];

export function initials(nama: string) {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function AppSidebar({ page, go, admin }: { page: string; go: (page: string) => void; admin: AdminProfile | null }) {
  const { setOpenMobile } = useSidebar();
  const open = (name: string) => {
    go(name);
    setOpenMobile(false);
  };
  const nama = admin?.nama ?? 'Gopi';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => open('Dashboard')}>
              <img src="/img/logo_200.png" alt="" className="size-8 shrink-0 rounded-md object-contain" />
              <span className="grid min-w-0 text-left leading-tight">
                <span className="truncate font-semibold">{admin?.nama_kos || 'Kos Gopi'}</span>
                <span className="truncate text-xs text-muted-foreground">Manajemen Kos</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Umum</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map(({ name, Icon }) => (
              <SidebarMenuItem key={name}>
                <SidebarMenuButton isActive={page === name} tooltip={name} onClick={() => open(name)}>
                  <Icon />
                  <span>{name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" isActive={page === 'Profil Admin'} aria-label="Menu pengguna">
                  <Avatar className="size-8 rounded-md">
                    <AvatarImage src={admin?.avatar_url || undefined} alt={nama} />
                    <AvatarFallback className="rounded-md">{initials(nama)}</AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{nama}</span>
                    <span className="truncate text-xs text-muted-foreground">{admin?.peran ?? 'Pemilik Kos'}</span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate font-medium">{nama}</div>
                  <div className="truncate text-xs text-muted-foreground">{admin?.email ?? 'gopi@kosgopi.id'}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => open('Profil Admin')}>Profil Admin</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => open('Kamar')}>Data Kamar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => open('Penghuni')}>Data Penghuni</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
