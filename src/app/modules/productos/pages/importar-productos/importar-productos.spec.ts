import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportarProductosComponent } from './importar-productos';

describe('ImportarProductosComponent', () => {
  let component: ImportarProductosComponent;
  let fixture: ComponentFixture<ImportarProductosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportarProductosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportarProductosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
