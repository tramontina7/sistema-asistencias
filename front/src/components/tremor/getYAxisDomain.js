// Tremor getYAxisDomain [v0.0.0]

export const getYAxisDomain = (autoMinValue, minValue, maxValue) => {
  const minDomain = autoMinValue ? 'auto' : (minValue ?? 0)
  const maxDomain = maxValue ?? 'auto'
  return [minDomain, maxDomain]
}
