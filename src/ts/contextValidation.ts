/**
 * Utility functions to handle Chrome extension context invalidation
 */

export const isContextValid = (): boolean => {
  try {
    return !!(chrome?.runtime?.id);
  } catch {
    return false;
  }
};

export const withContextCheck = async <T>(
  operation: () => T | Promise<T>,
  fallback?: () => T | Promise<T>
): Promise<T> => {
  if (!isContextValid()) {
    console.warn('Extension context invalidated. Please reload the extension.');
    if (fallback) {
      return await fallback();
    }
    throw new Error('Extension context invalidated. Please reload the extension.');
  }

  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Extension context invalidated')) {
      console.warn('Extension context invalidated during operation. Please reload the extension.');
      if (fallback) {
        return await fallback();
      }
    }
    throw error;
  }
};

export const safeChrome = <T>(
  chromeOperation: () => T,
  fallback: T
): T => {
  try {
    if (!isContextValid()) {
      return fallback;
    }
    return chromeOperation();
  } catch {
    return fallback;
  }
};