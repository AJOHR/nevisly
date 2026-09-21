import type { PowerPlayTeamResult } from "@/lib/nhl/powerPlay";

export const POWER_PLAY_SNAPSHOT_CAPTURED_AT = "2026-09-21T19:10:00.000Z";

type SnapshotTeam = { updatedAt: string; pp1: string[]; pp2: string[] };

const SNAPSHOT: Record<string, SnapshotTeam> = {
  "ANA": {
    "updatedAt": "2026-09-19T03:47:43.582Z",
    "pp1": [
      "Beckett Sennecke",
      "Leo Carlsson",
      "Mikael Granlund",
      "Jackson Lacombe",
      "Cutter Gauthier"
    ],
    "pp2": [
      "Alex Killorn",
      "Ryan Poehling",
      "Frank Vatrano",
      "Pavel Mintyukov",
      "Nikita Klepov"
    ]
  },
  "BOS": {
    "updatedAt": "2026-09-17T16:08:26.374Z",
    "pp1": [
      "Morgan Geekie",
      "Elias Lindholm",
      "Pavel Zacha",
      "David Pastrnak",
      "Charlie McAvoy"
    ],
    "pp2": [
      "James Hagens",
      "Fraser Minten",
      "Casey Mittelstadt",
      "Hampus Lindholm",
      "JJ Peterka"
    ]
  },
  "BUF": {
    "updatedAt": "2026-09-17T14:16:17.389Z",
    "pp1": [
      "Jack Quinn",
      "Zach Benson",
      "Josh Doan",
      "Tage Thompson",
      "Rasmus Dahlin"
    ],
    "pp2": [
      "Ryan McLeod",
      "Josh Norris",
      "Noah Ostlund",
      "Owen Power",
      "Jiri Kulich"
    ]
  },
  "CGY": {
    "updatedAt": "2026-09-18T16:37:31.628Z",
    "pp1": [
      "Joel Farabee",
      "Morgan Frost",
      "Matt Coronato",
      "Matvei Gridin",
      "Zayne Parekh"
    ],
    "pp2": [
      "Maxim Tsyplakov",
      "Ryan Strome",
      "Connor Zary",
      "Simon Nemec",
      "Yegor Sharangovich"
    ]
  },
  "CAR": {
    "updatedAt": "2026-09-17T15:21:52.318Z",
    "pp1": [
      "Andrei Svechnikov",
      "Sebastian Aho",
      "Jackson Blake",
      "Nikolaj Ehlers",
      "Shayne Gostisbehere"
    ],
    "pp2": [
      "Taylor Hall",
      "Logan Stankoven",
      "Mark Jankowski",
      "K'Andre Miller",
      "Sean Walker"
    ]
  },
  "CHI": {
    "updatedAt": "2026-09-17T15:05:55.646Z",
    "pp1": [
      "Tyler Bertuzzi",
      "Anton Frondell",
      "Roman Kantserov",
      "Bowen Byram",
      "Patrick Kane"
    ],
    "pp2": [
      "Frank Nazar",
      "Oliver Moore",
      "Ryan Donato",
      "Sam Rinzel",
      "Nick Lardis"
    ]
  },
  "COL": {
    "updatedAt": "2026-09-17T20:34:05.499Z",
    "pp1": [
      "Martin Necas",
      "Nazem Kadri",
      "Gabriel Landeskog",
      "Nathan MacKinnon",
      "Cale Makar"
    ],
    "pp2": [
      "Jaden Schwartz",
      "Brock Nelson",
      "Artturi Lehkonen",
      "Devon Toews",
      "Brent Burns"
    ]
  },
  "CBJ": {
    "updatedAt": "2026-09-17T16:24:22.199Z",
    "pp1": [
      "Charlie Coyle",
      "Adam Fantilli",
      "Kent Johnson",
      "Kirill Marchenko",
      "Zach Werenski"
    ],
    "pp2": [
      "Conor Garland",
      "Sean Monahan",
      "Valeri Nichushkin",
      "Ivan Provorov",
      "Denton Mateychuk"
    ]
  },
  "DAL": {
    "updatedAt": "2026-09-17T17:36:50.263Z",
    "pp1": [
      "Mikko Rantanen",
      "Wyatt Johnston",
      "Matt Duchene",
      "Miro Heiskanen",
      "Jason Robertson"
    ],
    "pp2": [
      "Jamie Benn",
      "Roope Hintz",
      "Justin Hryckowian",
      "Tyler Seguin",
      "Thomas Harley"
    ]
  },
  "DET": {
    "updatedAt": "2026-09-17T15:16:48.513Z",
    "pp1": [
      "Viktor Arvidsson",
      "Andrew Copp",
      "Lucas Raymond",
      "Alex DeBrincat",
      "Moritz Seider"
    ],
    "pp2": [
      "Emmitt Finnie",
      "J.T. Compher",
      "Marco Kasper",
      "Justin Faulk",
      "Axel Sandin-Pellikka"
    ]
  },
  "EDM": {
    "updatedAt": "2026-09-17T20:35:05.894Z",
    "pp1": [
      "Zach Hyman",
      "Ryan Nugent-Hopkins",
      "Leon Draisaitl",
      "Evan Bouchard",
      "Connor McDavid"
    ],
    "pp2": [
      "Vasily Podkolzin",
      "Kasperi Kapanen",
      "Isaac Howard",
      "Mattias Ekholm",
      "Jake Walman"
    ]
  },
  "FLA": {
    "updatedAt": "2026-09-17T20:34:19.672Z",
    "pp1": [
      "Brady Tkachuk",
      "Aleksander Barkov",
      "Sam Reinhart",
      "Aaron Ekblad",
      "Matthew Tkachuk"
    ],
    "pp2": [
      "Sam Bennett",
      "Anton Lundell",
      "Carter Verhaeghe",
      "Seth Jones",
      "Gustav Forsling"
    ]
  },
  "LAK": {
    "updatedAt": "2026-09-18T18:44:22.863Z",
    "pp1": [
      "Mats Zuccarello",
      "Quinton Byfield",
      "Adrian Kempe",
      "Artemi Panarin",
      "Brandt Clarke"
    ],
    "pp2": [
      "Trevor Moore",
      "Erik Haula",
      "Corey Perry",
      "Drew Doughty",
      "Alex Laferriere"
    ]
  },
  "MIN": {
    "updatedAt": "2026-09-17T16:16:09.336Z",
    "pp1": [
      "Ryan Hartman",
      "Joel Eriksson Ek",
      "Matt Boldy",
      "Quinn Hughes",
      "Kirill Kaprizov"
    ],
    "pp2": [
      "Blake Coleman",
      "Danila Yurov",
      "Bobby Brink",
      "Brock Faber",
      "Maxim Shabanov"
    ]
  },
  "MTL": {
    "updatedAt": "2026-09-17T14:47:45.082Z",
    "pp1": [
      "Juraj Slafkovsky",
      "Nick Suzuki",
      "Ivan Demidov",
      "Cole Caufield",
      "Lane Hutson"
    ],
    "pp2": [
      "Chris Kreider",
      "Kirby Dach",
      "Alex Newhook",
      "Zack Bolduc",
      "Noah Dobson"
    ]
  },
  "NSH": {
    "updatedAt": "2026-09-17T18:30:49.601Z",
    "pp1": [
      "Filip Forsberg",
      "Ryan O'Reilly",
      "Matthew Wood",
      "Steven Stamkos",
      "Roman Josi"
    ],
    "pp2": [
      "Brady Martin",
      "Ross Colton",
      "Jonathan Marchessault",
      "Mavrik Bourque",
      "Ryan Ufko"
    ]
  },
  "NJD": {
    "updatedAt": "2026-09-17T18:16:44.449Z",
    "pp1": [
      "Jesper Bratt",
      "Nico Hischier",
      "Luke Evangelista",
      "Jack Hughes",
      "Luke Hughes"
    ],
    "pp2": [
      "Timo Meier",
      "Evan Rodrigues",
      "Anthony Mantha",
      "Arseny Gritsyuk",
      "Dougie Hamilton"
    ]
  },
  "NYI": {
    "updatedAt": "2026-09-17T16:20:09.833Z",
    "pp1": [
      "Brayden Schenn",
      "Bo Horvat",
      "Calum Ritchie",
      "Kyle Palmieri",
      "Matthew Schaefer"
    ],
    "pp2": [
      "Emil Heineman",
      "Anthony Duclair",
      "Matias Maccelli",
      "Simon Holmstrom",
      "Tony DeAngelo"
    ]
  },
  "NYR": {
    "updatedAt": "2026-09-17T15:19:24.249Z",
    "pp1": [
      "Alexis Lafrenière",
      "J.T. Miller",
      "Pavel Dorofeyev",
      "Mika Zibanejad",
      "Adam Fox"
    ],
    "pp2": [
      "Will Cuylle",
      "Noah Laba",
      "Gabriel Perreault",
      "Oliver Bjorkstrand",
      "Sean Durzi"
    ]
  },
  "OTT": {
    "updatedAt": "2026-09-17T14:55:42.476Z",
    "pp1": [
      "Drake Batherson",
      "Tim Stützle",
      "Dylan Cozens",
      "Jake Sanderson",
      "William Eklund"
    ],
    "pp2": [
      "Andre Burakovsky",
      "Shane Pinto",
      "Claude Giroux",
      "Carter Yakemchuk",
      "Thomas Chabot"
    ]
  },
  "PHI": {
    "updatedAt": "2026-07-04T12:58:57.899Z",
    "pp1": [
      "Denver Barkey",
      "Trevor Zegras",
      "Matvei Michkov",
      "Owen Tippett",
      "Jamie Drysdale"
    ],
    "pp2": [
      "Travis Konecny",
      "Noah Cates",
      "Porter Martone",
      "Tyson Foerster",
      "David Jiricek"
    ]
  },
  "PIT": {
    "updatedAt": "2026-09-17T20:24:53.422Z",
    "pp1": [
      "Andrei Kuzmenko",
      "Evgeni Malkin",
      "Rickard Rakell",
      "Erik Karlsson",
      "Sidney Crosby"
    ],
    "pp2": [
      "Bryan Rust",
      "Ben Kindel",
      "Egor Chinakhov",
      "Kris Letang",
      "Tommy Novak"
    ]
  },
  "SJS": {
    "updatedAt": "2026-09-17T17:44:23.227Z",
    "pp1": [
      "Igor Chernyshov",
      "Alexander Wennberg",
      "Will Smith",
      "Macklin Celebrini",
      "Luca Cagnoni"
    ],
    "pp2": [
      "Mason Marchment",
      "Michael Misa",
      "Tyler Toffoli",
      "Dmitry Orlov",
      "Ivar Stenberg"
    ]
  },
  "SEA": {
    "updatedAt": "2026-09-17T18:24:13.015Z",
    "pp1": [
      "Jordan Eberle",
      "Matty Beniers",
      "Chandler Stephenson",
      "Vince Dunn",
      "Jared McCann"
    ],
    "pp2": [
      "Bobby McMann",
      "Shane Wright",
      "Mackie Samoskevich",
      "Berkly Catton",
      "Brandon Montour"
    ]
  },
  "STL": {
    "updatedAt": "2026-09-17T15:38:30.906Z",
    "pp1": [
      "Jimmy Snuggerud",
      "Robert Thomas",
      "Dylan Holloway",
      "Philip Broberg",
      "Mason McTavish"
    ],
    "pp2": [
      "Jake Neighbours",
      "Pavel Buchnevich",
      "Dalibor Dvorsky",
      "Connor McMichael",
      "Logan Mailloux"
    ]
  },
  "TBL": {
    "updatedAt": "2026-09-17T16:10:49.215Z",
    "pp1": [
      "Brandon Hagel",
      "Jake Guentzel",
      "Nikita Kucherov",
      "Brayden Point",
      "John Carlson"
    ],
    "pp2": [
      "Pontus Holmberg",
      "Anthony Cirelli",
      "Conor Geekie",
      "Gage Goncalves",
      "Victor Hedman"
    ]
  },
  "TOR": {
    "updatedAt": "2026-09-18T16:30:14.191Z",
    "pp1": [
      "Jack Roslovic",
      "John Tavares",
      "William Nylander",
      "Darren Raddysh",
      "Auston Matthews"
    ],
    "pp2": [
      "Matthew Knies",
      "Easton Cowan",
      "Gavin McKenna",
      "Morgan Rielly",
      "Oliver Ekman-Larsson"
    ]
  },
  "UTA": {
    "updatedAt": "2026-09-17T18:45:31.292Z",
    "pp1": [
      "Dylan Guenther",
      "Logan Cooley",
      "Nick Schmaltz",
      "Clayton Keller",
      "Mikhail Sergachev"
    ],
    "pp2": [
      "Anders Lee",
      "Vincent Trocheck",
      "Kailer Yamamoto",
      "Barrett Hayton",
      "John Marino"
    ]
  },
  "VAN": {
    "updatedAt": "2026-09-17T20:06:15.055Z",
    "pp1": [
      "Jake DeBrusk",
      "Marco Rossi",
      "Brock Boeser",
      "Zeev Buium",
      "Elias Pettersson"
    ],
    "pp2": [
      "Liam Ohgren",
      "Filip Chytil",
      "Linus Karlsson",
      "Jonathan Lekkerimaki",
      "Filip Hronek"
    ]
  },
  "VGK": {
    "updatedAt": "2026-07-04T14:29:34.716Z",
    "pp1": [
      "Jack Eichel",
      "Tomas Hertl",
      "Mark Stone",
      "Shea Theodore",
      "Mitch Marner"
    ],
    "pp2": [
      "Ivan Barbashev",
      "William Karlsson",
      "Victor Olofsson",
      "Rasmus Andersson",
      "Noah Hanifin"
    ]
  },
  "WSH": {
    "updatedAt": "2026-09-21T16:22:07.914Z",
    "pp1": [
      "Tom Wilson",
      "Dylan Strome",
      "Pierre-Luc Dubois",
      "Alex Ovechkin",
      "Jakob Chychrun"
    ],
    "pp2": [
      "Alex Tuch",
      "Ilya Protas",
      "Ryan Leonard",
      "Cole Hutson",
      "Jordan Kyrou"
    ]
  },
  "WPG": {
    "updatedAt": "2026-09-17T18:41:50.680Z",
    "pp1": [
      "Gabriel Vilardi",
      "Mark Scheifele",
      "Cole Perfetti",
      "Josh Morrissey",
      "Kyle Connor"
    ],
    "pp2": [
      "Nino Niederreiter",
      "Viggo Björck",
      "Brad Lambert",
      "Neal Pionk",
      "Isak Rosen"
    ]
  }
};

const SLUGS: Record<string, string> = {
  "ANA": "anaheim-ducks",
  "BOS": "boston-bruins",
  "BUF": "buffalo-sabres",
  "CGY": "calgary-flames",
  "CAR": "carolina-hurricanes",
  "CHI": "chicago-blackhawks",
  "COL": "colorado-avalanche",
  "CBJ": "columbus-blue-jackets",
  "DAL": "dallas-stars",
  "DET": "detroit-red-wings",
  "EDM": "edmonton-oilers",
  "FLA": "florida-panthers",
  "LAK": "los-angeles-kings",
  "MIN": "minnesota-wild",
  "MTL": "montreal-canadiens",
  "NSH": "nashville-predators",
  "NJD": "new-jersey-devils",
  "NYI": "new-york-islanders",
  "NYR": "new-york-rangers",
  "OTT": "ottawa-senators",
  "PHI": "philadelphia-flyers",
  "PIT": "pittsburgh-penguins",
  "SJS": "san-jose-sharks",
  "SEA": "seattle-kraken",
  "STL": "st-louis-blues",
  "TBL": "tampa-bay-lightning",
  "TOR": "toronto-maple-leafs",
  "UTA": "utah-mammoth",
  "VAN": "vancouver-canucks",
  "VGK": "vegas-golden-knights",
  "WSH": "washington-capitals",
  "WPG": "winnipeg-jets"
};

export function powerPlaySnapshotTeam(team: string): PowerPlayTeamResult | undefined {
  const data = SNAPSHOT[team];
  if (!data) return undefined;

  const players = [
    ...data.pp1.map((name) => ({
      name,
      team,
      unit: "PP1" as const,
      updatedAt: data.updatedAt,
      source: "Daily Faceoff" as const,
      delivery: "snapshot" as const,
      capturedAt: POWER_PLAY_SNAPSHOT_CAPTURED_AT,
    })),
    ...data.pp2.map((name) => ({
      name,
      team,
      unit: "PP2" as const,
      updatedAt: data.updatedAt,
      source: "Daily Faceoff" as const,
      delivery: "snapshot" as const,
      capturedAt: POWER_PLAY_SNAPSHOT_CAPTURED_AT,
    })),
  ];

  return {
    team,
    slug: SLUGS[team] ?? "",
    updatedAt: data.updatedAt,
    status: "ok",
    reason: "snapshot-fallback",
    players,
  };
}

export const POWER_PLAY_SNAPSHOT_TEAMS = Object.keys(SNAPSHOT);
