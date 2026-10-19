import { DrillplotEditor } from './element.js';

export { DrillplotEditor, type ChangeDetail, type SaveDetail, type SourceErrorDetail } from './element.js';
export { DrillModel } from './model.js';
export { TOKENS } from './style.js';

/** Registers <drillplot-editor>. Importing this module does it for you; calling it twice is safe. */
export function defineDrillplotEditor(name = 'drillplot-editor'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(name)) customElements.define(name, DrillplotEditor);
}
defineDrillplotEditor();

declare global {
  interface HTMLElementTagNameMap {
    'drillplot-editor': DrillplotEditor;
  }
}
