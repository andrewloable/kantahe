import { TestBed } from '@angular/core/testing';
import { ActionMenuComponent, MenuItem } from './action-menu.component';

describe('ActionMenuComponent', () => {
  function setup(items: MenuItem[]) {
    const fixture = TestBed.createComponent(ActionMenuComponent);
    fixture.componentRef.setInput('label', 'More actions for Hello');
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    const trigger = el.querySelector<HTMLButtonElement>('button.more')!;
    const menuItems = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    return { fixture, el, trigger, menuItems, settle, key };
  }
  afterEach(() => document.body.querySelectorAll('app-action-menu').forEach((e) => e.remove()));

  const three = () => {
    const ran: string[] = [];
    const items: MenuItem[] = ['Add to a playlist', 'Download', 'Delete'].map((label) => ({ label, run: () => ran.push(label), danger: label === 'Delete' }));
    return { ran, items };
  };

  it('is one button named for the song that says it opens a menu, closed at first', () => {
    const { trigger, menuItems } = setup(three().items);
    expect(trigger.getAttribute('aria-label')).toBe('More actions for Hello');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(menuItems()).toEqual([]);
  });

  it('opens a menu of its items with the focus on the first; Escape closes it and gives the focus back', async () => {
    const { el, trigger, menuItems, settle, key } = setup(three().items);
    trigger.click();
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('More actions for Hello');
    expect(menuItems().map((b) => b.textContent?.trim())).toEqual(['Add to a playlist', 'Download', 'Delete']);
    expect(document.activeElement).toBe(menuItems()[0]);
    key(menuItems()[0], 'Escape');
    await settle();
    expect(menuItems()).toEqual([]);
    expect(document.activeElement).toBe(trigger);
  });

  it('ArrowDown and ArrowUp move between the items and wrap; Home and End go to the ends', async () => {
    const { trigger, menuItems, settle, key } = setup(three().items);
    trigger.click();
    await settle();
    key(menuItems()[0], 'ArrowDown');
    expect(document.activeElement).toBe(menuItems()[1]);
    key(menuItems()[1], 'ArrowDown');
    key(menuItems()[2], 'ArrowDown');
    expect(document.activeElement).toBe(menuItems()[0]);
    key(menuItems()[0], 'ArrowUp');
    expect(document.activeElement).toBe(menuItems()[2]);
    key(menuItems()[2], 'Home');
    expect(document.activeElement).toBe(menuItems()[0]);
    key(menuItems()[0], 'End');
    expect(document.activeElement).toBe(menuItems()[2]);
  });

  it('choosing an item closes the menu, gives the focus back and runs it', async () => {
    const { ran, items } = three();
    const { trigger, menuItems, settle } = setup(items);
    trigger.click();
    await settle();
    menuItems()[2].click();
    await settle();
    expect(ran).toEqual(['Delete']);
    expect(menuItems()).toEqual([]);
    expect(document.activeElement).toBe(trigger);
  });

  it('a danger item is marked, a disabled item cannot be chosen', async () => {
    const ran: string[] = [];
    const { trigger, menuItems, settle } = setup([
      { label: 'Download', run: () => ran.push('d'), disabled: true },
      { label: 'Delete', run: () => ran.push('x'), danger: true },
    ]);
    trigger.click();
    await settle();
    expect(menuItems()[0].disabled).toBe(true);
    expect(menuItems()[1].classList.contains('danger')).toBe(true);
    menuItems()[0].click();
    expect(ran).toEqual([]);
  });

  it('a click elsewhere closes the menu; a second press of the button too', async () => {
    const { trigger, menuItems, settle } = setup(three().items);
    trigger.click();
    await settle();
    document.body.click();
    await settle();
    expect(menuItems()).toEqual([]);
    trigger.click();
    await settle();
    trigger.click();
    await settle();
    expect(menuItems()).toEqual([]);
  });
});
