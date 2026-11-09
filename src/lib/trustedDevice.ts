// «Это мой компьютер»: the director and the curator, who see everyone's data, are signed out after
// an hour without activity — school computers are shared. On their own device they can say so when
// they enter the code: the session then stays, and the code is asked again only on another device or
// after «Выйти». Only this browser remembers it; signing out forgets it.

const KEY = 'ait-hub-own-device'

export function isOwnDevice(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setOwnDevice(own: boolean) {
  try {
    if (own) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode: nothing is remembered, the hour-long sign-out stays.
  }
}
