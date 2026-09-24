export const tripControlDefinitions = [
  { type: '15:00', title: 'Monitoreo 3:00 PM' },
  { type: '20:00', title: 'Monitoreo 8:00 PM' },
  { type: '05:00', title: 'Monitoreo 5:00 AM' },
] as const

export type TripControlType = (typeof tripControlDefinitions)[number]['type']
