import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListarClientes } from './listar-clientes';

describe('ListarClientes', () => {
  let component: ListarClientes;
  let fixture: ComponentFixture<ListarClientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListarClientes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListarClientes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
