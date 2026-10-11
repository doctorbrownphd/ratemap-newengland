export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const MONTH_TEMP = [22, 25, 34, 46, 58, 68, 74, 72, 64, 52, 40, 28]  // °F, New England avg
export const MONTH_IRRAD = [0.34,0.46,0.62,0.78,0.9,0.97,1.0,0.92,0.76,0.56,0.36,0.28]
export const DAYS = [31,28,31,30,31,30,31,31,30,31,30,31]

// Subset of US federal holidays. Missing: Columbus Day, Veterans Day. Utility-specific holiday lists may differ.
// US federal holidays (month, day) for TOU off-peak classification
export const FEDERAL_HOLIDAYS: [number, number][] = [
  [0, 1],   // New Year's Day (Jan 1)
  [6, 4],   // Independence Day (Jul 4)
  [11, 25], // Christmas (Dec 25)
]
// Floating holidays are computed per year
export function isFederalHoliday(month: number, day: number, dayOfWeek: number): boolean {
  // Fixed holidays
  for (const [m, d] of FEDERAL_HOLIDAYS) {
    if (month === m && day === d) return true
  }
  // MLK Day: 3rd Monday of January
  if (month === 0 && dayOfWeek === 1 && day >= 15 && day <= 21) return true
  // Presidents' Day: 3rd Monday of February
  if (month === 1 && dayOfWeek === 1 && day >= 15 && day <= 21) return true
  // Memorial Day: last Monday of May
  if (month === 4 && dayOfWeek === 1 && day >= 25) return true
  // Labor Day: 1st Monday of September
  if (month === 8 && dayOfWeek === 1 && day <= 7) return true
  // Thanksgiving: 4th Thursday of November
  if (month === 10 && dayOfWeek === 4 && day >= 22 && day <= 28) return true
  return false
}

export function isOffPeak(date: Date): boolean {
  const dow = date.getDay()
  const isWeekend = dow === 0 || dow === 6
  return isWeekend || isFederalHoliday(date.getMonth(), date.getDate(), dow)
}
