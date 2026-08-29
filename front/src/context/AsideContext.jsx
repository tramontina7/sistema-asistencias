import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const AsideContext = createContext(null)

export function AsideProvider({ children }) {
  const [widgets, setWidgets] = useState([])

  const registerWidget = useCallback((Widget) => {
    setWidgets(prev => (prev.includes(Widget) ? prev : [...prev, Widget]))
  }, [])

  const unregisterWidget = useCallback((Widget) => {
    setWidgets(prev => prev.filter(w => w !== Widget))
  }, [])

  return (
    <AsideContext.Provider value={{ widgets, registerWidget, unregisterWidget }}>
      {children}
    </AsideContext.Provider>
  )
}

export function useAside() {
  return useContext(AsideContext)
}

export function useAsideWidget(Widget) {
  const ctx = useContext(AsideContext)
  useEffect(() => {
    if (!ctx) return undefined
    ctx.registerWidget(Widget)
    return () => ctx.unregisterWidget(Widget)
  }, [ctx, Widget])
}
