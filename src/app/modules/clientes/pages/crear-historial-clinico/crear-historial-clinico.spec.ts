import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrearHistorialClinicoComponent } from './crear-historial-clinico';



describe('CrearHistorialClinico', () => {
  let component: CrearHistorialClinicoComponent;
  let fixture: ComponentFixture<CrearHistorialClinicoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearHistorialClinicoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrearHistorialClinicoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
