/**
 * Person — port de `ICalendar::Person` (Fase 17.5).
 *
 * No Ruby é um `Struct.new(:name, :email)`: um simples par nome/email usado
 * nos campos ORGANIZER e ATTENDEE dos componentes.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:28
 */
export class Person {
  readonly name: string;
  readonly email: string;

  constructor(name: string, email: string,) {
    this.name = name;
    this.email = email;
  }
}
