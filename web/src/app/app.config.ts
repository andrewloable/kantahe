import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withHashLocation } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { PageTitleStrategy } from './core/page-title';
import { ThemeService } from './core/theme';
import { provideTv } from './tv/provide-tv';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // a packaged TV app is opened from a file: its address has no path the router could use
    provideRouter(routes, ...(environment.isTv ? [withHashLocation()] : [])),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideTv(),
    // the chosen theme (Auto, Light, Dark) is shown before the first page
    provideAppInitializer(() => inject(ThemeService).apply()),
  ],
};
