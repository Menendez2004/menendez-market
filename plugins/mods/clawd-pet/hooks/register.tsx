import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PetMood } from '../types'

const mood = atom({ plugin: 'clawd-pet', key: 'mood' } as const, 'awake')
const frame = atom({ plugin: 'clawd-pet', key: 'frame' } as const, 0)
const isHidden = atom({ plugin: 'clawd-pet', key: 'isHidden' } as const, false)
const laptopStep = atom({ plugin: 'clawd-pet', key: 'laptopStep' } as const, 0)

// A quarter second a frame, so the typing looks quick; the laptop moves on
// every other frame, so it still takes about two seconds to come out.
const TICK_MS = 250

// Where the laptop is, one step every other tick toward OPEN while Claude
// works and back toward STOWED once it stops.
const STOWED = 0 // behind Clawd's back, one corner peeking out
const REACHING = 1 // Clawd reaches back and grabs it
const LIFTED = 2 // pulled out, held up closed in front
const SET_DOWN = 3 // set down closed in front
const OPEN = 4 // open in front, Clawd types

// Fixed colors, so Clawd stays vivid whatever the terminal theme.
const ORANGE = '#E8713A'
const EYE_BLACK = '#000000'
const LAPTOP_GREY = '#A8A8A8'
const LAPTOP_DIM = '#5C5C5C'
const SPARK_YELLOW = '#FFD166'

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
// when open, and a thin black slit (`▂`, black on orange) when shut. The right
// arm goes up (`▀`) to reach behind Clawd's back for the laptop; while Claude
// works the arms take turns dropping onto the keys (`▁`), left then right.
function petRows(isEyesClosed: boolean, leftArm: string, rightArm: string): Seg[][] {
  const eye: Seg = isEyesClosed
    ? { text: '▂', color: EYE_BLACK, backgroundColor: ORANGE }
    : { text: '▀', color: ORANGE, backgroundColor: EYE_BLACK }
  const body = (text: string): Seg => ({ text, color: ORANGE, bold: true })

  return [
    [body(`${leftArm}█`), eye, body('███'), eye, body(`█${rightArm}`)],
    [body(' █▀█▀█▀█ ')],
  ]
}

// The corner of the laptop peeking out from behind Clawd's back, one column
// right of it: dim while stowed, bright while Clawd grabs it, gone once out.
function behindRows(step: number): Seg[][] {
  if (step === STOWED) {
    return [[{ text: '▐', color: LAPTOP_DIM }], [{ text: ' ' }]]
  }
  if (step === REACHING) {
    return [[{ text: '█', color: LAPTOP_GREY }], [{ text: ' ' }]]
  }
  return [[{ text: ' ' }], [{ text: ' ' }]]
}

// The laptop in front of Clawd, four columns wide at every step so Clawd
// never shifts: lifted closed, set down closed, then open with the screen
// showing a blinking prompt while Claude works.
function laptopRows(step: number, isWorking: boolean, tick: number): Seg[][] {
  const empty: Seg = { text: '    ' }
  const closed: Seg = { text: '▄▄▄▄', color: LAPTOP_GREY }

  if (step === LIFTED) {
    return [[closed], [empty]]
  }
  if (step === SET_DOWN) {
    return [[empty], [closed]]
  }
  if (step === OPEN) {
    const screen: Seg = isWorking
      ? { text: tick % 2 === 0 ? '>_' : '>█', color: '#7CFC9A', backgroundColor: '#1A1A1A', bold: true }
      : { text: '✻ ', color: ORANGE, backgroundColor: '#1A1A1A', bold: true }
    return [
      [{ text: '▐', color: LAPTOP_GREY }, screen, { text: '▌', color: LAPTOP_GREY }],
      [{ text: '▀▀▀▀', color: LAPTOP_GREY }],
    ]
  }
  return [[empty], [empty]]
}

// The sparks that pop out of the laptop while Clawd types, one frame per
// tick, in the row above the laptop and as wide as it.
const SPARKS = ['  ✻ ', ' · ✻', '✻ · ', ' ✻ ·']

function sparkRow(tick: number): Seg[] {
  const sparks = SPARKS[tick % SPARKS.length] ?? ''
  return [...sparks].map(ch =>
    ch === '✻' ? { text: ch, color: ORANGE, bold: true } : ch === '·' ? { text: ch, color: SPARK_YELLOW, bold: true } : { text: ch },
  )
}

// The "Zzz" that floats up while Clawd sleeps, one step every second.
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
      if ((await read($, frame)) % 2 === 0) {
        await update($, laptopStep, step =>
          current === 'working' ? Math.min(OPEN, (step ?? STOWED) + 1) : Math.max(STOWED, (step ?? STOWED) - 1),
        )
      }
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

  // Clawd sits in the band right above the prompt, against its right edge,
  // on rows of its own so nothing squeezes it: three where the band has
  // them (the top one for the sparks and the floating Z), two otherwise.
  // The row count never changes with the mood, so the prompt never jumps.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.maxRows < 2 || (await read($, isHidden))) {
      return next(e)
    }

    const current = await read($, mood)
    const tick = await read($, frame)
    const step = await read($, laptopStep)
    const { Box, Text } = $.ui.resolve(e)

    const isWorking = current === 'working'
    const isTyping = isWorking && step === OPEN
    const isEyesClosed = current === 'sleeping' || (current === 'awake' && tick % 28 === 27)
    const keyBeat = tick % 4
    const leftArm = isTyping && keyBeat === 0 ? '▁' : '▄'
    const rightArm = step === REACHING ? '▀' : isTyping && keyBeat === 2 ? '▁' : '▄'
    const bubble =
      current === 'sleeping'
        ? [...(ZZZ[Math.floor(tick / 4) % ZZZ.length] ?? ['', '']), 'Zzz…']
        : isTyping
          ? ['', '', Math.floor(tick / 2) % 2 === 0 ? 'tap!' : 'tap tap!']
          : isWorking
            ? ['', '', step <= REACHING ? 'hmm…' : 'got it!']
            : step > STOWED
              ? ['', '', 'done!']
              : ['', '', 'hi!']
    const blank: Seg[] = [{ text: ' ' }]
    const laptop = [isTyping ? sparkRow(tick) : [{ text: '    ' }], ...laptopRows(step, isWorking, tick)]
    const pet = [blank, ...petRows(isEyesClosed, leftArm, rightArm)]
    const behind = [blank, ...behindRows(step)]
    const rows = e.props.maxRows >= 3 ? 3 : 2
    const fit = <T,>(column: T[]): T[] => column.slice(column.length - rows)

    const drawRow = (segs: Seg[], key: string) => (
      <Text key={key}>
        {segs.map((seg, i) => (
          <Text key={`${key}-${i}`} color={seg.color} backgroundColor={seg.backgroundColor} bold={seg.bold}>
            {seg.text}
          </Text>
        ))}
      </Text>
    )

    // As wide as the band, everything pushed to its right end.
    return (
      <Box flexDirection="row" alignItems="flex-end" justifyContent="flex-end" width={e.props.bodyColumns}>
        <Box flexDirection="column" alignItems="flex-end">
          {fit(bubble).map((row, i) => (
            <Text key={`bubble-${i}`} color={ORANGE} bold={current === 'sleeping'}>
              {row || ' '}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column" marginLeft={1}>
          {fit(laptop).map((r, i) => drawRow(r, `laptop-${i}`))}
        </Box>
        <Box flexDirection="column" marginLeft={1}>
          {fit(pet).map((r, i) => drawRow(r, `pet-${i}`))}
        </Box>
        <Box flexDirection="column">{fit(behind).map((r, i) => drawRow(r, `behind-${i}`))}</Box>
      </Box>
    )
  })
}
