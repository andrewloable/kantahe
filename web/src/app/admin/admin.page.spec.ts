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
      ['Upload', '/admin/upload'],
      ['Users', '/admin/users'],
      ['Songs', '/admin/songs'],
      ['Videos', '/admin/videos'],
      ['Settings', '/admin/settings'],
      ['Transfer', '/admin/transfer'],
    ]);
    expect(nav!.querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Users');
    expect(el.textContent).toContain('users here');
  });

  it('regression: Upload is the first page of this menu and opens inside it, so the admin menu stays on screen', async () => {
    @Component({ template: '<p>upload here</p>' })
    class Upload {}
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'admin', component: AdminPage, children: [{ path: 'upload', component: Upload }] }])] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/upload', AdminPage);
    const el = harness.fixture.nativeElement as HTMLElement;
    expect(el.querySelector('nav a[aria-current="page"]')?.getAttribute('href')).toBe('/admin/upload');
    expect(el.textContent).toContain('upload here');
  });
});
