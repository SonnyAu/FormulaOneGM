export type Driver = {
  id: string;
  name: string;
  number: number;
  nationality: string;
};

export type Team = {
  id: string;
  entrant: string;
  constructor: string;
  chassis: string;
  power_unit: string;
  driverIds: [string, string];
};

export type ChassisNamingPattern = "year-based" | "iteration-based";
