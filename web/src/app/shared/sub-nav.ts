import { afterNextRender, ElementRef, inject, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * On a phone the sub-menu of Me and Administration is one line that scrolls sideways (styles.css .sub-nav, kantahe-du1.9): after every
 * navigation the current entry is scrolled into view, so that the page that is open is always named on screen. Call it in a constructor.
 */
export function keepCurrentEntryInView(): void {
  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const injector = inject(Injector);
  const router = inject(Router);
  // the entry is found by the address, not by aria-current: RouterLinkActive may not have marked it yet when this runs
  const show = () =>
    afterNextRender(
      () => {
        const path = router.url.split(/[?#]/)[0];
        const link = Array.from(host.querySelectorAll<HTMLAnchorElement>('nav.sub-nav a')).find((a) => path.startsWith(a.getAttribute('href') ?? '\0'));
        link?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      },
      { injector },
    );
  router.events
    .pipe(
      filter((e) => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    )
    .subscribe(show);
  show();
}
