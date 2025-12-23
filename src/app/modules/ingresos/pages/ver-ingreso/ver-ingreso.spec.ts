import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerIngresoComponent } from './ver-ingreso';

describe('VerIngresoComponent', () => {
  let component: VerIngresoComponent;
  let fixture: ComponentFixture<VerIngresoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerIngresoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerIngresoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
