export const tryJson = (x: string) => {
  if (typeof x !== "string") return undefined;
  try {
    return JSON.parse(x);
  } catch (e) {
    return undefined;
  }
};
