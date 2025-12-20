import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearVenta } from './crear-venta';

describe('CrearVenta', () => {
  let component: CrearVenta;
  let fixture: ComponentFixture<CrearVenta>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearVenta]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrearVenta);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
