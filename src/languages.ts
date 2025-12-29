export interface LanguageDefinition {
  id: string;
  label: string;
}

export const APP_LANGUAGES: LanguageDefinition[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },

  { id: "rust", label: "Rust" },
  { id: "go", label: "Go" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "kotlin", label: "Kotlin" },

  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "csharp", label: "C#" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },

  { id: "sql", label: "SQL" },
  { id: "yaml", label: "YAML" },
  { id: "xml", label: "XML" },

  { id: "shell", label: "Shell" },
  { id: "powershell", label: "PowerShell" },

  { id: "markdown", label: "Markdown" },
  { id: "plaintext", label: "Plain Text" },
];
