/** Whole years between `birthDate` ("YYYY-MM-DD") and `on`, in UTC. */
export function ageOn(birthDate: string, on: Date = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = on.getUTCFullYear() - year;
  const beforeBirthday =
    on.getUTCMonth() + 1 < month || (on.getUTCMonth() + 1 === month && on.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}
