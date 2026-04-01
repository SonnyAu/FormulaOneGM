export type Driver = {
  id: string;
  name: string;
  number: number;
  nationality: string;
};

export type Team = {
  id: string;
  /** Full entry name (e.g. sponsor + team). */
  entrant: string;
  /** Short code for standings / timing (typically 3 letters). */
  abbreviation: string;
  constructor: string;
  chassis: string;
  power_unit: string;
  driverIds: [string, string];
};

export type ChassisNamingPattern = "year-based" | "iteration-based";

export type CustomTeam = {
  constructorName: string;
  teamBase: string;
  chassisPrefix: string;
  chassisNamingPattern: ChassisNamingPattern;
  driverOne: string;
  driverTwo: string;
};

export type TeamSelection =
  | {
      mode: "existing";
      teamId: string;
    }
  | {
      mode: "custom";
      team: CustomTeam;
    };
