import { expect, mock, test } from 'claude-code/testing'

const CORNER = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 },
} as const

const start = async ($: any, on: any) => {
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('prompt.edit', (_$: unknown, e: { text: string; inputText: string }) => ({
    text: e.text + e.inputText,
    cursor: e.text.length + e.inputText.length,
  }))
  on('session.start', (_$: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

const texts = async (ui: { find: (q: { type: 'Text'; text: RegExp }) => Promise<unknown> }, text: RegExp) =>
  ui.find({ type: 'Text', text })

test('Clawd is awake with the laptop behind its back, then sleeps with Zzz when idle', async ($, on) => {
  const clock = mock.clock(on)
  await start($, on)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface, ...CORNER } as never)
    expect(await texts(ui as never, /hi!/)).toBeDefined()
    expect(await texts(ui as never, / █▀█▀█▀█ /)).toBeDefined()
    expect(await texts(ui as never, /▐/)).toBeDefined()
    expect(await texts(ui as never, /▀▀▀▀/)).toBeUndefined()
    await ui.unmount()
  }

  await clock.advance(61_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface, ...CORNER } as never)
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

  const ui = await $.ui.mount({ plugin: 'clawd-pet', surface: 'terminal', ...CORNER } as never)
  expect(await texts(ui as never, /Zzz/)).toBeUndefined()
  expect(await texts(ui as never, /hi!/)).toBeDefined()
  await ui.unmount()
})

test('when work starts Clawd pulls the laptop out from behind its back and types', async ($, on) => {
  const clock = mock.clock(on)
  await start($, on)
  await ($.turn as any).start({ text: 'hello' })

  const look = async (pattern: RegExp) => {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface: 'terminal', ...CORNER } as never)
    const found = await texts(ui as never, pattern)
    await ui.unmount()
    return found
  }

  await clock.advance(500)
  expect(await look(/hmm…/)).toBeDefined()
  expect(await look(/█/)).toBeDefined()

  await clock.advance(500)
  expect(await look(/got it!/)).toBeDefined()
  expect(await look(/▄▄▄▄/)).toBeDefined()

  await clock.advance(1_000)
  expect(await look(/tap/)).toBeDefined()
  expect(await look(/▀▀▀▀/)).toBeDefined()
  expect(await look(/>/)).toBeDefined()
  expect(await look(/✻/)).toBeDefined()

  // Fast typing: the bubble alternates and the sparks keep moving.
  const seen = new Set<string>()
  for (let i = 0; i < 4; i++) {
    await clock.advance(250)
    if (await look(/tap tap!/)) seen.add('tap tap!')
    else if (await look(/tap!/)) seen.add('tap!')
  }
  expect([...seen].sort()).toEqual(['tap tap!', 'tap!'])

  await ($.turn as any).complete({}).catch(() => undefined)
  await clock.advance(500)
  expect(await look(/done!/)).toBeDefined()

  await clock.advance(2_000)
  expect(await look(/hi!/)).toBeDefined()
  expect(await look(/▀▀▀▀/)).toBeUndefined()
  expect(await look(/▄▄▄▄/)).toBeUndefined()
})

test('fits in two rows when the band has no third', async ($, on) => {
  mock.clock(on)
  await start($, on)

  const ui = await $.ui.mount({
    plugin: 'clawd-pet',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { ...CORNER.props, maxRows: 2 },
  } as never)
  expect(await texts(ui as never, /hi!/)).toBeDefined()
  expect(await texts(ui as never, / █▀█▀█▀█ /)).toBeDefined()
  await ui.unmount()
})

test('gives the band back to a survey', async ($, on) => {
  mock.clock(on)
  await start($, on)

  // The pet passes, so the drawing falls to what is beneath it: in a test,
  // nothing, which the mount reports instead of drawing Clawd.
  const error = await $.ui
    .mount({
      plugin: 'clawd-pet',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { ...CORNER.props, hasSurvey: true },
    } as never)
    .then(() => undefined, (err: Error) => err)
  expect(String(error)).toContain('no implementation for ui.render')
})
