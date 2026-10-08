import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PetMood } from '../types'

const mood = atom({ plugin: 'clawd-pet', key: 'mood' } as const, 'awake')
const frame = atom({ plugin: 'clawd-pet', key: 'frame' } as const, 0)
const isHidden = atom({ plugin: 'clawd-pet', key: 'isHidden' } as const, false)
const laptopStep = atom({ plugin: 'clawd-pet', key: 'laptopStep' } as const, 0)
const isPlanMode = atom({ plugin: 'clawd-pet', key: 'isPlanMode' } as const, false)

// How long Clawd stays knocked out after a command fails.
const ERROR_MS = 3000

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
const DEFAULT_COLOR = 'orange'
const EYE_BLACK = '#000000'
const LAPTOP_GREY = '#A8A8A8'
const LAPTOP_DIM = '#5C5C5C'
const SPARK_YELLOW = '#FFD166'
const Z_FADED = '#7A5A4A'
const SCREEN_GLOW = '#CFE3F7'
const SCREEN_DIM = '#8FB4DA'
const HAT_YELLOW = '#E8B04B'
const HAT_BADGE = '#B07A1E'

// The colors Clawd can be, by the name the person picks in /config or types
// after `/pet color`; any #RRGGBB (or #RGB) works too.
const PALETTE: Record<string, string> = {
  orange: '#E8713A',
  blue: '#4A90E2',
  green: '#4CAF50',
  purple: '#9B59B6',
  pink: '#E86A9B',
  red: '#E74C3C',
  yellow: '#F1C40F',
  gray: '#95A5A6',
}

// The hex a color name or hex code stands for, as #RRGGBB, or undefined when
// it is neither a palette name nor a well-formed hex code.
function toHex(color: string): string | undefined {
  const value = color.trim().toLowerCase()
  const named = PALETTE[value]
  if (named !== undefined) {
    return named
  }
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value)
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  }
  const long = /^#?([0-9a-f]{6})$/.exec(value)
  return long ? `#${long[1]}` : undefined
}

// The same color at 60% brightness: shut eyes are drawn in it, so they read
// as a darker line on any body color.
function darken(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.round(((n >> shift) & 0xff) * 0.6)
  return `#${[16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, '0')).join('')}`
}

// Clawd's body color and its darker shade, set from the person's choice when
// the module loads (and again when they change it with /pet color).
let BODY = PALETTE[DEFAULT_COLOR] ?? '#E8713A'
let BODY_DARK = darken(BODY)

function paint(hex: string) {
  BODY = hex
  BODY_DARK = darken(hex)
}

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
  const body = (text: string): Seg => ({ text, color: BODY, bold: true })
  const eye: Seg =
    eyes === 'open'
      ? { text: '▀', color: EYE_BLACK, backgroundColor: BODY }
      : { text: '▀', color: BODY_DARK, backgroundColor: BODY }

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
  const body = (text: string): Seg => ({ text, color: BODY, bold: true })
  const eye: Seg = { text: '▀', color: EYE_BLACK, backgroundColor: BODY }

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

// The hard hat Clawd wears while Claude is in plan mode: a yellow dome with
// a darker badge in the row above its head, and the brim painted over the
// empty top half of its head row, so it sits right on top of the head.
function hatRow(): Seg[] {
  const hat = (text: string, color = HAT_YELLOW): Seg => ({ text, color, bold: true })
  return [{ text: '  ' }, hat('▄▄'), hat('▄', HAT_BADGE), hat('▄▄'), { text: '  ' }]
}

function brimRow(): Seg[] {
  return [
    { text: '▀', color: HAT_YELLOW, bold: true },
    { text: '▀▀▀▀▀▀▀', color: HAT_YELLOW, backgroundColor: BODY, bold: true },
    { text: '▀', color: HAT_YELLOW, bold: true },
  ]
}

// Planning, Clawd faces you under its hard hat and marches in place: its
// legs step between two stances every half second.
function marchingLegs(tick: number): Seg[] {
  const legs = Math.floor(tick / 2) % 2 === 0 ? ' █▀█▀█▀█ ' : ' ▀█▀█▀█▀ '
  return [{ text: legs, color: BODY, bold: true }]
}

// Knocked out after a command fails: Clawd lies flat on its back, its legs
// in the air, its eyes crossed out (×), with stars spinning over it and the
// laptop tumbling off behind it.
//
//   . . . . . . . . .     legs up
//   . # . # . # . # .
//   # # X # # # X # #     flat body
//   # # # # # # # # #
function knockedOutRows(): Seg[][] {
  const body = (text: string): Seg => ({ text, color: BODY, bold: true })
  const eye: Seg = { text: '×', color: EYE_BLACK, backgroundColor: BODY, bold: true }
  return [
    [body(' ▄ ▄ ▄ ▄ ')],
    [body('██'), eye, body('███'), eye, body('██')],
  ]
}

const STARS = ['  ✦   ✧  ', '   ✧ ✦   ', '  ✧   ✦  ', '   ✦ ✧   ']

function starRow(tick: number): Seg[] {
  const stars = STARS[Math.floor(tick / 2) % STARS.length] ?? ''
  return [...stars].map(ch => (ch === ' ' ? { text: ch } : { text: ch, color: SPARK_YELLOW, bold: true }))
}

// The sparks that pop out of the laptop while Clawd types, one frame per
// tick, in the row above the laptop and as wide as it.
const SPARKS = ['  ✻  ', ' · ✻ ', '✻  · ', ' ✻  ·']

function sparkRow(tick: number): Seg[] {
  const sparks = SPARKS[tick % SPARKS.length] ?? ''
  return [...sparks].map(ch =>
    ch === '✻' ? { text: ch, color: BODY, bold: true } : ch === '·' ? { text: ch, color: SPARK_YELLOW, bold: true } : { text: ch },
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
      cells[4 + age] = { text: shape, color: age === Z_SHAPES.length - 1 ? Z_FADED : BODY, bold: age >= 3 }
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

// What moodNow needs to know beyond the plugin's state.
type Clock = {
  lastActivityAt: number
  isTurnRunning: boolean
  errorUntil: number
  idleMs: number
  // How many Plan subagents are running: Claude planning without plan mode.
  planAgents: number
  // What the footer under the prompt last said about plan mode, and what of
  // it the plugin has already recorded (see the PromptHint hook).
  footerSaysPlan: boolean
  footerEverSaidPlan: boolean
  footerApplied: boolean | undefined
}

// Clawd's mood right now: knocked out for a few seconds after a failed
// command, planning or working while a turn runs, asleep once the person has
// been idle long enough, awake otherwise.
async function moodNow($: EngineInterface, c: Clock): Promise<PetMood> {
  const now = await $.clock.now()
  if (now < c.errorUntil) {
    return 'error'
  }
  if (c.isTurnRunning) {
    return c.planAgents > 0 || (await read($, isPlanMode)) ? 'planning' : 'working'
  }
  return now - c.lastActivityAt >= c.idleMs ? 'sleeping' : 'awake'
}

// Records whether plan mode is on. The engine's plan-mode notes switch it
// both ways; the settings-hook events' `permission_mode` only ever switches it
// on, so a field they leave stale cannot take the hat off mid-plan.
async function notePermissionMode($: EngineInterface, permissionMode: string | undefined) {
  if (permissionMode !== undefined && (await read($, isPlanMode)) !== (permissionMode === 'plan')) {
    await update($, isPlanMode, () => permissionMode === 'plan')
  }
}

export const register: Register = (on, options) => {
  const idleMs = Math.max(5, Number(options.idleSeconds ?? 60)) * 1000
  // A custom hex in /config wins over the palette pick; a malformed one is
  // ignored and the pick is used.
  paint(toHex(String(options.customColor ?? '')) ?? toHex(String(options.color ?? DEFAULT_COLOR)) ?? BODY)
  const c: Clock = {
    lastActivityAt: 0,
    isTurnRunning: false,
    errorUntil: 0,
    idleMs,
    planAgents: 0,
    footerSaysPlan: false,
    footerEverSaidPlan: false,
    footerApplied: undefined,
  }

  on('session.start', async ($, e, next) => {
    c.lastActivityAt = await $.clock.now()
    await update($, mood, () => 'awake')

    $.clock.every(TICK_MS, async () => {
      // Shift+Tab: the footer is the first to show the mode changed. Its word
      // is recorded once each time it changes; it only switches plan mode off
      // once it has been seen saying it is on, so a footer that never shows
      // the mode leaves the other signals in charge.
      if (c.footerApplied !== c.footerSaysPlan && (c.footerSaysPlan || c.footerEverSaidPlan)) {
        await notePermissionMode($, c.footerSaysPlan ? 'plan' : 'default')
        c.footerApplied = c.footerSaysPlan
      }
      const current = await moodNow($, c)
      await setMood($, current)
      if ((await read($, frame)) % 2 === 0) {
        // Working, the laptop comes out; knocked out, it stays where it was;
        // otherwise (planning included) it goes back behind Clawd's back.
        await update($, laptopStep, step =>
          current === 'working'
            ? Math.min(OPEN, (step ?? STOWED) + 1)
            : current === 'error'
              ? (step ?? STOWED)
              : Math.max(STOWED, (step ?? STOWED) - 1),
        )
      }
      await update($, frame, n => ((n ?? 0) + 1) % 1000)
    })

    // The pet keeps living even if the command cannot be registered.
    try {
      await $.command.register({
        name: 'pet',
        description: 'Show or hide Clawd, the Claude pet above the prompt; /pet color changes its color.',
        argumentHint: '[color <name|#hex>]',
      })
    } catch {}

    return next(e)
  })

  // `/pet` shows or hides Clawd; `/pet color` lists the colors; `/pet color
  // <name|#hex>` repaints it now and saves the choice in the plugin's /config
  // options (a name in "color", a hex in "customColor"), so it lasts.
  on('command.run', { command: 'pet' }, async ($, e) => {
    const [sub, ...rest] = e.args.trim().split(/\s+/)
    if (sub !== 'color') {
      const hidden = await update($, isHidden, h => !h)
      return { text: hidden ? 'Clawd went home. Run /pet to bring it back.' : 'Clawd is back!' }
    }

    const names = Object.keys(PALETTE).join(', ')
    const wanted = rest.join(' ')
    if (wanted === '') {
      return { text: `Clawd's colors: ${names}, or any hex like #00BCD4. Now: ${BODY}.` }
    }

    const hex = toHex(wanted)
    if (hex === undefined) {
      return { text: `"${wanted}" is not a color I know. Use one of: ${names}, or a hex like #00BCD4.` }
    }

    paint(hex)
    const name = wanted.trim().toLowerCase()
    const saves =
      PALETTE[name] !== undefined
        ? [
            { key: 'clawd-pet.color', value: name },
            { key: 'clawd-pet.customColor', value: '' },
          ]
        : [{ key: 'clawd-pet.customColor', value: hex }]
    for (const save of saves) {
      const { deny } = await $.config.set(save)
      if (deny !== undefined) {
        return { text: `Clawd is ${hex} for now, but the color could not be saved: ${deny}` }
      }
    }
    return { text: `Clawd is now ${PALETTE[name] !== undefined ? name : hex}.` }
  })

  // Anything the person does in the prompt box wakes Clawd up.
  on('prompt.edit', async ($, e, next) => {
    c.lastActivityAt = await $.clock.now()
    await setMood($, await moodNow($, c))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    c.isTurnRunning = true
    c.lastActivityAt = await $.clock.now()
    await setMood($, await moodNow($, c))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    c.isTurnRunning = true
    c.lastActivityAt = await $.clock.now()
    await setMood($, await moodNow($, c))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    c.isTurnRunning = false
    c.lastActivityAt = await $.clock.now()
    await setMood($, await moodNow($, c))
    return next(e)
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    if (e.permission_mode === 'plan') {
      await notePermissionMode($, 'plan')
    }
    return next(e)
  })

  on('classic.PostToolUse', async ($, e, next) => {
    if (e.permission_mode === 'plan') {
      await notePermissionMode($, 'plan')
    }
    return next(e)
  })

  // The engine's own record of plan mode: while it is on, every request of
  // the main conversation carries a `plan_mode` reminder (and a
  // `plan_mode_reentry` note when Claude goes back into it); when it ends, a
  // `plan_mode_exit` note is made once. A subagent's rows are left out: only
  // the main conversation's mode puts the hat on.
  on('prompt.attachment', { type: 'plan_mode' }, async ($, e, next) => {
    if (e.agentId === undefined) {
      await notePermissionMode($, 'plan')
    }
    return next(e)
  })

  on('prompt.attachment', { type: 'plan_mode_reentry' }, async ($, e, next) => {
    if (e.agentId === undefined) {
      await notePermissionMode($, 'plan')
    }
    return next(e)
  })

  on('prompt.attachment', { type: 'plan_mode_exit' }, async ($, e, next) => {
    if (e.agentId === undefined) {
      await notePermissionMode($, 'default')
    }
    return next(e)
  })

  // Entering plan mode puts the hat on; a plan accepted takes it off.
  on('tool.call', { tool: 'EnterPlanMode' }, async ($, e, next) => {
    const result = await next(e)
    if (!result.deny && !result.isError) {
      await update($, isPlanMode, () => true)
    }
    return result
  })

  on('tool.call', { tool: 'ExitPlanMode' }, async ($, e, next) => {
    const result = await next(e)
    if (!result.deny && !result.isError) {
      await update($, isPlanMode, () => false)
    }
    return result
  })

  // Asked to plan, Claude may hand the work to its Plan subagent without
  // entering plan mode: Clawd plans (hard hat on) while that agent runs.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (e.subagent_type !== 'Plan') {
      return next(e)
    }
    c.planAgents += 1
    try {
      return await next(e)
    } finally {
      c.planAgents -= 1
    }
  })

  // The footer under the prompt says "plan mode on" while plan mode is on, the
  // moment Shift+Tab switches it. A drawing never writes state, so this only
  // notes what the line says; the timer records it.
  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    c.footerSaysPlan = /plan mode on/i.test(e.props.hint)
    c.footerEverSaidPlan = c.footerEverSaidPlan || c.footerSaysPlan
    return next(e)
  })

  // A failing command (a build, a test run, a script) knocks Clawd out for a
  // few seconds; an interrupt does not count.
  on('classic.PostToolUseFailure', async ($, e, next) => {
    if (e.permission_mode === 'plan') {
      await notePermissionMode($, 'plan')
    }
    if (e.tool_name === 'Bash' && !e.is_interrupt) {
      c.errorUntil = (await $.clock.now()) + ERROR_MS
      await setMood($, 'error')
    }
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
    const isPlanning = current === 'planning'
    const isKnockedOut = current === 'error'
    const wearsHat = !isAsleep && !isKnockedOut && (isPlanning || (await read($, isPlanMode)))
    const eyes: Eyes = isAsleep ? 'asleep' : current === 'awake' && tick % 28 === 27 ? 'blink' : 'open'
    // From the moment it turns to grab the laptop until it has put it back,
    // Clawd is in profile; otherwise it faces you.
    const isSideways = step > STOWED && !isKnockedOut
    const bubble =
      isKnockedOut
        ? ['', '', '', 'oops!']
        : isPlanning
          ? ['', '', '', `planning${'.'.repeat((Math.floor(tick / 2) % 3) + 1)}`]
          : isAsleep
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
    const front = petRows(eyes)
    const body: Seg[][] = isKnockedOut
      ? [[{ text: '         ' }], ...knockedOutRows()]
      : isSideways
        ? sidePetRows(isTyping && tick % 2 === 1)
        : isPlanning
          ? [front[0] ?? blank, front[1] ?? blank, marchingLegs(tick)]
          : front
    const head = body[0] ?? blank
    const pet = [
      isKnockedOut ? starRow(tick) : isAsleep ? sleepRow(tick) : wearsHat ? hatRow() : blank,
      wearsHat ? brimRow() : head,
      ...body.slice(1),
    ]
    const tumblingLaptop: Seg[][] = [
      [{ text: ' ' }],
      [{ text: '▞', color: LAPTOP_GREY, bold: true }],
      [{ text: '▀', color: LAPTOP_DIM }],
    ]
    const behind = [blank, ...(isKnockedOut ? tumblingLaptop : behindRows(step))]
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
            <Text key={`bubble-${i}`} color={isAsleep ? Z_FADED : BODY} bold={!isAsleep}>
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
