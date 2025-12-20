import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListarHistorialClinico } from './listar-historial-clinico';

describe('ListarHistorialClinico', () => {
  let component: ListarHistorialClinico;
  let fixture: ComponentFixture<ListarHistorialClinico>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListarHistorialClinico]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListarHistorialClinico);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
