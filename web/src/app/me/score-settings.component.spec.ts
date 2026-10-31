import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { ScoreLevel, ScoreMode, UserSettingsSchema } from '../../gen/kantahe/v1/session_pb';
import { TRANSPORT } from '../core/api';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { device, stateOf } from '../queue/testing';
import { ScoreSettingsComponent } from './score-settings.component';
import { fakeMe } from './testing';

async function setup(opts: { mic?: boolean } = {}) {
  const server = fakeMe();
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  const state = stateOf({ devices: [device('me', 'Phone', { isCaller: true, micAvailable: opts.mic ?? true })], player: 'me' });
  state.settings = create(UserSettingsSchema, { scoreMode: ScoreMode.RANDOM, scoreLevel: ScoreLevel.MIDDLE });
  TestBed.inject(StateStore).state.set(state);
  const fixture = TestBed.createComponent(ScoreSettingsComponent);
  const el = fixture.nativeElement as HTMLElement;
  fixture.detectChanges();
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  const radio = (group: string, label: string) =>
    Array.from(el.querySelectorAll<HTMLInputElement>(`input[name="${group}"]`)).find((i) => el.querySelector(`label[for="${i.id}"]`)?.textContent?.trim().startsWith(label))!;
  return { fixture, el, server, settle, radio };
}

describe('ScoreSettingsComponent', () => {
  it('two groups of radio buttons with their legends, showing the current settings', async () => {
    const { el, radio } = await setup();
    expect(Array.from(el.querySelectorAll('legend')).map((l) => l.textContent?.trim())).toEqual(['Score', 'Level']);
    expect(radio('mode', 'Random').checked).toBe(true);
    expect(radio('mode', 'Off').checked).toBe(false);
    expect(radio('level', 'Middle').checked).toBe(true);
    expect(el.querySelectorAll('input[name="mode"]').length).toBe(3);
    expect(el.querySelectorAll('input[name="level"]').length).toBe(3);
  });

  it('choosing a mode sends only the mode', async () => {
    const { radio, server, settle } = await setup();
    radio('mode', 'Off').click();
    await settle();
    expect(server.calls.settings.length).toBe(1);
    expect(server.calls.settings[0].scoreMode).toBe(ScoreMode.OFF);
    expect(server.calls.settings[0].scoreLevel).toBeUndefined();
  });

  it('choosing a level sends only the level', async () => {
    const { radio, server, settle } = await setup();
    radio('level', 'High').click();
    await settle();
    expect(server.calls.settings[0].scoreLevel).toBe(ScoreLevel.HIGH);
    expect(server.calls.settings[0].scoreMode).toBeUndefined();
  });

  it('a refusal is shown and the choice goes back', async () => {
    const { radio, server, settle } = await setup();
    server.failNext(new ConnectError('needs a microphone', Code.FailedPrecondition));
    radio('mode', 'Microphone').click();
    await settle();
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Could not change the score setting. Try again.');
    expect(radio('mode', 'Random').checked).toBe(true);
  });

  it('says what each mode does, and warns when no device could listen', async () => {
    const { el } = await setup({ mic: false });
    expect(el.textContent).toContain('Needs a device with a microphone');
  });

  it('does not warn when a device can listen', async () => {
    const { el } = await setup({ mic: true });
    expect(el.textContent).not.toContain('Needs a device with a microphone');
  });
});
