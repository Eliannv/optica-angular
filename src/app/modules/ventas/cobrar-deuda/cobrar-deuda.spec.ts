import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CobrarDeuda } from './cobrar-deuda';

describe('CobrarDeuda', () => {
  let component: CobrarDeuda;
  let fixture: ComponentFixture<CobrarDeuda>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CobrarDeuda]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CobrarDeuda);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
