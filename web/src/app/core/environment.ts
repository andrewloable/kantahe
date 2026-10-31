import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';
import { Environment } from '../../environments/environment.model';

/** What this build is (web, or a packaged TV app); tests replace it. */
export const ENVIRONMENT = new InjectionToken<Environment>('kantahe environment', { providedIn: 'root', factory: () => environment });
