import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListarFacturas } from './listar-facturas';

describe('ListarFacturas', () => {
  let component: ListarFacturas;
  let fixture: ComponentFixture<ListarFacturas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListarFacturas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListarFacturas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
