import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80 },
} as const

const start = async ($: any, on: any) => {
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('prompt.edit', (_$: unknown, e: { text: string; inputText: string }) => ({
    text: e.text + e.inputText,
    cursor: e.text.length + e.inputText.length,
  }))
  on('session.start', (_$: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

const texts = async (ui: { find: (q: { type: 'Text'; text: RegExp }) => Promise<unknown> }, text: RegExp) =>
  ui.find({ type: 'Text', text })

test('Clawd is awake with its laptop, then sleeps with Zzz when idle', async ($, on) => {
  const clock = mock.clock(on)
  await start($, on)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface, ...BAND } as never)
    expect(await texts(ui as never, /ready when you are/)).toBeDefined()
    expect(await texts(ui as never, /╭───────╮/)).toBeDefined()
    expect(await texts(ui as never, / █ █   █ █ /)).toBeDefined()
    await ui.unmount()
  }

  await clock.advance(61_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface, ...BAND } as never)
    expect(await texts(ui as never, /Zzz/)).toBeDefined()
    await ui.unmount()
  }
})

test('typing in the prompt wakes Clawd up', async ($, on) => {
  const clock = mock.clock(on)
  await start($, on)
  await clock.advance(61_000)

  await ($.prompt as any).edit({ origin: 'composer', text: '', cursor: 0, start: 0, end: 0, inputText: 'h' } as never)
  await clock.advance(1_000)

  const ui = await $.ui.mount({ plugin: 'clawd-pet', surface: 'terminal', ...BAND } as never)
  expect(await texts(ui as never, /Zzz/)).toBeUndefined()
  expect(await texts(ui as never, /ready when you are/)).toBeDefined()
  await ui.unmount()
})

test('Clawd types on its laptop while Claude is working', async ($, on) => {
  mock.clock(on)
  await start($, on)

  const ui = await $.ui.mount({
    plugin: 'clawd-pet',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { ...BAND.props, isWorking: true },
  } as never)
  expect(await texts(ui as never, /tap tap/)).toBeDefined()
  await ui.unmount()
})
