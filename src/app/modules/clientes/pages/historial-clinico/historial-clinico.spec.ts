import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistorialClinicoComponent } from './historial-clinico';

describe('HistorialClinicoComponent', () => {
  let component: HistorialClinicoComponent;
  let fixture: ComponentFixture<HistorialClinicoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialClinicoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistorialClinicoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
