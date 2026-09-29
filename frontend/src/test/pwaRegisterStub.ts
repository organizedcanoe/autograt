// Stands in for vite-plugin-pwa's virtual module, which only exists when the plugin runs (it is off in Vitest).
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }
}
