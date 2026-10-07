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
const SLEEPY_EYE = '#8A3F1C'
const Z_FADED = '#7A5A4A'

// One run of characters in a single style.
type Seg = { text: string; color?: string; backgroundColor?: string; bold?: boolean }

// Clawd as a 9×6 pixel sprite, two pixel rows per terminal row (half
// blocks), so it is three rows tall, about as square as the sticker:
//
//   . # # # # # # # .     row 0  head
//   # # E # # # E # #     row 1  arms and eyes
//   # # # # # # # # #     row 2  arms
//   . # # # # # # # .     row 3  body
//   . # . # . # . # .     row 4  legs
//   . # . # . # . # .     row 5  legs
//
// An eye is one pixel: black when open (`▀`, orange over black), a thin black
// slit when it blinks (`▂`), a dark orange line while asleep. Each arm spans
// two pixel rows; while Claude works the arms take turns dropping one pixel
// onto the keys, and the right arm goes up one pixel to reach behind Clawd's
// back for the laptop.
//
// Asleep, Clawd breathes with its whole body: on each breath out everything
// above the legs sinks one pixel and the legs squash to one pixel, so the
// head never comes apart from the body.
type Arm = 'rest' | 'down' | 'up'
type Eyes = 'open' | 'blink' | 'asleep'

// An arm's two cells, top row then middle row, for each of its positions.
const ARM: Record<Arm, [string, string]> = {
  rest: ['▄', '▀'], // pixel rows 1 and 2
  down: [' ', '█'], // pixel rows 2 and 3
  up: ['█', ' '], // pixel rows 0 and 1
}

function petRows(eyes: Eyes, leftArm: Arm, rightArm: Arm, isBreathingOut = false): Seg[][] {
  const body = (text: string): Seg => ({ text, color: ORANGE, bold: true })

  if (isBreathingOut) {
    // Everything one pixel lower: the head is the bottom half of the top row,
    // the eyes the top half of the middle row, the legs one pixel.
    const eye: Seg = { text: '▀', color: SLEEPY_EYE, backgroundColor: ORANGE }
    return [
      [body(' ▄▄▄▄▄▄▄ ')],
      [body('██'), eye, body('███'), eye, body('██')],
      [body(' █▀█▀█▀█ ')],
    ]
  }

  const eye: Seg =
    eyes === 'open'
      ? { text: '▀', color: ORANGE, backgroundColor: EYE_BLACK }
      : eyes === 'blink'
        ? { text: '▂', color: EYE_BLACK, backgroundColor: ORANGE }
        : { text: '▄', color: SLEEPY_EYE, backgroundColor: ORANGE }
  const [leftTop, leftMid] = ARM[leftArm]
  const [rightTop, rightMid] = ARM[rightArm]

  return [
    [body(`${leftTop}█`), eye, body('███'), eye, body(`█${rightTop}`)],
    [body(`${leftMid}███████${rightMid}`)],
    [body(' █ █ █ █ ')],
  ]
}

// The corner of the laptop peeking out from behind Clawd's back, one column
// right of its head: dim while stowed, bright while Clawd grabs it, gone once
// out.
function behindRows(step: number): Seg[][] {
  const none: Seg[] = [{ text: ' ' }]
  if (step === STOWED) {
    return [[{ text: '▐', color: LAPTOP_DIM }], none, none]
  }
  if (step === REACHING) {
    return [[{ text: '█', color: LAPTOP_GREY }], none, none]
  }
  return [none, none, none]
}

// The laptop in front of Clawd, four columns wide at every step so Clawd
// never shifts: lifted closed at arm height, set down closed, then open with
// the screen showing a blinking prompt while Claude works.
function laptopRows(step: number, isWorking: boolean, tick: number): Seg[][] {
  const empty: Seg[] = [{ text: '    ' }]

  if (step === LIFTED) {
    return [empty, [{ text: '▀▀▀▀', color: LAPTOP_GREY }], empty]
  }
  if (step === SET_DOWN) {
    return [empty, empty, [{ text: '▄▄▄▄', color: LAPTOP_GREY }]]
  }
  if (step === OPEN) {
    const screen: Seg = isWorking
      ? { text: tick % 2 === 0 ? '>_' : '>█', color: '#7CFC9A', backgroundColor: '#1A1A1A', bold: true }
      : { text: '✻ ', color: ORANGE, backgroundColor: '#1A1A1A', bold: true }
    return [
      empty,
      [{ text: '▐', color: LAPTOP_GREY }, screen, { text: '▌', color: LAPTOP_GREY }],
      [{ text: '▀▀▀▀', color: LAPTOP_GREY }],
    ]
  }
  return [empty, empty, empty]
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

// The Zs that float up out of Clawd's head while it sleeps, in the row above
// it: each is born small over the top of its head and drifts right one column
// every half second, growing from `·` to `z` to `Z` and fading on its last
// step. Two are in the air at once, three steps apart.
const Z_SHAPES = ['·', 'z', 'z', 'Z', 'Z']
const Z_CYCLE = 6

function sleepRow(tick: number): Seg[] {
  const cells: Seg[] = Array.from({ length: 9 }, () => ({ text: ' ' }))
  const beat = Math.floor(tick / 2)
  for (const offset of [0, 3]) {
    const age = (beat + offset) % Z_CYCLE
    const shape = Z_SHAPES[age]
    if (shape !== undefined) {
      cells[4 + age] = { text: shape, color: age === Z_SHAPES.length - 1 ? Z_FADED : ORANGE, bold: age >= 3 }
    }
  }
  return cells
}

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
  // on rows of its own so nothing squeezes it: four where the band has them
  // (the top one for the sparks and the floating Zs), three otherwise. The
  // row count never changes with the mood, so the prompt never jumps.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.maxRows < 3 || (await read($, isHidden))) {
      return next(e)
    }

    const current = await read($, mood)
    const tick = await read($, frame)
    const step = await read($, laptopStep)
    const { Box, Text } = $.ui.resolve(e)

    const isWorking = current === 'working'
    const isTyping = isWorking && step === OPEN
    const isAsleep = current === 'sleeping'
    const eyes: Eyes = isAsleep ? 'asleep' : current === 'awake' && tick % 28 === 27 ? 'blink' : 'open'
    const keyBeat = tick % 4
    const leftArm: Arm = isTyping && keyBeat === 0 ? 'down' : 'rest'
    const rightArm: Arm = step === REACHING ? 'up' : isTyping && keyBeat === 2 ? 'down' : 'rest'
    // A slow breath: a second and a half in, a second and a half out.
    const isBreathingOut = isAsleep && Math.floor(tick / 6) % 2 === 1
    const bubble =
      isAsleep
        ? ['', '', '', 'Zzz…']
        : isTyping
          ? ['', '', '', '']
          : isWorking
            ? ['', '', '', step <= REACHING ? 'hmm…' : 'got it!']
            : step > STOWED
              ? ['', '', '', 'done!']
              : ['', '', '', 'hi!']
    const blank: Seg[] = [{ text: ' ' }]
    const laptop = [isTyping ? sparkRow(tick) : [{ text: '    ' }], ...laptopRows(step, isWorking, tick)]
    const pet = [isAsleep ? sleepRow(tick) : blank, ...petRows(eyes, leftArm, rightArm, isBreathingOut)]
    const behind = [blank, ...behindRows(step)]
    const rows = e.props.maxRows >= 4 ? 4 : 3
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
            <Text key={`bubble-${i}`} color={isAsleep ? Z_FADED : ORANGE} bold={!isAsleep}>
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
