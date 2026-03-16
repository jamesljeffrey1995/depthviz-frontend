import { useCallback } from 'react'

interface UseGeolocationReturn {
  getLocation: () => Promise<GeolocationCoordinates>
}

export function useGeolocation(): UseGeolocationReturn {
  const getLocation = useCallback((): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve(pos.coords),
        () => reject(new Error('Location access denied'))
      )
    })
  }, [])

  return { getLocation }
}
