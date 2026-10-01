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
puts "root.level=#{root.level} child.level=#{child.level} gc.level=#{gc.level}"
puts "root.fullId=#{root.fullId} child.fullId=#{child.fullId} gc.fullId=#{gc.fullId}"
puts "root.isChildOf?(child)=#{root.isChildOf?(child)}"
puts "child.isChildOf?(root)=#{child.isChildOf?(root)}"
puts "gc.isChildOf?(child)=#{gc.isChildOf?(child)}"
puts "gc.isChildOf?(root)=#{gc.isChildOf?(root)}"
puts "root.kids=#{root.kids.map { |k| k.fullId }.inspect}"
puts "child.kids=#{child.kids.map { |k| k.fullId }.inspect}"
puts "gc.kids=#{gc.kids.map { |k| k.fullId }.inspect}"
puts "root.parents=#{root.parents.map { |p| p.fullId }.inspect}"
puts "child.parents=#{child.parents.map { |p| p.fullId }.inspect}"
puts "gc.parents=#{gc.parents.map { |p| p.fullId }.inspect}"
puts "root.ancestors=#{root.ancestors.map { |a| a.fullId }.inspect}"
puts "child.ancestors=#{child.ancestors.map { |a| a.fullId }.inspect}"
puts "gc.ancestors=#{gc.ancestors.map { |a| a.fullId }.inspect}"
puts "root.all=#{root.all.map { |n| n.fullId }.inspect}"
puts "root.allLeaves(false)=#{root.allLeaves(false).map { |n| n.fullId }.inspect}"
puts "root.allLeaves(true)=#{root.allLeaves(true).map { |n| n.fullId }.inspect}"
puts "root.leaf?=#{root.leaf?} child.leaf?=#{child.leaf?} gc.leaf?=#{gc.leaf?}"
puts "root.container?=#{root.container?} child.container?=#{child.container?} gc.container?=#{gc.container?}"
puts "root.root.fullId=#{root.root.fullId}"
puts "child.root.fullId=#{child.root.fullId}"
puts "gc.root.fullId=#{gc.root.fullId}"

# --- Inheritance tests ---
ps2 = createPropertySet(1, false)
ps2.addAttributeType(TaskJuggler::AttributeDefinition.new("priority", "Priority", TaskJuggler::IntegerAttribute, false, false, false, 500))
root2 = TestProperty.new(ps2, "root2", "Root 2", nil)
child2 = TestProperty.new(ps2, "child2", "Child 2", root2)
gc2 = TestProperty.new(ps2, "gc2", "Grandchild 2", child2)
root2.set("priority", 100)
child2.set("priority", 200)

puts "\n=== Inheritance ==="
puts "root2.get('priority')=#{root2.get('priority')}"
puts "child2.get('priority')=#{child2.get('priority')}"
puts "gc2.get('priority')=#{gc2.get('priority')}"
puts "root2.provided?('priority')=#{root2.provided?('priority')}"
puts "child2.provided?('priority')=#{child2.provided?('priority')}"
puts "gc2.provided?('priority')=#{gc2.provided?('priority')}"
puts "root2.inherited?('priority')=#{root2.inherited?('priority')}"
puts "child2.inherited?('priority')=#{child2.inherited?('priority')}"
puts "gc2.inherited?('priority')=#{gc2.inherited?('priority')}"
puts "root2.modified?('priority')=#{root2.modified?('priority')}"
puts "child2.modified?('priority')=#{child2.modified?('priority')}"
puts "gc2.modified?('priority')=#{gc2.modified?('priority')}"

# --- Scenario tests ---
ps3 = createPropertySet(2, false)
ps3.addAttributeType(TaskJuggler::AttributeDefinition.new("effort", "Effort", TaskJuggler::DurationAttribute, false, false, true, 0))
root3 = TestProperty.new(ps3, "root3", "Root 3", nil)
root3["effort", 0] = 3600
root3["effort", 1] = 7200

puts "\n=== Scenario ==="
puts "root3.provided?('effort',0)=#{root3.provided?('effort',0)}"
puts "root3.provided?('effort',1)=#{root3.provided?('effort',1)}"
puts "root3.get('effort',0)=#{root3.get('effort',0)}"
puts "root3.get('effort',1)=#{root3.get('effort',1)}"

# --- Adoption tests ---
ps4 = createPropertySet(1, false)
root4 = TestProperty.new(ps4, "root4", "Root 4", nil)
root5 = TestProperty.new(ps4, "root5", "Root 5", nil)
task = TestProperty.new(ps4, "task", "Task", root4)
root5.adopt(task)

puts "\n=== Adoption ==="
puts "task.stepParents=#{task.stepParents.map { |p| p.fullId }.inspect}"
puts "root4.adoptees=#{root4.adoptees.map { |a| a.fullId }.inspect}"
puts "root4.kids=#{root4.kids.map { |k| k.fullId }.inspect}"
puts "task.leaf?=#{task.leaf?}"

begin
  root5.adopt(task)
  puts "Duplicate adopt: NO ERROR (unexpected)"
rescue => e
  puts "Duplicate adopt: ERROR=#{e.class}: #{e.message}"
end

begin
  task.adopt(task)
  puts "Self adopt: NO ERROR (unexpected)"
rescue => e
  puts "Self adopt: ERROR=#{e.class}: #{e.message}"
end

# --- Backup/restore tests ---
ps5 = createPropertySet(1, false)
ps5.addAttributeType(TaskJuggler::AttributeDefinition.new("status", "Status", TaskJuggler::StringAttribute, false, false, false, "active"))
root6 = TestProperty.new(ps5, "root6", "Root 6", nil)
root6.set("status", "in_progress")
backup = root6.backupAttributes
ps5.addAttributeType(TaskJuggler::AttributeDefinition.new("priority", "Priority", TaskJuggler::IntegerAttribute, false, false, false, 500))
root6.set("priority", 100)

puts "\n=== Backup/restore ==="
puts "root6.get('status')=#{root6.get('status')}"
puts "root6.get('priority')=#{root6.get('priority')}"
root6.restoreAttributes(backup)
puts "After restore: root6.get('status')=#{root6.get('status')}"
puts "After restore: root6.get('priority')=#{root6.get('priority')}"

backup[0]["status"].set("modified")
puts "After backup mutation: root6.get('status')=#{root6.get('status')}"

# --- Flat namespace tests ---
ps6 = createPropertySet(1, true)
root7 = TestProperty.new(ps6, "root7", "Root 7", nil)
child7 = TestProperty.new(ps6, "child7", "Child 7", root7)

puts "\n=== Flat namespace ==="
puts "root7.fullId=#{root7.fullId} child7.fullId=#{child7.fullId}"
puts "root7.level=#{root7.level} child7.level=#{child7.level}"
puts "root7.getBSIndicies=#{root7.getBSIndicies.inspect}"
puts "child7.getBSIndicies=#{child7.getBSIndicies.inspect}"