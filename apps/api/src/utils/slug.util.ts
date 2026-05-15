/**
 * Slugify cho tiếng Việt — bỏ dấu, đổi đ→d, gộp non-alphanumeric thành "-".
 * Dùng chung cho seed + import service. Không phụ thuộc lib ngoài.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Tìm slug duy nhất trong cùng category: nếu đụng → `slug-2`, `slug-3`...
 * `existsCheck` trả về true nếu slug đã tồn tại.
 */
export async function uniqueSlugWithin(
  base: string,
  existsCheck: (candidate: string) => Promise<boolean>
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  let counter = 2;
  while (await existsCheck(candidate)) {
    candidate = `${root}-${counter}`;
    counter += 1;
    if (counter > 99) {
      candidate = `${root}-${Date.now().toString(36)}`;
      break;
    }
  }
  return candidate;
}
