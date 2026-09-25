#!/usr/bin/env ruby
# frozen_string_literal: true

$LOAD_PATH.unshift("/home/aarvati/github/syntaxmesh/docs/taskjuggler/lib")
require "taskjuggler/Attributes"
require "taskjuggler/AttributeBase"
require "taskjuggler/AttributeDefinition"

# Helper to create attribute instances
def create_attribute(type_name, value, mode = 0, inherit = false)
  # Create a mock property
  property = Struct.new(:id, :name).new("test.attr", "Test Attr")
  
  # Create attribute definition
  type_class = TaskJuggler.const_get(type_name)
  type = TaskJuggler::AttributeDefinition.new(
    type_name.downcase,  # id
    type_name,            # name
    type_class,           # objClass
    false,                # inheritedFromParent
    false,                # inheritedFromProject
    false,                # scenarioSpecific
    value                 # default
  )
  
  # Create container
  container = Struct.new(:store).new({})
  
  # Create attribute
  attr = type_class.new(property, type, container)
  
  # Set value
  if inherit
    attr.inherit(value)
  else
    attr.set(value)
  end
  
  # Set mode if needed
  if mode != 0
    TaskJuggler::AttributeBase.setMode(mode)
  end
  
  attr
end

# Compute expected values
puts "# Computing actual Ruby outputs for golden test cases"

# 1. AllocationAttribute to_s
begin
  attr = create_attribute("AllocationAttribute", [
    { candidates: [{ fullId: "r1" }, { fullId: "r2" }], selectionMode: 0, mandatory: true, persistent: false }
  ])
  puts "AllocationAttribute.to_s: #{attr.to_s.inspect}"
rescue => e
  puts "AllocationAttribute.to_s error: #{e.message}"
end

# 2. BookingListAttribute to_s
begin
  attr = create_attribute("BookingListAttribute", [
    { booking: "b1" }
  ])
  puts "BookingListAttribute.to_s: #{attr.to_s.inspect}"
rescue => e
  puts "BookingListAttribute.to_s error: #{e.message}"
end

# 3. LogicalExpressionAttribute to_s
begin
  attr = create_attribute("LogicalExpressionAttribute", "expr")
  puts "LogicalExpressionAttribute.to_s: #{attr.to_s.inspect}"
rescue => e
  puts "LogicalExpressionAttribute.to_s error: #{e.message}"
end

# 4. ColumnListAttribute to_s
begin
  attr = create_attribute("ColumnListAttribute", ["col1", "col2"])
  puts "ColumnListAttribute.to_s: #{attr.to_s.inspect}"
rescue => e
  puts "ColumnListAttribute.to_s error: #{e.message}"
end