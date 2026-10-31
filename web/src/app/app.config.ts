import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideTv } from './tv/provide-tv';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // a packaged TV app is opened from a file: its address has no path the router could use
    provideRouter(routes, ...(environment.isTv ? [withHashLocation()] : [])),
    provideTv(),
  ],
};
