export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 200);
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return '1 minute read';
  return `${minutes} minute read`;
}

export function paginateHTML(html: string, maxCharsPerPage: number = 3000): string[] {
  if (!html || html.trim() === '') return [''];

  // Split by block-level closing tags
  const blockRegex = /(<\/(?:p|h[1-6]|li|blockquote|div|ul|ol|hr)>)/gi;
  const parts = html.split(blockRegex);

  const pages: string[] = [];
  let currentPage = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (currentPage.length + part.length > maxCharsPerPage && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = part;
    } else {
      currentPage += part;
    }
  }

  if (currentPage.trim()) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [''];
}
