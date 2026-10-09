export type PetMood = 'awake' | 'working' | 'planning' | 'error' | 'sleeping'

// What a subagent's helper does: reads in glasses, plans under the hard hat,
// or codes on its laptop.
export type HelperKind = 'research' | 'plan' | 'code'

export type Helper = { id: string; kind: HelperKind }

declare module 'claude-code' {
  interface PluginState {
    'clawd-pet': {
      mood: PetMood
      frame: number
      isHidden: boolean
      laptopStep: number
      isPlanMode: boolean
      helpers: Helper[]
    }
  }
}
