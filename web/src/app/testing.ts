import { ComponentFixture } from '@angular/core/testing';

/** Types into a field the way a user does. */
export async function fill<T>(fixture: ComponentFixture<T>, selector: string, value: string): Promise<void> {
  const el = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
  if (!el) throw new Error(`no element ${selector}`);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await fixture.whenStable();
}

export async function submit<T>(fixture: ComponentFixture<T>): Promise<void> {
  const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await fixture.whenStable();
}

export function text<T>(fixture: ComponentFixture<T>): string {
  return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function alerts<T>(fixture: ComponentFixture<T>): string[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="alert"]')).map((e) => e.textContent?.trim() ?? '');
}
