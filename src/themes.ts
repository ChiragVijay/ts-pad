import type { Extension } from "@codemirror/state";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";

export type ThemeType = "light" | "dark";

export interface ThemeDefinition {
  id: string;
  label: string;
  type: ThemeType;
  extension: Extension;
}

export const APP_THEMES: ThemeDefinition[] = [
  {
    id: "github-light",
    label: "GitHub Light",
    type: "light",
    extension: githubLight,
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    type: "dark",
    extension: githubDark,
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    type: "dark",
    extension: tokyoNight,
  },
  {
    id: "dracula",
    label: "Dracula",
    type: "dark",
    extension: dracula,
  },
];
