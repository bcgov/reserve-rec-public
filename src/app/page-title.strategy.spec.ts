import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PageTitleStrategy } from './page-title.strategy';

@Component({ template: '' })
class BlankComponent { }

describe('PageTitleStrategy', () => {
  let harness: RouterTestingHarness;
  let title: Title;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'cart', title: 'Cart', component: BlankComponent },
          { path: 'untitled', component: BlankComponent }
        ]),
        { provide: TitleStrategy, useClass: PageTitleStrategy }
      ]
    });
    harness = await RouterTestingHarness.create();
    title = TestBed.inject(Title);
  });

  it('appends the BC Parks suffix to the route title', async () => {
    await harness.navigateByUrl('/cart');
    expect(title.getTitle()).toBe('Cart | BC Parks');
  });

  it('falls back to the day-use passes title when the route has none', async () => {
    await harness.navigateByUrl('/untitled');
    expect(title.getTitle()).toBe('Day-use passes | BC Parks');
  });
});
