import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { TRANSPORT } from '../../core/api';
import { fakeAdminUsers, user } from '../testing';
import { UserFormComponent } from './user-form.component';

function setup() {
  const server = fakeAdminUsers([user('u1', 'ann@example.com', { admin: true })]);
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  const fixture = TestBed.createComponent(UserFormComponent);
  const created = vi.fn();
  fixture.componentInstance.created.subscribe(created);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  const fill = (id: string, value: string) => {
    const i = el.querySelector<HTMLInputElement>('#' + id)!;
    i.value = value;
    i.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  };
  return { fixture, el, server, created, settle, fill, submit };
}

describe('UserFormComponent', () => {
  it('has a labelled field for each thing, and checkboxes for the roles', () => {
    const { el } = setup();
    for (const input of Array.from(el.querySelectorAll('input'))) expect(el.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
    expect(Array.from(el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).map((c) => c.id)).toEqual(['new-admin', 'new-uploader']);
  });

  it('Generate fills in 12 random characters', async () => {
    const { el, settle } = setup();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Generate')!.click();
    await settle();
    const value = el.querySelector<HTMLInputElement>('#new-password')!.value;
    expect(value).toHaveLength(12);
  });

  it('create sends the form values', async () => {
    const { el, fill, submit, server, created } = setup();
    fill('new-email', ' bob@example.com ');
    fill('new-name', 'Bob');
    fill('new-password', 'Abcd2345wxyz');
    el.querySelector<HTMLInputElement>('#new-uploader')!.click();
    await submit();
    expect(server.calls.create.length).toBe(1);
    const c = server.calls.create[0];
    expect([c.email, c.displayName, c.temporaryPassword, c.admin, c.uploader]).toEqual(['bob@example.com', 'Bob', 'Abcd2345wxyz', false, true]);
    expect(created).toHaveBeenCalledTimes(1);
    expect(created.mock.calls[0][0]).toMatchObject({ user: { email: 'bob@example.com' }, password: 'Abcd2345wxyz' });
  });

  it('clears the form after it worked (the password included)', async () => {
    const { el, fill, submit } = setup();
    fill('new-email', 'bob@example.com');
    fill('new-name', 'Bob');
    fill('new-password', 'Abcd2345wxyz');
    await submit();
    expect(el.querySelector<HTMLInputElement>('#new-email')!.value).toBe('');
    expect(el.querySelector<HTMLInputElement>('#new-password')!.value).toBe('');
  });

  it('an email that is taken says so', async () => {
    const { el, fill, submit, created } = setup();
    fill('new-email', 'ann@example.com');
    fill('new-name', 'Ann again');
    fill('new-password', 'Abcd2345wxyz');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Email already in use');
    expect(created).not.toHaveBeenCalled();
  });

  it('checks the fields before asking the server', async () => {
    const { el, submit, server, fill } = setup();
    await submit();
    expect(server.calls.create).toEqual([]);
    const alerts = Array.from(el.querySelectorAll('[role="alert"]')).map((a) => a.textContent);
    expect(alerts.join(' | ')).toContain('Enter a valid email address.');
    expect(alerts.join(' | ')).toContain('Enter a name');
    expect(alerts.join(' | ')).toContain('8 to 256');
    fill('new-email', 'x@example.com');
    fill('new-name', 'X');
    fill('new-password', 'short');
    await submit();
    expect(server.calls.create).toEqual([]);
  });

  it('shows what else the server says', async () => {
    const { fill, submit, server, el } = setup();
    server.failNext(new ConnectError('invalid email address', Code.InvalidArgument));
    fill('new-email', 'bob@example.com');
    fill('new-name', 'Bob');
    fill('new-password', 'Abcd2345wxyz');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('invalid email address');
  });

  it('a double submit creates one user', async () => {
    const { el, fill, server, settle } = setup();
    fill('new-email', 'bob@example.com');
    fill('new-name', 'Bob');
    fill('new-password', 'Abcd2345wxyz');
    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(server.calls.create.length).toBe(1);
  });
});
