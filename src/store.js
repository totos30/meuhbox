// Sons perso conservés dans le navigateur (IndexedDB). Tout est en try/catch :
// si le stockage est indisponible, les sons restent valables pour la session.
const DB = 'boite-a-meuh'
const STORE = 'sons'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const out = fn(t.objectStore(STORE))
        t.oncomplete = () => resolve(out && out.result)
        t.onerror = () => reject(t.error)
      })
  )
}

export async function loadSounds() {
  try {
    const all = await tx('readonly', (s) => s.getAll())
    return (all || []).sort((a, b) => a.createdAt - b.createdAt)
  } catch (e) {
    return []
  }
}

export async function saveSound(record) {
  try {
    await tx('readwrite', (s) => s.put(record))
    return true
  } catch (e) {
    return false
  }
}

export async function deleteSound(id) {
  try {
    await tx('readwrite', (s) => s.delete(id))
  } catch (e) {
    /* rien à faire */
  }
}
