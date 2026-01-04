import type { LanguageDefinition } from "@/languages";
import type { ThemeDefinition } from "@/themes";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Identifier, RemoteInsertOp } from "server/crdt";
import { useSync } from "../hooks/useSync";
import type { User } from "../hooks/useWebSocket";

interface EditorProps {
  theme: ThemeDefinition;
  language: LanguageDefinition;
  docId: string;
  userId: string;
  username: string;
  onUsersChange: (users: User[]) => void;
  onRenameUser: (newName: string) => void;
  onLanguageChange: (languageId: string) => void;
  renameUserRef: RefObject<((name: string) => void) | null>;
}

const Editor = ({
  theme,
  language,
  docId,
  userId,
  username,
  onUsersChange,
  onRenameUser,
  onLanguageChange,
  renameUserRef,
}: EditorProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const isRemoteChange = useRef(false);
  const hasInitialized = useRef(false);
  const cursorDecorationsRef = useRef<string[]>([]);

  const getEditorModel = useCallback(() => {
    return editorRef.current?.getModel();
  }, []);

  const crdtRef = useRef<ReturnType<typeof useSync>["crdt"] | null>(null);

  const applyRemoteInsert = useCallback(
    (payload: RemoteInsertOp) => {
      const model = getEditorModel();
      if (!model || !editorRef.current || !crdtRef.current) return;

      const index = crdtRef.current.getVisibleIndex(payload.char.id);
      if (index === -1) return;

      const pos = model.getPositionAt(index);
      editorRef.current.executeEdits("remote", [
        {
          range: new monaco.Range(
            pos.lineNumber,
            pos.column,
            pos.lineNumber,
            pos.column,
          ),
          text: payload.char.value,
          forceMoveMarkers: true,
        },
      ]);
    },
    [getEditorModel],
  );

  const applyRemoteDelete = useCallback(
    (payload: { id: Identifier; visibleIndex: number }) => {
      const model = getEditorModel();
      if (!model || !editorRef.current) return;

      const index = payload.visibleIndex;
      if (index === -1) return;

      const start = model.getPositionAt(index);
      const end = model.getPositionAt(index + 1);
      editorRef.current.executeEdits("remote", [
        {
          range: new monaco.Range(
            start.lineNumber,
            start.column,
            end.lineNumber,
            end.column,
          ),
          text: "",
        },
      ]);
    },
    [getEditorModel],
  );

  const handleInit = useCallback(() => {
    if (!editorRef.current || !crdtRef.current || hasInitialized.current)
      return;

    hasInitialized.current = true;
    isRemoteChange.current = true;

    const model = editorRef.current.getModel();
    if (model) {
      const content = crdtRef.current.toString();
      model.setValue(content);
    }

    isRemoteChange.current = false;
  }, []);

  const {
    crdt,
    isInitialized,
    users,
    applyLocalInsert,
    applyLocalDelete,
    renameUser,
    changeLanguage,
    updateCursor,
  } = useSync(
    docId,
    userId,
    username,
    useCallback(
      (type: string, payload: any) => {
        isRemoteChange.current = true;

        if (type === "insert") {
          applyRemoteInsert(payload);
        } else if (type === "delete") {
          applyRemoteDelete(payload);
        }

        isRemoteChange.current = false;
      },
      [applyRemoteInsert, applyRemoteDelete],
    ),
    handleInit,
    onLanguageChange,
  );

  crdtRef.current = crdt;

  useEffect(() => {
    onUsersChange(users);
  }, [users, onUsersChange]);

  useEffect(() => {
    renameUserRef.current = renameUser;
  }, [renameUser, renameUserRef]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const remoteUsers = users.filter((u) => u.id !== userId && u.cursor);

    const decorations: monaco.editor.IModelDeltaDecoration[] = remoteUsers.map(
      (user) => ({
        range: new monaco.Range(
          user.cursor!.lineNumber,
          user.cursor!.column,
          user.cursor!.lineNumber,
          user.cursor!.column,
        ),
        options: {
          className: `remote-cursor`,
          beforeContentClassName: `remote-cursor-line`,
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }),
    );

    const styleId = "remote-cursor-styles";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const css = remoteUsers
      .map(
        (user, idx) => `
      .remote-cursor-${idx} { border-left-color: ${user.color} !important; }
    `,
      )
      .join("\n");
    styleEl.textContent = css;

    const decorationsWithColors = remoteUsers.map((user, idx) => ({
      range: new monaco.Range(
        user.cursor!.lineNumber,
        user.cursor!.column,
        user.cursor!.lineNumber,
        user.cursor!.column,
      ),
      options: {
        className: `remote-cursor remote-cursor-${idx}`,
        beforeContentClassName: `remote-cursor-line remote-cursor-${idx}`,
        stickiness:
          monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }));

    cursorDecorationsRef.current = editor
      .getModel()!
      .deltaDecorations(cursorDecorationsRef.current, decorationsWithColors);
  }, [users, userId]);

  const prevLanguageRef = useRef(language.id);
  useEffect(() => {
    if (isInitialized && prevLanguageRef.current !== language.id) {
      changeLanguage(language.id);
    }
    prevLanguageRef.current = language.id;
  }, [language.id, isInitialized, changeLanguage]);

  useEffect(() => {
    if (isInitialized && editorRef.current && !hasInitialized.current) {
      handleInit();
    }
  }, [isInitialized, handleInit]);

  const handleContentChange = useCallback(
    (event: monaco.editor.IModelContentChangedEvent) => {
      if (isRemoteChange.current) return;

      event.changes.forEach((change) => {
        const { rangeOffset, rangeLength, text } = change;

        if (rangeLength > 0) {
          for (let i = 0; i < rangeLength; i++) {
            applyLocalDelete(rangeOffset);
          }
        }

        if (text.length > 0) {
          for (let i = 0; i < text.length; i++) {
            applyLocalInsert(text[i], rangeOffset + i);
          }
        }
      });
    },
    [applyLocalInsert, applyLocalDelete],
  );

  const handleEditorMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor;
      editor.onDidChangeModelContent(handleContentChange);

      editor.onDidChangeCursorPosition((e) => {
        updateCursor({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      });
    },
    [handleContentChange, updateCursor],
  );

  return (
    <MonacoEditor
      height="100%"
      language={language.id}
      theme={theme.id}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        padding: { top: 10, bottom: 10 },
        tabSize: 2,
        automaticLayout: true,
        wordWrap: "on",
        scrollBeyondLastLine: false,
      }}
      onMount={handleEditorMount}
    />
  );
};

export default Editor;
