/**
 * Person — port of `ICalendar::Person` (Phase 17.5).
 *
 * In Ruby it is a `Struct.new(:name, :email)`: a simple name/email pair used in
 * the ORGANIZER and ATTENDEE fields of the components.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:28
 */
export class Person {
  /** Display name of the person. */
  readonly name: string;
  /** Email address of the person. */
  readonly email: string;

  /**
   * Creates a person.
   *
   * @param name Display name.
   * @param email Email address.
   */
  constructor(name: string, email: string,) {
    this.name = name;
    this.email = email;
  }
}
