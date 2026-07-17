/**
 * Seed script for Blickling Fieldbook development data.
 * Run with: npx tsx src/seed.ts
 */
import { db, pool } from "@workspace/db";
import {
  propertiesTable,
  usersTable,
  categoriesTable,
  namedLocationsTable,
  observationsTable,
  actionsTable,
  notesTable,
  auditEventsTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding Blickling Fieldbook...");

  // Clear existing data in correct order
  await db.delete(auditEventsTable);
  await db.delete(notesTable);
  await db.delete(actionsTable);
  await db.delete(observationsTable);
  await db.delete(namedLocationsTable);
  await db.delete(categoriesTable);
  await db.delete(usersTable);
  await db.delete(propertiesTable);

  // 1. Property
  const [property] = await db.insert(propertiesTable).values({
    name: "Blickling Estate",
    description: "A 4,777-acre National Trust estate in Norfolk, England. Home to Blickling Hall, ancient woodland, parkland, and productive farmland.",
    defaultLatitude: 52.8406,
    defaultLongitude: 1.2977,
    defaultZoom: 13,
  }).returning();

  console.log("Created property:", property.name);

  // 2. Users
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD ?? "admin123";
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? "admin@blickling.nt";

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const managerHash = await bcrypt.hash("manager123", 12);
  const memberHash = await bcrypt.hash("member123", 12);

  const [admin, manager, alice, tom] = await db.insert(usersTable).values([
    {
      name: "Estate Administrator",
      email: adminEmail,
      passwordHash,
      role: "administrator",
      active: true,
      propertyId: property.id,
    },
    {
      name: "Sarah Jennings",
      email: "sarah.jennings@blickling.nt",
      passwordHash: managerHash,
      role: "manager",
      active: true,
      propertyId: property.id,
    },
    {
      name: "Alice Frost",
      email: "alice.frost@blickling.nt",
      passwordHash: memberHash,
      role: "team_member",
      active: true,
      propertyId: property.id,
    },
    {
      name: "Tom Hadley",
      email: "tom.hadley@blickling.nt",
      passwordHash: memberHash,
      role: "team_member",
      active: true,
      propertyId: property.id,
    },
  ]).returning();

  console.log("Created 4 users");

  // 3. Categories (all 16 from spec)
  const categoryData = [
    { name: "Tree safety", description: "Hazardous trees, falling branches, structural defects", icon: "tree-pine", displayColour: "#2d6a4f", sortOrder: 1 },
    { name: "Paths and access", description: "Footpaths, bridleways, access routes and obstructions", icon: "footprints", displayColour: "#40916c", sortOrder: 2 },
    { name: "Habitat condition", description: "Woodland, grassland and general habitat condition", icon: "leaf", displayColour: "#52b788", sortOrder: 3 },
    { name: "Deer impact", description: "Deer browsing damage, population pressure indicators", icon: "scan-eye", displayColour: "#74c69d", sortOrder: 4 },
    { name: "Veteran trees", description: "Ancient and veteran tree features, monitoring", icon: "trees", displayColour: "#1b4332", sortOrder: 5 },
    { name: "Woodland management", description: "Coppice, thinning, ride management and planting", icon: "axe", displayColour: "#081c15", sortOrder: 6 },
    { name: "Grassland and meadow management", description: "Cutting regimes, grassland restoration, seeding", icon: "sprout", displayColour: "#b7e4c7", sortOrder: 7 },
    { name: "Water and wetland", description: "Drainage, ponds, rivers, wetland habitats", icon: "droplets", displayColour: "#1e6091", sortOrder: 8 },
    { name: "Invasive species", description: "Himalayan balsam, ragwort, grey squirrel and other invasives", icon: "ban", displayColour: "#e63946", sortOrder: 9 },
    { name: "Boundaries, gates and fencing", description: "Field boundaries, gates, stiles and fencing condition", icon: "fence", displayColour: "#a8dadc", sortOrder: 10 },
    { name: "Visitor incident", description: "Incidents involving visitors or the public", icon: "person-standing", displayColour: "#e76f51", sortOrder: 11 },
    { name: "Infrastructure", description: "Buildings, walls, bridges and estate infrastructure", icon: "building", displayColour: "#264653", sortOrder: 12 },
    { name: "Machinery and vehicles", description: "Plant, equipment and vehicle issues", icon: "settings", displayColour: "#e9c46a", sortOrder: 13 },
    { name: "Tenant or neighbour issue", description: "Matters relating to tenants or adjacent landowners", icon: "users", displayColour: "#f4a261", sortOrder: 14 },
    { name: "Completed work", description: "Record of completed tasks and maintenance", icon: "check-circle", displayColour: "#06d6a0", sortOrder: 15 },
    { name: "General observation", description: "Miscellaneous observations not covered by other categories", icon: "eye", displayColour: "#8ecae6", sortOrder: 16 },
  ];

  const categories = await db.insert(categoriesTable).values(
    categoryData.map((c) => ({ ...c, propertyId: property.id, active: true }))
  ).returning();

  console.log("Created 16 categories");

  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  // 4. Named locations
  const locationData = [
    { name: "Hercules Wood", description: "Ancient oak and lime woodland, north of the hall", latitude: 52.849, longitude: 1.291 },
    { name: "Great Wood", description: "Extensive mixed woodland to the east", latitude: 52.840, longitude: 1.318 },
    { name: "Tollands Meadow", description: "Species-rich grassland meadow", latitude: 52.833, longitude: 1.295 },
    { name: "Abel Heath", description: "Open heathland area to the south", latitude: 52.828, longitude: 1.288 },
    { name: "Leaselands", description: "Farmland and grazing fields", latitude: 52.845, longitude: 1.280 },
    { name: "Holly's Grove", description: "Small ancient woodland with veteran holly", latitude: 52.836, longitude: 1.308 },
    { name: "The Beeches", description: "Beech woodland on the estate boundary", latitude: 52.843, longitude: 1.302 },
    { name: "Mount Covert", description: "Game covert and mixed planting", latitude: 52.851, longitude: 1.284 },
    { name: "Osier Carr", description: "Wet carr woodland and fen", latitude: 52.830, longitude: 1.312 },
    { name: "Parkland", description: "Open parkland surrounding Blickling Hall", latitude: 52.841, longitude: 1.295 },
    { name: "Gardens", description: "Formal gardens and walled garden", latitude: 52.840, longitude: 1.292 },
    { name: "Moorgate", description: "Northern moorland and rough grazing", latitude: 52.856, longitude: 1.296 },
  ];

  const locations = await db.insert(namedLocationsTable).values(
    locationData.map((l) => ({ ...l, propertyId: property.id, active: true }))
  ).returning();

  console.log("Created 12 named locations");

  const locByName = Object.fromEntries(locations.map((l) => [l.name, l]));

  // 5. Observations (20+) - realistic mix
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const observationData = [
    {
      title: "Fallen oak limb obstructing Lake Walk",
      description: "A substantial lower limb from the large oak at grid ref has fallen across the main footpath. The limb is approximately 8m long and 30cm diameter at the break point. The path is completely blocked.",
      categoryId: catByName["Paths and access"].id,
      priority: "high" as const,
      status: "action_required" as const,
      observedAt: daysAgo(3),
      reportedByUserId: alice.id,
      latitude: 52.8398,
      longitude: 1.2942,
      namedLocationId: locByName["Parkland"].id,
      safetyIssue: true,
      publicAccessAffected: true,
      machineryRequired: true,
      followUpRequired: true,
    },
    {
      title: "Heavy browsing of coppice regrowth",
      description: "Extensive deer browsing on recently coppiced hazel stools in the south compartment. Regrowth from last winter's cut is almost entirely stripped. Deer population pressure appears to have increased.",
      categoryId: catByName["Deer impact"].id,
      priority: "normal" as const,
      status: "monitoring" as const,
      observedAt: daysAgo(14),
      reportedByUserId: manager.id,
      latitude: 52.8488,
      longitude: 1.2908,
      namedLocationId: locByName["Hercules Wood"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Damaged pedestrian gate latch",
      description: "The wooden kissing gate at the south entrance has a broken iron latch. The gate swings open freely and cannot be secured. Livestock may escape from the adjacent field.",
      categoryId: catByName["Boundaries, gates and fencing"].id,
      priority: "normal" as const,
      status: "action_required" as const,
      observedAt: daysAgo(7),
      reportedByUserId: tom.id,
      latitude: 52.8284,
      longitude: 1.2882,
      namedLocationId: locByName["Abel Heath"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Ragwort patch beside meadow boundary",
      description: "Established ragwort colony of approximately 15 plants found along the hedge line at the north boundary of the meadow. Needs pulling before it sets seed.",
      categoryId: catByName["Invasive species"].id,
      priority: "normal" as const,
      status: "under_review" as const,
      observedAt: daysAgo(10),
      reportedByUserId: alice.id,
      latitude: 52.8332,
      longitude: 1.2954,
      namedLocationId: locByName["Tollands Meadow"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Ryetec mower vibration and bearing failure",
      description: "Ryetec 1.8m flail mower producing excessive vibration and bearing noise from the left-hand drum. Risk of catastrophic bearing failure mid-operation. Machine taken out of service pending inspection.",
      categoryId: catByName["Machinery and vehicles"].id,
      priority: "urgent" as const,
      status: "action_required" as const,
      observedAt: daysAgo(2),
      reportedByUserId: tom.id,
      latitude: 52.8406,
      longitude: 1.2977,
      namedLocationId: null,
      safetyIssue: true,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Large ash dieback — potential road hazard",
      description: "Three large ash trees adjacent to the estate road showing advanced dieback and crown die-back of more than 50%. One tree has a large dead branch overhanging the carriageway. Urgent assessment required.",
      categoryId: catByName["Tree safety"].id,
      priority: "urgent" as const,
      status: "action_required" as const,
      observedAt: daysAgo(1),
      reportedByUserId: manager.id,
      latitude: 52.8421,
      longitude: 1.2968,
      namedLocationId: locByName["Parkland"].id,
      safetyIssue: true,
      publicAccessAffected: true,
      machineryRequired: true,
      followUpRequired: true,
    },
    {
      title: "Himalayan balsam colony along east ditch",
      description: "Significant colony of Himalayan balsam found along 80m of the east drainage ditch. Plants are currently in flower. Immediate action required before seed set.",
      categoryId: catByName["Invasive species"].id,
      priority: "high" as const,
      status: "action_required" as const,
      observedAt: daysAgo(5),
      reportedByUserId: alice.id,
      latitude: 52.8396,
      longitude: 1.3178,
      namedLocationId: locByName["Great Wood"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Veteran oak — large cavity at base",
      description: "Ancient parkland oak (estimated 400+ years) has a significant basal cavity on the north side, approximately 1.5m deep. The tree is structurally sound but the cavity provides important habitat. Recommend monitoring and designation as a veteran tree feature.",
      categoryId: catByName["Veteran trees"].id,
      priority: "low" as const,
      status: "monitoring" as const,
      observedAt: daysAgo(30),
      reportedByUserId: manager.id,
      latitude: 52.8412,
      longitude: 1.2951,
      namedLocationId: locByName["Parkland"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: false,
    },
    {
      title: "Pond margin vegetation — succession advancing",
      description: "The main pond in Osier Carr is showing significant vegetation succession with reedmace and willow scrub advancing into open water area from north and east margins. Open water reduced by approximately 20% since last survey.",
      categoryId: catByName["Water and wetland"].id,
      priority: "normal" as const,
      status: "submitted" as const,
      observedAt: daysAgo(21),
      reportedByUserId: alice.id,
      latitude: 52.8301,
      longitude: 1.3124,
      namedLocationId: locByName["Osier Carr"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Interpretation board damaged — visitor carpark",
      description: "The main estate interpretation board at the visitor carpark has been significantly damaged, probably by a reversing vehicle. The board is split vertically and the information is partially illegible.",
      categoryId: catByName["Infrastructure"].id,
      priority: "normal" as const,
      status: "resolved" as const,
      observedAt: daysAgo(45),
      reportedByUserId: tom.id,
      latitude: 52.8393,
      longitude: 1.2986,
      namedLocationId: locByName["Parkland"].id,
      safetyIssue: false,
      publicAccessAffected: true,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Section of deer fence down — Hercules Wood",
      description: "Approximately 20m of deer fence on the eastern boundary of Hercules Wood has collapsed following a large beech tree fall. The fence is flat on the ground. Deer access to newly planted areas is now unprotected.",
      categoryId: catByName["Boundaries, gates and fencing"].id,
      priority: "high" as const,
      status: "action_required" as const,
      observedAt: daysAgo(8),
      reportedByUserId: manager.id,
      latitude: 52.8501,
      longitude: 1.2934,
      namedLocationId: locByName["Hercules Wood"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: true,
      followUpRequired: true,
    },
    {
      title: "Yellow rattle establishment — north meadow",
      description: "Yellow rattle successfully established in the north section of Tollands Meadow from last autumn's seed sowing. Approximately 60% germination rate observed. Very positive result for the grassland restoration programme.",
      categoryId: catByName["Grassland and meadow management"].id,
      priority: "low" as const,
      status: "resolved" as const,
      observedAt: daysAgo(60),
      reportedByUserId: alice.id,
      latitude: 52.8351,
      longitude: 1.2941,
      namedLocationId: locByName["Tollands Meadow"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: false,
    },
    {
      title: "Bat roost noted — stable block",
      description: "During routine inspection of the stable block roof, significant bat activity observed at the eastern gable. Probable roost of common pipistrelle or brown long-eared bat. Needs survey before any roof work is planned.",
      categoryId: catByName["General observation"].id,
      priority: "normal" as const,
      status: "submitted" as const,
      observedAt: daysAgo(12),
      reportedByUserId: manager.id,
      latitude: 52.8404,
      longitude: 1.2989,
      namedLocationId: locByName["Gardens"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Coppice coupes completed — Great Wood north",
      description: "Winter coppicing of the northern compartment of Great Wood completed on schedule. Seven coupes covering 3.2ha. Brash burned in situ. Area now fenced for deer exclusion. First regrowth showing well.",
      categoryId: catByName["Completed work"].id,
      priority: "low" as const,
      status: "closed" as const,
      observedAt: daysAgo(90),
      reportedByUserId: tom.id,
      latitude: 52.8419,
      longitude: 1.3156,
      namedLocationId: locByName["Great Wood"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: true,
      followUpRequired: false,
    },
    {
      title: "Litter accumulation — public footpath junction",
      description: "Significant accumulation of visitor litter at the main footpath junction near the carpark. Appears to be a regular problem. Three bin bags worth collected today.",
      categoryId: catByName["General observation"].id,
      priority: "low" as const,
      status: "resolved" as const,
      observedAt: daysAgo(15),
      reportedByUserId: alice.id,
      latitude: 52.8389,
      longitude: 1.2979,
      namedLocationId: locByName["Parkland"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: false,
    },
    {
      title: "Footbridge decking — loose boards",
      description: "Three decking boards on the footbridge over the drainage ditch near Osier Carr are loose and one has rotted through. The bridge is still passable but poses a trip hazard. Repair needed within the week.",
      categoryId: catByName["Infrastructure"].id,
      priority: "high" as const,
      status: "action_required" as const,
      observedAt: daysAgo(4),
      reportedByUserId: tom.id,
      latitude: 52.8315,
      longitude: 1.3108,
      namedLocationId: locByName["Osier Carr"].id,
      safetyIssue: true,
      publicAccessAffected: true,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Tenant dispute — unauthorised field access",
      description: "Tenant at Leaselands Farm has been using estate track without the required gate code, causing conflict with neighbouring tenant. Both parties contacted. Mediation may be required.",
      categoryId: catByName["Tenant or neighbour issue"].id,
      priority: "normal" as const,
      status: "under_review" as const,
      observedAt: daysAgo(9),
      reportedByUserId: manager.id,
      latitude: 52.8447,
      longitude: 1.2798,
      namedLocationId: locByName["Leaselands"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Drainage ditch blocked — Holly's Grove",
      description: "Main drainage ditch to the east of Holly's Grove is completely blocked by accumulated debris and silt over approximately 15m. Standing water is now backing up into the adjacent woodland.",
      categoryId: catByName["Water and wetland"].id,
      priority: "normal" as const,
      status: "submitted" as const,
      observedAt: daysAgo(18),
      reportedByUserId: alice.id,
      latitude: 52.8362,
      longitude: 1.3082,
      namedLocationId: locByName["Holly's Grove"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: true,
      followUpRequired: true,
    },
    {
      title: "New barn owl box erected — Mount Covert",
      description: "Second barn owl nesting box successfully erected at the recommended height (5m) on the mature ash at the edge of Mount Covert. Box faces northeast as recommended. First box installed last season was occupied.",
      categoryId: catByName["Completed work"].id,
      priority: "low" as const,
      status: "closed" as const,
      observedAt: daysAgo(35),
      reportedByUserId: tom.id,
      latitude: 52.8512,
      longitude: 1.2843,
      namedLocationId: locByName["Mount Covert"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: false,
    },
    {
      title: "Visitor visitor slipped on muddy path — minor injury",
      description: "Visitor slipped on muddy section of path near The Beeches. Minor bruising to knee. Visitor declined medical assistance and continued their walk. Path conditions noted and reported to visitor services. Accident book completed.",
      categoryId: catByName["Visitor incident"].id,
      priority: "high" as const,
      status: "closed" as const,
      observedAt: daysAgo(22),
      reportedByUserId: alice.id,
      latitude: 52.8432,
      longitude: 1.3022,
      namedLocationId: locByName["The Beeches"].id,
      safetyIssue: true,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: true,
    },
    {
      title: "Habitat survey — Moorgate rough grazing",
      description: "Annual habitat condition survey of Moorgate rough grazing area completed. Sward condition generally good, purple moor grass co-dominant with wavy hair grass. Deer grazing pressure low. Evidence of curlew activity noted.",
      categoryId: catByName["Habitat condition"].id,
      priority: "low" as const,
      status: "submitted" as const,
      observedAt: daysAgo(6),
      reportedByUserId: manager.id,
      latitude: 52.8558,
      longitude: 1.2961,
      namedLocationId: locByName["Moorgate"].id,
      safetyIssue: false,
      publicAccessAffected: false,
      machineryRequired: false,
      followUpRequired: false,
    },
  ];

  const observations = await db.insert(observationsTable).values(
    observationData.map((o, i) => ({
      ...o,
      propertyId: property.id,
      referenceNumber: `BLK-2026-${String(i + 1).padStart(5, "0")}`,
    }))
  ).returning();

  console.log(`Created ${observations.length} observations`);

  const obs = Object.fromEntries(observations.map((o) => [o.title.slice(0, 30), o]));

  // 6. Actions (15+)
  const pastDate = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const futureDate = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const actionData = [
    {
      title: "Inspect and remove fallen oak limb from Lake Walk",
      description: "Assess structural integrity of fallen limb and parent tree. Remove obstruction from footpath using chainsaw. Dispose of timber and brash.",
      observationId: observations[0].id,
      assignedToUserId: tom.id,
      priority: "high" as const,
      status: "in_progress" as const,
      dueDate: futureDate(1),
      estimatedMinutes: 180,
      equipmentRequired: true,
      contractorRequired: false,
    },
    {
      title: "Repair or replace kissing gate latch — Abel Heath",
      description: "Source replacement iron latch or repair existing. Ensure gate closes securely to prevent livestock escape.",
      observationId: observations[2].id,
      assignedToUserId: tom.id,
      priority: "normal" as const,
      status: "not_started" as const,
      dueDate: futureDate(5),
      estimatedMinutes: 60,
      equipmentRequired: false,
      contractorRequired: false,
    },
    {
      title: "Pull ragwort before seed set — Tollands Meadow",
      description: "Hand pull all ragwort plants in the identified colony. Bag and remove from site. Do not compost. Check surrounding area.",
      observationId: observations[3].id,
      assignedToUserId: alice.id,
      priority: "normal" as const,
      status: "not_started" as const,
      dueDate: futureDate(3),
      estimatedMinutes: 90,
      equipmentRequired: false,
      contractorRequired: false,
    },
    {
      title: "Obtain repair estimate for Ryetec mower",
      description: "Contact Ryetec service agent for inspection and repair estimate. Assess operational impact on summer cutting programme. Report back to manager within 48 hours.",
      observationId: observations[4].id,
      assignedToUserId: manager.id,
      priority: "urgent" as const,
      status: "planned" as const,
      dueDate: futureDate(1),
      estimatedMinutes: 120,
      equipmentRequired: false,
      contractorRequired: true,
    },
    {
      title: "Arborist survey — ash trees on estate road",
      description: "Commission qualified arborist to assess three ash trees. Tree risk assessment required. Identify any immediate crown reduction or removal required.",
      observationId: observations[5].id,
      assignedToUserId: manager.id,
      priority: "urgent" as const,
      status: "planned" as const,
      dueDate: pastDate(0),  // Due today
      estimatedMinutes: 240,
      equipmentRequired: false,
      contractorRequired: true,
    },
    {
      title: "Clear Himalayan balsam — east ditch Great Wood",
      description: "Organise volunteer or work party to pull balsam along east ditch. Bag all material and remove from site. Check 50m either side of colony.",
      observationId: observations[6].id,
      assignedToUserId: alice.id,
      priority: "high" as const,
      status: "not_started" as const,
      dueDate: futureDate(2),
      estimatedMinutes: 300,
      equipmentRequired: false,
      contractorRequired: false,
    },
    {
      title: "Repair deer fence — Hercules Wood east boundary",
      description: "Clear fallen tree from fence line. Restore approximately 20m of deer fence. Check remaining fence line for further damage.",
      observationId: observations[10].id,
      assignedToUserId: tom.id,
      priority: "high" as const,
      status: "in_progress" as const,
      dueDate: pastDate(2),  // Overdue
      estimatedMinutes: 480,
      equipmentRequired: true,
      contractorRequired: false,
    },
    {
      title: "Replace footbridge decking boards — Osier Carr",
      description: "Remove and replace three loose decking boards. Check all boards and fixings. Treat replacement timber.",
      observationId: observations[15].id,
      assignedToUserId: tom.id,
      priority: "high" as const,
      status: "not_started" as const,
      dueDate: futureDate(3),
      estimatedMinutes: 120,
      equipmentRequired: true,
      contractorRequired: false,
    },
    {
      title: "Clear drainage ditch — Holly's Grove",
      description: "Clear debris and silt from 15m blocked section of east ditch. Remove accumulated material from site. Check outfall.",
      observationId: observations[17].id,
      assignedToUserId: tom.id,
      priority: "normal" as const,
      status: "not_started" as const,
      dueDate: futureDate(10),
      estimatedMinutes: 240,
      equipmentRequired: true,
      contractorRequired: false,
    },
    {
      title: "Commission bat survey — stable block",
      description: "Appoint licensed bat surveyor to carry out activity survey and roost assessment. Required before any roof maintenance can proceed.",
      observationId: observations[12].id,
      assignedToUserId: manager.id,
      priority: "normal" as const,
      status: "planned" as const,
      dueDate: futureDate(14),
      estimatedMinutes: 60,
      equipmentRequired: false,
      contractorRequired: true,
    },
    {
      title: "Monitor deer browsing pressure — Hercules Wood",
      description: "Install photo-monitoring points in affected compartment. Record browsing height and intensity. Monthly checks for next 6 months.",
      observationId: observations[1].id,
      assignedToUserId: alice.id,
      priority: "normal" as const,
      status: "in_progress" as const,
      dueDate: futureDate(30),
      estimatedMinutes: 90,
      equipmentRequired: false,
      contractorRequired: false,
    },
    {
      title: "Replace interpretation board — visitor carpark",
      description: "Order replacement panel from estate design team. Install new board on existing frame.",
      observationId: observations[9].id,
      assignedToUserId: tom.id,
      priority: "normal" as const,
      status: "completed" as const,
      dueDate: pastDate(20),
      completedAt: pastDate(18),
      completionNote: "New board ordered from estate design team and fitted. Old board removed and disposed of.",
      estimatedMinutes: 180,
      equipmentRequired: false,
      contractorRequired: false,
    },
    {
      title: "Mediate tenant access dispute — Leaselands",
      description: "Arrange meeting with both tenants and estate manager. Review terms of access agreements. Issue written communication confirming requirements.",
      observationId: observations[16].id,
      assignedToUserId: manager.id,
      priority: "normal" as const,
      status: "waiting" as const,
      dueDate: pastDate(3),  // Overdue
      estimatedMinutes: 120,
      equipmentRequired: false,
      contractorRequired: false,
      waitingReason: "Waiting for tenant to confirm meeting date",
    },
    {
      title: "Apply path grit to slippery section — The Beeches",
      description: "Apply grit and improve drainage at section identified in visitor incident report. Install warning sign if work cannot be completed immediately.",
      observationId: observations[19].id,
      assignedToUserId: alice.id,
      priority: "high" as const,
      status: "completed" as const,
      dueDate: pastDate(15),
      completedAt: pastDate(14),
      completionNote: "Section re-graded and 5 bags of grit applied. Good drainage restored.",
      estimatedMinutes: 90,
      equipmentRequired: true,
      contractorRequired: false,
    },
    {
      title: "Cut pond margins — Osier Carr",
      description: "Cut back advancing reedmace from north and east margins of main pond. Remove cut material from water. Survey open water area before and after.",
      observationId: observations[8].id,
      assignedToUserId: tom.id,
      priority: "normal" as const,
      status: "not_started" as const,
      dueDate: futureDate(21),
      estimatedMinutes: 360,
      equipmentRequired: true,
      contractorRequired: false,
    },
  ];

  const actions = await db.insert(actionsTable).values(
    actionData.map((a, i) => ({
      ...a,
      propertyId: property.id,
      referenceNumber: `ACT-2026-${String(i + 1).padStart(5, "0")}`,
      createdByUserId: manager.id,
      completedAt: (a as any).completedAt ?? null,
      completionNote: (a as any).completionNote ?? null,
      waitingReason: (a as any).waitingReason ?? null,
    }))
  ).returning();

  console.log(`Created ${actions.length} actions`);

  // 7. Notes
  await db.insert(notesTable).values([
    {
      observationId: observations[0].id,
      body: "Spoke with the countryside team. Tom will attend first thing tomorrow with the chainsaw. Parent tree also needs checking for further dead wood.",
      createdByUserId: manager.id,
    },
    {
      observationId: observations[1].id,
      body: "Photo monitoring points established at six locations. First survey showed approximately 70% browse damage to hazel regrowth below 1.2m. Will recheck in one month.",
      createdByUserId: alice.id,
    },
    {
      observationId: observations[5].id,
      body: "Coned off the road with temporary signs as a precaution. Called arborist — earliest they can attend is tomorrow morning.",
      createdByUserId: manager.id,
    },
    {
      actionId: actions[6].id,
      body: "Made a start on clearing the fallen beech. Tree completely clear by end of day. Fence repair to start tomorrow.",
      createdByUserId: tom.id,
    },
    {
      observationId: observations[4].id,
      body: "Machine fully isolated and locked out. Contacted Ryetec on 01603 XXXX. They can send an engineer Thursday morning.",
      createdByUserId: tom.id,
    },
    {
      actionId: actions[11].id,
      body: "New board arrived from design team and installed. Much better quality than the previous one. Job complete.",
      createdByUserId: tom.id,
    },
  ]);

  console.log("Created notes");

  // 8. Audit events
  await db.insert(auditEventsTable).values([
    { propertyId: property.id, observationId: observations[0].id, userId: alice.id, eventType: "observation_created", newValue: "Fallen oak limb obstructing Lake Walk" },
    { propertyId: property.id, observationId: observations[0].id, userId: manager.id, eventType: "status_changed", fieldName: "status", previousValue: "submitted", newValue: "action_required" },
    { propertyId: property.id, observationId: observations[5].id, userId: manager.id, eventType: "observation_created", newValue: "Large ash dieback — potential road hazard" },
    { propertyId: property.id, observationId: observations[5].id, userId: manager.id, eventType: "status_changed", fieldName: "status", previousValue: "submitted", newValue: "action_required" },
    { propertyId: property.id, observationId: observations[9].id, userId: manager.id, eventType: "status_changed", fieldName: "status", previousValue: "action_required", newValue: "resolved" },
    { propertyId: property.id, actionId: actions[11].id, userId: tom.id, eventType: "action_completed", newValue: "completed" },
    { propertyId: property.id, actionId: actions[13].id, userId: alice.id, eventType: "action_completed", newValue: "completed" },
  ]);

  console.log("Created audit events");
  console.log("\n✅ Seed complete!");
  console.log(`\nLogin credentials:`);
  console.log(`  Admin:   ${adminEmail} / ${adminPassword}`);
  console.log(`  Manager: sarah.jennings@blickling.nt / manager123`);
  console.log(`  Team:    alice.frost@blickling.nt / member123`);
  console.log(`  Team:    tom.hadley@blickling.nt / member123`);

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
