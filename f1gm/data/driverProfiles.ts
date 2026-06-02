import { DriverProfile } from "@/lib/sim/raceweekend/raceTypes";

// Hand-authored driver ratings (1-100) used by the race weekend engine.
// Kept as editable data so the planned academy system can append junior drivers later.

export const driverProfiles: Record<string, DriverProfile> = {
  "max-verstappen": { id: "max-verstappen", name: "Max Verstappen", overall: 97, qualifying: 96, racePace: 97, tireManagement: 90, overtaking: 95, defending: 94, consistency: 93, wetWeather: 97, braking: 94, traction: 93, lowSpeed: 92, highSpeed: 95, adaptability: 95 },
  "charles-leclerc": { id: "charles-leclerc", name: "Charles Leclerc", overall: 92, qualifying: 95, racePace: 90, tireManagement: 84, overtaking: 88, defending: 86, consistency: 85, wetWeather: 88, braking: 90, traction: 86, lowSpeed: 89, highSpeed: 91, adaptability: 87 },
  "lando-norris": { id: "lando-norris", name: "Lando Norris", overall: 91, qualifying: 92, racePace: 90, tireManagement: 86, overtaking: 87, defending: 85, consistency: 87, wetWeather: 85, braking: 88, traction: 86, lowSpeed: 87, highSpeed: 90, adaptability: 88 },
  "lewis-hamilton": { id: "lewis-hamilton", name: "Lewis Hamilton", overall: 91, qualifying: 89, racePace: 92, tireManagement: 93, overtaking: 92, defending: 90, consistency: 90, wetWeather: 95, braking: 90, traction: 89, lowSpeed: 89, highSpeed: 90, adaptability: 92 },
  "oscar-piastri": { id: "oscar-piastri", name: "Oscar Piastri", overall: 90, qualifying: 89, racePace: 90, tireManagement: 88, overtaking: 86, defending: 87, consistency: 90, wetWeather: 84, braking: 87, traction: 87, lowSpeed: 86, highSpeed: 88, adaptability: 88 },
  "fernando-alonso": { id: "fernando-alonso", name: "Fernando Alonso", overall: 90, qualifying: 87, racePace: 90, tireManagement: 92, overtaking: 93, defending: 95, consistency: 91, wetWeather: 92, braking: 90, traction: 88, lowSpeed: 90, highSpeed: 88, adaptability: 93 },
  "george-russell": { id: "george-russell", name: "George Russell", overall: 89, qualifying: 90, racePace: 88, tireManagement: 85, overtaking: 84, defending: 85, consistency: 88, wetWeather: 86, braking: 86, traction: 85, lowSpeed: 85, highSpeed: 88, adaptability: 86 },
  "carlos-sainz-jr": { id: "carlos-sainz-jr", name: "Carlos Sainz Jr.", overall: 88, qualifying: 86, racePace: 88, tireManagement: 88, overtaking: 85, defending: 87, consistency: 88, wetWeather: 84, braking: 87, traction: 86, lowSpeed: 86, highSpeed: 86, adaptability: 86 },
  "pierre-gasly": { id: "pierre-gasly", name: "Pierre Gasly", overall: 85, qualifying: 84, racePace: 85, tireManagement: 84, overtaking: 83, defending: 83, consistency: 83, wetWeather: 84, braking: 84, traction: 83, lowSpeed: 84, highSpeed: 84, adaptability: 84 },
  "alexander-albon": { id: "alexander-albon", name: "Alexander Albon", overall: 85, qualifying: 84, racePace: 85, tireManagement: 86, overtaking: 82, defending: 86, consistency: 85, wetWeather: 83, braking: 84, traction: 84, lowSpeed: 84, highSpeed: 85, adaptability: 85 },
  "nico-hulkenberg": { id: "nico-hulkenberg", name: "Nico Hulkenberg", overall: 84, qualifying: 85, racePace: 83, tireManagement: 84, overtaking: 82, defending: 84, consistency: 84, wetWeather: 86, braking: 83, traction: 82, lowSpeed: 83, highSpeed: 84, adaptability: 84 },
  "sergio-perez": { id: "sergio-perez", name: "Sergio Perez", overall: 84, qualifying: 80, racePace: 85, tireManagement: 90, overtaking: 84, defending: 86, consistency: 82, wetWeather: 84, braking: 83, traction: 85, lowSpeed: 85, highSpeed: 83, adaptability: 83 },
  "valtteri-bottas": { id: "valtteri-bottas", name: "Valtteri Bottas", overall: 83, qualifying: 84, racePace: 83, tireManagement: 85, overtaking: 80, defending: 82, consistency: 85, wetWeather: 82, braking: 83, traction: 83, lowSpeed: 82, highSpeed: 84, adaptability: 82 },
  "esteban-ocon": { id: "esteban-ocon", name: "Esteban Ocon", overall: 83, qualifying: 83, racePace: 83, tireManagement: 83, overtaking: 81, defending: 84, consistency: 83, wetWeather: 83, braking: 83, traction: 82, lowSpeed: 83, highSpeed: 83, adaptability: 82 },
  "kimi-antonelli": { id: "kimi-antonelli", name: "Kimi Antonelli", overall: 82, qualifying: 83, racePace: 82, tireManagement: 79, overtaking: 82, defending: 80, consistency: 79, wetWeather: 81, braking: 82, traction: 81, lowSpeed: 81, highSpeed: 83, adaptability: 84 },
  "oliver-bearman": { id: "oliver-bearman", name: "Oliver Bearman", overall: 80, qualifying: 80, racePace: 80, tireManagement: 79, overtaking: 81, defending: 79, consistency: 78, wetWeather: 80, braking: 81, traction: 79, lowSpeed: 80, highSpeed: 80, adaptability: 82 },
  "liam-lawson": { id: "liam-lawson", name: "Liam Lawson", overall: 80, qualifying: 80, racePace: 80, tireManagement: 79, overtaking: 81, defending: 80, consistency: 78, wetWeather: 80, braking: 80, traction: 79, lowSpeed: 80, highSpeed: 80, adaptability: 81 },
  "isack-hadjar": { id: "isack-hadjar", name: "Isack Hadjar", overall: 80, qualifying: 81, racePace: 79, tireManagement: 79, overtaking: 80, defending: 79, consistency: 79, wetWeather: 80, braking: 80, traction: 79, lowSpeed: 80, highSpeed: 80, adaptability: 82 },
  "lance-stroll": { id: "lance-stroll", name: "Lance Stroll", overall: 80, qualifying: 78, racePace: 80, tireManagement: 81, overtaking: 78, defending: 80, consistency: 79, wetWeather: 82, braking: 79, traction: 79, lowSpeed: 80, highSpeed: 79, adaptability: 79 },
  "gabriel-bortoleto": { id: "gabriel-bortoleto", name: "Gabriel Bortoleto", overall: 79, qualifying: 80, racePace: 79, tireManagement: 78, overtaking: 79, defending: 78, consistency: 78, wetWeather: 79, braking: 79, traction: 78, lowSpeed: 79, highSpeed: 79, adaptability: 82 },
  "franco-colapinto": { id: "franco-colapinto", name: "Franco Colapinto", overall: 79, qualifying: 79, racePace: 79, tireManagement: 77, overtaking: 80, defending: 78, consistency: 76, wetWeather: 78, braking: 79, traction: 78, lowSpeed: 78, highSpeed: 79, adaptability: 81 },
  "arvid-lindblad": { id: "arvid-lindblad", name: "Arvid Lindblad", overall: 77, qualifying: 78, racePace: 77, tireManagement: 75, overtaking: 78, defending: 76, consistency: 74, wetWeather: 76, braking: 77, traction: 76, lowSpeed: 77, highSpeed: 77, adaptability: 81 },
};

/** Returns a driver profile, deriving a sane baseline for unknown ids. */
export function getDriverProfile(driverId: string, name = "Unknown Driver", overall = 75): DriverProfile {
  const existing = driverProfiles[driverId];
  if (existing) return existing;
  return {
    id: driverId,
    name,
    overall,
    qualifying: overall,
    racePace: overall,
    tireManagement: overall - 2,
    overtaking: overall - 2,
    defending: overall - 2,
    consistency: overall - 3,
    wetWeather: overall - 2,
    braking: overall - 1,
    traction: overall - 1,
    lowSpeed: overall - 1,
    highSpeed: overall - 1,
    adaptability: overall + 2,
  };
}
