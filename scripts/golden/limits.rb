#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "date"
require "taskjuggler/Project"
require "taskjuggler/Limits"
require "taskjuggler/TjTime"

$golden_cases = []

def tc(desc, method, input, expected, *args)
  h = { description: desc, method: method, input: input, expected: expected }
  if args.last.is_a?(Hash)
    opts = args.last
    h[:mode] = opts[:mode] if opts[:mode]
    h[:inherit] = opts[:inherit] if opts[:inherit]
  end
  $golden_cases << h
end

project = TaskJuggler::Project.new('test', 'Test Project', '1.0')
project['start'] = TaskJuggler::TjTime.new(Time.parse('2026-01-01T00:00:00Z'))
project['end'] = TaskJuggler::TjTime.new(Time.parse('2026-01-08T00:00:00Z'))
project['scheduleGranularity'] = 3600

limits = TaskJuggler::Limits.new
limits.setProject(project)
project['limits'] = limits

def make_checks(limit, name, checks)
  checks.each do |c|
    tc("limit #{name} #{c[:desc]}", "ok?", { name: name, index: c[:idx], upper: c[:upper] }, c[:expected])
  end
end

# dailymax: value=3, increment 3 times at idx 0, then ok?(0,true) false; dec then true
l = limits.setLimit('dailymax', 3)[0]
3.times { limits.inc(0) }
make_checks(l, 'dailymax', [
  { desc: 'after 3 inc ok?(0,true) false', idx: 0, upper: true, expected: false },
  { desc: 'after 3 inc ok?(0,false) true', idx: 0, upper: false, expected: true },
])
limits.dec(0)
make_checks(l, 'dailymax', [
  { desc: 'after dec ok?(0,true) true', idx: 0, upper: true, expected: true },
  { desc: 'after dec ok?(1,true) true (empty)', idx: 1, upper: true, expected: true },
])

# dailymin: value=2, no inc, ok?(0,false) false; inc twice then true
l = limits.setLimit('dailymin', 2)[0]
make_checks(l, 'dailymin', [
  { desc: 'no inc ok?(0,false) false', idx: 0, upper: false, expected: false },
  { desc: 'no inc ok?(0,true) true', idx: 0, upper: true, expected: true },
])
2.times { limits.inc(0) }
make_checks(l, 'dailymin', [
  { desc: 'after 2 inc ok?(0,false) true', idx: 0, upper: false, expected: true },
])

# weeklymax: value=2, inc 3 times at idx 0, ok false
l = limits.setLimit('weeklymax', 2)[0]
3.times { limits.inc(0) }
make_checks(l, 'weeklymax', [
  { desc: 'after 3 inc ok?(0,true) false', idx: 0, upper: true, expected: false },
  { desc: 'ok?(24,true) true (new day same week)', idx: 24, upper: true, expected: true },
])

# weeklymin: value=2, no inc, ok false
l = limits.setLimit('weeklymin', 2)[0]
make_checks(l, 'weeklymin', [
  { desc: 'no inc ok?(0,false) false', idx: 0, upper: false, expected: false },
])

# monthlymax: value=2, inc 3 times at idx 0, ok false
l = limits.setLimit('monthlymax', 2)[0]
3.times { limits.inc(0) }
make_checks(l, 'monthlymax', [
  { desc: 'after 3 inc ok?(0,true) false', idx: 0, upper: true, expected: false },
])

# monthlymin: value=2, no inc, ok false
l = limits.setLimit('monthlymin', 2)[0]
make_checks(l, 'monthlymin', [
  { desc: 'no inc ok?(0,false) false', idx: 0, upper: false, expected: false },
])

# maximum: value=3600 (1h), inc 2 times at idx 0, ok true; inc once more false
l = limits.setLimit('maximum', 3600)[0]
2.times { limits.inc(0) }
make_checks(l, 'maximum', [
  { desc: 'after 2 inc ok?(0,true) true', idx: 0, upper: true, expected: true },
])
limits.inc(0)
make_checks(l, 'maximum', [
  { desc: 'after 3 inc ok?(0,true) false', idx: 0, upper: true, expected: false },
])

# minimum: value=3600, no inc, ok false; inc once true
l = limits.setLimit('minimum', 3600)[0]
make_checks(l, 'minimum', [
  { desc: 'no inc ok?(0,false) false', idx: 0, upper: false, expected: false },
])
limits.inc(0)
make_checks(l, 'minimum', [
  { desc: 'after 1 inc ok?(0,false) true', idx: 0, upper: false, expected: true },
])

# ok?(null, true, nil) checks all slots
l = limits.setLimit('dailymax', 1)[0]
limits.inc(0)
make_checks(l, 'dailymax', [
  { desc: 'after 1 inc ok?(null,true) false', idx: nil, upper: true, expected: false },
])

# reset
l = limits.setLimit('dailymax', 1)[0]
limits.inc(0)
l.reset(0)
make_checks(l, 'dailymax', [
  { desc: 'after reset ok?(0,true) true', idx: 0, upper: true, expected: true },
])

output = {
  version: "1.0",
  description: "Golden test cases for Limits compatibility (Phase 6)",
  generated_at: Time.now.utc.to_s,
  cases: $golden_cases,
}

puts JSON.pretty_generate(output)