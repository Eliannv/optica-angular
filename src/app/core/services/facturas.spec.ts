import { TestBed } from '@angular/core/testing';

import { Facturas } from './facturas';

describe('Facturas', () => {
  let service: Facturas;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Facturas);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
