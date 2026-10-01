#!/usr/bin/env ruby -w
# frozen_string_literal: true
# encoding: UTF-8

lib_path = File.expand_path("./docs/taskjuggler/lib", Dir.pwd)
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
  end
  def get(name); @store[name]; end
  def set(name, value); @store[name] = value; end
  def scenario(idx); nil; end
  def scenarioIdx(sc); nil; end
end

class TestProperty < TaskJuggler::PropertyTreeNode; end

ps = TaskJuggler::PropertySet.new(MockProject.new(1, false), false)
ps.addAttributeType(TaskJuggler::AttributeDefinition.new("priority", "Priority", TaskJuggler::IntegerAttribute, true, false, false, 500))
root = TestProperty.new(ps, "root", "Root", nil)
ps.addProperty(root)
root.set("priority", 100)
puts "get: #{root.get("priority")}"
puts "provided?: #{root.provided?("priority")}"
puts "inherited?: #{root.inherited?("priority")}"
puts "modified?: #{root.modified?("priority")}"