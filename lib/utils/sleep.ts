export const sleep = <Args extends unknown[]>(
  ms: number,
  ...args: Args
): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms, ...args));
};
