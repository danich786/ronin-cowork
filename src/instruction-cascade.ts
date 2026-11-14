export type Switches = Record<string, boolean>;

export const switches = (value: unknown): Switches => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] =>
    /^[a-z0-9][a-z0-9_-]{0,63}$/.test(entry[0]) && typeof entry[1] === 'boolean'));
};

