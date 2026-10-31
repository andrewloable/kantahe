import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AdminPage } from './admin.page';

@Component({ template: '<p>users here</p>' })
class Child {}

describe('AdminPage', () => {
  it('has a menu of the admin pages and a place for the page', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'admin', component: AdminPage, children: [{ path: 'users', component: Child }] }])] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/users', AdminPage);
    const el = harness.fixture.nativeElement as HTMLElement;
    const nav = el.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Administration');
    expect(Array.from(nav!.querySelectorAll('a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Users', '/admin/users'],
      ['Songs', '/admin/songs'],
      ['Upload', '/upload'],
      ['Settings', '/admin/settings'],
    ]);
    expect(nav!.querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Users');
    expect(el.textContent).toContain('users here');
  });
});
