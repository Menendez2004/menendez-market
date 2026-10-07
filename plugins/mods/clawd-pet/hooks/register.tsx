import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PetMood } from '../types'

const mood = atom({ plugin: 'clawd-pet', key: 'mood' } as const, 'awake')
const frame = atom({ plugin: 'clawd-pet', key: 'frame' } as const, 0)
const isHidden = atom({ plugin: 'clawd-pet', key: 'isHidden' } as const, false)

const TICK_MS = 1000

// Fixed colors, so Clawd stays vivid whatever the terminal theme.
const ORANGE = '#E8713A'
const EYE_BLACK = '#000000'
const LAPTOP_GREY = '#A8A8A8'
const LAPTOP_DIM = '#5C5C5C'

// One run of characters in a single style.
type Seg = { text: string; color?: string; backgroundColor?: string; bold?: boolean }

// Clawd as a 9×4 pixel sprite, two pixel rows per terminal row (half
// blocks), so it fits in the two rows at the right of the prompt footer:
//
//   . # # # # # # # .     row 0  head
//   # # E # # # E # #     row 1  arms and eyes
//   . # # # # # # # .     row 2  body
//   . # . # . # . # .     row 3  legs
//
// An eye is the bottom half of its cell painted black (`▀`, orange on black)
// when open, and a thin black slit (`▂`, black on orange) when shut.
// While Claude works the arms drop half a cell every other tick, as if typing.
function petRows(isEyesClosed: boolean, isArmsDown: boolean): Seg[][] {
  const eye: Seg = isEyesClosed
    ? { text: '▂', color: EYE_BLACK, backgroundColor: ORANGE }
    : { text: '▀', color: ORANGE, backgroundColor: EYE_BLACK }
  const arm = isArmsDown ? '▁' : '▄'
  const body = (text: string): Seg => ({ text, color: ORANGE, bold: true })

  return [
    [body(`${arm}█`), eye, body('███'), eye, body(`█${arm}`)],
    [body(' █▀█▀█▀█ ')],
  ]
}

// Clawd's tiny laptop: the screen shows the Claude mark, a blinking prompt
// while Claude works, and goes dark while Clawd sleeps.
function laptopRows(current: PetMood, tick: number): Seg[][] {
  const frame = current === 'sleeping' ? LAPTOP_DIM : LAPTOP_GREY
  const screen: Seg =
    current === 'sleeping'
      ? { text: '  ', backgroundColor: '#1A1A1A' }
      : current === 'working'
        ? { text: tick % 2 === 0 ? '>_' : '> ', color: '#7CFC9A', backgroundColor: '#1A1A1A', bold: true }
        : { text: '✻ ', color: ORANGE, backgroundColor: '#1A1A1A', bold: true }

  return [
    [{ text: '▐', color: frame }, screen, { text: '▌', color: frame }],
    [{ text: '▀▀▀▀', color: frame }],
  ]
}

// The "Zzz" that floats up while Clawd sleeps, one step per tick.
const ZZZ = [
  ['    ', 'z   '],
  ['  z ', 'z   '],
  [' Z  ', 'z z '],
  ['Z   ', '  z '],
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
        description: 'Show or hide Clawd, the Claude pet in the corner under the prompt.',
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

  // Clawd sits in the bottom-right corner, at the right end of the footer
  // under the prompt, beside the mode labels the engine draws there.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (await read($, isHidden)) {
      return next(e)
    }

    const current = await read($, mood)
    const tick = await read($, frame)
    const { Box, Text } = $.ui.resolve(e)

    const isEyesClosed = current === 'sleeping' || (current === 'awake' && tick % 7 === 6)
    const isArmsDown = current === 'working' && tick % 2 === 1
    const bubble =
      current === 'sleeping'
        ? [...(ZZZ[tick % ZZZ.length] ?? []).slice(0, 1), 'Zzz…']
        : current === 'working'
          ? ['', `tap${'.'.repeat((tick % 3) + 1)}`]
          : ['', 'hi!']
    const pet = petRows(isEyesClosed, isArmsDown)
    const laptop = laptopRows(current, tick)

    const drawRow = (segs: Seg[], key: string) => (
      <Text key={key}>
        {segs.map((seg, i) => (
          <Text key={`${key}-${i}`} color={seg.color} backgroundColor={seg.backgroundColor} bold={seg.bold}>
            {seg.text}
          </Text>
        ))}
      </Text>
    )

    // Pinned to the right edge whichever way the footer lays out: beside the
    // hint line it grows into the free width and pushes right; stacked under
    // it (a narrow terminal, or a tall footer) it aligns itself right.
    return (
      <Box flexDirection="row" alignItems="flex-end" flexGrow={1} justifyContent="flex-end" alignSelf="flex-end">
        {e.props.modes.length > 0 ? (
          <Text dimColor>{`${e.props.modes.join(' & ')}  `}</Text>
        ) : null}
        <Box flexDirection="column" alignItems="flex-end">
          {bubble.map((row, i) => (
            <Text key={`bubble-${i}`} color={ORANGE} bold={current === 'sleeping'}>
              {row || ' '}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column" marginLeft={1}>
          {laptop.map((r, i) => drawRow(r, `laptop-${i}`))}
        </Box>
        <Box flexDirection="column" marginLeft={1}>
          {pet.map((r, i) => drawRow(r, `pet-${i}`))}
        </Box>
      </Box>
    )
  })
}
