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

# dailymax: value=3, increment 3 times at idx 0, then ok?(0,true) false; dec then true
# NOTE: setLimit returns the @limits array, so use .last to get the newly created limit.
l = limits.setLimit('dailymax', 3).last
3.times { limits.inc(0) }
tc("limit dailymax after 3 inc ok?(0,true) false", "ok?", { name: 'dailymax', index: 0, upper: true }, l.ok?(0, true, nil))
tc("limit dailymax after 3 inc ok?(0,false) true", "ok?", { name: 'dailymax', index: 0, upper: false }, l.ok?(0, false, nil))
limits.dec(0)
tc("limit dailymax after dec ok?(0,true) true", "ok?", { name: 'dailymax', index: 0, upper: true }, l.ok?(0, true, nil))
tc("limit dailymax after dec ok?(1,true) true (empty)", "ok?", { name: 'dailymax', index: 1, upper: true }, l.ok?(1, true, nil))

# dailymin: value=2, no inc, ok?(0,false) false; inc twice then true
l = limits.setLimit('dailymin', 2).last
tc("limit dailymin no inc ok?(0,false) false", "ok?", { name: 'dailymin', index: 0, upper: false }, l.ok?(0, false, nil))
tc("limit dailymin no inc ok?(0,true) true", "ok?", { name: 'dailymin', index: 0, upper: true }, l.ok?(0, true, nil))
2.times { limits.inc(0) }
tc("limit dailymin after 2 inc ok?(0,false) true", "ok?", { name: 'dailymin', index: 0, upper: false }, l.ok?(0, false, nil))

# weeklymax: value=2, inc 3 times at idx 0, ok false
l = limits.setLimit('weeklymax', 2).last
3.times { limits.inc(0) }
tc("limit weeklymax after 3 inc ok?(0,true) false", "ok?", { name: 'weeklymax', index: 0, upper: true }, l.ok?(0, true, nil))
tc("limit weeklymax ok?(24,true) true (new day same week)", "ok?", { name: 'weeklymax', index: 24, upper: true }, l.ok?(24, true, nil))

# weeklymin: value=2, no inc, ok false
l = limits.setLimit('weeklymin', 2).last
tc("limit weeklymin no inc ok?(0,false) false", "ok?", { name: 'weeklymin', index: 0, upper: false }, l.ok?(0, false, nil))

# monthlymax: value=2, inc 3 times at idx 0, ok false
l = limits.setLimit('monthlymax', 2).last
3.times { limits.inc(0) }
tc("limit monthlymax after 3 inc ok?(0,true) false", "ok?", { name: 'monthlymax', index: 0, upper: true }, l.ok?(0, true, nil))

# monthlymin: value=2, no inc, ok false
l = limits.setLimit('monthlymin', 2).last
tc("limit monthlymin no inc ok?(0,false) false", "ok?", { name: 'monthlymin', index: 0, upper: false }, l.ok?(0, false, nil))

# maximum: value=3600 (1h), inc 2 times at idx 0, ok true; inc once more false
l = limits.setLimit('maximum', 3600).last
2.times { limits.inc(0) }
tc("limit maximum after 2 inc ok?(0,true) true", "ok?", { name: 'maximum', index: 0, upper: true }, l.ok?(0, true, nil))
limits.inc(0)
tc("limit maximum after 3 inc ok?(0,true) false", "ok?", { name: 'maximum', index: 0, upper: true }, l.ok?(0, true, nil))

# minimum: value=3600, no inc, ok false; inc once true
l = limits.setLimit('minimum', 3600).last
tc("limit minimum no inc ok?(0,false) false", "ok?", { name: 'minimum', index: 0, upper: false }, l.ok?(0, false, nil))
limits.inc(0)
tc("limit minimum after 1 inc ok?(0,false) true", "ok?", { name: 'minimum', index: 0, upper: false }, l.ok?(0, false, nil))

# ok?(null, true, nil) checks all slots
l = limits.setLimit('dailymax', 1).last
limits.inc(0)
tc("limit dailymax after 1 inc ok?(null,true) false", "ok?", { name: 'dailymax', index: nil, upper: true }, l.ok?(nil, true, nil))

# reset
l = limits.setLimit('dailymax', 1).last
limits.inc(0)
l.reset(0)
tc("limit dailymax after reset ok?(0,true) true", "ok?", { name: 'dailymax', index: 0, upper: true }, l.ok?(0, true, nil))

output = {
  version: "1.0",
  description: "Golden test cases for Limits compatibility (Phase 6)",
  generated_at: Time.now.utc.to_s,
  cases: $golden_cases,
}

puts JSON.pretty_generate(output)