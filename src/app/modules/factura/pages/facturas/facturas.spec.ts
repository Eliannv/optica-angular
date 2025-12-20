import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Facturas } from './facturas';

describe('Facturas', () => {
  let component: Facturas;
  let fixture: ComponentFixture<Facturas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Facturas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Facturas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
