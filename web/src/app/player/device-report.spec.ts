import { deviceMemoryMb } from './device-report';

describe('deviceMemoryMb', () => {
  it('turns the gigabytes the browser reports into megabytes', () => {
    expect(deviceMemoryMb({ deviceMemory: 4 } as unknown as Navigator)).toBe(4096);
    expect(deviceMemoryMb({ deviceMemory: 0.5 } as unknown as Navigator)).toBe(512);
  });
  it('is 0 when the browser does not say', () => {
    expect(deviceMemoryMb({} as Navigator)).toBe(0);
    expect(deviceMemoryMb({ deviceMemory: 0 } as unknown as Navigator)).toBe(0);
    expect(deviceMemoryMb({ deviceMemory: Number.NaN } as unknown as Navigator)).toBe(0);
    expect(deviceMemoryMb({ deviceMemory: -2 } as unknown as Navigator)).toBe(0);
  });
});
