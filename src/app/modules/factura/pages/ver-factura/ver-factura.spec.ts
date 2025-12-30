import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerFacturaComponent } from './ver-factura';


describe('VerFactura', () => {
  let component: VerFacturaComponent;
  let fixture: ComponentFixture<VerFacturaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerFacturaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerFacturaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
