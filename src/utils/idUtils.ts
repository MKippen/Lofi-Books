export function generateId(): string {
  return crypto.randomUUID();
}

export function hashStringToNumber(str: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return min + (Math.abs(hash) % (max - min + 1));
}
