import { expect, it, vi } from 'vitest'
import { findCursorInteractiveElements } from './snapshot-cursor-interactive-elements'
import type { CdpCommandSender } from './snapshot-engine'

it.each([null, {}, { result: { value: 'invalid json' } }, { result: { value: '{}' } }])(
  'ignores an invalid cursor probe response: %j',
  async (response) => {
    const send = vi.fn<CdpCommandSender>().mockResolvedValue(response)
    await expect(findCursorInteractiveElements(send, [])).resolves.toEqual([])
    expect(send).toHaveBeenCalledTimes(1)
  }
)

it('skips malformed node responses while retaining later valid elements and cleaning up', async () => {
  const send = vi
    .fn<CdpCommandSender>()
    .mockResolvedValueOnce({
      result: { value: JSON.stringify([{ text: 'Invalid' }, { text: 'Valid' }]) }
    })
    .mockResolvedValueOnce({ result: { objectId: 'first' } })
    .mockResolvedValueOnce({ node: { backendNodeId: 'wrong-type' } })
    .mockResolvedValueOnce({ result: { objectId: 'second' } })
    .mockResolvedValueOnce({ node: { backendNodeId: 42 } })
    .mockResolvedValueOnce({})
  await expect(findCursorInteractiveElements(send, [])).resolves.toEqual([
    { ref: '', role: 'clickable', name: 'Valid', backendDOMNodeId: 42, depth: 0 }
  ])
  expect(send).toHaveBeenLastCalledWith('Runtime.evaluate', {
    expression: 'delete window.__alfredCursorInteractive',
    returnByValue: true
  })
})
