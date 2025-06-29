import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { SIDEBAR_NAV_ITEMS, SIDEBAR_NAV_ITEMS_MORE } from './constants/sidebar-nav-items';
import { SidebarNavItem } from './models/sidebar-nav-item.interface';

@Component({
  selector: 'app-side-menu',
  imports: [CommonModule, RouterModule, TooltipModule, DividerModule, AvatarModule],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenuComponent {
  @Input() isMobile = false;
  @Output() menuItemClick = new EventEmitter<void>();

  sampleAppsSidebarNavs = SIDEBAR_NAV_ITEMS;
  sampleAppsSidebarNavsMore = SIDEBAR_NAV_ITEMS_MORE;
  selectedLevel1Item: SidebarNavItem | null = null;

  constructor(private router: Router) {}

  ngOnInit() {
    // Inicializar con el primer elemento que tenga subelementos
    const firstItemWithChildren = this.sampleAppsSidebarNavs.find(item => item.children);
    if (firstItemWithChildren) {
      this.selectedLevel1Item = firstItemWithChildren;
    }
  }

  onLevel1Click(navItem: SidebarNavItem) {
    if (navItem.children) {
      // Si tiene subelementos, mostrar el nivel 2
      this.selectedLevel1Item = navItem;
    } else if (navItem.selectable && navItem.url !== undefined) {
      // Si es seleccionable y no tiene subelementos, navegar directamente
      this.router.navigate([navItem.url]);
      this.selectedLevel1Item = null; // Ocultar nivel 2
      this.onMenuItemClick();
    }
  }

  isActiveLevel1(navItem: SidebarNavItem): boolean {
    if (navItem.children) {
      // Si tiene subelementos, está activo si algún subelemento está activo
      return navItem.children.some(child => 
        child.url !== undefined && this.router.url === `/${child.url}`
      );
    } else if (navItem.url !== undefined) {
      // Si no tiene subelementos, verificar si la URL actual coincide
      return this.router.url === `/${navItem.url}`;
    }
    return false;
  }

  onMenuItemClick() {
    this.menuItemClick.emit();
  }

  onSettingsClick(title: string) {
    console.log('Settings clicked:', title);
    this.menuItemClick.emit();
  }
}