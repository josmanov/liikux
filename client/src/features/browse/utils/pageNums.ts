export function pageNums(current: number, count: number): Array<number | "gap"> {
  if (count <= 6) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  if (current <= 4) return [1, 2, 3, 4, "gap", count];
  if (current >= count - 3) {
    return [1, "gap", count - 3, count - 2, count - 1, count];
  }
  return [1, "gap", current - 1, current, current + 1, "gap", count];
}
