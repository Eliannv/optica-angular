import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  readonly appVersion = '1.0.0';
  private themeService = inject(ThemeService);

  isDark = computed(() => this.themeService.currentTheme() === 'dark');
}
