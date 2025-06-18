import { getSecret } from './helpers.util'; 
import * as fs from 'fs';

jest.mock('fs');

describe('getSecret', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return file content if path exists', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('supersecret\n');

    const result = getSecret('/run/secrets/SECRET_KEY');
    expect(result).toBe('supersecret');
    expect(fs.readFileSync).toHaveBeenCalledWith('/run/secrets/SECRET_KEY', 'utf8');
  });

  it('should return raw value if path does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const result = getSecret('rawvalue');
    expect(result).toBe('rawvalue');
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('should return raw value if error occurs during read', () => {
    (fs.existsSync as jest.Mock).mockImplementation(() => {
      throw new Error('fs error');
    });

    const result = getSecret('fallbackvalue');
    expect(result).toBe('fallbackvalue');
  });
});
