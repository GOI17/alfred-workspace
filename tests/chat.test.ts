import { afterEach, expect, it } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import { WorkspaceService } from '../src/server/service.js'
import { join } from 'node:path'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { providerError } from '../src/server/provider-error.js'
import { gitFixture } from './fixtures.js'

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}
const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})
async function setup(model: MockLanguageModelV4) {
  const files = await gitFixture()
  cleanup.push(() => rm(files.root, { recursive: true, force: true }))
  const service = await WorkspaceService.open(join(files.root, 'data'), model)
  cleanup.push(() => service.close())
  const project = await service.addProject(files.repository)
  const conversation = await service.addConversation(project.id, files.repository)
  return { ...files, service, conversation }
}
it('streams native model text, persists it, and owns the agent state on the server', async () => {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-start', id: 'reply' })
          controller.enqueue({ type: 'text-delta', id: 'reply', delta: 'Una idea propia.' })
          controller.enqueue({ type: 'text-end', id: 'reply' })
          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage,
          })
          controller.close()
        },
      }),
    }),
  })
  const { service, conversation, root } = await setup(model)
  await service.chat.start(conversation.id, 'Hola Alfred', 'openai')
  await expect.poll(() => service.state().agents[conversation.id]?.status).toBe('idle')
  expect(service.state().conversations[0].messages.map((message) => message.text)).toEqual([
    'Hola Alfred',
    'Una idea propia.',
  ])
  expect(await readFile(join(root, 'data', 'workspace.json'), 'utf8')).toContain('Una idea propia.')
  expect(model.doStreamCalls[0].prompt.at(-1)?.role).toBe('user')
  const measured = service.state().conversations[0].messages.at(-1)?.contextUsage
  expect(measured).toMatchObject({ provider: 'openai', inputTokens: 1, outputTokens: 1 })
  const savedUsage = JSON.parse(await readFile(join(root, 'data', 'workspace.json'), 'utf8')).conversations[0].messages.at(-1).contextUsage
  expect(savedUsage).toEqual(measured)
})
it('does not write until approval and handles multiple requested writes one at a time', async () => {
  let step = 0
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          if (step++ === 0) {
            for (const path of ['one.txt', 'two.txt'])
              controller.enqueue({
                type: 'tool-call',
                toolCallId: path,
                toolName: 'write_file',
                input: JSON.stringify({ path, content: `Content for ${path}` }),
              })
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
              usage,
            })
          } else {
            controller.enqueue({ type: 'text-start', id: 'done' })
            controller.enqueue({ type: 'text-delta', id: 'done', delta: 'Cambios revisados.' })
            controller.enqueue({ type: 'text-end', id: 'done' })
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage,
            })
          }
          controller.close()
        },
      }),
    }),
  })
  const { service, conversation, repository } = await setup(model)
  await service.chat.start(conversation.id, 'Propón dos archivos', 'openai')
  await expect.poll(() => service.state().agents[conversation.id]?.status).toBe('waiting')
  await expect(readFile(join(repository, 'one.txt'))).rejects.toThrow()
  await expect(readFile(join(repository, 'two.txt'))).rejects.toThrow()
  const first = service.state().agents[conversation.id].approval
  if (!first) throw new Error('Missing first approval')
  service.chat.decide(conversation.id, first.id, true)
  await expect.poll(() => service.state().agents[conversation.id]?.approval?.id).not.toBe(first.id)
  const second = service.state().agents[conversation.id].approval
  if (!second) throw new Error('Missing second approval')
  service.chat.decide(conversation.id, second.id, false)
  await expect.poll(() => service.state().agents[conversation.id]?.status).toBe('idle')
  expect(await readFile(join(repository, first.path), 'utf8')).toBe(`Content for ${first.path}`)
  await expect(readFile(join(repository, second.path))).rejects.toThrow()
})
it('queues concurrent turns and stopping cancels approval while persisting the paused queue', async () => {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: 'tool-call',
            toolCallId: 'change',
            toolName: 'write_file',
            input: JSON.stringify({ path: 'hello.txt', content: 'overwrite' }),
          })
          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
            usage,
          })
          controller.close()
        },
      }),
    }),
  })
  const { service, conversation, repository, root } = await setup(model)
  await service.chat.start(conversation.id, 'Cambia el archivo', 'openai')
  await expect.poll(() => service.state().agents[conversation.id]?.status).toBe('waiting')
  await service.chat.start(conversation.id, 'Otro turno', 'openai')
  expect(service.conversation(conversation.id).queue?.map((item) => item.text)).toEqual(['Otro turno'])
  await service.chat.stop(conversation.id)
  expect(service.state().agents[conversation.id]?.status).toBe('idle')
  expect(service.conversation(conversation.id).queuePaused).toBe(true)
  expect(await readFile(join(repository, 'hello.txt'), 'utf8')).toBe('hello\n')
  const saved = JSON.parse(await readFile(join(root, 'data', 'workspace.json'), 'utf8'))
  expect(saved.conversations[0].queue[0].text).toBe('Otro turno')
  expect(saved.conversations[0].queuePaused).toBe(true)
  await service.chat.resume(conversation.id)
  await expect.poll(() => service.state().agents[conversation.id]?.status).toBe('waiting')
  expect(service.conversation(conversation.id).queue).toEqual([])
  expect(service.conversation(conversation.id).messages.filter((item) => item.role === 'user').map((item) => item.text))
    .toEqual(['Cambia el archivo', 'Otro turno'])
  await service.chat.stop(conversation.id)
})

it('interrupts pending approval, prioritizes the new turn and drains remaining messages in order', async () => {
  let step = 0
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          if (step++ === 0) {
            controller.enqueue({ type: 'tool-call', toolCallId: 'change', toolName: 'write_file',
              input: JSON.stringify({ path: 'hello.txt', content: 'not approved' }) })
            controller.enqueue({ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage })
          } else {
            controller.enqueue({ type: 'text-start', id: 'reply' })
            controller.enqueue({ type: 'text-delta', id: 'reply', delta: 'Respuesta.' })
            controller.enqueue({ type: 'text-end', id: 'reply' })
            controller.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage })
          }
          controller.close()
        },
      }),
    }),
  })
  const { service, conversation, repository } = await setup(model)
  await service.chat.start(conversation.id, 'Inicial', 'openai')
  await expect.poll(() => service.state().agents[conversation.id]?.status).toBe('waiting')
  const approval = service.state().agents[conversation.id].approval!
  await service.chat.start(conversation.id, 'Pendiente uno', 'openai')
  await service.chat.start(conversation.id, 'Descartar', 'openai')
  const removed = service.conversation(conversation.id).queue!.find((item) => item.text === 'Descartar')!
  await service.chat.removeQueued(conversation.id, removed.id)
  await service.chat.start(conversation.id, 'Pendiente dos', 'openai')
  await service.chat.start(conversation.id, 'Prioritario', 'openai', [], 'interrupt')
  await expect.poll(() => service.conversation(conversation.id).messages.filter((item) => item.role === 'assistant').length).toBe(4)
  expect(service.conversation(conversation.id).messages.filter((item) => item.role === 'user').map((item) => item.text))
    .toEqual(['Inicial', 'Prioritario', 'Pendiente uno', 'Pendiente dos'])
  expect(service.conversation(conversation.id).queue).toEqual([])
  expect(() => service.chat.decide(conversation.id, approval.id, true)).toThrow('no longer pending')
  expect(await readFile(join(repository, 'hello.txt'), 'utf8')).toBe('hello\n')
})

it('preserves a file edited by the user while approval was pending', async () => {
  let step = 0
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          if (step++ === 0) {
            controller.enqueue({
              type: 'tool-call',
              toolCallId: 'change',
              toolName: 'write_file',
              input: JSON.stringify({ path: 'hello.txt', content: 'agent version' }),
            })
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
              usage,
            })
          } else
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage,
            })
          controller.close()
        },
      }),
    }),
  })
  const { service, conversation, repository } = await setup(model)
  await service.chat.start(conversation.id, 'Propón un cambio', 'openai')
  await expect.poll(() => service.state().agents[conversation.id]?.status).toBe('waiting')
  await writeFile(join(repository, 'hello.txt'), 'user version')
  const approval = service.state().agents[conversation.id].approval
  if (!approval) throw new Error('Missing approval')
  service.chat.decide(conversation.id, approval.id, true)
  await expect.poll(() => service.state().agents[conversation.id]?.status).toBe('idle')
  expect(await readFile(join(repository, 'hello.txt'), 'utf8')).toBe('user version')
})

it('does not forward provider error bodies or reflected credentials to the browser', () => {
  const error = Object.assign(new Error('Invalid key: test-private-api-secret'), {
    statusCode: 401,
  })
  expect(providerError(error)).not.toContain('test-private-api-secret')
  expect(providerError(error)).toContain('authorization')
})
