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
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.PostToolUse', () => ({}))
  on('classic.PostToolUseFailure', () => ({}))
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
    expect(await texts(ui as never, /█▀█▀█▀█/)).toBeDefined()
    expect(await texts(ui as never, /▐/)).toBeDefined()
    expect(await texts(ui as never, /╲/)).toBeUndefined()
    await ui.unmount()
  }

  await clock.advance(61_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface, ...CORNER } as never)
    expect(await texts(ui as never, /Zzz/)).toBeDefined()
    await ui.unmount()
  }
})

test('asleep, Clawd lies still while Zs float up out of its head', async ($, on) => {
  const clock = mock.clock(on)
  await start($, on)
  await clock.advance(61_000)

  const bodies = new Set<string>()
  const zFrames = new Set<string>()
  for (let i = 0; i < 16; i++) {
    await clock.advance(250)
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface: 'terminal', ...CORNER } as never)
    const head = (await ui.find({ type: 'Text', text: /▄▄▄▄▄▄▄/ } as never)) as { text?: string } | undefined
    const legs = (await ui.find({ type: 'Text', text: /█▀█▀█▀█/ } as never)) as { text?: string } | undefined
    const z = (await ui.find({ type: 'Text', text: /^[·zZ]$/ } as never)) as { text?: string } | undefined
    bodies.add(`${head?.text}|${legs?.text}`)
    expect(z).toBeDefined()
    zFrames.add(String(z?.text))
    await ui.unmount()
  }
  // One body shape the whole time; the Zs change.
  expect(bodies.size).toBe(1)
  expect(zFrames.size).toBeGreaterThan(1)
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

test('when work starts Clawd turns sideways, pulls out the laptop and types', async ($, on) => {
  const clock = mock.clock(on)
  await start($, on)
  await ($.turn as any).start({ text: 'hello' })

  const look = async (pattern: RegExp) => {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface: 'terminal', ...CORNER } as never)
    const found = await texts(ui as never, pattern)
    await ui.unmount()
    return found
  }

  // Facing you, the body has a full row of eyes and arms; in profile the
  // eyes sit toward the front and the back arm is gone.
  const facing = /^███$/
  const sideways = /^██ $/

  await clock.advance(500)
  expect(await look(/hmm…/)).toBeDefined()
  expect(await look(sideways)).toBeDefined()
  expect(await look(facing)).toBeUndefined()

  await clock.advance(500)
  expect(await look(/got it!/)).toBeDefined()
  expect(await look(/^▄▄▄$/)).toBeDefined()

  await clock.advance(500)
  expect(await look(/^▀▀▀$/)).toBeDefined()

  await clock.advance(500)
  expect(await look(/╲/)).toBeDefined()
  expect(await look(/^▀▀▀$/)).toBeDefined()
  expect(await look(/✻/)).toBeDefined()

  // Typing shows no words: the front arm goes down onto the keys and back
  // up, and the sparks keep popping.
  const armDown = /^▀█▀█▀█▀█ $/
  const beats = new Set<boolean>()
  for (let i = 0; i < 4; i++) {
    await clock.advance(250)
    expect(await look(/tap/)).toBeUndefined()
    expect(await look(/✻/)).toBeDefined()
    expect(await look(sideways)).toBeDefined()
    beats.add(Boolean(await look(armDown)))
  }
  expect([...beats].sort()).toEqual([false, true])

  await ($.turn as any).complete({}).catch(() => undefined)
  await clock.advance(500)
  expect(await look(/done!/)).toBeDefined()

  await clock.advance(2_000)
  expect(await look(/hi!/)).toBeDefined()
  expect(await look(facing)).toBeDefined()
  expect(await look(/╲/)).toBeUndefined()
  expect(await look(/^▀▀▀$/)).toBeUndefined()
  expect(await look(/^▄▄▄$/)).toBeUndefined()
})

test('in plan mode Clawd wears a hard hat and marches instead of opening the laptop', async ($, on) => {
  const clock = mock.clock(on)
  await start($, on)
  await ($.classic as any).UserPromptSubmit({ prompt: 'plan the refactor', permission_mode: 'plan' })
  await ($.turn as any).start({ text: 'plan the refactor' })

  const look = async (pattern: RegExp) => {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface: 'terminal', ...CORNER } as never)
    const found = await texts(ui as never, pattern)
    await ui.unmount()
    return found
  }

  await clock.advance(3_000)
  expect(await look(/planning/)).toBeDefined()
  expect(await look(/^▀▀▀▀▀▀▀$/)).toBeDefined() // the brim
  expect(await look(/╲/)).toBeUndefined() // no laptop out

  // Marching: the legs change stance.
  const stances = new Set<boolean>()
  for (let i = 0; i < 4; i++) {
    await clock.advance(250)
    stances.add(Boolean(await look(/^ ▀█▀█▀█▀ $/)))
  }
  expect([...stances].sort()).toEqual([false, true])

  // Out of plan mode the hat comes off and the laptop comes out again.
  await ($.classic as any).UserPromptSubmit({ prompt: 'go', permission_mode: 'default' })
  await clock.advance(3_000)
  expect(await look(/^▀▀▀▀▀▀▀$/)).toBeUndefined()
  expect(await look(/╲/)).toBeDefined()
})

test('a failing command knocks Clawd out for a few seconds', async ($, on) => {
  const clock = mock.clock(on)
  await start($, on)

  const look = async (pattern: RegExp) => {
    const ui = await $.ui.mount({ plugin: 'clawd-pet', surface: 'terminal', ...CORNER } as never)
    const found = await texts(ui as never, pattern)
    await ui.unmount()
    return found
  }

  await ($.classic as any).PostToolUseFailure({
    tool_name: 'Bash',
    tool_input: { command: 'npm test' },
    tool_use_id: 'toolu_1',
    error: 'Exit code 1',
  })
  expect(await look(/oops!/)).toBeDefined()
  expect(await look(/×/)).toBeDefined()

  await clock.advance(3_500)
  expect(await look(/oops!/)).toBeUndefined()
  expect(await look(/hi!/)).toBeDefined()

  // A failed edit is no code error, and an interrupt is not either.
  await ($.classic as any).PostToolUseFailure({ tool_name: 'Edit', tool_input: {}, tool_use_id: 'toolu_2', error: 'no match' })
  await ($.classic as any).PostToolUseFailure({
    tool_name: 'Bash',
    tool_input: {},
    tool_use_id: 'toolu_3',
    error: 'interrupted',
    is_interrupt: true,
  })
  expect(await look(/oops!/)).toBeUndefined()
})

test('fits in three rows when the band has no fourth', async ($, on) => {
  mock.clock(on)
  await start($, on)

  const ui = await $.ui.mount({
    plugin: 'clawd-pet',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { ...CORNER.props, maxRows: 3 },
  } as never)
  expect(await texts(ui as never, /hi!/)).toBeDefined()
  expect(await texts(ui as never, /█▀█▀█▀█/)).toBeDefined()
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
