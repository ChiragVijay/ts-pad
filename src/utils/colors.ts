export const USER_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#eab308", // yellow
  "#ef4444", // red
] as const;

export const USER_COLORS_TAILWIND = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-yellow-500",
  "bg-red-500",
] as const;

export function getUserColor(userId: string): string {
  const index =
    userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    USER_COLORS.length;
  return USER_COLORS[index];
}

export function getUserColorClass(userId: string): string {
  const index =
    userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    USER_COLORS_TAILWIND.length;
  return USER_COLORS_TAILWIND[index];
}
