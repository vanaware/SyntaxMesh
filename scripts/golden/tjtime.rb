#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"

$golden_cases = []

def tc(desc, method, input, expected, *args)
  h = { description: desc, method: method, input: input, expected: expected }
  
  # Extract options from last argument if it's a hash
  if args.last.is_a?(Hash)
    opts = args.last
    h[:timezone] = opts[:timezone] if opts[:timezone]
    h[:format] = opts[:format] if opts[:format]
    h[:compareWith] = opts[:compareWith] if opts[:compareWith]
    h[:combineWith] = opts[:combineWith] if opts[:combineWith]
  elsif args.length >= 2
    # strftime style: format, timezone
    h[:format] = args[0]
    h[:timezone] = args[1][:timezone] if args[1].is_a?(Hash) && args[1][:timezone]
  end
  
  $golden_cases << h
end

# --- sameTimeNext* methods ---

tc("sameTimeNextDay advances to next day same time",
   "sameTimeNextDay",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 16, hour: 14, minute: 30, second: 45 })

tc("sameTimeNextDay rolls month end",
   "sameTimeNextDay",
   { year: 2026, month: 1, day: 31, hour: 23, minute: 59, second: 59 },
   { year: 2026, month: 2, day: 1, hour: 23, minute: 59, second: 59 })

tc("sameTimeNextDay leap year",
   "sameTimeNextDay",
   { year: 2024, month: 2, day: 29, hour: 14, minute: 30, second: 45 },
   { year: 2024, month: 3, day: 1, hour: 14, minute: 30, second: 45 })

tc("sameTimeNextDay year boundary",
   "sameTimeNextDay",
   { year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 59 },
   { year: 2027, month: 1, day: 1, hour: 23, minute: 59, second: 59 })

tc("sameTimeNextWeek advances 7 days",
   "sameTimeNextWeek",
   { year: 2026, month: 1, day: 12, hour: 10, minute: 0, second: 0 },
   { year: 2026, month: 1, day: 19, hour: 10, minute: 0, second: 0 })

tc("sameTimeNextWeek year boundary",
   "sameTimeNextWeek",
   { year: 2026, month: 12, day: 28, hour: 14, minute: 30, second: 0 },
   { year: 2027, month: 1, day: 4, hour: 14, minute: 30, second: 0 })

tc("sameTimeNextMonth advances one month",
   "sameTimeNextMonth",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 0 },
   { year: 2026, month: 2, day: 15, hour: 14, minute: 30, second: 0 })

tc("sameTimeNextMonth handles month end",
   "sameTimeNextMonth",
   { year: 2026, month: 1, day: 31, hour: 12, minute: 0, second: 0 },
   { year: 2026, month: 2, day: 28, hour: 12, minute: 0, second: 0 })

tc("sameTimeNextMonth February to March",
   "sameTimeNextMonth",
   { year: 2026, month: 2, day: 28, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 3, day: 28, hour: 14, minute: 30, second: 45 })

tc("sameTimeNextMonth end of year",
   "sameTimeNextMonth",
   { year: 2026, month: 12, day: 15, hour: 10, minute: 0, second: 0 },
   { year: 2027, month: 1, day: 15, hour: 10, minute: 0, second: 0 })

tc("sameTimeNextQuarter advances one quarter",
   "sameTimeNextQuarter",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 0 },
   { year: 2026, month: 4, day: 15, hour: 14, minute: 30, second: 0 })

tc("sameTimeNextQuarter Q4 to next year",
   "sameTimeNextQuarter",
   { year: 2026, month: 10, day: 15, hour: 14, minute: 30, second: 0 },
   { year: 2027, month: 1, day: 15, hour: 14, minute: 30, second: 0 })

tc("sameTimeNextYear advances one year",
   "sameTimeNextYear",
   { year: 2026, month: 6, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2027, month: 6, day: 15, hour: 14, minute: 30, second: 45 })

tc("sameTimeNextYear leap year to non-leap",
   "sameTimeNextYear",
   { year: 2024, month: 2, day: 29, hour: 12, minute: 0, second: 0 },
   { year: 2025, month: 2, day: 28, hour: 12, minute: 0, second: 0 })

# --- strftime ---

tc("strftime %Y returns year",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "2026", "%Y")

tc("strftime %m returns month",
   "strftime",
   { year: 2026, month: 3, day: 5, hour: 9, minute: 5, second: 1 },
   "03", "%m")

tc("strftime %d returns day",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "15", "%d")

tc("strftime %H returns hour 24h",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "14", "%H")

tc("strftime %M returns minute",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "30", "%M")

tc("strftime %S returns second",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "45", "%S")

tc("strftime %A returns weekday name",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "Thursday", "%A")

tc("strftime %B returns month name",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "January", "%B")

tc("strftime %z returns timezone offset",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "+0000", "%z", timezone: "UTC")

tc("strftime %Z returns timezone name",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "UTC", "%Z", timezone: "UTC")

# --- beginOf* normalization methods ---

tc("beginOfHour zeroes minutes and seconds",
   "beginOfHour",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 15, hour: 14, minute: 0, second: 0 })

tc("midnight zeroes hours, minutes, seconds",
   "midnight",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 15, hour: 0, minute: 0, second: 0 })

tc("beginOfWeek with startMonday=true",
   "beginOfWeek",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 12, hour: 0, minute: 0, second: 0 })

tc("beginOfMonth zeroes to first day",
   "beginOfMonth",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 0 })

tc("beginOfYear zeroes to January 1",
   "beginOfYear",
   { year: 2026, month: 6, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 0 })

# --- Timezone normalization ---

tc("beginOfWeek in timezone America/Sao_Paulo",
   "beginOfWeek",
   { year: 2026, month: 1, day: 12, hour: 14, minute: 30, second: 0 },
   { year: 2026, month: 1, day: 12, hour: 0, minute: 0, second: 0 },
   timezone: "America/Sao_Paulo")

tc("beginOfMonth in timezone America/Sao_Paulo",
   "beginOfMonth",
   { year: 2026, month: 3, day: 20, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 3, day: 1, hour: 0, minute: 0, second: 0 },
   timezone: "America/Sao_Paulo")

# --- Accessors ---

tc("wday returns day of week (0=Sunday)",
   "wday",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   4)

tc("hour returns local hour",
   "hour",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   14)

tc("day returns day of month",
   "day",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   15)

tc("month returns month number",
   "month",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   1)

tc("year returns year",
   "year",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   2026)

# --- to_a ---

tc("to_a returns [year, month, day, hour, minute, second, wday]",
   "to_a",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   [2026, 1, 15, 14, 30, 45, 4])

# --- compareTo ---

tc("compareTo equal times returns 0",
   "compareTo",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   0,
   { compareWith: { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 } })

tc("compareTo less than returns -1",
   "compareTo",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   -1,
   { compareWith: { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 46 } })

tc("compareTo greater than returns 1",
   "compareTo",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   1,
   { compareWith: { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 44 } })

# --- collectIntervals ---

tc("collectIntervals returns empty for no intervals",
   "collectIntervals",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   [])

tc("collectIntervals with single interval",
   "collectIntervals",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   [{ start: "2026-01-15-14:30:45", end: "2026-01-15-15:30:45" }])

tc("collectIntervals with multiple intervals",
   "collectIntervals",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   [
     { start: "2026-01-15-14:30:45", end: "2026-01-15-15:30:45" },
     { start: "2026-01-15-16:00:00", end: "2026-01-15-17:00:00" },
   ])

tc("sameTimeNextYear leap year to leap year",
   "sameTimeNextYear",
   { year: 2024, month: 3, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2025, month: 3, day: 15, hour: 14, minute: 30, second: 45 })

tc("sameTimeNextYear February 28 non-leap",
   "sameTimeNextYear",
   { year: 2025, month: 2, day: 28, hour: 12, minute: 0, second: 0 },
   { year: 2026, month: 2, day: 28, hour: 12, minute: 0, second: 0 })

tc("sameTimeNextDay March 31 to April 1",
   "sameTimeNextDay",
   { year: 2026, month: 3, day: 31, hour: 12, minute: 0, second: 0 },
   { year: 2026, month: 4, day: 1, hour: 12, minute: 0, second: 0 })

tc("sameTimeNextDay February 28 non-leap",
   "sameTimeNextDay",
   { year: 2025, month: 2, day: 28, hour: 10, minute: 0, second: 0 },
   { year: 2025, month: 3, day: 1, hour: 10, minute: 0, second: 0 })

tc("sameTimeNextWeek mid-year",
   "sameTimeNextWeek",
   { year: 2026, month: 6, day: 15, hour: 8, minute: 30, second: 0 },
   { year: 2026, month: 6, day: 22, hour: 8, minute: 30, second: 0 })

tc("sameTimeNextMonth March 31 to April 30",
   "sameTimeNextMonth",
   { year: 2026, month: 3, day: 31, hour: 14, minute: 0, second: 0 },
   { year: 2026, month: 4, day: 30, hour: 14, minute: 0, second: 0 })

tc("sameTimeNextMonth May 31 to June 30",
   "sameTimeNextMonth",
   { year: 2026, month: 5, day: 31, hour: 10, minute: 0, second: 0 },
   { year: 2026, month: 6, day: 30, hour: 10, minute: 0, second: 0 })

tc("sameTimeNextMonth December 31 to January 31",
   "sameTimeNextMonth",
   { year: 2026, month: 12, day: 31, hour: 14, minute: 0, second: 0 },
   { year: 2027, month: 1, day: 31, hour: 14, minute: 0, second: 0 })

tc("sameTimeNextQuarter Q2 to Q3",
   "sameTimeNextQuarter",
   { year: 2026, month: 5, day: 15, hour: 14, minute: 30, second: 0 },
   { year: 2026, month: 8, day: 15, hour: 14, minute: 30, second: 0 })

tc("sameTimeNextQuarter Q4 to next year Q1",
   "sameTimeNextQuarter",
   { year: 2026, month: 11, day: 15, hour: 14, minute: 30, second: 0 },
   { year: 2027, month: 2, day: 15, hour: 14, minute: 30, second: 0 })

# --- strftime (extended) ---

tc("strftime %y returns 2-digit year",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "26", "%y")

tc("strftime %j returns day of year",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "015", "%j")

tc("strftime %W returns week number",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "02", "%W")

tc("strftime %p returns AM/PM",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "PM", "%p")

tc("strftime %I returns 12-hour hour",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "02", "%I")

tc("strftime %x returns date format",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "01/15/26", "%x")

tc("strftime %X returns time format",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "14:30:45", "%X")

tc("strftime %% returns literal %",
   "strftime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "%", "%%")

# --- to_s ---

tc("to_s returns default format",
   "to_s",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "2026-01-15 14:30:45 +0000")

tc("to_s with timezone offset",
   "to_s",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   "2026-01-15 14:30:45 +0000", timezone: "UTC")

# --- secondsOfDay ---

tc("secondsOfDay returns seconds since midnight",
   "secondsOfDay",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   52245)

tc("secondsOfDay at midnight",
   "secondsOfDay",
   { year: 2026, month: 1, day: 15, hour: 0, minute: 0, second: 0 },
   0)

tc("secondsOfDay at end of day",
   "secondsOfDay",
   { year: 2026, month: 1, day: 15, hour: 23, minute: 59, second: 59 },
   86399)

# --- lastDayOfMonth ---

tc("lastDayOfMonth January",
   "lastDayOfMonth",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   31)

tc("lastDayOfMonth February non-leap",
   "lastDayOfMonth",
   { year: 2025, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
   28)

tc("lastDayOfMonth February leap",
   "lastDayOfMonth",
   { year: 2024, month: 2, day: 15, hour: 14, minute: 30, second: 45 },
   29)

tc("lastDayOfMonth April",
   "lastDayOfMonth",
   { year: 2026, month: 4, day: 15, hour: 14, minute: 30, second: 45 },
   30)

# --- utc/localtime/gmtime ---

tc("utc returns UTC time",
   "utc",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 })

tc("localtime returns local time",
   "localtime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 })

tc("gmtime returns UTC time",
   "gmtime",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 })

# --- compareTo edge cases ---

tc("compareTo same time returns 0",
   "compareTo",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   0,
   { compareWith: { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 } })

tc("compareTo one second less returns -1",
   "compareTo",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   -1,
   { compareWith: { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 46 } })

tc("compareTo one second greater returns 1",
   "compareTo",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   1,
   { compareWith: { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 44 } })

tc("compareTo different months",
   "compareTo",
   { year: 2026, month: 2, day: 1, hour: 0, minute: 0, second: 0 },
   1,
   { compareWith: { year: 2026, month: 1, day: 31, hour: 23, minute: 59, second: 59 } })

# --- beginOf* edge cases ---

tc("beginOfWeek Sunday start",
   "beginOfWeek",
   { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 11, hour: 0, minute: 0, second: 0 })

tc("beginOfQuarter zeroes to first day of quarter",
   "beginOfQuarter",
   { year: 2026, month: 3, day: 15, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 0 })

# --- Timezone edge cases ---

tc("beginOfWeek in timezone Europe/London",
   "beginOfWeek",
   { year: 2026, month: 1, day: 12, hour: 14, minute: 30, second: 0 },
   { year: 2026, month: 1, day: 12, hour: 0, minute: 0, second: 0 },
   timezone: "Europe/London")

tc("beginOfMonth in timezone Asia/Tokyo",
   "beginOfMonth",
   { year: 2026, month: 3, day: 20, hour: 14, minute: 30, second: 45 },
   { year: 2026, month: 3, day: 1, hour: 0, minute: 0, second: 0 },
   timezone: "Asia/Tokyo")

# Generate the JSON output
output = {
  version: "1.0",
  description: "Golden test cases for TjTime compatibility (Cat. B bugs)",
  generated_at: Time.now.utc.to_s,
  cases: $golden_cases,
}

puts JSON.pretty_generate(output)