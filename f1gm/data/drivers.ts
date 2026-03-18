import { Driver } from "@/types/f1";

export const drivers: Driver[] = [
  { id: "pierre-gasly", name: "Pierre Gasly", number: 10, nationality: "France" },
  { id: "franco-colapinto", name: "Franco Colapinto", number: 43, nationality: "Argentina" },
  { id: "fernando-alonso", name: "Fernando Alonso", number: 14, nationality: "Spain" },
  { id: "lance-stroll", name: "Lance Stroll", number: 18, nationality: "Canada" },
  { id: "alexander-albon", name: "Alexander Albon", number: 23, nationality: "Thailand" },
  { id: "carlos-sainz-jr", name: "Carlos Sainz Jr.", number: 55, nationality: "Spain" },
  { id: "gabriel-bortoleto", name: "Gabriel Bortoleto", number: 5, nationality: "Brazil" },
  { id: "nico-hulkenberg", name: "Nico Hülkenberg", number: 27, nationality: "Germany" },
  { id: "sergio-perez", name: "Sergio Pérez", number: 11, nationality: "Mexico" },
  { id: "valtteri-bottas", name: "Valtteri Bottas", number: 77, nationality: "Finland" },
  { id: "charles-leclerc", name: "Charles Leclerc", number: 16, nationality: "Monaco" },
  { id: "lewis-hamilton", name: "Lewis Hamilton", number: 44, nationality: "United Kingdom" },
  { id: "esteban-ocon", name: "Esteban Ocon", number: 31, nationality: "France" },
  { id: "oliver-bearman", name: "Oliver Bearman", number: 87, nationality: "United Kingdom" },
  { id: "lando-norris", name: "Lando Norris", number: 1, nationality: "United Kingdom" },
  { id: "oscar-piastri", name: "Oscar Piastri", number: 81, nationality: "Australia" },
  { id: "kimi-antonelli", name: "Kimi Antonelli", number: 12, nationality: "Italy" },
  { id: "george-russell", name: "George Russell", number: 63, nationality: "United Kingdom" },
  { id: "liam-lawson", name: "Liam Lawson", number: 30, nationality: "New Zealand" },
  { id: "arvid-lindblad", name: "Arvid Lindblad", number: 41, nationality: "United Kingdom" },
  { id: "max-verstappen", name: "Max Verstappen", number: 3, nationality: "Netherlands" },
  { id: "isack-hadjar", name: "Isack Hadjar", number: 6, nationality: "France" },
];

export const driverMap = new Map(drivers.map((driver) => [driver.id, driver]));
