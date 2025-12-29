export type ThemeType = "light" | "dark";

export interface ThemeDefinition {
  id: string;
  label: string;
  type: ThemeType;
}

export const APP_THEMES: ThemeDefinition[] = [
  { id: "vs", label: "Light", type: "light" },
  { id: "vs-dark", label: "Dark", type: "dark" },
  { id: "hc-light", label: "High Contrast (Light)", type: "light" },
  { id: "hc-black", label: "High Contrast (Dark)", type: "dark" },
];
