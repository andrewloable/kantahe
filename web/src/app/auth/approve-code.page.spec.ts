import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { ApproveCodeRequest, ApproveCodeResponseSchema, AuthService } from '../../gen/kantahe/v1/auth_pb';
import { TRANSPORT } from '../core/api';
import { ApproveCodePage } from './approve-code.page';
import { alerts, fill, submit, text } from '../testing';

function setup(approve: () => unknown = () => create(ApproveCodeResponseSchema, { deviceName: 'Living room TV' })) {
  const calls: ApproveCodeRequest[] = [];
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      approveCode(req) {
        calls.push(req);
        return approve() as never;
      },
    }),
  );
  TestBed.configureTestingModule({ imports: [ApproveCodePage], providers: [provideRouter([]), { provide: TRANSPORT, useValue: transport }] });
  const fixture = TestBed.createComponent(ApproveCodePage);
  fixture.detectChanges();
  return { fixture, calls };
}

const input = (f: ReturnType<typeof setup>['fixture']) => f.nativeElement.querySelector('#code') as HTMLInputElement;
const button = (f: ReturnType<typeof setup>['fixture']) => f.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;

describe('ApproveCodePage', () => {
  it('labels the field and explains which characters a code has', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('label[for="code"]')).not.toBeNull();
    expect(input(fixture).maxLength).toBe(6);
    expect(input(fixture).autocomplete).toBe('off');
    expect(text(fixture)).toMatch(/0, 1, I or O/);
  });

  it('shows what the user types in capitals and drops spaces and dashes', async () => {
    const { fixture } = setup();
    await fill(fixture, '#code', 'ab-c d12');
    expect(input(fixture).value).toBe('ABCD12');
  });

  it('needs all six characters', async () => {
    const { fixture, calls } = setup();
    await fill(fixture, '#code', 'abc');
    fixture.detectChanges();
    expect(button(fixture).disabled).toBe(true);
    await submit(fixture);
    expect(calls.length).toBe(0);
  });

  it('approves the code in capitals and names the device', async () => {
    const { fixture, calls } = setup();
    await fill(fixture, '#code', 'abcd23');
    fixture.detectChanges();
    expect(button(fixture).disabled).toBe(false);
    await submit(fixture);
    expect(calls.map((c) => c.code)).toEqual(['ABCD23']);
    expect(text(fixture)).toContain('Signed in Living room TV');
    expect(input(fixture).value).toBe('');
  });

  it('unknown or expired code', async () => {
    const { fixture } = setup(() => {
      throw new ConnectError('unknown or expired code', Code.NotFound);
    });
    await fill(fixture, '#code', 'ABCD23');
    await submit(fixture);
    expect(alerts(fixture)).toEqual(['Code not found or expired']);
    expect(text(fixture)).not.toContain('Signed in');
  });

  it('passes the slow-down message through', async () => {
    const { fixture } = setup(() => {
      throw new ConnectError('try again in 2 s', Code.ResourceExhausted);
    });
    await fill(fixture, '#code', 'ABCD23');
    await submit(fixture);
    expect(alerts(fixture)).toEqual(['try again in 2 s']);
  });

  it('a new attempt clears the old result', async () => {
    let fail = true;
    const { fixture } = setup(() => {
      if (fail) throw new ConnectError('x', Code.NotFound);
      return create(ApproveCodeResponseSchema, { deviceName: 'TV' });
    });
    await fill(fixture, '#code', 'ABCD23');
    await submit(fixture);
    expect(alerts(fixture).length).toBe(1);
    fail = false;
    await fill(fixture, '#code', 'ABCD24');
    await submit(fixture);
    expect(alerts(fixture)).toEqual([]);
    expect(text(fixture)).toContain('Signed in TV');
  });
});
