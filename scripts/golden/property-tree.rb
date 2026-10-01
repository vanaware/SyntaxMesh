#!/usr/bin/env ruby -w
# frozen_string_literal: true
# encoding: UTF-8

require "json"

lib_path = File.expand_path("../../docs/taskjuggler/lib", __dir__)
$LOAD_PATH.unshift(lib_path)

require 'taskjuggler/PropertySet'
require 'taskjuggler/PropertyTreeNode'
require 'taskjuggler/AttributeDefinition'
require 'taskjuggler/AttributeBase'
require 'taskjuggler/Attributes'
require 'taskjuggler/MessageHandler'

TaskJuggler::MessageHandlerInstance.instance.trapSetup = true

$golden_cases = []

def tc(desc, method, type, input, expected, *args)
  h = {
    description: desc,
    method: method,
    type: type,
    input: input,
    expected: expected,
  }
  if args.last.is_a?(Hash)
    opts = args.last
    h[:mode] = opts[:mode] if opts[:mode]
    h[:inherit] = opts[:inherit] if opts[:inherit]
    h[:node] = opts[:node] if opts[:node]
    h[:target] = opts[:target] if opts[:target]
    h[:adopter] = opts[:adopter] if opts[:adopter]
    h[:attr] = opts[:attr] if opts[:attr]
  end
  $golden_cases << h
end

class ScenarioWrapper
  def initialize(project, scenario_data)
    @project = project
    @scenario_data = scenario_data
  end
  def all; []; end
  def get(name); @project.get(name); end
  def set(name, value); @project.set(name, value); end
end

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

class TestProperty < TaskJuggler::PropertyTreeNode
  def initialize(propertySet, id, name, parent)
    super(propertySet, id, name, parent)
    @data = Array.new(@project.scenarioCount, nil)
    @project.scenarioCount.times do |i|
      TaskJuggler::ScenarioData.new(self, i, @scenarioAttributes[i])
    end
  end
end

def createPropertySet(scenarioCount = 1, flatNamespace = false)
  project = MockProject.new(scenarioCount, flatNamespace)
  TaskJuggler::PropertySet.new(project, flatNamespace)
end

def fmt(node)
  node.fullId
end

def fmtList(nodes)
  nodes.map { |n| fmt(n) }
end

def testStructure
  ps = createPropertySet(1, false)
  root = TestProperty.new(ps, "root", "Root", nil)
  ps.addProperty(root)
  child = TestProperty.new(ps, "child", "Child", root)
  ps.addProperty(child)
  gc = TestProperty.new(ps, "gc", "Grandchild", child)
  ps.addProperty(gc)

  tc("fullId hierárquico - raiz", "fullId", "TestProperty", { value: nil }, fmt(root), node: "root")
  tc("fullId hierárquico - filho", "fullId", "TestProperty", { value: nil }, fmt(child), node: "child")
  tc("fullId hierárquico - neto", "fullId", "TestProperty", { value: nil }, fmt(gc), node: "gc")

  tc("level raiz", "level", "TestProperty", { value: nil }, root.level, node: "root")
  tc("level filho", "level", "TestProperty", { value: nil }, child.level, node: "child")
  tc("level neto", "level", "TestProperty", { value: nil }, gc.level, node: "gc")

  tc("getBSIndicies raiz", "getBSIndicies", "TestProperty", { value: nil }, root.getBSIndicies, node: "root")
  tc("getBSIndicies filho", "getBSIndicies", "TestProperty", { value: nil }, child.getBSIndicies, node: "child")
  tc("getBSIndicies neto", "getBSIndicies", "TestProperty", { value: nil }, gc.getBSIndicies, node: "gc")

  tc("all inclui self", "all", "TestProperty", { value: nil }, fmtList(root.all), node: "root")
  tc("allLeaves sem self", "allLeaves", "TestProperty", { value: nil, withoutSelf: true }, fmtList(root.allLeaves(true)), node: "root")
  tc("allLeaves com self", "allLeaves", "TestProperty", { value: nil, withoutSelf: false }, fmtList(root.allLeaves(false)), node: "root")

  tc("isChildOf raiz -> filho", "isChildOf", "TestProperty", { value: nil }, root.isChildOf?(child), node: "root", target: "child")
  tc("isChildOf filho -> raiz", "isChildOf", "TestProperty", { value: nil }, child.isChildOf?(root), node: "child", target: "root")
  tc("isChildOf neto -> filho", "isChildOf", "TestProperty", { value: nil }, gc.isChildOf?(child), node: "gc", target: "child")
  tc("isChildOf neto -> raiz", "isChildOf", "TestProperty", { value: nil }, gc.isChildOf?(root), node: "gc", target: "root")

  tc("leaf raiz", "leaf", "TestProperty", { value: nil }, root.leaf?, node: "root")
  tc("leaf filho", "leaf", "TestProperty", { value: nil }, child.leaf?, node: "child")
  tc("leaf neto", "leaf", "TestProperty", { value: nil }, gc.leaf?, node: "gc")

  tc("container raiz", "container", "TestProperty", { value: nil }, root.container?, node: "root")
  tc("container filho", "container", "TestProperty", { value: nil }, child.container?, node: "child")
  tc("container neto", "container", "TestProperty", { value: nil }, gc.container?, node: "gc")

  tc("kids raiz", "kids", "TestProperty", { value: nil }, fmtList(root.kids), node: "root")
  tc("kids filho", "kids", "TestProperty", { value: nil }, fmtList(child.kids), node: "child")
  tc("kids neto", "kids", "TestProperty", { value: nil }, fmtList(gc.kids), node: "gc")

  tc("parents raiz", "parents", "TestProperty", { value: nil }, fmtList(root.parents), node: "root")
  tc("parents filho", "parents", "TestProperty", { value: nil }, fmtList(child.parents), node: "child")
  tc("parents neto", "parents", "TestProperty", { value: nil }, fmtList(gc.parents), node: "gc")

  tc("root raiz", "root", "TestProperty", { value: nil }, fmt(root.root), node: "root")
  tc("root filho", "root", "TestProperty", { value: nil }, fmt(child.root), node: "child")
  tc("root neto", "root", "TestProperty", { value: nil }, fmt(gc.root), node: "gc")

  tc("ancestors raiz", "ancestors", "TestProperty", { value: nil }, fmtList(root.ancestors), node: "root")
  tc("ancestors filho", "ancestors", "TestProperty", { value: nil }, fmtList(child.ancestors), node: "child")
  tc("ancestors neto", "ancestors", "TestProperty", { value: nil }, fmtList(gc.ancestors), node: "gc")

  tc("logicalId raiz", "logicalId", "TestProperty", { value: nil }, fmt(root), node: "root")
  tc("logicalId filho", "logicalId", "TestProperty", { value: nil }, fmt(child), node: "child")
  tc("logicalId neto", "logicalId", "TestProperty", { value: nil }, fmt(gc), node: "gc")
end

def testInheritance3Levels
  ps = createPropertySet(1, false)

  ps.addAttributeType(TaskJuggler::AttributeDefinition.new(
    "priority", "Priority", TaskJuggler::IntegerAttribute, true, false, false, 500
  ))

  root = TestProperty.new(ps, "root", "Root", nil)
  ps.addProperty(root)
  child = TestProperty.new(ps, "child", "Child", root)
  ps.addProperty(child)
  gc = TestProperty.new(ps, "gc", "Grandchild", child)
  ps.addProperty(gc)

  root.set("priority", 100)
  child.inheritAttributes
  gc.inheritAttributes

  tc("herança do root para filho", "get", "TestProperty", { value: nil }, root.get("priority"), node: "child", attr: "priority")
  tc("herança do root para neto", "get", "TestProperty", { value: nil }, root.get("priority"), node: "gc", attr: "priority")

  child.set("priority", 200)
  gc.inheritAttributes

  tc("filho sobrescreve neto", "get", "TestProperty", { value: nil }, child.get("priority"), node: "gc", attr: "priority")

  tc("root provided", "provided", "TestProperty", { value: nil }, root.provided("priority"), node: "root", attr: "priority")
  tc("root inherited", "inherited", "TestProperty", { value: nil }, root.inherited("priority"), node: "root", attr: "priority")
  tc("filho provided", "provided", "TestProperty", { value: nil }, child.provided("priority"), node: "child", attr: "priority")
  tc("filho inherited", "inherited", "TestProperty", { value: nil }, child.inherited("priority"), node: "child", attr: "priority")
  tc("neto provided", "provided", "TestProperty", { value: nil }, gc.provided("priority"), node: "gc", attr: "priority")
  tc("neto inherited", "inherited", "TestProperty", { value: nil }, gc.inherited("priority"), node: "gc", attr: "priority")

  tc("root modified", "modified", "TestProperty", { value: nil }, root.modified?("priority"), node: "root", attr: "priority")
  tc("filho modified", "modified", "TestProperty", { value: nil }, child.modified?("priority"), node: "child", attr: "priority")
  tc("neto modified", "modified", "TestProperty", { value: nil }, gc.modified?("priority"), node: "gc", attr: "priority")
end

def testScenarioSpecificInheritance
  ps = createPropertySet(2, false)

  ps.addAttributeType(TaskJuggler::AttributeDefinition.new(
    "effort", "Effort", TaskJuggler::DurationAttribute, false, false, true, 0
  ))

  root = TestProperty.new(ps, "root", "Root", nil)

  root["effort", 0] = 3600

  tc("cenario 0 provided", "provided", "TestProperty", { value: nil, scenarioIdx: 0 }, root.provided("effort", 0), node: "root")
  tc("cenario 0 inherited", "inherited", "TestProperty", { value: nil, scenarioIdx: 0 }, root.inherited("effort", 0), node: "root")
  tc("cenario 1 provided", "provided", "TestProperty", { value: nil, scenarioIdx: 1 }, root.provided("effort", 1), node: "root")
  tc("cenario 1 inherited", "inherited", "TestProperty", { value: nil, scenarioIdx: 1 }, root.inherited("effort", 1), node: "root")

  root["effort", 1] = 7200

  tc("cenario 1 provided", "provided", "TestProperty", { value: nil, scenarioIdx: 1 }, root.provided("effort", 1), node: "root")
  tc("cenario 0 ainda provided", "provided", "TestProperty", { value: nil, scenarioIdx: 0 }, root.provided("effort", 0), node: "root")
end

def testAdoption
  ps = createPropertySet(1, false)

  root1 = TestProperty.new(ps, "root1", "Root 1", nil)
  root2 = TestProperty.new(ps, "root2", "Root 2", nil)
  task = TestProperty.new(ps, "task", "Task", root1)

  tc("adoção simples - kids", "kids", "TestProperty", { value: nil }, fmtList(root1.kids), node: "root1")
  tc("adoção simples - leaf falso", "leaf", "TestProperty", { value: nil }, task.leaf?, node: "task")

  begin
    root2.adopt(task)
    tc("adoção simples - kids", "kids", "TestProperty", { value: nil }, fmtList(root2.kids), node: "root2")
    tc("adoção simples - leaf falso", "leaf", "TestProperty", { value: nil }, task.leaf?, node: "task")
  end

  begin
    root2.adopt(task)
    tc("adoção duplicada - lança erro", "adopt", "TestProperty", { value: nil }, "throws", node: "task", adopter: "root2")
  rescue TaskJuggler::TjRuntimeError => e
    tc("adoção duplicada - lança erro", "adopt", "TestProperty", { value: nil }, "throws", node: "task", adopter: "root2")
  end

  begin
    task.adopt(task)
    tc("auto-adoção - deve lançar erro", "adopt", "TestProperty", { value: nil }, "throws", node: "task", adopter: "task")
  rescue TaskJuggler::TjRuntimeError => e
    tc("auto-adoção - lança erro", "adopt", "TestProperty", { value: nil }, "throws", node: "task", adopter: "task")
  end
end

def testBackupRestore
  ps = createPropertySet(1, false)

  ps.addAttributeType(TaskJuggler::AttributeDefinition.new(
    "status", "Status", TaskJuggler::StringAttribute, false, false, false, "active"
  ))

  root = TestProperty.new(ps, "root", "Root", nil)
  root.set("status", "in_progress")

  backup = root.backupAttributes

  ps.addAttributeType(TaskJuggler::AttributeDefinition.new(
    "priority", "Priority", TaskJuggler::IntegerAttribute, false, false, false, 500
  ))
  root.set("priority", 100)

  tc("status após modificação", "get", "TestProperty", { value: nil }, root.get("status"), node: "root", attr: "status")
  tc("priority após modificação", "get", "TestProperty", { value: nil }, root.get("priority"), node: "root", attr: "priority")

  root.restoreAttributes(backup)

  tc("status após restore", "get", "TestProperty", { value: nil }, root.get("status"), node: "root", attr: "status")
  tc("priority após restore", "get", "TestProperty", { value: nil }, root.get("priority"), node: "root", attr: "priority")

  backup[0]["status"].set("modified")
  tc("modificação no backup afeta original", "get", "TestProperty", { value: nil }, root.get("status"), node: "root", attr: "status")
end

def testFlatNamespace
  ps = createPropertySet(1, true)

  root = TestProperty.new(ps, "root", "Root", nil)
  ps.addProperty(root)
  child = TestProperty.new(ps, "child", "Child", root)
  ps.addProperty(child)

  tc("fullId namespace plano raiz", "fullId", "TestProperty", { value: nil }, fmt(root), node: "root")
  tc("fullId namespace plano filho", "fullId", "TestProperty", { value: nil }, fmt(child), node: "child")

  tc("level namespace plano raiz", "level", "TestProperty", { value: nil }, root.level, node: "root")
  tc("level namespace plano filho", "level", "TestProperty", { value: nil }, child.level, node: "child")

  tc("getBSIndicies namespace plano raiz", "getBSIndicies", "TestProperty", { value: nil }, root.getBSIndicies, node: "root")
  tc("getBSIndicies namespace plano filho", "getBSIndicies", "TestProperty", { value: nil }, child.getBSIndicies, node: "child")
end

testStructure
testInheritance3Levels
testScenarioSpecificInheritance
testAdoption
testBackupRestore
testFlatNamespace

output = {
  version: "1.0",
  description: "Golden test cases for PropertyTreeNode, PropertySet, ScenarioData, Scenario, PTNProxy (Phase 4)",
  generated_at: Time.now.utc.to_s,
  cases: $golden_cases,
}

puts JSON.pretty_generate(output)
