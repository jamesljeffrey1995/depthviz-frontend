export interface DiveSpot {
  name: string
  lat: number
  lon: number
  description: string
  userAdded?: boolean
  id?: string
  isPublic?: boolean
  createdBy?: string
  createdAt?: number
}

export const UK_DIVE_SPOTS: DiveSpot[] = [
  // Northeast England
  { name: 'St Abbs', lat: 55.897, lon: -2.138, description: 'Marine reserve with excellent visibility and diverse marine life' },
  { name: 'Eyemouth', lat: 55.871, lon: -2.090, description: 'Kelp forests and scenic wall dives' },
  { name: 'Farne Islands', lat: 55.618, lon: -1.649, description: 'Grey seal colony and colourful reef walls' },
  { name: 'Seahouses', lat: 55.585, lon: -1.655, description: 'Gateway to Farne Islands with wrecks nearby' },
  { name: 'Beadnell', lat: 55.552, lon: -1.638, description: 'Sheltered bay with shallow reef dives' },
  { name: 'Seaton Sluice', lat: 55.081, lon: -1.478, description: 'Shore dive with reefs and occasional wreck debris' },
  { name: 'Tynemouth', lat: 55.017, lon: -1.423, description: 'North Sea shore dives with reefs and wrecks offshore' },
  { name: 'Marsden Bay', lat: 54.997, lon: -1.375, description: 'Limestone sea stacks and cave diving' },
  { name: 'Hartlepool', lat: 54.694, lon: -1.213, description: 'Offshore wrecks and rocky reef dives' },
  { name: 'Whitby', lat: 54.489, lon: -0.613, description: 'Historic harbour town with wreck diving nearby' },
  { name: 'Scarborough', lat: 54.280, lon: -0.401, description: 'North Sea wrecks and rocky reef dives' },
  { name: 'Filey Brigg', lat: 54.217, lon: -0.270, description: 'Rocky headland with kelp beds and nudibranchs' },
  { name: 'Flamborough Head', lat: 54.116, lon: -0.082, description: 'Chalk cliffs and cave diving' },
  { name: 'Bridlington', lat: 54.083, lon: -0.193, description: 'Shallow reef dives with flatfish and crabs' },
  // Scotland
  { name: 'Bass Rock', lat: 56.078, lon: -2.640, description: 'Dramatic rock faces and gannet colony' },
  { name: 'Dunbar', lat: 56.003, lon: -2.518, description: 'Shore diving with rocky reefs and diverse life' },
  { name: 'Stonehaven', lat: 56.963, lon: -2.212, description: 'Rocky reefs and sheltered harbour dives' },
  { name: 'Oban', lat: 56.412, lon: -5.471, description: 'Wreck capital of Scotland with varied diving' },
  { name: 'Sound of Mull', lat: 56.516, lon: -5.864, description: 'Sheltered sound with spectacular wreck diving' },
  { name: 'Loch Carron', lat: 57.383, lon: -5.550, description: 'Scenic sea loch with sea life and wrecks' },
  { name: 'Isle of Skye', lat: 57.274, lon: -6.216, description: 'Remote diving with seals and basking sharks' },
  { name: 'Scapa Flow', lat: 58.883, lon: -3.098, description: 'World-famous WWI wreck site in Orkney' },
  { name: 'Shetland', lat: 60.154, lon: -1.145, description: 'Remote northern diving with stunning clarity' },
  { name: 'St Kilda', lat: 57.814, lon: -8.570, description: 'Remote archipelago with outstanding underwater scenery' },
  // Northern Ireland
  { name: "Brown's Bay", lat: 54.803, lon: -5.737, description: 'Sheltered sandy bay on Islandmagee with easy shore diving' },
  { name: 'Rathlin Island', lat: 55.300, lon: -6.197, description: 'Dramatic wrecks and abundant sea life off Northern Ireland' },
  { name: 'Ballycastle', lat: 55.208, lon: -6.243, description: 'North Antrim coast dives with kelp and sea urchins' },
  { name: 'Strangford Lough', lat: 54.380, lon: -5.607, description: 'Tidal narrows teeming with marine biodiversity' },
  // Southwest England
  { name: 'Plymouth', lat: 50.376, lon: -4.143, description: 'Wrecks, reefs and marine biology haven' },
  { name: 'Wembury', lat: 50.321, lon: -4.062, description: 'Marine conservation area with diverse reef life' },
  { name: 'Dartmouth', lat: 50.351, lon: -3.577, description: 'Estuary and offshore reef diving with wrecks' },
  { name: 'Torbay', lat: 50.462, lon: -3.525, description: 'Sheltered bay with wrecks and soft coral' },
  { name: 'Portland', lat: 50.573, lon: -2.450, description: 'Shore dives and quarry with clear water' },
  { name: 'Chesil Cove', lat: 50.543, lon: -2.444, description: 'Popular shore dive entry point' },
  { name: 'Chesil Beach', lat: 50.610, lon: -2.558, description: 'Shore dive with seasonal visibility' },
  { name: 'Swanage', lat: 50.609, lon: -1.960, description: 'Pier diving and the famous Swanage Pier' },
  { name: 'Kimmeridge Bay', lat: 50.607, lon: -2.117, description: 'Jurassic Coast shore dive and marine reserve' },
  { name: 'Lundy Island', lat: 51.174, lon: -4.668, description: 'Marine conservation zone with seal dives' },
  { name: 'Porthkerris', lat: 50.053, lon: -5.070, description: 'Shore dive on the Lizard Peninsula' },
  { name: 'Falmouth', lat: 50.154, lon: -5.064, description: 'Sheltered harbour with wrecks and reefs' },
  { name: 'Mevagissey', lat: 50.270, lon: -4.778, description: 'Cornish fishing port with reef and wreck dives nearby' },
  { name: 'Isles of Scilly', lat: 49.914, lon: -6.315, description: 'Crystal-clear waters with abundant marine life' },
  // South England
  { name: 'Bournemouth', lat: 50.714, lon: -1.870, description: 'Pier dive and shallow reef in sheltered bay' },
  { name: 'Poole', lat: 50.715, lon: -1.988, description: 'Shallow harbour and offshore wrecks' },
  { name: 'Selsey', lat: 50.730, lon: -0.790, description: 'Mixon Hole reef and lobster spotting' },
  { name: 'Brighton', lat: 50.815, lon: -0.137, description: 'Marina wreck and pier dives' },
  { name: 'Eastbourne', lat: 50.768, lon: 0.282, description: 'Shore dives with chalk reef and wrecks offshore' },
  { name: 'Hastings', lat: 50.856, lon: 0.571, description: 'Shallow reef dives with historic wreck sites' },
  { name: 'Folkestone', lat: 51.081, lon: 1.167, description: 'Underwater sculpture park and reef dives' },
  { name: 'Dover', lat: 51.127, lon: 1.329, description: 'English Channel wrecks and white cliff walls' },
  { name: 'The Needles', lat: 50.664, lon: -1.591, description: 'Isle of Wight chalk stacks with wrecks nearby' },
  // Wales
  { name: 'Dale', lat: 51.709, lon: -5.158, description: 'Pembrokeshire coast with seal encounters' },
  { name: 'Pembrokeshire', lat: 51.748, lon: -5.047, description: 'Spectacular coast with diverse marine life' },
  { name: 'Ramsey Island', lat: 51.873, lon: -5.323, description: 'Tidal races and grey seal breeding grounds' },
  { name: 'Bardsey Island', lat: 52.757, lon: -4.795, description: 'Remote island with clear water and porpoise' },
  { name: 'Anglesey', lat: 53.258, lon: -4.310, description: 'Strong currents with wrecks and reefs' },
  // Inland
  { name: 'Capernwray', lat: 54.150, lon: -2.758, description: 'Inland dive centre with sunken attractions' },
  { name: 'Stoney Cove', lat: 52.567, lon: -1.212, description: 'UK\'s national diving centre, inland quarry' },
  { name: 'Chepstow Quarry', lat: 51.643, lon: -2.672, description: 'Inland quarry dive site with clear freshwater' },
]
