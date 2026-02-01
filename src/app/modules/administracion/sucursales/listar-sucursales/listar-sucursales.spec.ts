import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListarSucursales } from './listar-sucursales';

describe('ListarSucursales', () => {
  let component: ListarSucursales;
  let fixture: ComponentFixture<ListarSucursales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListarSucursales]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListarSucursales);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
