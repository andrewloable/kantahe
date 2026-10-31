import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast';
import { ToastsComponent } from './toasts.component';

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a message and removes it after a few seconds', () => {
    const t = TestBed.inject(ToastService);
    t.show('Added Song');
    expect(t.toasts().map((x) => x.message)).toEqual(['Added Song']);
    vi.advanceTimersByTime(3999);
    expect(t.toasts().length).toBe(1);
    vi.advanceTimersByTime(2);
    expect(t.toasts()).toEqual([]);
  });

  it('keeps errors a little longer', () => {
    const t = TestBed.inject(ToastService);
    t.show('Oops', 'error');
    vi.advanceTimersByTime(5000);
    expect(t.toasts().length).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(t.toasts()).toEqual([]);
  });

  it('dismiss removes one toast', () => {
    const t = TestBed.inject(ToastService);
    t.show('a');
    t.show('b');
    t.dismiss(t.toasts()[0].id);
    expect(t.toasts().map((x) => x.message)).toEqual(['b']);
  });

  it('a toast can carry an action; running it dismisses the toast', () => {
    const t = TestBed.inject(ToastService);
    const undo = vi.fn();
    t.show('Removed Hello', 'info', { label: 'Undo', run: undo });
    const toast = t.toasts()[0];
    expect(toast.action?.label).toBe('Undo');
    t.act(toast.id);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(t.toasts()).toEqual([]);
  });

  it('an action runs once however often it is pressed', () => {
    const t = TestBed.inject(ToastService);
    const undo = vi.fn();
    t.show('Removed Hello', 'info', { label: 'Undo', run: undo });
    const id = t.toasts()[0].id;
    t.act(id);
    t.act(id);
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('keeps at most four, dropping the oldest', () => {
    const t = TestBed.inject(ToastService);
    for (const m of ['1', '2', '3', '4', '5']) t.show(m);
    expect(t.toasts().map((x) => x.message)).toEqual(['2', '3', '4', '5']);
  });
});

describe('ToastsComponent', () => {
  it('announces messages politely and errors as alerts, with a dismiss button', async () => {
    const f = TestBed.createComponent(ToastsComponent);
    const t = TestBed.inject(ToastService);
    t.show('Added Song');
    t.show('Failed', 'error');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Added Song');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Failed');
    (el.querySelector('button') as HTMLButtonElement).click();
    await f.whenStable();
    expect(t.toasts().length).toBe(1);
  });

  it('shows the action as a button that runs it', async () => {
    const f = TestBed.createComponent(ToastsComponent);
    const t = TestBed.inject(ToastService);
    const undo = vi.fn();
    t.show('Removed Hello', 'info', { label: 'Undo', run: undo });
    await f.whenStable();
    const btn = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Undo')!;
    btn.click();
    expect(undo).toHaveBeenCalledTimes(1);
  });
});
