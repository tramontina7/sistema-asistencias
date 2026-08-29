// Tremor cx [v0.0.0]

import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cx(...args) {
  return twMerge(clsx(...args))
}
