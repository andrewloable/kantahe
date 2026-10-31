import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { ENVIRONMENT } from '../core/environment';
import { BackKeys, registerMediaKeys } from './back-keys';
import { SpatialNav } from './spatial-nav';

/** On a TV build: marks the page as a TV (larger type, visible focus) and turns the remote's keys on. */
export function provideTv(): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (!inject(ENVIRONMENT).isTv) return;
    document.documentElement.classList.add('tv');
    inject(SpatialNav).attach(document);
    inject(BackKeys).attach(document);
    registerMediaKeys(window);
  });
}
