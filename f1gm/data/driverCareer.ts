/** Per-driver career seed for save initialization and migration. */
export type DriverCareerSeed = {
  debutYear: number;
  age: number;
};

export const driverCareerSeed: Record<string, DriverCareerSeed> = {
  "pierre-gasly": { debutYear: 2019, age: 30 },
  "franco-colapinto": { debutYear: 2026, age: 22 },
  "fernando-alonso": { debutYear: 2001, age: 44 },
  "lance-stroll": { debutYear: 2017, age: 27 },
  "alexander-albon": { debutYear: 2019, age: 29 },
  "carlos-sainz-jr": { debutYear: 2015, age: 31 },
  "gabriel-bortoleto": { debutYear: 2026, age: 21 },
  "nico-hulkenberg": { debutYear: 2010, age: 38 },
  "sergio-perez": { debutYear: 2011, age: 35 },
  "valtteri-bottas": { debutYear: 2013, age: 36 },
  "charles-leclerc": { debutYear: 2018, age: 28 },
  "lewis-hamilton": { debutYear: 2007, age: 41 },
  "esteban-ocon": { debutYear: 2016, age: 29 },
  "oliver-bearman": { debutYear: 2026, age: 20 },
  "lando-norris": { debutYear: 2019, age: 26 },
  "oscar-piastri": { debutYear: 2023, age: 24 },
  "kimi-antonelli": { debutYear: 2026, age: 19 },
  "george-russell": { debutYear: 2019, age: 28 },
  "liam-lawson": { debutYear: 2023, age: 24 },
  "arvid-lindblad": { debutYear: 2026, age: 19 },
  "max-verstappen": { debutYear: 2015, age: 29 },
  "isack-hadjar": { debutYear: 2026, age: 21 },
};

export function getDriverCareerSeed(driverId: string, seasonYear: number): DriverCareerSeed {
  return driverCareerSeed[driverId] ?? { debutYear: seasonYear, age: 22 };
}
