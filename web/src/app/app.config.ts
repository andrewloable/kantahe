import { Location } from '@angular/common';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withHashLocation, withNavigationErrorHandler } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { PageTitleStrategy } from './core/page-title';
import { handleStaleChunk } from './core/stale-chunk';
import { ThemeService } from './core/theme';
import { provideTv } from './tv/provide-tv';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // a packaged TV app is opened from a file: its address has no path the router could use
    provideRouter(
      routes,
      ...(environment.isTv
        ? [withHashLocation()]
        : [
            // a page left open across a server update asks for lazy files that are gone: reload to get the new ones
            // (a packaged TV app has its files with it, and a hash address would not reload)
            withNavigationErrorHandler((error) => {
              const location = inject(Location);
              handleStaleChunk(error, (url) => window.location.assign(location.prepareExternalUrl(url)));
            }),
          ]),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideTv(),
    // the chosen theme (Auto, Light, Dark) is shown before the first page
    provideAppInitializer(() => inject(ThemeService).apply()),
  ],
};
