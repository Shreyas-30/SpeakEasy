export interface Suggestion {
  id: string;   // name.toLowerCase().trim()
  name: string; // display name shown in chip
}

export const NICHE_SUGGESTIONS: Suggestion[] = [
  // Motorsport & Vehicles
  { id: 'formula 1',        name: 'Formula 1' },
  { id: 'motogp',           name: 'MotoGP' },
  { id: 'rally racing',     name: 'Rally Racing' },
  { id: 'electric cars',    name: 'Electric Cars' },
  { id: 'cars',             name: 'Cars' },
  { id: 'motorcycles',      name: 'Motorcycles' },

  // Fitness & Wellness
  { id: 'yoga',             name: 'Yoga' },
  { id: 'running',          name: 'Running' },
  { id: 'cycling',          name: 'Cycling' },
  { id: 'weightlifting',    name: 'Weightlifting' },
  { id: 'crossfit',         name: 'CrossFit' },
  { id: 'pilates',          name: 'Pilates' },
  { id: 'meditation',       name: 'Meditation' },
  { id: 'mental health',    name: 'Mental Health' },
  { id: 'nutrition',        name: 'Nutrition' },

  // Cuisine & Food Niches
  { id: 'baking',           name: 'Baking' },
  { id: 'vegan food',       name: 'Vegan Food' },
  { id: 'street food',      name: 'Street Food' },
  { id: 'coffee',           name: 'Coffee' },
  { id: 'cocktails',        name: 'Cocktails' },
  { id: 'wine',             name: 'Wine' },
  { id: 'sushi',            name: 'Sushi' },

  // Finance & Economics
  { id: 'crypto',           name: 'Crypto' },
  { id: 'investing',        name: 'Investing' },
  { id: 'startups',         name: 'Startups' },
  { id: 'personal finance', name: 'Personal Finance' },
  { id: 'real estate',      name: 'Real Estate' },
  { id: 'stock market',     name: 'Stock Market' },

  // Music Genres & Niches
  { id: 'k-pop',            name: 'K-Pop' },
  { id: 'hip hop',          name: 'Hip Hop' },
  { id: 'jazz',             name: 'Jazz' },
  { id: 'classical music',  name: 'Classical Music' },
  { id: 'indie music',      name: 'Indie Music' },
  { id: 'electronic music', name: 'Electronic Music' },
  { id: 'podcasts',         name: 'Podcasts' },

  // Outdoor & Adventure
  { id: 'hiking',           name: 'Hiking' },
  { id: 'surfing',          name: 'Surfing' },
  { id: 'climbing',         name: 'Climbing' },
  { id: 'camping',          name: 'Camping' },
  { id: 'skiing',           name: 'Skiing' },
  { id: 'diving',           name: 'Diving' },
  { id: 'fishing',          name: 'Fishing' },

  // Creative & Craft Hobbies
  { id: 'photography',      name: 'Photography' },
  { id: 'drawing',          name: 'Drawing' },
  { id: 'ceramics',         name: 'Ceramics' },
  { id: 'knitting',         name: 'Knitting' },
  { id: 'interior design',  name: 'Interior Design' },
  { id: 'architecture',     name: 'Architecture' },

  // Specific Sports
  { id: 'basketball',       name: 'Basketball' },
  { id: 'football',         name: 'Football' },
  { id: 'tennis',           name: 'Tennis' },
  { id: 'cricket',          name: 'Cricket' },
  { id: 'golf',             name: 'Golf' },
  { id: 'boxing',           name: 'Boxing' },
  { id: 'martial arts',     name: 'Martial Arts' },

  // Pop Culture & Tech Niches
  { id: 'true crime',       name: 'True Crime' },
  { id: 'space',            name: 'Space' },
  { id: 'ai',               name: 'AI' },
  { id: 'cybersecurity',    name: 'Cybersecurity' },
  { id: 'web3',             name: 'Web3' },
  { id: 'sustainability',   name: 'Sustainability' },
  { id: 'history',          name: 'History' },
  { id: 'books',            name: 'Books' },
  { id: 'languages',        name: 'Languages' },
];
