import { DrillplotEditor } from './element.js';

export { DrillplotEditor, type ChangeDetail, type SaveDetail, type SourceErrorDetail } from './element.js';
export { DrillModel } from './model.js';
export { TOKENS } from './style.js';

/**
 * Registers the editor under a tag name. Importing this module already registers
 * <drillplot-editor>; call this to register it under another name too. A custom element
 * constructor can be registered only once, so any other name gets a subclass. Calling it
 * twice with the same name is safe.
 */
export function defineDrillplotEditor(name = 'drillplot-editor'): void {
  if (typeof customElements === 'undefined' || customElements.get(name)) return;
  customElements.define(name, name === 'drillplot-editor' ? DrillplotEditor : class extends DrillplotEditor {});
}
defineDrillplotEditor();

declare global {
  interface HTMLElementTagNameMap {
    'drillplot-editor': DrillplotEditor;
  }
}
