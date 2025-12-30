class DocumentState {
  content: string = "";

  updateContent(change: any) {
    this.content += change;
  }
}

class DocumentManager {
  private documents: Map<string, DocumentState> = new Map();

  createDocumentState(docId: string) {
    if (!this.documents.has(docId)) {
      this.documents.set(docId, new DocumentState());
    }
  }

  getDocumentState(docId: string): DocumentState {
    let state = this.documents.get(docId);
    if (!state) {
      state = new DocumentState();
      this.documents.set(docId, state);
    }
    return state;
  }

  updateDocumentState(docId: string, change: any) {
    const state = this.getDocumentState(docId);
    state.updateContent(change);
  }
}

export const docManager = new DocumentManager();
