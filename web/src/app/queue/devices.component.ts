import { RouterLink } from '@angular/router';
import { Component, computed, inject } from '@angular/core';
import { DeviceType } from '../../gen/kantahe/v1/common_pb';
import { StateStore } from '../core/state.store';

export const TYPES: Record<number, { icon: string; label: string }> = {
  [DeviceType.WEB]: { icon: '🌐', label: 'Web' },
  [DeviceType.ANDROID]: { icon: '📱', label: 'Android' },
  [DeviceType.IOS]: { icon: '📱', label: 'iOS' },
  [DeviceType.ANDROID_TV]: { icon: '📺', label: 'Android TV' },
  [DeviceType.TIZEN]: { icon: '📺', label: 'Tizen TV' },
  [DeviceType.WEBOS]: { icon: '📺', label: 'webOS TV' },
};

@Component({
  selector: 'app-devices',
  imports: [RouterLink],
  template: `
    <section aria-labelledby="devices-title">
      <h2 id="devices-title">Play on</h2>
      <p class="manage"><a routerLink="/me/devices">Manage devices</a></p>
      @if (devices().length === 0) {
        <p>No devices yet.</p>
      } @else {
        <ul class="devices">
          @for (d of devices(); track d.id) {
            <li>
              <span aria-hidden="true">{{ type(d.type).icon }}</span>
              <span class="name">{{ d.name }}</span>
              @if (d.isCaller) {
                <span>(this device)</span>
              }
              <span class="muted">{{ type(d.type).label }}</span>
              @if (d.id === playerId()) {
                <strong class="playing">playing</strong>
              }
              <span class="status"><span class="dot" [class.on]="d.online" aria-hidden="true"></span>{{ d.online ? 'online' : 'offline' }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .manage a {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
    }
    .devices {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      padding: 0.4rem 0;
      border-bottom: 1px solid var(--line);
    }
    .muted,
    .status {
      color: var(--muted);
    }
    .dot {
      display: inline-block;
      width: 0.6rem;
      height: 0.6rem;
      margin-right: 0.3rem;
      border-radius: 50%;
      background: var(--muted);
    }
    .dot.on {
      background: #2e9d4a;
    }
  `,
})
export class DevicesComponent {
  private readonly store = inject(StateStore);
  protected readonly devices = computed(() => this.store.state()?.devices ?? []);
  protected readonly playerId = computed(() => this.store.state()?.playerDeviceId ?? '');
  protected type(t: DeviceType) {
    return TYPES[t] ?? { icon: '❔', label: 'Unknown' };
  }
}
