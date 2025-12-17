import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearCliente } from './crear-cliente';

describe('CrearCliente', () => {
  let component: CrearCliente;
  let fixture: ComponentFixture<CrearCliente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearCliente]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrearCliente);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
