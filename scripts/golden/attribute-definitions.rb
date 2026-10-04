#!/usr/bin/env ruby -w
# frozen_string_literal: true
# encoding: UTF-8
#
# = attribute-definitions.rb -- TaskJuggler III Golden Test for AttributeDefinitions
#
# Gera um JSON com todas as definições de atributos de todos os PropertySets
# (tasks, resources, accounts, shifts, reports, scenarios) de um projeto de teste.
#
# O JSON é usado pelo golden test em TypeScript para comparar as definições
# de atributos do Ruby com as definições de atributos do TypeScript.
#
# Uso: ruby scripts/golden/attribute-definitions.rb
#

require 'json'
require 'taskjuggler/Project'
require 'taskjuggler/PropertySet'

# Cria um projeto de teste simples
project = TaskJuggler::Project.new('prj', 'Test', '1.0')

# Coleta todas as definições de atributos de todos os PropertySets
attribute_definitions = []

# Percorre os PropertySets do projeto (o Ruby os armazena em @propertySets)
project.scenarios.eachAttributeDefinition do |attr_def|
  # Converte para um hash com os campos que o golden test espera.
  # O golden test espera: id, name, objClass, inheritedFromParent,
  # inheritedFromProject, scenarioSpecific, default, userDefined
  attribute_definitions << {
    'id' => attr_def.id,
    'name' => attr_def.name,
    'objClass' => attr_def.objClass.name,
    'inheritedFromParent' => attr_def.inheritedFromParent,
    'inheritedFromProject' => attr_def.inheritedFromProject,
    'scenarioSpecific' => attr_def.scenarioSpecific,
    'default' => attr_def.default,
    'userDefined' => attr_def.userDefined,
  }
end

project.shifts.eachAttributeDefinition do |attr_def|
  attribute_definitions << {
    'id' => attr_def.id,
    'name' => attr_def.name,
    'objClass' => attr_def.objClass.name,
    'inheritedFromParent' => attr_def.inheritedFromParent,
    'inheritedFromProject' => attr_def.inheritedFromProject,
    'scenarioSpecific' => attr_def.scenarioSpecific,
    'default' => attr_def.default,
    'userDefined' => attr_def.userDefined,
  }
end

project.accounts.eachAttributeDefinition do |attr_def|
  attribute_definitions << {
    'id' => attr_def.id,
    'name' => attr_def.name,
    'objClass' => attr_def.objClass.name,
    'inheritedFromParent' => attr_def.inheritedFromParent,
    'inheritedFromProject' => attr_def.inheritedFromProject,
    'scenarioSpecific' => attr_def.scenarioSpecific,
    'default' => attr_def.default,
    'userDefined' => attr_def.userDefined,
  }
end

project.resources.eachAttributeDefinition do |attr_def|
  attribute_definitions << {
    'id' => attr_def.id,
    'name' => attr_def.name,
    'objClass' => attr_def.objClass.name,
    'inheritedFromParent' => attr_def.inheritedFromParent,
    'inheritedFromProject' => attr_def.inheritedFromProject,
    'scenarioSpecific' => attr_def.scenarioSpecific,
    'default' => attr_def.default,
    'userDefined' => attr_def.userDefined,
  }
end

project.tasks.eachAttributeDefinition do |attr_def|
  attribute_definitions << {
    'id' => attr_def.id,
    'name' => attr_def.name,
    'objClass' => attr_def.objClass.name,
    'inheritedFromParent' => attr_def.inheritedFromParent,
    'inheritedFromProject' => attr_def.inheritedFromProject,
    'scenarioSpecific' => attr_def.scenarioSpecific,
    'default' => attr_def.default,
    'userDefined' => attr_def.userDefined,
  }
end

project.reports.eachAttributeDefinition do |attr_def|
  attribute_definitions << {
    'id' => attr_def.id,
    'name' => attr_def.name,
    'objClass' => attr_def.objClass.name,
    'inheritedFromParent' => attr_def.inheritedFromParent,
    'inheritedFromProject' => attr_def.inheritedFromProject,
    'scenarioSpecific' => attr_def.scenarioSpecific,
    'default' => attr_def.default,
    'userDefined' => attr_def.userDefined,
  }
end

# Ordena por id para corresponder ao Ruby (já ordenado por cadaAttributeDefinition)
attribute_definitions.sort_by! { |ad| ad['id'] }

# Gera o JSON
json_output = {
  'version' => '1.0',
  'description' => 'Golden test for AttributeDefinitions',
  'generated_at' => Time.now.utc.iso8601,
  'cases' => attribute_definitions,
}

puts JSON.pretty_generate(json_output)