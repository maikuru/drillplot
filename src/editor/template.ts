export const TEMPLATE = `
<div class="root" part="root">
  <div class="tools" part="toolbar">
    <div class="seg" role="radiogroup" aria-label="Court view">
      <input type="radio" name="view" id="view-full" value="full"><label for="view-full">Full court</label>
      <input type="radio" name="view" id="view-half" value="half"><label for="view-half">Half court</label>
      <input type="radio" name="view" id="view-kitchen" value="kitchen"><label for="view-kitchen">Kitchen zoom</label>
    </div>
    <div class="seg" role="radiogroup" aria-label="Orientation">
      <input type="radio" name="orient" id="orient-portrait" value="portrait"><label for="orient-portrait">Portrait</label>
      <input type="radio" name="orient" id="orient-landscape" value="landscape"><label for="orient-landscape">Landscape</label>
    </div>
    <label class="check" for="mono"><input type="checkbox" id="mono"> Greyscale view</label>
    <select class="sel" id="half-side" aria-label="Which half to show" hidden>
      <option value="bottom">Bottom half</option>
      <option value="top">Top half</option>
    </select>
    <select class="sel" id="court-pick" aria-label="Court being edited" hidden></select>
    <span class="sp"></span>
    <button type="button" class="btn sm" id="undo">Undo</button>
    <button type="button" class="btn sm" id="redo">Redo</button>
    <button type="button" class="btn sm danger" id="delete">Delete</button>
    <button type="button" class="btn sm" id="clear">Clear</button>
    <span class="confirm" id="clear-confirm" hidden role="alert">
      <span>Clear the whole court?</span>
      <button type="button" class="btn sm danger" id="clear-yes">Yes, clear it</button>
      <button type="button" class="btn sm" id="clear-no">Keep it</button>
    </span>
  </div>

  <div class="body">
    <div class="stage-col">
      <div class="stage-wrap">
        <svg class="stage" id="stage" part="stage" xmlns="http://www.w3.org/2000/svg" viewBox="-2.5 -2.5 25 49" role="group" aria-label="Court drawing area. Use the piece list to select, arrow keys to nudge, Delete to remove." tabindex="0"></svg>
      </div>
      <div class="note"><span id="scale"></span><span id="offview"></span></div>
    </div>

    <div class="side" part="panel">
      <section aria-labelledby="h-details">
        <h3 id="h-details">Details</h3>
        <div class="field"><label for="title">Diagram title</label><input type="text" id="title" maxlength="120" autocomplete="off"></div>
        <div class="field" style="margin-top:8px"><label for="caption">Caption (optional)</label><textarea id="caption" maxlength="300"></textarea></div>
        <label class="check" for="show-caption"><input type="checkbox" id="show-caption"> Print the caption under the court</label>
      </section>

      <section aria-labelledby="h-legend">
        <h3 id="h-legend">Legend</h3>
        <p class="small">Notes printed under the court. A note's key matches a badge on the court or a shot number; leave the key empty to show a color swatch instead.</p>
        <div id="legend-rows" class="legend-rows"></div>
        <button type="button" class="btn sm" id="legend-add" style="margin-top:8px">Add a note</button>
      </section>

      <section aria-labelledby="h-courts">
        <h3 id="h-courts">Courts</h3>
        <div class="field"><label for="courts-n">Courts in this diagram</label>
          <select id="courts-n"><option value="1">One court</option><option value="2">Two courts</option><option value="3">Three courts</option><option value="4">Four courts</option></select>
          <span class="small" id="courts-note"></span></div>
        <div id="court-rows" class="legend-rows"></div>
      </section>

      <section class="pal" aria-labelledby="h-add">
        <h3 id="h-add">Add to the court</h3>
        <div class="row" role="group" aria-label="Players">
          <button type="button" class="btn sm" data-kind="pA"><span class="dot orange"></span>A</button>
          <button type="button" class="btn sm" data-kind="pB"><span class="dot orange"></span>B</button>
          <button type="button" class="btn sm" data-kind="pC"><span class="dot blue"></span>C</button>
          <button type="button" class="btn sm" data-kind="pD"><span class="dot blue"></span>D</button>
          <button type="button" class="btn sm" data-kind="pCoach"><span class="dot black"></span>Coach</button>
        </div>
        <div class="row" style="margin-top:8px" role="group" aria-label="Equipment">
          <button type="button" class="btn sm" data-kind="machine"><span class="dot sq"></span>Ball machine</button>
          <button type="button" class="btn sm" data-kind="cone"><span class="dot cone"></span>Cone</button>
          <button type="button" class="btn sm" data-kind="zone"><span class="dot zone"></span>Target zone</button>
          <button type="button" class="btn sm" data-kind="mark"><span class="dot key">1</span>Legend badge</button>
        </div>
        <h3 style="margin-top:14px">Draw arrows</h3>
        <div class="row" role="group" aria-label="Arrow tools">
          <button type="button" class="btn sm" data-tool="select" aria-pressed="true">Select and move</button>
          <button type="button" class="btn sm" data-tool="drive" aria-pressed="false">Drive (straight)</button>
          <button type="button" class="btn sm" data-tool="drop" aria-pressed="false">Drop or lob (curved)</button>
          <button type="button" class="btn sm" data-tool="move" aria-pressed="false">Movement (dashed)</button>
          <button type="button" class="btn sm" data-tool="line" aria-pressed="false">Line (no arrowhead)</button>
        </div>
        <p class="hint" id="hint" aria-live="polite"></p>
      </section>

      <section aria-labelledby="h-sel">
        <h3 id="h-sel">Pieces on the court</h3>
        <div class="field"><label for="pick">Select a piece</label><select id="pick"></select></div>
        <div class="insp" id="insp" hidden>
          <strong id="insp-name" aria-live="polite"></strong>
          <div class="field" id="g-label"><label for="sel-label" id="sel-label-l">Label</label><input type="text" id="sel-label" maxlength="8" autocomplete="off"></div>
          <div class="field" id="g-note"><label for="sel-note">Role under the disc (optional)</label><input type="text" id="sel-note" maxlength="16" autocomplete="off"></div>
          <div class="field" id="g-team"><label for="sel-team">Player color</label>
            <select id="sel-team"><option value="orange">Orange</option><option value="blue">Blue</option><option value="white">White</option><option value="black">Black</option></select>
            <span class="small">Four colors that stay apart for color-blind viewers and on a black and white printer.</span></div>
          <label class="check" id="g-ghost"><input type="checkbox" id="sel-ghost"> <span id="sel-ghost-l">Dashed outline</span></label>
          <div class="field" id="g-color"><label for="sel-color">Color</label>
            <select id="sel-color"><option value="">Default</option><option value="yellow">Yellow</option><option value="white">White</option><option value="orange">Orange</option><option value="red">Red</option><option value="pink">Pink</option><option value="green">Green</option><option value="black">Black</option></select></div>
          <label class="check" id="g-dash"><input type="checkbox" id="sel-dash"> Dashed (cooperative or optional)</label>
          <div class="field" id="g-alt"><label for="sel-alt">Either-or choice</label>
            <select id="sel-alt"><option value="">No: a shot in the sequence</option><option value="a">Choice a</option><option value="b">Choice b</option><option value="c">Choice c</option><option value="d">Choice d</option></select>
            <span class="small">Give two paths the same shot number and different letters to show one or the other.</span></div>
          <div id="g-ball">
            <label class="check"><input type="checkbox" id="sel-curve"> Curved (drop or lob)</label>
            <div class="row">
              <button type="button" class="btn sm" id="sel-flip">Flip the curve</button>
              <button type="button" class="btn sm" id="sel-earlier">Earlier shot</button>
              <button type="button" class="btn sm" id="sel-later">Later shot</button>
            </div>
          </div>
          <div class="field" id="g-key"><label for="sel-key">Legend badge (optional, up to 3 characters)</label><input type="text" id="sel-key" maxlength="3" autocomplete="off"></div>
          <div class="field" id="g-aim"><label for="sel-aim">Aim: <span id="sel-aim-v"></span> degrees</label><input type="range" id="sel-aim" min="0" max="359" step="1"></div>
          <div class="row" id="g-zone">
            <div class="field"><label for="sel-w">Width (ft)</label><input type="number" id="sel-w" min="1" max="20" step="0.5"></div>
            <div class="field"><label for="sel-h">Length (ft)</label><input type="number" id="sel-h" min="1" max="44" step="0.5"></div>
          </div>
          <div class="row" id="g-pos">
            <div class="field"><label for="sel-x">Across (ft)</label><input type="number" id="sel-x" step="0.25"></div>
            <div class="field"><label for="sel-y">Along (ft)</label><input type="number" id="sel-y" step="0.25"></div>
          </div>
          <div class="row" id="g-pos2">
            <div class="field"><label for="sel-x1">Start across</label><input type="number" id="sel-x1" step="0.25"></div>
            <div class="field"><label for="sel-y1">Start along</label><input type="number" id="sel-y1" step="0.25"></div>
            <div class="field"><label for="sel-x2">End across</label><input type="number" id="sel-x2" step="0.25"></div>
            <div class="field"><label for="sel-y2">End along</label><input type="number" id="sel-y2" step="0.25"></div>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-shots">
        <h3 id="h-shots">Shot numbers</h3>
        <p class="small" id="shots-note"></p>
        <button type="button" class="btn sm" id="renumber" style="margin-top:8px">Renumber shots</button>
      </section>
      <p class="small">Shortcuts: Delete removes the selected piece. Ctrl or Cmd + Z undoes, with Shift to redo. Ctrl or Cmd + S saves. Arrow keys nudge a selected piece half a foot. With an arrow tool chosen, Enter on the court adds an arrow you can then adjust.</p>
    </div>

    <div class="sheet" id="sheet-svg" hidden role="region" aria-labelledby="sheet-svg-h">
      <div class="sheet-head"><h3 id="sheet-svg-h">Get SVG</h3><button type="button" class="btn sm" id="sheet-svg-back">Back to drawing</button></div>
      <div class="sheet-grid">
        <div class="col">
          <div class="field"><label for="out-svg">SVG (court and pieces only, source embedded)</label><textarea class="ta" id="out-svg" readonly spellcheck="false"></textarea></div>
          <div class="row"><button type="button" class="btn primary" id="copy-svg">Copy SVG</button><span class="status" id="copy-svg-s" role="status"></span></div>
          <div class="field"><label for="out-json">Source (JSON), to reopen or edit later</label><textarea class="ta" id="out-json" readonly spellcheck="false" style="min-height:130px"></textarea></div>
          <div class="row"><button type="button" class="btn" id="copy-json">Copy source (JSON)</button><span class="status" id="copy-json-s" role="status"></span></div>
        </div>
        <div>
          <div class="preview" id="preview" role="img" aria-label="Preview of the exported SVG"></div>
          <p class="small" id="preview-note"></p>
        </div>
      </div>
    </div>

    <div class="sheet" id="sheet-open" hidden role="region" aria-labelledby="sheet-open-h">
      <div class="sheet-head"><h3 id="sheet-open-h">Open from source</h3><button type="button" class="btn sm" id="sheet-open-back">Back to drawing</button></div>
      <p class="small">Paste an SVG exported from here, or the JSON source. It replaces what is on the court (you can undo it).</p>
      <div class="field"><label for="open-input">SVG or JSON</label><textarea class="ta" id="open-input" spellcheck="false" style="min-height:260px"></textarea></div>
      <div class="row"><button type="button" class="btn primary" id="open-go">Open diagram</button><span class="status" id="open-s" role="status"></span></div>
    </div>
  </div>

  <div class="foot" part="footer">
    <button type="button" class="btn" id="open-svg">Get SVG</button>
    <button type="button" class="btn" id="open-src">Open from source</button>
    <span class="sp"></span>
    <button type="button" class="btn primary" id="save" part="save">Save</button>
  </div>
</div>
<div class="ghost" id="ghost" hidden></div>
`;
