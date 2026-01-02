import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[appEnterNext]',
  standalone: true
})
export class EnterNextDirective {
  @HostListener('keydown.enter', ['$event'])
  handleEnter(event: Event) {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Evitar envío de formularios por Enter
    event.preventDefault();

    // Obtener elementos focusables dentro del documento
    const focusables = Array.from(document.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    ))
    // Filtrar por visibilidad
    .filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));

    const idx = focusables.indexOf(target);
    if (idx >= 0) {
      // Buscar el siguiente focusable
      for (let i = idx + 1; i < focusables.length; i++) {
        const next = focusables[i];
        if (next && typeof next.focus === 'function') {
          next.focus();
          break;
        }
      }
    }
  }
}
