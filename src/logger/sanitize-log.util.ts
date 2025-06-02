export function sanitizeLogData(data: Record<string, any>): Record<string, any> {
    const clone = { ...data };
    const sensitiveKeys = ['email', 'phone', 'access_code', 'password'];
  
    for (const key of sensitiveKeys) {
      if (clone[key]) {
        clone[key] = '[REDACTED]';
      }
    }
  
    return clone;
  }
  