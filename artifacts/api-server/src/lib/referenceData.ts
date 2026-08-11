export const defaultCategories = [
  { name: "Trees and woodland", description: "Tree safety, woodland management and forestry", icon: "tree-pine", displayColour: "#2f855a" },
  { name: "Buildings", description: "Estate buildings, structures and fabric", icon: "building", displayColour: "#805ad5" },
  { name: "Paths and access", description: "Paths, gates, bridges and visitor access", icon: "route", displayColour: "#3182ce" },
  { name: "Water", description: "Ponds, drains, ditches and watercourses", icon: "waves", displayColour: "#0891b2" },
  { name: "Wildlife", description: "Habitats, species and ecological observations", icon: "bird", displayColour: "#65a30d" },
  { name: "Boundaries", description: "Fences, walls, hedges and estate boundaries", icon: "fence", displayColour: "#b7791f" },
  { name: "Grounds", description: "Parkland, gardens and general grounds", icon: "leaf", displayColour: "#38a169" },
  { name: "Health and safety", description: "Hazards and safety-related observations", icon: "triangle-alert", displayColour: "#c53030" },
] as const;

export const defaultLocations = [
  { name: "Blickling Hall", description: "Hall and immediate service areas", latitude: 52.8117, longitude: 1.2317 },
  { name: "Main Drive", description: "Main approach and verges", latitude: 52.8134, longitude: 1.2351 },
  { name: "Great Wood", description: "Core woodland compartment", latitude: 52.8225, longitude: 1.2244 },
  { name: "Lake Walk", description: "Public route around the lake", latitude: 52.8079, longitude: 1.2265 },
  { name: "Walled Garden", description: "Walled garden and entrances", latitude: 52.8102, longitude: 1.2291 },
  { name: "Estate Yard", description: "Operational yard and stores", latitude: 52.8151, longitude: 1.2364 },
] as const;
