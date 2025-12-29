import type { ThemeDefinition } from "@/themes";
import { Compartment } from "@codemirror/state";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef } from "react";

interface EditorProps {
  theme: ThemeDefinition;
}

const themeConfig = new Compartment();

const Editor = ({ theme }: EditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);

  useEffect(() => {
    if (editorRef.current) {
      const view = new EditorView({
        doc: "",
        extensions: [
          basicSetup,
          themeConfig.of(theme.extension),
          EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto" },
          }),
        ],
        parent: editorRef.current,
      });
      viewRef.current = view;

      return () => {
        view.destroy();
      };
    }
  }, []);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: themeConfig.reconfigure(theme.extension),
      });
    }
  }, [theme]);

  return <div className="h-full w-full" ref={editorRef}></div>;
};

export default Editor;
