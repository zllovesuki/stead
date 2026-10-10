export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
}
export function formatBytes(size: number) {
  return size < 1024 ? `${size} B` : `${Math.round(size / 1024)} KB`;
}
