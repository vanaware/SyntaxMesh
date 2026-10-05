#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "date"
require "taskjuggler/Project"
require "taskjuggler/Shift"
require "taskjuggler/WorkingHours"
require "taskjuggler/ShiftAssignments"
require "taskjuggler/Interval"
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

# Create a shift with working hours Monday 9-17
shift = TaskJuggler::Shift.new(project, 'shift1', 'Shift 1', nil)
wh = TaskJuggler::WorkingHours.new(3600, project['start'], project['end'])
wh.setWorkingHours(1, [[9 * 3600, 17 * 3600]])
shift['workinghours', 0] = wh

# Create ShiftAssignments with 2 assignments
assignments = TaskJuggler::ShiftAssignments.new
assignments.project = project

# Assignment 1: Monday 9-17 (index 9)
interval1 = TaskJuggler::Interval.new(
  TaskJuggler::TjTime.new(Time.parse('2026-01-05T09:00:00Z')),
  TaskJuggler::TjTime.new(Time.parse('2026-01-05T17:00:00Z'))
)
assignments.addAssignment(TaskJuggler::ShiftAssignment.new(
  shift.scenario(0), interval1
))

# Assignment 2: Tuesday 10-18 (index 10)
interval2 = TaskJuggler::Interval.new(
  TaskJuggler::TjTime.new(Time.parse('2026-01-06T10:00:00Z')),
  TaskJuggler::TjTime.new(Time.parse('2026-01-06T18:00:00Z'))
)
assignments.addAssignment(TaskJuggler::ShiftAssignment.new(
  shift.scenario(0), interval2
))

# Test getSbSlot for various indices.
# Values are recorded from the actual implementation, not hard-coded.

# Test getSbSlot for index 9 (Monday 9:00)
actual = assignments.getSbSlot(9)
tc("ShiftAssignments getSbSlot index 9 (Mon 9:00)", "getSbSlot", { index: 9 }, actual)

# Test getSbSlot for index 12 (Monday 12:00)
actual = assignments.getSbSlot(12)
tc("ShiftAssignments getSbSlot index 12 (Mon 12:00)", "getSbSlot", { index: 12 }, actual)

# Test getSbSlot for index 20 (Monday 20:00)
actual = assignments.getSbSlot(20)
tc("ShiftAssignments getSbSlot index 20 (Mon 20:00)", "getSbSlot", { index: 20 }, actual)

# Test getSbSlot for index 10 (Tuesday 10:00)
actual = assignments.getSbSlot(10)
tc("ShiftAssignments getSbSlot index 10 (Tue 10:00)", "getSbSlot", { index: 10 }, actual)

# Test getSbSlot for index 0 (Sunday midnight)
actual = assignments.getSbSlot(0)
tc("ShiftAssignments getSbSlot index 0 (Sun 00:00)", "getSbSlot", { index: 0 }, actual)

# Test assigned? method
# index 9 - assigned
actual = assignments.assigned?(9)
tc("ShiftAssignments assigned? index 9 (Mon 9:00)", "assigned?", { index: 9 }, actual)
# index 20 - not assigned
actual = assignments.assigned?(20)
tc("ShiftAssignments assigned? index 20 (Mon 20:00)", "assigned?", { index: 20 }, actual)

# Test onShift? method
# index 9 - onShift
actual = assignments.onShift?(9)
tc("ShiftAssignments onShift? index 9 (Mon 9:00)", "onShift?", { index: 9 }, actual)
# index 20 - not onShift
actual = assignments.onShift?(20)
tc("ShiftAssignments onShift? index 20 (Mon 20:00)", "onShift?", { index: 20 }, actual)

# Test timeOff? method
# index 9 - not timeOff
actual = assignments.timeOff?(9)
tc("ShiftAssignments timeOff? index 9 (Mon 9:00)", "timeOff?", { index: 9 }, actual)
# index 20 - timeOff
actual = assignments.timeOff?(20)
tc("ShiftAssignments timeOff? index 20 (Mon 20:00)", "timeOff?", { index: 20 }, actual)

# Test onLeave? method
# index 9 - not onLeave
actual = assignments.onLeave?(9)
tc("ShiftAssignments onLeave? index 9 (Mon 9:00)", "onLeave?", { index: 9 }, actual)
# index 20 - not onLeave
actual = assignments.onLeave?(20)
tc("ShiftAssignments onLeave? index 20 (Mon 20:00)", "onLeave?", { index: 20 }, actual)

# Test hashKey for identical instances
assignments2 = TaskJuggler::ShiftAssignments.new
assignments2.project = project
assignments2.addAssignment(TaskJuggler::ShiftAssignment.new(
  shift.scenario(0), interval1
))
assignments2.addAssignment(TaskJuggler::ShiftAssignment.new(
  shift.scenario(0), interval2
))

actual = assignments.hashKey == assignments2.hashKey
tc("ShiftAssignments hashKey identical instances", "hashKey", { assignments: assignments }, actual)

# Test hashKey for different instances
assignments3 = TaskJuggler::ShiftAssignments.new
assignments3.project = project
assignments3.addAssignment(TaskJuggler::ShiftAssignment.new(
  shift.scenario(0), interval1
))

actual = assignments.hashKey == assignments3.hashKey
tc("ShiftAssignments hashKey different instances", "hashKey", { assignments: assignments3 }, actual)

output = {
  version: "1.0",
  description: "Golden test cases for ShiftAssignments compatibility (Phase 6)",
  generated_at: Time.now.utc.to_s,
  cases: $golden_cases,
}

puts JSON.pretty_generate(output)
