/**
 * `chapters-syntax.ts` — capítulos sobre a gramática e o dialeto de texto
 * (22.1b.5).
 *
 * Mesmo contrato de {@link ./chapters-basics.ts}: texto-fonte RichText em
 * inglês, sem E/S, apenas a extensão `.smx`.
 *
 * @see ./chapters.ts
 */

import type { ManualChapter, } from "./chapters-basics.ts";

/** Gramática, marcação de texto e atributos de lista. */
export const SYNTAX_CHAPTERS: readonly ManualChapter[] = [
  {
    name: "The_Syntax",
    text: `== The Syntax ==

This chapter describes the grammar that every project file follows. The
reference in Appendix A is generated from the same grammar that the parser
uses, so the two always agree; this chapter explains the reasoning behind it.

=== Lexical elements ===

A project file is a sequence of tokens separated by white space. Comments
start with a number sign and run to the end of the line:

  # This is a comment
  task design "Design"   # ... and so is this

Three kinds of literal appear throughout:

* '''Identifiers''' - unquoted words such as ''''design'''' or
  ''''dev.backend''''. They may contain letters, digits, underscores,
  hyphens and dots, but no white space. A leading exclamation mark negates an
  identifier when it is used as a dependency, as in ''''!design''''.
* '''Strings''' - quoted with single or double quotes. Strings may contain
  spaces and punctuation, and may be empty. Use a string for every human
  readable name.
* '''Numbers''' - integers or decimals. Percentages, durations and currency
  amounts are numbers with a suffix, as described below.

=== Values and their written forms ===

SyntaxMesh distinguishes the following value types. The Reference appendix
links each keyword to the types it accepts.

* '''Id''' - an unquoted identifier. Used to reference another property.
* '''String''' - quoted text.
* '''Integer''' and '''Float''' - plain numbers.
* '''Date''' - ''''2026-01-05'''', optionally with a time and a zone:
  ''''2026-01-05-13:00'''', ''''2026-01-05-13:00-+0100''''.
* '''Duration''' - a number with a unit: ''''15min'''', ''''8h'''',
  ''''5d'''', ''''2w'''', ''''3m'''' and ''''1y''''. A working day is 8
  hours unless the project says otherwise.
* '''Interval''' - two dates separated by a hyphen, as in
  ''''2026-01-05 - 2026-03-31''''.
* '''Percent''' - a number followed by a percent sign, as in ''''50%''''.
* '''Symbol''' - a bare word understood by the keyword that receives it,
  such as the value ''''html'''' in [[formats]].
* '''Logical expression''' - a condition over project data, used by
  [[depends]], [[hidetask]] and similar keywords. The operators are and
  (ampersand), or (vertical bar), not (tilde), and the comparisons equal,
  not equal, less, less or equal, greater and greater or equal. The functions
  are ''''hasalert'''', ''''isleaf'''', ''''ismilestone'''',
  ''''isscheduled'''' and ''''iscontainer''''.
* '''Reference''' - a quoted or unquoted name of a property, resolved in the
  namespace of the keyword that accepts it.
* '''List''' - a comma-separated sequence of any of the above.

=== The shape of a property ===

Every project property has the same four parts:

  <keyword> [<id>] "<name>" [{ <attributes> }]

The keyword is fixed by the grammar. The id is optional and must be unique
within the keyword's namespace. The name is mandatory and is what reports
show. The attribute block is optional; when present it contains one attribute
per line, and the braces may be dropped when the block is empty.

The same shape holds for nested properties, which are just properties that
may only appear inside another property's block:

  task project "Project" {
    task design "Design" {
      effort 5d
    }
  }

=== Attributes and contexts ===

An attribute is a keyword that is only legal inside certain blocks. The set
of legal attributes is the ''context'' of the block. [[task]] accepts
attributes such as [[effort]] and [[allocate]]; [[resource]] accepts
[[efficiency]] and [[limits]]; a report accepts [[formats]] and ''''columns''''.

Three rules make the same attribute keyword reusable across contexts:

# Each attribute declares the contexts it belongs to. Appendix A lists them
  for every keyword.
# An attribute may be a ''list attribute'': it is inherited by the nested
  properties of the block. [[Reports]] and the reference page of the
  attribute explain the propagation.
# An attribute may be ''scenario specific'': its value may differ per
  scenario instead of being shared by all of them.

=== Global scope ===

Outside of any property block you are in the ''global scope''. Only the
top-level properties are legal there: [[project]], [[macro]], [[flags]],
[[account]], [[shift]], [[resource]], [[task]], the report declarations and
''''include''''. Everything else needs a context.

=== Comments, order and includes ===

Order matters only for references: a property must be declared before it is
used. ''''include'''' pulls another file into the current position, which makes
it possible to keep a library of resources and accounts in one file and the
schedule in another:

  include "library/resource.smx"

An include cannot contain a project header; the header lives in the master
file only.

=== Scenarios ===

A [[scenario]] is a named alternative view of the same project. Scenarios are
declared inside the project block, before the properties that use them:

  project plan "Plan" 2026-01-05 - 2026-06-30 {
    scenario optimistic "Optimistic"
    scenario committed "Committed"
  }

  task design "Design" { effort 10d }

Every property can then hold one value per scenario. Scheduling and reporting
always run in a single scenario at a time, and a report selects the scenario
it shows with ''''scenarios''''.
`,
  },
  {
    name: "Rich_Text_Attributes",
    text: `== Rich Text Attributes ==

Names, headers and notes are not plain strings: they are ''rich text''. The
dialect is deliberately small and line oriented, and it is the same one the
classic project files used, so existing text keeps working unchanged.

=== Paragraphs and emphasis ===

Text is grouped into paragraphs by blank lines. Inline markup is limited to
three forms:

* ''''italic'''' - two single quotes around the text.
* '''bold''' - three single quotes around the text.
* ''''code'''' - four single quotes around the text.

  The task '''must''' be finished before
  the ''integration'' phase starts; see ''''depends'''' in the reference.

Note that the delimiters are quotes, not slashes or asterisks.

=== Headings and rules ===

Headings use equals signs. One pair opens a chapter, two pairs a section and
so on, up to four levels:

  == Chapter ==
  === Section ===
  ==== Sub-section ====

A line with four hyphens draws a horizontal rule:

  ----

=== Lists ===

Bullet lists start with asterisks, numbered lists with number signs. Both may
be nested up to four levels:

  * first item
  ** nested item
  * second item

  # first step
  ## sub-step
  # second step

=== Preformatted text ===

A line that starts with a single space is preformatted: everything on it is
copied literally, and consecutive lines form one block. This is how code is
shown in reports and in this manual:

   task report "Plan" {
     formats html
   }

=== Internal links ===

Double square brackets link to another keyword, to a page of the manual, or
to a section of a page:

  [[task]]
  [[task|the task property]]
  [[Getting_Started.html#Structure_of_an_SMX_File|file structure]]

Without a label the link text is the target. An external URL uses single
square brackets instead:

  [https://example.com The project site]

=== Function blocks ===

A block function is written between the two-character opening marker (a
less-than sign followed by an opening bracket) and the closing marker (a
closing bracket followed by a greater-than sign), and expands to generated
content. The most useful one embeds an annotated example:

  <[example file="HtmlTaskReport"]>

The manual itself uses this function: every code block in a keyword page comes
from the example corpus.

=== Colors ===

A run of text may be colored with a font color element: an opening tag that
names the color and a matching closing tag. The name is a CSS color word or a
hexadecimal value:

  <fcol:red>This text is red.</fcol>

=== Escaping ===

To show markup literally, wrap it in a nowiki element, that is an opening
''''<nowiki>'''' tag and a closing ''''</nowiki>'''' tag. The pair also stops
internal links from being resolved:

  <nowiki>''''not a link''''</nowiki>
`,
  },
  {
    name: "List_Attributes",
    text: `== List Attributes ==

A ''list attribute'' is an attribute whose value is a list, and which is
inherited by the properties nested inside the block where it is declared.
List attributes are the mechanism behind dependency chains, report filters
and flag propagation.

=== Declaring a list ===

The value is a comma-separated list in parentheses or without them; both
forms are accepted:

  taskreport "Plan" {
    columns id, name, start, end
  }

  flags team, urgent

=== Inheritance ===

When a list attribute appears in the block of a container property, the
nested properties inherit the list. Adding an item to the list of a child
extends the parent's list; it cannot remove an item.

  task project "Project" {
    flags team
    task design "Design" {
      flags urgent
    }
  }

The design task carries both ''team'' and ''urgent''; the project carries
''team'' only.

=== References in logical expressions ===

List values are often referenced by a logical expression. The tilde operator
tests for a set intersection, so a filter can ask whether two lists share an
element:

  hidetask ~isleaf()

  taskreport "Plan" {
    columns id, name, start, end
    hidetask depends !~design
  }

=== Ordering and duplicates ===

The order of the items is preserved. Duplicates are harmless but are removed
when the list is read, so the same value may appear in a parent and in a
child without changing the result.

=== Common list attributes ===

The most frequently used list attributes are:

* [[depends]] - completion-to-start dependencies,
* [[precedes]] - start-to-completion dependencies,
* [[allocate]] - resources assigned to a task,
* [[flags]] - free-form labels,
* ''''columns'''' - the columns of a report,
* [[formats]] - the output formats of a report.

Each of them is documented in Appendix A with its context and its inheritance
behavior.
`,
  },
];
