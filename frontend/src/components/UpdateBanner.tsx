import { useRegisterSW } from 'virtual:pwa-register/react'

// Registers the service worker and, once a new build has been deployed, offers to switch to it.
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  // A dialog, because Pico only centers header/main/footer under #root; a bare article would need custom CSS.
  return (
    <dialog open>
      <article>
        <p>A new version is available.</p>
        <footer>
          <button className="secondary" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
          <button onClick={() => updateServiceWorker(true)}>Reload</button>
        </footer>
      </article>
    </dialog>
  )
}
