import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PetMood } from '../types'

const mood = atom({ plugin: 'clawd-pet', key: 'mood' } as const, 'awake')
const frame = atom({ plugin: 'clawd-pet', key: 'frame' } as const, 0)
const isHidden = atom({ plugin: 'clawd-pet', key: 'isHidden' } as const, false)

const TICK_MS = 1000
const MIN_ART_COLUMNS = 52
const ART_ROWS = 4

const ORANGE = 'claude'
const EYE_BLACK = '#000000'

// One run of characters in a single style.
type Seg = { text: string; color?: string; backgroundColor?: string }

// Clawd as an 11×8 pixel sprite, two pixel rows per terminal row (half
// blocks), so each pixel is about square:
//
//   . # # # # # # # # # .     row 0  head
//   . # # # # # # # # # .     row 1
//   # # E # # # # # E # #     row 2  arms and eyes
//   # # # # # # # # # # #     row 3  arms
//   . # # # # # # # # # .     row 4  body
//   . # # # # # # # # # .     row 5
//   . # . # . . . # . # .     row 6  legs
//   . # . # . . . # . # .     row 7
//
// An eye is the top half of its cell painted black: `▄` on a black
// background when open, `▆` (a thin slit) when blinking or asleep. While
// Claude works the arms drop half a cell every other tick, as if typing.
function petRows(isEyesClosed: boolean, isArmsDown: boolean): Seg[][] {
  const eye: Seg = { text: isEyesClosed ? '▆' : '▄', color: ORANGE, backgroundColor: EYE_BLACK }
  const armTop = isArmsDown ? '▄' : '█'
  const armBottom = isArmsDown ? '▀' : ' '

  return [
    [{ text: ' █████████ ', color: ORANGE }],
    [{ text: `${armTop}█`, color: ORANGE }, eye, { text: '█████', color: ORANGE }, eye, { text: `█${armTop}`, color: ORANGE }],
    [{ text: `${armBottom}█████████${armBottom}`, color: ORANGE }],
    [{ text: ' █ █   █ █ ', color: ORANGE }],
  ]
}

// Clawd's laptop, open in front of it: the screen shows the Claude mark,
// a prompt that blinks while Claude works, and goes dark while it sleeps.
function laptopRows(current: PetMood, tick: number): Seg[][] {
  const frame = current === 'sleeping' ? 'inactive' : 'subtle'
  const screen: Seg[] =
    current === 'sleeping'
      ? [{ text: '       ', color: frame }]
      : current === 'working'
        ? [{ text: ' ' }, { text: '✻', color: ORANGE }, { text: tick % 2 === 0 ? ' >_  ' : ' >   ' }]
        : [{ text: '   ' }, { text: '✻', color: ORANGE }, { text: '   ' }]

  return [
    [{ text: ' ╭───────╮ ', color: frame }],
    [{ text: ' │', color: frame }, ...screen, { text: '│ ', color: frame }],
    [{ text: ' ╰───────╯ ', color: frame }],
    [{ text: '▀▀▀▀▀▀▀▀▀▀▀', color: frame }],
  ]
}

// The "Zzz" that floats up while Clawd sleeps, one step per tick.
const ZZZ = [
  ['', '', 'z'],
  ['', '  z', 'z'],
  ['    Z', '  z', 'z'],
  ['    Z', '  z', ''],
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

    if (e.props.bodyColumns < MIN_ART_COLUMNS || e.props.maxRows < ART_ROWS) {
      const line = current === 'sleeping' ? 'Clawd: Zzz…' : current === 'working' ? 'Clawd: tap tap…' : 'Clawd: hi! ✻'
      return (
        <Box>
          <Text color={ORANGE}>{line}</Text>
        </Box>
      )
    }

    const isEyesClosed = current === 'sleeping' || (current === 'awake' && tick % 7 === 6)
    const isArmsDown = current === 'working' && tick % 2 === 1
    const dots = '.'.repeat((tick % 3) + 1)
    const bubble =
      current === 'sleeping'
        ? [...(ZZZ[tick % ZZZ.length] ?? []), 'Zzz… (type to wake me)']
        : current === 'working'
          ? ['', `tap tap${dots}`, '', 'working with Claude']
          : ['', 'hi! ✻', '', 'ready when you are']

    const drawRow = (segs: Seg[], key: string) => (
      <Text key={key}>
        {segs.map((seg, i) => (
          <Text key={`${key}-${i}`} color={seg.color} backgroundColor={seg.backgroundColor}>
            {seg.text}
          </Text>
        ))}
      </Text>
    )

    return (
      <Box flexDirection="row">
        <Box flexDirection="column">{petRows(isEyesClosed, isArmsDown).map((r, i) => drawRow(r, `pet-${i}`))}</Box>
        <Box flexDirection="column" marginLeft={1}>
          {laptopRows(current, tick).map((r, i) => drawRow(r, `laptop-${i}`))}
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          {bubble.map((row, i) => (
            <Text key={`bubble-${i}`} color={current === 'sleeping' ? ORANGE : undefined} dimColor={i === ART_ROWS - 1}>
              {row || ' '}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
