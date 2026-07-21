export function importEntry(title: string, body: string): string {
  return `# ${title}\n\n${body.trim()}\n`;
}
