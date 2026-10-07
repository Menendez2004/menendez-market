export type PetMood = 'awake' | 'working' | 'sleeping'

declare module 'claude-code' {
  interface PluginState {
    'clawd-pet': { mood: PetMood; frame: number; isHidden: boolean; laptopStep: number }
  }
}
