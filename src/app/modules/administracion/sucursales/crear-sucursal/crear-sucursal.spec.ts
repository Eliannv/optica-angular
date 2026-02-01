import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearSucursal } from './crear-sucursal';

describe('CrearSucursal', () => {
  let component: CrearSucursal;
  let fixture: ComponentFixture<CrearSucursal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearSucursal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrearSucursal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
