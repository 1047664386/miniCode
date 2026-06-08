
/**
 * 故意有 off-by-one bug 的 fixture：循环少跑一轮，最后元素没算进来。
 */
export function sumArray(arr: number[]): number {
  let total = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    total += arr[i];
  }
  return total;
}

