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
const STOWED = 0 // Clawd faces you, the laptop behind its back, one corner peeking out
const TURNED = 1 // Clawd turns sideways, facing left, and grabs the laptop
const LIFTED = 2 // pulled out, held up closed in front of it
const SET_DOWN = 3 // set down closed on the ground in front of it
const OPEN = 4 // opened sideways, the screen tilted back; Clawd types

// Fixed colors, so Clawd stays vivid whatever the terminal theme.
const ORANGE = '#E8713A'
const EYE_BLACK = '#000000'
const LAPTOP_GREY = '#A8A8A8'
const LAPTOP_DIM = '#5C5C5C'
const SPARK_YELLOW = '#FFD166'
const SLEEPY_EYE = '#8A3F1C'
const Z_FADED = '#7A5A4A'
const SCREEN_GLOW = '#CFE3F7'
const SCREEN_DIM = '#8FB4DA'

// One run of characters in a single style.
type Seg = { text: string; color?: string; backgroundColor?: string; bold?: boolean }

// Clawd as a 9×5 pixel sprite, two pixel rows per terminal row (half
// blocks), so it is two and a half rows tall, close to the sticker's shape;
// the head starts halfway down the top row:
//
//   . # # # # # # # .     row 0  head
//   # # E # # # E # #     row 1  arms and eyes
//   # # # # # # # # #     row 2  arms
//   . # # # # # # # .     row 3  body
//   . # . # . # . # .     row 4  legs
//
// An eye is one pixel: black when open (`▀`, black over orange), a dark
// orange line when it blinks or while asleep. Facing you, Clawd only idles
// and sleeps; asleep it lies still and only the Zs above it move. To work it
// turns sideways (below).
type Eyes = 'open' | 'blink' | 'asleep'

function petRows(eyes: Eyes): Seg[][] {
  const body = (text: string): Seg => ({ text, color: ORANGE, bold: true })
  const eye: Seg =
    eyes === 'open'
      ? { text: '▀', color: EYE_BLACK, backgroundColor: ORANGE }
      : { text: '▀', color: SLEEPY_EYE, backgroundColor: ORANGE }

  return [
    [body(' ▄▄▄▄▄▄▄ ')],
    [body('██'), eye, body('███'), eye, body('██')],
    [body(' █▀█▀█▀█ ')],
  ]
}

// Clawd in profile, facing left, as it works: the same 9×5 body with both
// eyes toward the front (left) and one arm, the front one, reaching out to
// the keyboard; the back arm is hidden behind its body.
//
//   . # # # # # # # .     row 0  head
//   . # E # # E # # .     row 1  eyes
//   A # # # # # # # .     row 2  front arm (at rest)
//   a # # # # # # # .     row 3  front arm (on the keys)
//   . # . # . # . # .     row 4  legs
//
// Typing, the front arm drops one pixel onto the keys and back up.
function sidePetRows(isArmDown: boolean): Seg[][] {
  const body = (text: string): Seg => ({ text, color: ORANGE, bold: true })
  const eye: Seg = { text: '▀', color: EYE_BLACK, backgroundColor: ORANGE }

  return [
    [body(' ▄▄▄▄▄▄▄ ')],
    [body(`${isArmDown ? ' ' : '▄'}█`), eye, body('██'), eye, body('██ ')],
    [body(`${isArmDown ? '▀' : ' '}█▀█▀█▀█ `)],
  ]
}

// The corner of the laptop peeking out from behind Clawd's back, one column
// right of its head: dim while stowed, bright while Clawd turns and grabs it,
// gone once out.
function behindRows(step: number): Seg[][] {
  const none: Seg[] = [{ text: ' ' }]
  if (step === STOWED) {
    return [[{ text: '▐', color: LAPTOP_DIM }], none, none]
  }
  if (step === TURNED) {
    return [[{ text: '█', color: LAPTOP_GREY }], none, none]
  }
  return [none, none, none]
}

// The laptop, seen from the side like Clawd, five columns wide at every step
// so Clawd never shifts: held up closed at arm height, set down closed, then
// opened with the screen tilted back toward the left and the keyboard
// running up to Clawd's front arm. While Clawd types the screen flickers.
function laptopRows(step: number, isWorking: boolean, tick: number): Seg[][] {
  const empty: Seg[] = [{ text: '     ' }]
  const grey = (text: string): Seg => ({ text, color: LAPTOP_GREY, bold: true })

  if (step === LIFTED) {
    return [empty, [{ text: '  ' }, grey('▄▄▄')], empty]
  }
  if (step === SET_DOWN) {
    return [empty, empty, [{ text: '  ' }, grey('▀▀▀')]]
  }
  if (step === OPEN) {
    const screen: Seg = {
      text: '╲',
      color: isWorking && tick % 2 === 1 ? SCREEN_DIM : SCREEN_GLOW,
      bold: true,
    }
    return [
      [screen, { text: '    ' }],
      [{ text: ' ' }, screen, { text: '   ' }],
      [{ text: '  ' }, grey('▀▀▀')],
    ]
  }
  return [empty, empty, empty]
}

// The sparks that pop out of the laptop while Clawd types, one frame per
// tick, in the row above the laptop and as wide as it.
const SPARKS = ['  ✻  ', ' · ✻ ', '✻  · ', ' ✻  ·']

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
    // From the moment it turns to grab the laptop until it has put it back,
    // Clawd is in profile; otherwise it faces you.
    const isSideways = step > STOWED
    const bubble =
      isAsleep
        ? ['', '', '', 'Zzz…']
        : isTyping
          ? ['', '', '', '']
          : isWorking
            ? ['', '', '', step <= TURNED ? 'hmm…' : 'got it!']
            : step > STOWED
              ? ['', '', '', 'done!']
              : ['', '', '', 'hi!']
    const blank: Seg[] = [{ text: ' ' }]
    const laptop = [isTyping ? sparkRow(tick) : [{ text: '     ' }], ...laptopRows(step, isWorking, tick)]
    const body = isSideways ? sidePetRows(isTyping && tick % 2 === 1) : petRows(eyes)
    const pet = [isAsleep ? sleepRow(tick) : blank, ...body]
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
        <Box flexDirection="column">{fit(pet).map((r, i) => drawRow(r, `pet-${i}`))}</Box>
        <Box flexDirection="column">{fit(behind).map((r, i) => drawRow(r, `behind-${i}`))}</Box>
      </Box>
    )
  })
}
