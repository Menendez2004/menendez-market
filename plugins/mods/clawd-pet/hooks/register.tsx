import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PetMood } from '../types'

const mood = atom({ plugin: 'clawd-pet', key: 'mood' } as const, 'awake')
const frame = atom({ plugin: 'clawd-pet', key: 'frame' } as const, 0)
const isHidden = atom({ plugin: 'clawd-pet', key: 'isHidden' } as const, false)

const TICK_MS = 1000
const MIN_ART_COLUMNS = 28

// Clawd, sitting behind its laptop. Row 0 is the head and eyes, row 1 the
// body and arms; the laptop lid (with the Claude mark) and its base follow.
const EYES: Record<PetMood | 'blink', string> = {
  awake: '  ▐▛███▜▌  ',
  blink: '  ▐▀███▀▌  ',
  working: '  ▐▛███▜▌  ',
  sleeping: '  ▐▀███▀▌  ',
}
const ARMS_UP = ' ▝▜█████▛▘ '
const ARMS_DOWN = ' ▗▜█████▛▖ '
const LAPTOP = ['╭─────────╮', '│    ✻    │', '╰─────────╯', '▀▀▀▀▀▀▀▀▀▀▀']

// The "Zzz" that floats up while Clawd sleeps, one step per tick.
const ZZZ = [
  ['', '', ' z'],
  ['', '   z', ' z'],
  ['      Z', '   z', ' z'],
  ['      Z', '   z', ''],
]

// Writes the mood only when it changed, so an idle tick redraws nothing new.
async function setMood($: EngineInterface, next: PetMood) {
  if ((await read($, mood)) !== next) {
    await update($, mood, () => next)
  }
}

export const register: Register = (on, options) => {
  const idleMs = Math.max(5, Number(options.idleSeconds ?? 60)) * 1000
  let lastActivityAt = 0
  let isTurnRunning = false

  on('session.start', async ($, e, next) => {
    lastActivityAt = await $.clock.now()
    await update($, mood, () => 'awake')

    $.clock.every(TICK_MS, async () => {
      const now = await $.clock.now()
      const current: PetMood = isTurnRunning
        ? 'working'
        : now - lastActivityAt >= idleMs
          ? 'sleeping'
          : 'awake'
      await setMood($, current)
      await update($, frame, n => ((n ?? 0) + 1) % 1000)
    })

    // The pet keeps living even if the command cannot be registered.
    try {
      await $.command.register({
        name: 'pet',
        description: 'Show or hide Clawd, the Claude pet above the prompt.',
      })
    } catch {}

    return next(e)
  })

  on('command.run', { command: 'pet' }, async $ => {
    const hidden = await update($, isHidden, h => !h)
    return { text: hidden ? 'Clawd went home. Run /pet to bring it back.' : 'Clawd is back!' }
  })

  // Anything the person does in the prompt box wakes Clawd up.
  on('prompt.edit', async ($, e, next) => {
    lastActivityAt = await $.clock.now()
    await setMood($, isTurnRunning ? 'working' : 'awake')
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    isTurnRunning = true
    lastActivityAt = await $.clock.now()
    await setMood($, isTurnRunning ? 'working' : 'awake')
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    lastActivityAt = await $.clock.now()
    await setMood($, isTurnRunning ? 'working' : 'awake')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    isTurnRunning = false
    lastActivityAt = await $.clock.now()
    await setMood($, isTurnRunning ? 'working' : 'awake')
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const stored = await read($, mood)
    const current: PetMood = e.props.isWorking ? 'working' : stored
    const tick = await read($, frame)
    const { Box, Text } = $.ui.resolve(e)

    if (e.props.bodyColumns < MIN_ART_COLUMNS || e.props.maxRows < LAPTOP.length + 2) {
      const line =
        current === 'sleeping' ? '▐▀███▀▌ Zzz…' : current === 'working' ? '▐▛███▜▌ typing…' : '▐▛███▜▌ hi!'
      return (
        <Box>
          <Text color="claude">{line}</Text>
        </Box>
      )
    }

    const eyes = current === 'awake' && tick % 7 === 6 ? EYES.blink : EYES[current]
    const arms = current === 'working' && tick % 2 === 1 ? ARMS_DOWN : ARMS_UP
    const dots = '.'.repeat((tick % 3) + 1)
    const bubble =
      current === 'sleeping'
        ? [...(ZZZ[tick % ZZZ.length] ?? []), '', 'Zzz… (type to wake me)', '']
        : current === 'working'
          ? ['', `tap tap${dots}`, '', '', 'working with Claude', '']
          : ['', 'hi! ✻', '', '', 'ready when you are', '']

    return (
      <Box flexDirection="row">
        <Box flexDirection="column">
          <Text color="claude">{eyes}</Text>
          <Text color="claude">{arms}</Text>
          {LAPTOP.map((row, i) => (
            <Text key={`laptop-${i}`} color={current === 'sleeping' ? 'inactive' : 'subtle'}>
              {i === 1 && current !== 'sleeping' ? (
                <Text>
                  │    <Text color="claude">✻</Text>    │
                </Text>
              ) : (
                row
              )}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column" marginLeft={1}>
          {bubble.map((row, i) => (
            <Text key={`bubble-${i}`} color={current === 'sleeping' ? 'claude' : undefined} dimColor={i >= 4}>
              {row || ' '}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
