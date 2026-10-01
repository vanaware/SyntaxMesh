#!/usr/bin/env ruby -w
# frozen_string_literal: true
# encoding: UTF-8

lib_path = File.expand_path("./docs/taskjuggler/lib", __dir__)
$LOAD_PATH.unshift(lib_path)

require 'taskjuggler/PropertySet'
require 'taskjuggler/PropertyTreeNode'
require 'taskjuggler/AttributeDefinition'
require 'taskjuggler/AttributeBase'
require 'taskjuggler/Attributes'
require 'taskjuggler/MessageHandler'

TaskJuggler::MessageHandlerInstance.instance.trapSetup = true

class MockProject
  attr_reader :scenarioCount, :flatNamespace
  def initialize(scenarioCount = 1, flatNamespace = false)
    @scenarioCount = scenarioCount
    @flatNamespace = flatNamespace
    @store = {}
    @scenarios = []
    for i in 0..(scenarioCount - 1)
      @scenarios << { id: i == 0 ? "plan" : "scenario#{i}", fullId: i == 0 ? "plan" : "scenario#{i}" }
    end
  end
  def get(name); @store[name]; end
  def set(name, value); @store[name] = value; end
  def scenario(idx); return nil if idx < 0 || idx >= @scenarios.length; ScenarioWrapper.new(self, @scenarios[idx]); end
  def scenarioIdx(sc); @scenarios.each_index { |i| return i if @scenarios[i][:id] == sc || @scenarios[i][:fullId] == sc }; nil; end
  def addScenario(scenario); @scenarios << scenario; @scenarioCount = @scenarios.length; end
end

class ScenarioWrapper
  def initialize(project, scenario_data); @project = project; end
  def all; []; end
  def get(name); @project.get(name); end
  def set(name, value); @project.set(name, value); end
end

class TestProperty < TaskJuggler::PropertyTreeNode; end

def createPropertySet(scenarioCount = 1, flatNamespace = false)
  TaskJuggler::PropertySet.new(MockProject.new(scenarioCount, flatNamespace), flatNamespace)
end

# --- Structure tests ---
ps = createPropertySet(1, false)
root = TestProperty.new(ps, "root", "Root", nil)
child = TestProperty.new(ps, "child", "Child", root)
gc = TestProperty.new(ps, "gc", "Grandchild", child)

puts "=== Structure ==="
puts "root.level=#{root.level} (golden expects 1)"
puts "child.level=#{child.level} (golden expects 2)"
puts "gc.level=#{gc.level} (golden expects 3)"

puts "\nroot.isChildOf?(child)=#{root.isChildOf?(child)} (golden expects true for 'isChildOf raiz -> filho')"
puts "child.isChildOf?(root)=#{child.isChildOf?(root)} (golden expects false for 'isChildOf filho -> raiz')"
puts "gc.isChildOf?(child)=#{gc.isChildOf?(child)} (golden expects true for 'isChildOf neto -> filho')"
puts "gc.isChildOf?(root)=#{gc.isChildOf?(root)} (golden expects false for 'isChildOf neto -> raiz')"

puts "\nroot.kids=#{root.kids.map { |k| k.fullId }.inspect} (golden expects ['root.child', 'root.child.gc'])"
puts "child.kids=#{child.kids.map { |k| k.fullId }.inspect} (golden expects ['root.child.gc'])"
puts "gc.kids=#{gc.kids.map { |k| k.fullId }.inspect} (golden expects [])"

puts "\nroot.parents=#{root.parents.map { |p| p.fullId }.inspect} (golden expects [])"
puts "child.parents=#{child.parents.map { |p| p.fullId }.inspect} (golden expects ['root'])"
puts "gc.parents=#{gc.parents.map { |p| p.fullId }.inspect} (golden expects ['root', 'root.child'])"

puts "\nroot.ancestors=#{root.ancestors.map { |a| a.fullId }.inspect} (golden expects [])"
puts "child.ancestors=#{child.ancestors.map { |a| a.fullId }.inspect} (golden expects ['root'])"
puts "gc.ancestors=#{gc.ancestors.map { |a| a.fullId }.inspect} (golden expects ['root', 'root.child'])"

puts "\nroot.all=#{root.all.map { |n| n.fullId }.inspect} (golden expects ['root', 'root.child', 'root.child.gc'])"
puts "root.allLeaves(false)=#{root.allLeaves(false).map { |n| n.fullId }.inspect} (golden expects ['root.child.gc'])"
puts "root.allLeaves(true)=#{root.allLeaves(true).map { |n| n.fullId }.inspect} (golden expects [])"

puts "\nroot.leaf?=#{root.leaf?} (golden expects false)"
puts "child.leaf?=#{child.leaf?} (golden expects false)"
puts "gc.leaf?=#{gc.leaf?} (golden expects true)"

puts "\nroot.container?=#{root.container?} (golden expects true)"
puts "child.container?=#{child.container?} (golden expects true)"
puts "gc.container?=#{gc.container?} (golden expects false)"

puts "\nroot.root.fullId=#{root.root.fullId} (golden expects 'root')"
puts "child.root.fullId=#{child.root.fullId} (golden expects 'root')"
puts "gc.root.fullId=#{gc.root.fullId} (golden expects 'root')"

# --- Inheritance tests ---
ps2 = createPropertySet(1, false)
ps2.addAttributeType(TaskJuggler::AttributeDefinition.new("priority", "Priority", TaskJuggler::IntegerAttribute, false, false, false, 500))
root2 = TestProperty.new(ps2, "root2", "Root 2", nil)
child2 = TestProperty.new(ps2, "child2", "Child 2", root2)
gc2 = TestProperty.new(ps2, "gc2", "Grandchild 2", child2)
root2.set("priority", 100)
child2.set("priority", 200)

puts "\n=== Inheritance ==="
puts "root2.get('priority')=#{root2.get('priority')} (golden expects 100)"
puts "child2.get('priority')=#{child2.get('priority')} (golden expects 200)"
puts "gc2.get('priority')=#{gc2.get('priority')} (golden expects 200)"

# Need to call inheritAttributes to propagate values
root2.inheritAttributes
child2.inheritAttributes
gc2.inheritAttributes

puts "\nAfter inheritAttributes:"
puts "root2.get('priority')=#{root2.get('priority')} (golden expects 100)"
puts "child2.get('priority')=#{child2.get('priority')} (golden expects 200)"
puts "gc2.get('priority')=#{gc2.get('priority')} (golden expects 200)"

puts "\nroot2.provided?('priority')=#{root2.provided?('priority')} (golden expects true)"
puts "child2.provided?('priority')=#{child2.provided?('priority')} (golden expects true)"
puts "gc2.provided?('priority')=#{gc2.provided?('priority')} (golden expects false)"

puts "\nroot2.inherited?('priority')=#{root2.inherited?('priority')} (golden expects false)"
puts "child2.inherited?('priority')=#{child2.inherited?('priority')} (golden expects false)"
puts "gc2.inherited?('priority')=#{gc2.inherited?('priority')} (golden expects true)"

puts "\nroot2.modified?('priority')=#{root2.modified?('priority')} (golden expects true)"
puts "child2.modified?('priority')=#{child2.modified?('priority')} (golden expects true)"
puts "gc2.modified?('priority')=#{gc2.modified?('priority')} (golden expects true)"

# --- Adoption tests ---
ps4 = createPropertySet(1, false)
root4 = TestProperty.new(ps4, "root4", "Root 4", nil)
root5 = TestProperty.new(ps4, "root5", "Root 5", nil)
task = TestProperty.new(ps4, "task", "Task", root4)
root5.adopt(task)

puts "\n=== Adoption ==="
puts "task.stepParents=#{task.stepParents.map { |p| p.fullId }.inspect} (golden expects ['root5'])"
puts "root4.adoptees=#{root4.adoptees.map { |a| a.fullId }.inspect} (golden expects ['task'])"
puts "root4.kids=#{root4.kids.map { |k| k.fullId }.inspect} (golden expects ['task'])"
puts "task.leaf?=#{task.leaf?} (golden expects false)"

# --- Backup/restore tests ---
ps5 = createPropertySet(1, false)
ps5.addAttributeType(TaskJuggler::AttributeDefinition.new("status", "Status", TaskJuggler::StringAttribute, false, false, false, "active"))
root6 = TestProperty.new(ps5, "root6", "Root 6", nil)
root6.set("status", "in_progress")
backup = root6.backupAttributes
ps5.addAttributeType(TaskJuggler::AttributeDefinition.new("priority", "Priority", TaskJuggler::IntegerAttribute, false, false, false, 500))
root6.set("priority", 100)

puts "\n=== Backup/restore ==="
puts "root6.get('status')=#{root6.get('status')} (golden expects 'in_progress')"
puts "root6.get('priority')=#{root6.get('priority')} (golden expects 100)"
root6.restoreAttributes(backup)
puts "After restore: root6.get('status')=#{root6.get('status')} (golden expects 'in_progress')"
puts "After restore: root6.get('priority')=#{root6.get('priority')} (golden expects 500)"

backup[0]["status"].set("modified")
puts "After backup mutation: root6.get('status')=#{root6.get('status')} (golden expects 'modified')"

# --- Flat namespace tests ---
ps6 = createPropertySet(1, true)
root7 = TestProperty.new(ps6, "root7", "Root 7", nil)
child7 = TestProperty.new(ps6, "child7", "Child 7", root7)

puts "\n=== Flat namespace ==="
puts "root7.fullId=#{root7.fullId} (golden expects 'root')"
puts "child7.fullId=#{child7.fullId} (golden expects 'child')"
puts "root7.level=#{root7.level} (golden expects 1)"
puts "child7.level=#{child7.level} (golden expects 2)"
puts "root7.getBSIndicies=#{root7.getBSIndicies.inspect} (golden expects [1])"
puts "child7.getBSIndicies=#{child7.getBSIndicies.inspect} (golden expects [2])"