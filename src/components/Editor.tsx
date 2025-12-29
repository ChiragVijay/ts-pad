import type { LanguageDefinition } from "@/languages";
import type { ThemeDefinition } from "@/themes";
import MonacoEditor from "@monaco-editor/react";

interface EditorProps {
  theme: ThemeDefinition;
  language: LanguageDefinition;
}

const Editor = ({ theme, language }: EditorProps) => {
  return (
    <MonacoEditor
      height="100%"
      language={language.id}
      theme={theme.id}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        padding: { top: 16 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
      }}
    />
  );
};

export default Editor;
