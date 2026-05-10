export const success = (data: unknown, message?: string) => ({
  status: 'success' as const,
  data,
  ...(message && { message }),
});

export const apiError = (code: string, message: string) => ({
  status: 'error' as const,
  error: { code, message },
});
