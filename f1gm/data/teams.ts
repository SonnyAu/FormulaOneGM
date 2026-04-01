import { Team } from "@/types/f1";

export const teams: Team[] = [
  {
    id: "alpine",
    entrant: "BWT Alpine F1 Team",
    abbreviation: "ALP",
    constructor: "Alpine-Mercedes",
    chassis: "A526",
    power_unit: "Mercedes-AMG F1 M17",
    driverIds: ["pierre-gasly", "franco-colapinto"],
  },
  {
    id: "aston-martin",
    entrant: "Aston Martin Aramco F1 Team",
    abbreviation: "AMR",
    constructor: "Aston Martin Aramco-Honda",
    chassis: "AMR26",
    power_unit: "Honda RA626H",
    driverIds: ["fernando-alonso", "lance-stroll"],
  },
  {
    id: "williams",
    entrant: "Atlassian Williams F1 Team",
    abbreviation: "WIL",
    constructor: "Williams-Mercedes",
    chassis: "FW48",
    power_unit: "Mercedes-AMG F1 M17",
    driverIds: ["alexander-albon", "carlos-sainz-jr"],
  },
  {
    id: "audi",
    entrant: "Audi Revolut F1 Team",
    abbreviation: "AUD",
    constructor: "Audi",
    chassis: "R26",
    power_unit: "Audi AFR 26 Hybrid",
    driverIds: ["gabriel-bortoleto", "nico-hulkenberg"],
  },
  {
    id: "cadillac",
    entrant: "Cadillac Formula 1 Team",
    abbreviation: "CAD",
    constructor: "Cadillac-Ferrari",
    chassis: "MAC-26",
    power_unit: "Ferrari 067/6",
    driverIds: ["sergio-perez", "valtteri-bottas"],
  },
  {
    id: "ferrari",
    entrant: "Scuderia Ferrari HP",
    abbreviation: "FER",
    constructor: "Ferrari",
    chassis: "SF-26",
    power_unit: "Ferrari 067/6",
    driverIds: ["charles-leclerc", "lewis-hamilton"],
  },
  {
    id: "haas",
    entrant: "Haas F1 Team",
    abbreviation: "HAA",
    constructor: "Haas-Ferrari",
    chassis: "VF-26",
    power_unit: "Ferrari 067/6",
    driverIds: ["esteban-ocon", "oliver-bearman"],
  },
  {
    id: "mclaren",
    entrant: "McLaren F1 Team",
    abbreviation: "MCL",
    constructor: "McLaren-Mercedes",
    chassis: "MCL40",
    power_unit: "Mercedes-AMG F1 M17",
    driverIds: ["lando-norris", "oscar-piastri"],
  },
  {
    id: "mercedes",
    entrant: "Mercedes-AMG Petronas F1 Team",
    abbreviation: "MER",
    constructor: "Mercedes",
    chassis: "F1 W17",
    power_unit: "Mercedes-AMG F1 M17",
    driverIds: ["kimi-antonelli", "george-russell"],
  },
  {
    id: "racing-bulls",
    entrant: "Visa Cash App Racing Bulls F1 Team",
    abbreviation: "VRB",
    constructor: "Racing Bulls-Red Bull Ford",
    chassis: "VCARB 03",
    power_unit: "Red Bull Ford DM01",
    driverIds: ["liam-lawson", "arvid-lindblad"],
  },
  {
    id: "red-bull",
    entrant: "Oracle Red Bull Racing",
    abbreviation: "RBR",
    constructor: "Red Bull Racing-Red Bull Ford",
    chassis: "RB22",
    power_unit: "Red Bull Ford DM01",
    driverIds: ["max-verstappen", "isack-hadjar"],
  },
];

/** Short code for custom constructor names (first three A–Z letters, padded if needed). */
export function abbreviateConstructorName(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 3) {
    return letters.slice(0, 3).toUpperCase();
  }
  const alnum = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (alnum.length >= 3) return alnum.slice(0, 3);
  if (alnum.length === 2) return `${alnum}X`;
  if (alnum.length === 1) return `${alnum}XX`;
  return "TM";
}
