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
  /** Entrant rendering template; sponsor aliases are injected from active contracts. */
  nameTemplate: string;
  /** Short code for standings / timing (typically 3 letters). */
  abbreviation: string;
  constructor: string;
  chassis: string;
  power_unit: string;
  driverIds: [string, string];
  sponsors: TeamSponsorSeed[];
};

export type SponsorCategory = "title" | "major" | "technical" | "apparel" | "supplier";

export type SponsorAmbition = "low" | "medium" | "high" | "elite";

export type TeamSponsorSeed = {
  sponsorId: string;
  name: string;
  /** Sponsor-owned title rendering alias, e.g. Toyota Gazoo Racing -> TGR. */
  titleName?: string;
  category: SponsorCategory;
  annualValue: number;
  termYears?: number;
  ambition?: SponsorAmbition;
  /** Allows non-title partners such as Cash App to appear in a team name template. */
  namingPartner?: boolean;
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
