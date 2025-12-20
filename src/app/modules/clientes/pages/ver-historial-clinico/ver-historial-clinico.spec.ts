import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerHistorialClinico } from './ver-historial-clinico';

describe('VerHistorialClinico', () => {
  let component: VerHistorialClinico;
  let fixture: ComponentFixture<VerHistorialClinico>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerHistorialClinico]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerHistorialClinico);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
