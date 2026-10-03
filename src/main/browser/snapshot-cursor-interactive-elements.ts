import { isJsonObject } from '../../shared/json-object'
import type { SnapshotEntry } from './snapshot-ax-tree-walk'
import type { CdpCommandSender } from './snapshot-engine'

// Why: finds DOM elements that are visually interactive (cursor:pointer, onclick,
// tabindex, contenteditable) but lack standard ARIA roles. These are common in
// modern SPAs where styled <div>s act as buttons. Returns them as a JS array of
// remote object references that we can resolve to backendNodeIds via CDP.
export async function findCursorInteractiveElements(
  sendCommand: CdpCommandSender,
  existingEntries: SnapshotEntry[]
): Promise<SnapshotEntry[]> {
  const existingNodeIds = new Set(existingEntries.map((e) => e.backendDOMNodeId))
  const results: SnapshotEntry[] = []

  try {
    // Single evaluate call that finds interactive elements and returns their info
    // along with a way to reference them by index
    const response = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const SKIP_ROLES = new Set(['button','link','textbox','checkbox','radio','tab',
          'menuitem','option','switch','slider','combobox','searchbox','spinbutton','treeitem',
          'menuitemcheckbox','menuitemradio']);
        const SKIP_TAGS = new Set(['input','button','select','textarea','a']);
        const seen = new Set();
        const found = [];
        const matchedElements = [];

        function check(el) {
          if (seen.has(el)) return;
          seen.add(el);
          const tag = el.tagName.toLowerCase();
          if (SKIP_TAGS.has(tag)) return;
          const role = el.getAttribute('role');
          if (role && SKIP_ROLES.has(role)) return;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const text = (el.ariaLabel || el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80);
          if (!text) return;
          found.push({ text, tag });
          matchedElements.push(el);
          if (found.length >= 50) return;
        }

        document.querySelectorAll('[onclick], [tabindex]:not([tabindex="-1"]), [contenteditable="true"]').forEach(el => {
          if (found.length < 50) check(el);
        });
        document.querySelectorAll('div, span, li, td, img, svg, label').forEach(el => {
          if (found.length >= 50) return;
          try {
            if (window.getComputedStyle(el).cursor === 'pointer') check(el);
          } catch {}
        });

        window.__alfredCursorInteractive = matchedElements;
        return JSON.stringify(found);
      })()`,
      returnByValue: true
    })
    if (
      !isJsonObject(response) ||
      !isJsonObject(response.result) ||
      typeof response.result.value !== 'string'
    ) {
      return results
    }

    const elements: unknown = JSON.parse(response.result.value)
    if (!Array.isArray(elements)) {
      return results
    }

    for (let i = 0; i < elements.length; i++) {
      try {
        const objectResponse = await sendCommand('Runtime.evaluate', {
          expression: `window.__alfredCursorInteractive[${i}]`
        })

        if (
          !isJsonObject(objectResponse) ||
          !isJsonObject(objectResponse.result) ||
          typeof objectResponse.result.objectId !== 'string'
        ) {
          continue
        }

        const nodeResponse = await sendCommand('DOM.describeNode', {
          objectId: objectResponse.result.objectId
        })
        if (
          !isJsonObject(nodeResponse) ||
          !isJsonObject(nodeResponse.node) ||
          typeof nodeResponse.node.backendNodeId !== 'number'
        ) {
          continue
        }
        const backendNodeId = nodeResponse.node.backendNodeId
        const element: unknown = elements[i]
        if (!isJsonObject(element) || typeof element.text !== 'string') {
          continue
        }

        if (existingNodeIds.has(backendNodeId)) {
          continue
        }

        results.push({
          ref: '',
          role: 'clickable',
          name: element.text,
          backendDOMNodeId: backendNodeId,
          depth: 0
        })
      } catch {
        continue
      }
    }

    // Clean up
    await sendCommand('Runtime.evaluate', {
      expression: 'delete window.__alfredCursorInteractive',
      returnByValue: true
    })
  } catch {
    // DOM query failed — not critical, just return empty
  }

  return results
}
