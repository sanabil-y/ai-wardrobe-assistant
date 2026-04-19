require('dotenv').config();

// express for backend routes
const express = require('express');

// lets frontend talk to backend
const cors = require('cors');

// openai sdk
const OpenAI = require('openai');

const app = express();

// allows cross origin requests
app.use(cors());

// lets backend accept json, bigger limit because of image/url payloads
app.use(express.json({ limit: '10mb' }));

// creating openai client using api key from env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// just a simple test route to check backend is alive
app.get('/test', (req, res) => {
  res.json({ message: 'Backend works' });
});

// makes text lower case and removes spaces around it
const normalise = (value = '') => value.toString().trim().toLowerCase();

// makes text look cleaner like title case
const titleCase = (value = '') =>
  value
    .toString()
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

// tries to force clothing categories into one standard version
const normaliseCategory = (cat = '') => {
  const c = normalise(cat);

  // top type words
  if (
    c.includes('shirt') ||
    c.includes('top') ||
    c.includes('t-shirt') ||
    c.includes('tee') ||
    c.includes('blouse')
  )
    return 'top';

  // bottom type words
  if (
    c.includes('trouser') ||
    c.includes('jean') ||
    c.includes('skirt') ||
    c.includes('pant') ||
    c.includes('bottom')
  )
    return 'bottom';

  // outerwear words
  if (
    c.includes('jacket') ||
    c.includes('coat') ||
    c.includes('hoodie') ||
    c.includes('blazer') ||
    c.includes('cardigan') ||
    c.includes('outerwear')
  )
    return 'outerwear';

  // shoe words
  if (
    c.includes('shoe') ||
    c.includes('trainer') ||
    c.includes('boot') ||
    c.includes('heel') ||
    c.includes('loafer') ||
    c.includes('sneaker') ||
    c.includes('flat')
  )
    return 'shoes';

  if (c.includes('dress')) return 'dress';

  // accessory words
  if (
    c.includes('bag') ||
    c.includes('accessory') ||
    c.includes('belt') ||
    c.includes('scarf')
  )
    return 'accessory';

  // fallback if none matched
  return c || 'other';
};

// joins main item fields into one searchable text string
const getItemText = (item = {}) =>
  [
    normalise(item.itemName),
    normalise(item.description),
    normalise(item.category),
    normalise(item.occasion),
    normalise(item.mood),
    normalise(item.colour),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

// creates one stable key from outfit item ids
const getOutfitKeyFromIds = (ids = []) => [...ids].sort().join('|');

// tries to safely pull json object out of model response
const extractJsonObject = (text = '') => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('No JSON object found in model response');
    }

    return JSON.parse(match[0]);
  }
};

// some colour words mapped into one cleaner standard
const COLOUR_ALIASES = {
  gray: 'grey',
  charcoal: 'grey',
  offwhite: 'white',
  ivory: 'cream',
  tan: 'beige',
  camel: 'beige',
  burgundy: 'red',
  maroon: 'red',
  wine: 'red',
  lilac: 'purple',
  lavender: 'purple',
  magenta: 'pink',
  khaki: 'green',
  olive: 'green',
  denim: 'blue',
};

// colour groups used later for harmony scoring
const NEUTRAL_COLOURS = new Set([
  'black',
  'white',
  'grey',
  'beige',
  'cream',
  'brown',
  'navy',
]);

const EARTH_COLOURS = new Set(['beige', 'cream', 'brown', 'green']);
const BRIGHT_COLOURS = new Set(['red', 'yellow', 'orange', 'pink', 'purple']);
const COOL_COLOURS = new Set(['blue', 'navy', 'green', 'purple', 'grey']);
const WARM_COLOURS = new Set([
  'red',
  'orange',
  'yellow',
  'brown',
  'beige',
  'cream',
  'pink',
]);

// these colour pairs usually clash hard
const HARD_CLASH_PAIRS = [
  ['red', 'green'],
  ['yellow', 'purple'],
  ['orange', 'pink'],
  ['red', 'orange'],
  ['yellow', 'pink'],
];

// these tend to work well together
const GOOD_PAIRS = [
  ['black', 'white'],
  ['black', 'grey'],
  ['black', 'beige'],
  ['black', 'cream'],
  ['black', 'navy'],
  ['white', 'blue'],
  ['white', 'navy'],
  ['white', 'grey'],
  ['beige', 'brown'],
  ['beige', 'cream'],
  ['navy', 'beige'],
  ['navy', 'white'],
  ['blue', 'white'],
  ['blue', 'grey'],
  ['green', 'beige'],
  ['green', 'cream'],
];

// turns diff shades / names into one standard colour label
const canonicalColour = (colour = '') => {
  const c = normalise(colour);
  if (!c) return '';

  if (COLOUR_ALIASES[c]) return COLOUR_ALIASES[c];

  if (c.includes('navy')) return 'navy';
  if (c.includes('black')) return 'black';
  if (c.includes('white')) return 'white';
  if (c.includes('grey') || c.includes('gray')) return 'grey';
  if (c.includes('beige') || c.includes('camel') || c.includes('tan'))
    return 'beige';
  if (c.includes('cream') || c.includes('ivory')) return 'cream';
  if (c.includes('brown')) return 'brown';
  if (c.includes('blue') || c.includes('denim')) return 'blue';
  if (c.includes('green') || c.includes('olive') || c.includes('khaki'))
    return 'green';
  if (c.includes('red') || c.includes('burgundy') || c.includes('maroon'))
    return 'red';
  if (c.includes('yellow')) return 'yellow';
  if (c.includes('orange')) return 'orange';
  if (c.includes('pink')) return 'pink';
  if (c.includes('purple') || c.includes('lilac') || c.includes('lavender'))
    return 'purple';

  // fallback just takes first word
  return c.split(' ')[0];
};

// checks if colour is neutral
const isNeutralColour = (colour = '') =>
  NEUTRAL_COLOURS.has(canonicalColour(colour));

// checks if pair is in good pair list
const isGoodPair = (a = '', b = '') => {
  const first = canonicalColour(a);
  const second = canonicalColour(b);

  return GOOD_PAIRS.some(
    ([x, y]) => (first === x && second === y) || (first === y && second === x)
  );
};

// checks if pair is one of the bad clash pairs
const isHardClash = (a = '', b = '') => {
  const first = canonicalColour(a);
  const second = canonicalColour(b);

  return HARD_CLASH_PAIRS.some(
    ([x, y]) => (first === x && second === y) || (first === y && second === x)
  );
};

// gives a harmony score for the colours in one outfit
const getColourHarmonyScore = (colours = []) => {
  if (!colours.length) return 0;

  let score = 0;

  for (let i = 0; i < colours.length; i += 1) {
    for (let j = i + 1; j < colours.length; j += 1) {
      const a = canonicalColour(colours[i]);
      const b = canonicalColour(colours[j]);

      if (!a || !b) continue;

      // same colour can look cohesive
      if (a === b) {
        score += 5;
        continue;
      }

      // hard clash gets strong minus
      if (isHardClash(a, b)) {
        score -= 10;
        continue;
      }

      // neutral with almost anything usually works
      if (isNeutralColour(a) || isNeutralColour(b)) {
        score += 4;
        continue;
      }

      if (isGoodPair(a, b)) {
        score += 5;
        continue;
      }

      if (EARTH_COLOURS.has(a) && EARTH_COLOURS.has(b)) {
        score += 3;
        continue;
      }

      if (COOL_COLOURS.has(a) && COOL_COLOURS.has(b)) {
        score += 2;
        continue;
      }

      if (
        WARM_COLOURS.has(a) &&
        WARM_COLOURS.has(b) &&
        !BRIGHT_COLOURS.has(a) &&
        !BRIGHT_COLOURS.has(b)
      ) {
        score += 1;
        continue;
      }

      // if nothing good matched, small penalty
      score -= 4;
    }
  }

  return score;
};

// helper to check if text contains any word from a list
const textHasAny = (text, words) => words.some((word) => text.includes(word));

// tries to work out style signals from each clothing item
const inferItemSignals = (item = {}) => {
  const text = getItemText(item);
  const explicitOccasion = normalise(item.occasion);
  const category = normaliseCategory(item.category);
  const colour = canonicalColour(item.colour);

  // lots of little booleans so later scoring is easier
  const isJeans = textHasAny(text, ['jean', 'denim']);
  const isHoodie = textHasAny(text, ['hoodie', 'sweatshirt']);
  const isJogger = textHasAny(text, [
    'jogger',
    'tracksuit',
    'track pant',
    'sweatpant',
  ]);
  const isLegging = textHasAny(text, ['legging']);
  const isTrainer = textHasAny(text, ['trainer', 'sneaker', 'running shoe']);
  const isBoot = textHasAny(text, ['boot']);
  const isHeel = textHasAny(text, ['heel']);
  const isLoafer = textHasAny(text, ['loafer']);
  const isFlat = textHasAny(text, ['flat', 'ballet']);
  const isBlazer = textHasAny(text, ['blazer']);
  const isShirt = textHasAny(text, [
    'shirt',
    'button down',
    'button-up',
    'button up',
    'blouse',
  ]);
  const isTrouser = textHasAny(text, [
    'trouser',
    'tailored pant',
    'tailored pants',
    'slack',
  ]);
  const isSkirt = textHasAny(text, ['skirt']);

  // tries to split dress into casual or dressy
  const isDressyDress =
    category === 'dress' &&
    textHasAny(text, ['formal', 'elegant', 'satin', 'midi', 'maxi', 'evening']);

  const isCasualDress =
    category === 'dress' &&
    textHasAny(text, ['casual', 'cotton', 'knit', 'day dress', 't-shirt dress']);

  const isTee = textHasAny(text, ['t-shirt', 'tee']);
  const isKnit = textHasAny(text, ['knit', 'jumper', 'sweater', 'cardigan']);
  const isCoat = textHasAny(text, ['coat', 'trench', 'wool coat']);
  const isPuffer = textHasAny(text, ['puffer']);

  // sporty / structured / party type vibes
  const isSporty =
    textHasAny(text, [
      'gym',
      'sport',
      'active',
      'running',
      'training',
      'workout',
    ]) || isLegging || isJogger || isTrainer;

  const isStructured =
    isBlazer ||
    isShirt ||
    isTrouser ||
    isLoafer ||
    isHeel ||
    textHasAny(text, ['tailored', 'structured', 'formal', 'smart']);

  const isParty =
    textHasAny(text, [
      'party',
      'going out',
      'night out',
      'evening',
      'satin',
      'heels',
      'sparkle',
      'sequin',
    ]) || isHeel;

  const isCasual =
    isTee ||
    isJeans ||
    isHoodie ||
    isKnit ||
    isCasualDress ||
    textHasAny(text, ['casual', 'relaxed', 'everyday']);

  const isHeavy =
    isCoat || isPuffer || isBoot || textHasAny(text, ['wool', 'thick', 'heavy']);

  // style scores for each occasion lane
  const styleScores = {
    formal: 0,
    work: 0,
    casual: 0,
    party: 0,
    sport: 0,
  };

  // if item already had an explicit occasion, use that too
  if (explicitOccasion && styleScores[explicitOccasion] !== undefined) {
    styleScores[explicitOccasion] += 6;
  }

  if (isStructured) {
    styleScores.formal += 4;
    styleScores.work += 4;
  }

  if (isCasual) {
    styleScores.casual += 5;
  }

  if (isParty) {
    styleScores.party += 5;
  }

  if (isSporty) {
    styleScores.sport += 7;
  }

  // some item types clearly hurt certain occasions
  if (isJeans || isHoodie || isJogger || isTrainer) {
    styleScores.formal -= 6;
    styleScores.work -= 4;
    styleScores.casual += 3;
  }

  if (isBlazer) {
    styleScores.casual -= 5;
    styleScores.formal += 4;
    styleScores.work += 4;
  }

  if (isTrouser) {
    styleScores.formal += 3;
    styleScores.work += 4;
  }

  if (isHeel || isLoafer) {
    styleScores.formal += 4;
    styleScores.work += 3;
    styleScores.party += 3;
    styleScores.casual -= 2;
  }

  if (isFlat) {
    styleScores.work += 2;
    styleScores.casual += 1;
  }

  if (isDressyDress) {
    styleScores.formal += 5;
    styleScores.party += 4;
  }

  if (isCasualDress) {
    styleScores.casual += 4;
    styleScores.formal -= 3;
  }

  // ranking styles so we know top 2
  const rankedStyles = Object.entries(styleScores).sort((a, b) => b[1] - a[1]);
  const primaryStyle = rankedStyles[0][0];
  const secondaryStyle = rankedStyles[1][0];

  return {
    text,
    category,
    colour,
    explicitOccasion,
    primaryStyle,
    secondaryStyle,
    styleScores,
    isJeans,
    isHoodie,
    isJogger,
    isLegging,
    isTrainer,
    isBoot,
    isHeel,
    isLoafer,
    isFlat,
    isBlazer,
    isShirt,
    isTrouser,
    isSkirt,
    isSporty,
    isStructured,
    isCasual,
    isParty,
    isHeavy,
    isPuffer,
    isCoat,
    isTee,
    isKnit,
  };
};

// checks if one item is allowed for the requested occasion
const isItemAllowedForOccasion = (signals, requestedOccasion) => {
  const { category } = signals;

  if (requestedOccasion === 'formal') {
    if (
      signals.isHoodie ||
      signals.isJogger ||
      signals.isTrainer ||
      signals.isLegging ||
      signals.isJeans
    )
      return false;

    if (
      category === 'shoes' &&
      !(
        signals.isHeel ||
        signals.isLoafer ||
        signals.isBoot ||
        signals.styleScores.formal >= 4 ||
        signals.styleScores.work >= 4
      )
    )
      return false;

    if (
      category === 'outerwear' &&
      !(
        signals.isBlazer ||
        signals.isCoat ||
        signals.styleScores.formal >= 4 ||
        signals.styleScores.work >= 4
      )
    )
      return false;

    if (
      category === 'top' &&
      !(
        signals.isShirt ||
        signals.isStructured ||
        signals.styleScores.formal >= 4 ||
        signals.styleScores.work >= 5
      )
    )
      return false;

    if (
      category === 'bottom' &&
      !(
        signals.isTrouser ||
        signals.isSkirt ||
        signals.styleScores.formal >= 4 ||
        signals.styleScores.work >= 5
      )
    )
      return false;

    if (
      category === 'dress' &&
      signals.styleScores.formal < 4 &&
      signals.styleScores.party < 3
    )
      return false;

    return true;
  }

  if (requestedOccasion === 'work') {
    if (
      signals.isHoodie ||
      signals.isJogger ||
      signals.isTrainer ||
      signals.isLegging
    )
      return false;

    if (signals.isJeans && signals.explicitOccasion !== 'work') return false;

    if (
      category === 'shoes' &&
      !(
        signals.isLoafer ||
        signals.isHeel ||
        signals.isFlat ||
        signals.isBoot ||
        signals.styleScores.work >= 4 ||
        signals.styleScores.formal >= 4
      )
    )
      return false;

    if (
      category === 'outerwear' &&
      !(
        signals.isBlazer ||
        signals.isCoat ||
        signals.isKnit ||
        signals.styleScores.work >= 4 ||
        signals.styleScores.formal >= 4
      )
    )
      return false;

    if (
      category === 'top' &&
      !(
        signals.isShirt ||
        signals.isKnit ||
        signals.styleScores.work >= 4 ||
        signals.styleScores.formal >= 4
      )
    )
      return false;

    if (
      category === 'bottom' &&
      !(
        signals.isTrouser ||
        signals.isSkirt ||
        (signals.isJeans && signals.explicitOccasion === 'work') ||
        signals.styleScores.work >= 4
      )
    )
      return false;

    if (
      category === 'dress' &&
      signals.styleScores.work < 4 &&
      signals.styleScores.formal < 4
    )
      return false;

    return true;
  }

  if (requestedOccasion === 'casual') {
    if (signals.isBlazer && signals.explicitOccasion !== 'casual') return false;
    if (signals.isHeel && signals.explicitOccasion !== 'casual') return false;

    if (
      signals.isTrouser &&
      signals.explicitOccasion !== 'casual' &&
      !signals.isKnit
    )
      return false;

    if (
      category === 'shoes' &&
      !(
        signals.isTrainer ||
        signals.isBoot ||
        signals.isFlat ||
        signals.styleScores.casual >= 4
      )
    )
      return false;

    if (
      category === 'outerwear' &&
      !(
        signals.isHoodie ||
        signals.isKnit ||
        signals.isCoat ||
        signals.styleScores.casual >= 4
      )
    )
      return false;

    if (
      category === 'top' &&
      !(
        signals.isTee ||
        signals.isKnit ||
        signals.isCasual ||
        signals.styleScores.casual >= 4
      )
    )
      return false;

    if (
      category === 'bottom' &&
      !(
        signals.isJeans ||
        signals.isSkirt ||
        signals.styleScores.casual >= 4
      )
    )
      return false;

    if (category === 'dress' && signals.styleScores.casual < 4) return false;

    return true;
  }

  if (requestedOccasion === 'party') {
    if (signals.isJogger || signals.isLegging) return false;

    if (
      category === 'shoes' &&
      !(
        signals.isHeel ||
        signals.isBoot ||
        signals.isFlat ||
        signals.styleScores.party >= 4
      )
    )
      return false;

    if (
      category === 'outerwear' &&
      !(
        signals.isBlazer ||
        signals.isCoat ||
        signals.styleScores.party >= 3 ||
        signals.styleScores.formal >= 3
      )
    )
      return false;

    if (
      category === 'top' &&
      !(
        signals.isParty ||
        signals.isStructured ||
        signals.styleScores.party >= 4 ||
        signals.styleScores.formal >= 3
      )
    )
      return false;

    if (
      category === 'bottom' &&
      !(
        signals.isSkirt ||
        signals.styleScores.party >= 4 ||
        signals.styleScores.formal >= 3 ||
        signals.isJeans
      )
    )
      return false;

    if (
      category === 'dress' &&
      signals.styleScores.party < 4 &&
      signals.styleScores.formal < 4
    )
      return false;

    return true;
  }

  if (requestedOccasion === 'sport') {
    if (!signals.isSporty && category !== 'accessory') return false;
    if (category === 'shoes' && !signals.isTrainer) return false;
    return true;
  }

  return true;
};

// checks if item fits weather
const isItemAllowedForWeather = (signals, requestedWeather) => {
  if (requestedWeather === 'warm' && signals.isHeavy) return false;
  if (requestedWeather === 'warm' && signals.isCoat) return false;
  if (requestedWeather === 'warm' && signals.isPuffer) return false;

  if (requestedWeather === 'rainy' && signals.category === 'accessory')
    return false;

  return true;
};

// bonus points depending on mood
const buildMoodBonus = (signals, requestedMood) => {
  let score = 0;
  const notes = [];

  if (normalise(signals.explicitOccasion) === requestedMood) {
    score += 1;
  }

  if (requestedMood === 'comfortable') {
    if (signals.isCasual || signals.isKnit) {
      score += 4;
      notes.push('+4 comfortable feel');
    }
    if (signals.isStructured && !signals.isKnit) {
      score -= 2;
      notes.push('-2 too structured for comfort');
    }
  }

  if (requestedMood === 'confident') {
    if (
      signals.isStructured ||
      signals.isParty ||
      ['black', 'navy', 'red'].includes(signals.colour)
    ) {
      score += 4;
      notes.push('+4 confidence-supporting piece');
    }
  }

  if (requestedMood === 'relaxed') {
    if (signals.isCasual || signals.isKnit) {
      score += 4;
      notes.push('+4 relaxed feel');
    }
    if (signals.isBlazer) {
      score -= 2;
      notes.push('-2 too sharp for relaxed mood');
    }
  }

  if (requestedMood === 'productive') {
    if (signals.isStructured || signals.isShirt || signals.isTrouser) {
      score += 4;
      notes.push('+4 productive polished fit');
    }
  }

  if (requestedMood === 'social') {
    if (signals.isParty || signals.isCasual) {
      score += 3;
      notes.push('+3 social-friendly piece');
    }
  }

  return { score, notes };
};

// occasion base score taken from style scores
const getOccasionBaseScore = (signals, requestedOccasion) => {
  const value = signals.styleScores[requestedOccasion] || 0;
  return value * 3;
};

// weather bonus notes
const getWeatherBonus = (signals, requestedWeather) => {
  let score = 0;
  const notes = [];

  if (requestedWeather === 'cold') {
    if (signals.isHeavy || signals.isCoat || signals.isBoot || signals.isKnit) {
      score += 4;
      notes.push('+4 cold-weather suitable');
    }
  }

  if (requestedWeather === 'rainy') {
    if (signals.isCoat || signals.isBoot) {
      score += 4;
      notes.push('+4 rainy-weather suitable');
    }
  }

  if (requestedWeather === 'warm') {
    if (!signals.isHeavy && !signals.isCoat && !signals.isBoot) {
      score += 3;
      notes.push('+3 warm-weather suitable');
    }
  }

  if (requestedWeather === 'mild') {
    if (!signals.isPuffer) {
      score += 2;
      notes.push('+2 suitable for mild weather');
    }
  }

  return { score, notes };
};

// gives item bonus based on past likes/dislikes
const getPreferenceBonus = (signals, feedbackSummary) => {
  const likedColours = (feedbackSummary.likedColours || []).map(canonicalColour);
  const dislikedColours = (feedbackSummary.dislikedColours || []).map(
    canonicalColour
  );
  const likedCategories = (feedbackSummary.likedCategories || []).map(
    normaliseCategory
  );
  const dislikedCategories = (feedbackSummary.dislikedCategories || []).map(
    normaliseCategory
  );
  const preferredOccasions = (feedbackSummary.preferredOccasions || []).map(
    normalise
  );
  const preferredMoods = (feedbackSummary.preferredMoods || []).map(normalise);

  let score = 0;
  const notes = [];

  if (likedColours.includes(signals.colour)) {
    score += 3;
    notes.push('+3 previously liked colour');
  }

  if (dislikedColours.includes(signals.colour)) {
    score -= 4;
    notes.push('-4 previously disliked colour');
  }

  if (likedCategories.includes(signals.category)) {
    score += 3;
    notes.push('+3 previously liked category');
  }

  if (dislikedCategories.includes(signals.category)) {
    score -= 4;
    notes.push('-4 previously disliked category');
  }

  // tiny boost just because those prefs exist
  if (preferredOccasions.length) score += 1;
  if (preferredMoods.length) score += 1;

  return { score, notes };
};

// enriches items with signals + score + score notes
const enrichWardrobeItems = (
  wardrobeItems = [],
  requestedOccasion,
  requestedMood,
  requestedWeather,
  feedbackSummary
) => {
  return wardrobeItems
    .map((item) => {
      const signals = inferItemSignals(item);
      const itemNotes = [];

      // remove items that dont fit the request
      if (!isItemAllowedForOccasion(signals, requestedOccasion)) {
        return null;
      }

      if (!isItemAllowedForWeather(signals, requestedWeather)) {
        return null;
      }

      let score = 0;

      const occasionScore = getOccasionBaseScore(signals, requestedOccasion);
      score += occasionScore;
      itemNotes.push(`+${occasionScore} occasion fit`);

      const mood = buildMoodBonus(signals, requestedMood);
      score += mood.score;
      itemNotes.push(...mood.notes);

      const weather = getWeatherBonus(signals, requestedWeather);
      score += weather.score;
      itemNotes.push(...weather.notes);

      const preference = getPreferenceBonus(signals, feedbackSummary);
      score += preference.score;
      itemNotes.push(...preference.notes);

      // main outfit pieces matter more
      if (
        signals.category === 'top' ||
        signals.category === 'bottom' ||
        signals.category === 'dress'
      ) {
        score += 2;
        itemNotes.push('+2 core outfit piece');
      }

      if (requestedOccasion === 'formal' && isNeutralColour(signals.colour)) {
        score += 3;
        itemNotes.push('+3 neutral formal colour');
      }

      if (
        requestedOccasion === 'work' &&
        ['black', 'navy', 'grey', 'white', 'beige', 'cream'].includes(
          signals.colour
        )
      ) {
        score += 3;
        itemNotes.push('+3 polished work colour');
      }

      if (requestedOccasion === 'casual' && signals.isCasual) {
        score += 4;
        itemNotes.push('+4 clearly casual piece');
      }

      if (
        requestedOccasion === 'party' &&
        (signals.isParty || BRIGHT_COLOURS.has(signals.colour))
      ) {
        score += 3;
        itemNotes.push('+3 party suitable');
      }

      if (requestedOccasion === 'sport' && signals.isSporty) {
        score += 6;
        itemNotes.push('+6 sport suitable');
      }

      return {
        ...item,
        signals,
        score,
        scoreLog: itemNotes,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
};

// filters shoe choices based on occasion
const getCompatibleShoes = (items, requestedOccasion) => {
  return items.filter((item) => {
    const s = item.signals;

    if (s.category !== 'shoes') return false;

    if (requestedOccasion === 'formal')
      return (
        s.isHeel ||
        s.isLoafer ||
        s.isBoot ||
        s.styleScores.formal >= 4
      );

    if (requestedOccasion === 'work')
      return (
        s.isLoafer ||
        s.isFlat ||
        s.isHeel ||
        s.isBoot ||
        s.styleScores.work >= 4
      );

    if (requestedOccasion === 'casual')
      return (
        s.isTrainer ||
        s.isBoot ||
        s.isFlat ||
        s.styleScores.casual >= 4
      );

    if (requestedOccasion === 'party')
      return (
        s.isHeel ||
        s.isBoot ||
        s.isFlat ||
        s.styleScores.party >= 4
      );

    if (requestedOccasion === 'sport') return s.isTrainer;

    return true;
  });
};

// outerwear only really matters for some weathers
const getCompatibleOuterwear = (items, requestedOccasion, requestedWeather) => {
  if (!['cold', 'rainy', 'mild'].includes(requestedWeather)) return [];

  return items.filter((item) => {
    const s = item.signals;

    if (s.category !== 'outerwear') return false;

    if (requestedOccasion === 'formal')
      return (
        s.isBlazer ||
        s.isCoat ||
        s.styleScores.formal >= 4 ||
        s.styleScores.work >= 4
      );

    if (requestedOccasion === 'work')
      return (
        s.isBlazer ||
        s.isCoat ||
        s.isKnit ||
        s.styleScores.work >= 4
      );

    if (requestedOccasion === 'casual')
      return (
        s.isHoodie ||
        s.isKnit ||
        s.isCoat ||
        s.styleScores.casual >= 4
      );

    if (requestedOccasion === 'party')
      return (
        s.isBlazer ||
        s.isCoat ||
        s.styleScores.party >= 3 ||
        s.styleScores.formal >= 3
      );

    if (requestedOccasion === 'sport') return s.isSporty || s.isCoat;

    return true;
  });
};

// gives bonus if styles across pieces match well together
const styleCompatibilityBonus = (items, requestedOccasion) => {
  const styles = items.map((item) => item.signals.primaryStyle);
  const uniqueStyles = [...new Set(styles)];

  if (!uniqueStyles.length) return 0;

  if (uniqueStyles.length === 1 && uniqueStyles[0] === requestedOccasion)
    return 10;

  if (uniqueStyles.length === 1) return 6;

  const allClose = uniqueStyles.every((style) => {
    if (requestedOccasion === 'formal')
      return ['formal', 'work', 'party'].includes(style);
    if (requestedOccasion === 'work') return ['work', 'formal'].includes(style);
    if (requestedOccasion === 'casual') return ['casual'].includes(style);
    if (requestedOccasion === 'party') return ['party', 'formal'].includes(style);
    if (requestedOccasion === 'sport') return ['sport'].includes(style);
    return false;
  });

  return allClose ? 3 : -8;
};

// catches combos that really dont belong together
const containsHardStyleConflict = (items, requestedOccasion) => {
  const hasBlazer = items.some((item) => item.signals.isBlazer);
  const hasJeans = items.some((item) => item.signals.isJeans);
  const hasTrainer = items.some((item) => item.signals.isTrainer);
  const hasHoodie = items.some((item) => item.signals.isHoodie);
  const hasJogger = items.some(
    (item) => item.signals.isJogger || item.signals.isLegging
  );

  if (requestedOccasion === 'formal') {
    if (hasJeans || hasTrainer || hasHoodie || hasJogger) return true;
  }

  if (requestedOccasion === 'work') {
    if (hasTrainer || hasHoodie || hasJogger) return true;
    if (hasBlazer && hasJeans) return true;
  }

  if (requestedOccasion === 'casual') {
    const veryFormalCombo =
      hasBlazer &&
      items.some((item) => item.signals.isTrouser) &&
      items.some((item) => item.signals.isLoafer || item.signals.isHeel);

    if (veryFormalCombo) return true;
  }

  if (requestedOccasion === 'sport') {
    const nonSportItem = items.some(
      (item) =>
        !item.signals.isSporty && !['accessory'].includes(item.signals.category)
    );
    if (nonSportItem) return true;
  }

  return false;
};

// gives bonus if outfit feels complete
const completenessBonus = (items) => {
  const categories = items.map((item) => item.signals.category);
  const hasTop = categories.includes('top');
  const hasBottom = categories.includes('bottom');
  const hasDress = categories.includes('dress');
  const hasShoes = categories.includes('shoes');
  const hasOuterwear = categories.includes('outerwear');

  if (hasDress && hasShoes && hasOuterwear) return 12;
  if (hasDress && hasShoes) return 10;
  if (hasTop && hasBottom && hasShoes && hasOuterwear) return 12;
  if (hasTop && hasBottom && hasShoes) return 10;
  if (hasTop && hasBottom) return 7;
  if (hasDress) return 7;

  return -5;
};

// checks full outfit against saved / liked / disliked outfit history
const getOutfitPreferenceBonus = (items, feedbackSummary) => {
  const likedOutfitKeys = new Set(
    (feedbackSummary.likedOutfitKeys || []).map(normalise)
  );
  const dislikedOutfitKeys = new Set(
    (feedbackSummary.dislikedOutfitKeys || []).map(normalise)
  );
  const savedOutfitKeys = new Set(
    (feedbackSummary.savedOutfitKeys || []).map(normalise)
  );

  const outfitKey = getOutfitKeyFromIds(items.map((item) => item.id));
  let score = 0;

  if (likedOutfitKeys.has(outfitKey)) score += 8;
  if (savedOutfitKeys.has(outfitKey)) score += 6;
  if (dislikedOutfitKeys.has(outfitKey)) score -= 12;

  return score;
};

// turns scoring into a more readable confidence percent
const buildConfidence = ({
  totalScore,
  colourScore,
  styleScore,
  completenessScore,
  preferenceScore,
  scoreGapFromTop = 0,
  scoreRange = 1,
  weakRecommendation = false,
}) => {
  const safeTotalScore = Math.max(0, totalScore);

  let confidence =
    42 +
    Math.sqrt(safeTotalScore) * 2.2 +
    Math.max(0, colourScore) * 0.45 +
    Math.max(0, styleScore) * 0.55 +
    Math.max(0, completenessScore) * 0.5 +
    Math.max(0, preferenceScore) * 0.2;

  const relativePenalty = (scoreGapFromTop / Math.max(scoreRange, 1)) * 22;
  confidence -= relativePenalty;

  if (weakRecommendation) {
    confidence -= 18;
  }

  if (completenessScore < 10) {
    confidence -= 8;
  }

  if (styleScore < 0) {
    confidence -= 10;
  }

  if (colourScore < 2) {
    confidence -= 6;
  }

  return Math.max(35, Math.min(92, Math.round(confidence)));
};

// builds the reason text shown to user
const buildExplanation = ({
  requestedOccasion,
  requestedMood,
  requestedWeather,
  items,
  colourScore,
  styleScore,
  completenessScore,
  preferenceScore,
}) => {
  const top = items.find((item) => item.signals.category === 'top');
  const bottom = items.find((item) => item.signals.category === 'bottom');
  const dress = items.find((item) => item.signals.category === 'dress');
  const shoes = items.find((item) => item.signals.category === 'shoes');
  const outerwear = items.find((item) => item.signals.category === 'outerwear');

  const colours = items
    .map((item) => canonicalColour(item.colour))
    .filter(Boolean);

  const uniqueColours = [...new Set(colours)];

  // makes sentence saying what the outfit actually is
  const outfitStructure = dress
    ? `${dress.itemName}${shoes ? ` with ${shoes.itemName}` : ''}${
        outerwear ? ` and ${outerwear.itemName}` : ''
      }`
    : `${top ? top.itemName : 'top'} with ${bottom ? bottom.itemName : 'bottom'}${
        shoes ? ` and ${shoes.itemName}` : ''
      }${outerwear ? `, finished with ${outerwear.itemName}` : ''}`;

  const occasionLineMap = {
    formal:
      'This outfit stays fully in a formal lane by using polished, structured pieces rather than casual basics.',
    work: 'This outfit stays work-appropriate by keeping the combination polished, practical, and office-suitable.',
    casual:
      'This outfit stays clearly casual by using relaxed everyday pieces instead of formal tailoring.',
    party:
      'This outfit stays party-appropriate by leaning into dressier pieces and a more styled finish.',
    sport:
      'This outfit stays fully sport-focused by using activewear pieces that make sense together.',
  };

  const moodLineMap = {
    comfortable:
      'The item choices support a comfortable feel, with easier everyday shapes and softer styling.',
    confident:
      'The item choices support a confident look, with cleaner lines and stronger visual impact.',
    relaxed:
      'The item choices support a relaxed look, avoiding anything too sharp or overly formal.',
    productive:
      'The item choices support a productive mood, with pieces that feel put-together and focused.',
    social:
      'The item choices support a social look, making the outfit feel more presentable and going-out ready.',
  };

  let colourLine =
    'The colour palette has been kept coordinated so the outfit looks intentional rather than random.';

  if (colourScore >= 10) {
    colourLine = `The colour palette is especially strong here, using ${uniqueColours
      .map(titleCase)
      .join(', ')} in a way that stays balanced and coordinated.`;
  } else if (uniqueColours.length === 1) {
    colourLine = `The outfit is built around a consistent ${titleCase(
      uniqueColours[0]
    )} colour direction, which keeps it very cohesive.`;
  } else if (uniqueColours.some((colour) => isNeutralColour(colour))) {
    colourLine =
      'Neutral colours help hold this outfit together, so the pieces match cleanly without clashing.';
  }

  let weatherLine = '';

  if (requestedWeather === 'cold') {
    weatherLine = outerwear
      ? `${outerwear.itemName} helps make the outfit more suitable for colder weather.`
      : 'The selected pieces still stay on the more suitable side for colder weather.';
  } else if (requestedWeather === 'rainy') {
    weatherLine =
      outerwear || shoes
        ? 'The outfit includes more weather-sensible pieces for rainy conditions.'
        : 'The outfit avoids obviously unsuitable warm-weather combinations for rainy conditions.';
  } else if (requestedWeather === 'warm') {
    weatherLine =
      'Heavier cold-weather pieces were avoided so the outfit stays more suitable for warm conditions.';
  } else if (requestedWeather === 'mild') {
    weatherLine =
      'The outfit stays balanced for mild weather without leaning too heavy or too light.';
  }

  let qualityLine = '';

  if (styleScore >= 8 && colourScore >= 8 && completenessScore >= 10) {
    qualityLine =
      'Overall, this recommendation scored highly because the style, colours, and full outfit structure all align well together.';
  } else if (preferenceScore > 0) {
    qualityLine =
      'This option was also strengthened by patterns from outfits or item types you have liked before.';
  } else {
    qualityLine =
      'Overall, this outfit was selected because it is one of the strongest complete matches currently available in your wardrobe.';
  }

  // tags shown on frontend
  const explanationTags = [];

  if (requestedOccasion === 'formal') explanationTags.push('Formal Match');
  if (requestedOccasion === 'work') explanationTags.push('Work Match');
  if (requestedOccasion === 'casual') explanationTags.push('Casual Match');
  if (requestedOccasion === 'party') explanationTags.push('Party Match');
  if (requestedOccasion === 'sport') explanationTags.push('Sport Match');

  if (requestedWeather === 'cold') explanationTags.push('Cold Ready');
  if (requestedWeather === 'rainy') explanationTags.push('Rain Ready');
  if (requestedWeather === 'warm') explanationTags.push('Warm Ready');
  if (requestedWeather === 'mild') explanationTags.push('Mild Weather');

  if (colourScore >= 8) explanationTags.push('Strong Colour Harmony');
  else if (colourScore >= 0) explanationTags.push('Balanced Colours');

  if (requestedMood === 'comfortable') explanationTags.push('Comfort Focus');
  if (requestedMood === 'confident') explanationTags.push('Confidence Focus');
  if (requestedMood === 'relaxed') explanationTags.push('Relaxed Look');
  if (requestedMood === 'productive') explanationTags.push('Productive Look');
  if (requestedMood === 'social') explanationTags.push('Social Look');

  if (preferenceScore > 0) explanationTags.push('Based on Your Preferences');

  const reason = [
    `Selected combination: ${outfitStructure}.`,
    occasionLineMap[requestedOccasion],
    moodLineMap[requestedMood],
    colourLine,
    weatherLine,
    qualityLine,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    reason,
    explanationTags: explanationTags.slice(0, 4),
  };
};

// builds all possible outfit combos then scores them
const buildOutfitCandidates = (
  enrichedItems,
  requestedOccasion,
  requestedMood,
  requestedWeather,
  feedbackSummary
) => {
  const tops = enrichedItems.filter((item) => item.signals.category === 'top');
  const bottoms = enrichedItems.filter(
    (item) => item.signals.category === 'bottom'
  );
  const dresses = enrichedItems.filter(
    (item) => item.signals.category === 'dress'
  );
  const shoes = getCompatibleShoes(enrichedItems, requestedOccasion);
  const outerwear = getCompatibleOuterwear(
    enrichedItems,
    requestedOccasion,
    requestedWeather
  );

  const candidates = [];

  // only take top scoring few from each type so it doesnt explode too much
  const topChoices = tops.slice(0, 8);
  const bottomChoices = bottoms.slice(0, 8);
  const dressChoices = dresses.slice(0, 6);
  const shoeChoices = shoes.slice(0, 8);
  const outerwearChoices = outerwear.slice(0, 6);

  // build top + bottom based outfits
  for (const top of topChoices) {
    for (const bottom of bottomChoices) {
      if (top.id === bottom.id) continue;

      const baseColours = [top.colour, bottom.colour];
      const baseColourScore = getColourHarmonyScore(baseColours);

      if (baseColourScore < 0) continue;

      const baseItems = [top, bottom];

      if (containsHardStyleConflict(baseItems, requestedOccasion)) continue;

      const matchingShoes = shoeChoices.filter((shoe) => {
        if (baseItems.some((item) => item.id === shoe.id)) return false;
        return (
          getColourHarmonyScore([top.colour, bottom.colour, shoe.colour]) >= 0
        );
      });

      const shoeSet = matchingShoes.length ? matchingShoes.slice(0, 2) : [null];

      for (const shoe of shoeSet) {
        const current = shoe ? [...baseItems, shoe] : [...baseItems];

        if (containsHardStyleConflict(current, requestedOccasion)) continue;

        const matchingOuterwear = outerwearChoices.filter((outer) => {
          if (current.some((item) => item.id === outer.id)) return false;
          return (
            getColourHarmonyScore([
              ...current.map((item) => item.colour),
              outer.colour,
            ]) >= 0
          );
        });

        const outerSet =
          requestedWeather === 'cold' || requestedWeather === 'rainy'
            ? matchingOuterwear.length
              ? matchingOuterwear.slice(0, 2)
              : [null]
            : [null];

        for (const outer of outerSet) {
          const finalItems = outer ? [...current, outer] : [...current];

          if (containsHardStyleConflict(finalItems, requestedOccasion)) continue;

          candidates.push(finalItems);
        }
      }
    }
  }

  // build dress based outfits
  for (const dress of dressChoices) {
    const matchingShoes = shoeChoices.filter((shoe) => {
      if (shoe.id === dress.id) return false;
      return getColourHarmonyScore([dress.colour, shoe.colour]) >= 0;
    });

    const shoeSet = matchingShoes.length ? matchingShoes.slice(0, 2) : [null];

    for (const shoe of shoeSet) {
      const current = shoe ? [dress, shoe] : [dress];

      if (containsHardStyleConflict(current, requestedOccasion)) continue;

      const matchingOuterwear = outerwearChoices.filter((outer) => {
        if (current.some((item) => item.id === outer.id)) return false;
        return (
          getColourHarmonyScore([
            ...current.map((item) => item.colour),
            outer.colour,
          ]) >= 0
        );
      });

      const outerSet =
        requestedWeather === 'cold' || requestedWeather === 'rainy'
          ? matchingOuterwear.length
            ? matchingOuterwear.slice(0, 2)
            : [null]
          : [null];

      for (const outer of outerSet) {
        const finalItems = outer ? [...current, outer] : [...current];

        if (containsHardStyleConflict(finalItems, requestedOccasion)) continue;

        candidates.push(finalItems);
      }
    }
  }

  // remove duplicate combos
  const unique = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const key = getOutfitKeyFromIds(candidate.map((item) => item.id));
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  // score each outfit candidate
  let scoredCandidates = unique.map((items) => {
    const baseItemScore = items.reduce((sum, item) => sum + item.score, 0);
    const colours = items.map((item) => item.colour);
    const colourScore = getColourHarmonyScore(colours);
    const styleScore = styleCompatibilityBonus(items, requestedOccasion);
    const completenessScore = completenessBonus(items);
    const preferenceScore = getOutfitPreferenceBonus(items, feedbackSummary);

    const totalScore =
      baseItemScore +
      colourScore +
      styleScore +
      completenessScore +
      preferenceScore;

    const explanation = buildExplanation({
      requestedOccasion,
      requestedMood,
      requestedWeather,
      items,
      colourScore,
      styleScore,
      completenessScore,
      preferenceScore,
    });

    return {
      title: 'Recommended Outfit',
      selectedItemIds: items.map((item) => item.id),
      reason: explanation.reason,
      confidence: 0,
      weakRecommendation: false,
      explanationTags: explanation.explanationTags,
      scoringLog: {
        baseItemScore,
        colourScore,
        styleScore,
        completenessScore,
        preferenceScore,
        totalScore,
        items: items.map((item) => ({
          itemName: item.itemName,
          category: item.category,
          colour: item.colour,
          score: item.score,
          scoreLog: item.scoreLog,
        })),
      },
    };
  });

  scoredCandidates.sort(
    (a, b) => b.scoringLog.totalScore - a.scoringLog.totalScore
  );

  const topScore = scoredCandidates[0]?.scoringLog?.totalScore ?? 0;
  const bottomScore =
    scoredCandidates[scoredCandidates.length - 1]?.scoringLog?.totalScore ?? 0;
  const scoreRange = Math.max(1, topScore - bottomScore);

  // final confidence pass
  scoredCandidates = scoredCandidates.map((outfit) => {
    const totalScore = outfit.scoringLog.totalScore;
    const colourScore = outfit.scoringLog.colourScore;
    const styleScore = outfit.scoringLog.styleScore;
    const completenessScore = outfit.scoringLog.completenessScore;
    const preferenceScore = outfit.scoringLog.preferenceScore;
    const scoreGapFromTop = topScore - totalScore;

    const weakRecommendation =
      totalScore < 30 ||
      completenessScore < 10 ||
      styleScore < 0 ||
      colourScore < 2;

    const confidence = buildConfidence({
      totalScore,
      colourScore,
      styleScore,
      completenessScore,
      preferenceScore,
      scoreGapFromTop,
      scoreRange,
      weakRecommendation,
    });

    return {
      ...outfit,
      confidence,
      weakRecommendation,
    };
  });

  // only return top 3 and rename them nicely
  return scoredCandidates.slice(0, 3).map((outfit, index) => ({
    ...outfit,
    title:
      index === 0
        ? 'Best Match'
        : index === 1
        ? 'Alternative Option'
        : 'Another Option',
  }));
};

// normalises voice text to make matching easier
const normaliseVoiceText = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[.,!?]/g, '')
    .replace(/\s+/g, ' ');

// tries to detect simple page navigation from voice
const getRouteFromVoiceCommand = (message = '') => {
  const text = normaliseVoiceText(message);

  if (
    text.includes('home page') ||
    text === 'home' ||
    text.includes('go home') ||
    text.includes('take me home')
  ) {
    return '/(tabs)';
  }

  if (
    text.includes('suggestions page') ||
    text.includes('suggestion page') ||
    text.includes('outfit suggestions') ||
    text.includes('go to suggestions') ||
    text.includes('take me to suggestions') ||
    text.includes('go to outfit suggestions')
  ) {
    return '/(tabs)/suggestions';
  }

  if (
    text.includes('wardrobe page') ||
    text.includes('go to wardrobe') ||
    text.includes('take me to wardrobe') ||
    text === 'wardrobe' ||
    text.includes('my wardrobe')
  ) {
    return '/(tabs)/wardrobe';
  }

  if (
    text.includes('add item page') ||
    text.includes('go to add item') ||
    text.includes('take me to add item') ||
    text.includes('open add item') ||
    text.includes('add clothes page')
  ) {
    return '/(tabs)/addItem';
  }

  if (
    text.includes('saved outfits page') ||
    text.includes('go to saved outfits') ||
    text.includes('take me to saved outfits') ||
    text.includes('saved page')
  ) {
    return '/(tabs)/savedOutfits';
  }

  if (
    text.includes('past looks page') ||
    text.includes('go to past looks') ||
    text.includes('take me to past looks') ||
    text.includes('history page')
  ) {
    return '/(tabs)/pastLooks';
  }

  return '';
};

// maps route back to screen name
const getScreenNameFromRoute = (route = '') => {
  if (route === '/(tabs)') return 'home';
  if (route === '/(tabs)/suggestions') return 'suggestions';
  if (route === '/(tabs)/wardrobe') return 'wardrobe';
  if (route === '/(tabs)/addItem') return 'addItem';
  if (route === '/(tabs)/savedOutfits') return 'savedOutfits';
  if (route === '/(tabs)/pastLooks') return 'pastLooks';
  return '';
};

// quick direct intent for scrolling
const extractScrollIntent = (message = '') => {
  const text = normaliseVoiceText(message);

  if (
    text.includes('scroll down') ||
    text.includes('go down') ||
    text.includes('move down')
  ) {
    return {
      spokenReply: 'Scrolling down.',
      intent: {
        type: 'scroll',
        payload: {
          direction: 'down',
        },
      },
    };
  }

  if (
    text.includes('scroll up') ||
    text.includes('go up') ||
    text.includes('move up')
  ) {
    return {
      spokenReply: 'Scrolling up.',
      intent: {
        type: 'scroll',
        payload: {
          direction: 'up',
        },
      },
    };
  }

  return null;
};

// tries to fill add item fields from voice command
const extractAddItemFieldIntent = (message = '') => {
  const text = normaliseVoiceText(message);

  let payload = {};

  const nameMatch =
    text.match(/set item name to (.+)/) ||
    text.match(/item name is (.+)/) ||
    text.match(/name is (.+)/);

  if (nameMatch?.[1]) {
    payload.itemName = titleCase(nameMatch[1]);
  }

  const descriptionMatch =
    text.match(/set description to (.+)/) ||
    text.match(/description is (.+)/);

  if (descriptionMatch?.[1]) {
    payload.description = descriptionMatch[1].trim();
  }

  // direct category matching
  const categoryValue = (() => {
    if (
      text.includes('category top') ||
      text.includes('set category to top') ||
      text.includes('category is top')
    )
      return 'Top';
    if (
      text.includes('category bottom') ||
      text.includes('set category to bottom') ||
      text.includes('category is bottom')
    )
      return 'Bottom';
    if (
      text.includes('category dress') ||
      text.includes('set category to dress') ||
      text.includes('category is dress')
    )
      return 'Dress';
    if (
      text.includes('category outerwear') ||
      text.includes('set category to outerwear') ||
      text.includes('category is outerwear')
    )
      return 'Outerwear';
    if (
      text.includes('category shoes') ||
      text.includes('set category to shoes') ||
      text.includes('category is shoes')
    )
      return 'Shoes';
    if (
      text.includes('category accessory') ||
      text.includes('set category to accessory') ||
      text.includes('category is accessory')
    )
      return 'Accessory';
    if (
      text.includes('category other') ||
      text.includes('set category to other') ||
      text.includes('category is other')
    )
      return 'Other';
    return '';
  })();

  if (categoryValue) {
    payload.category = categoryValue;
  }

  const colourMatch =
    text.match(/set colour to (.+)/) ||
    text.match(/set color to (.+)/) ||
    text.match(/colour is (.+)/) ||
    text.match(/color is (.+)/);

  if (colourMatch?.[1]) {
    payload.colour = titleCase(colourMatch[1]);
  }

  // occasion matching
  const occasionValue = (() => {
    if (text.includes('occasion casual') || text.includes('set occasion to casual'))
      return 'Casual';
    if (text.includes('occasion work') || text.includes('set occasion to work'))
      return 'Work';
    if (text.includes('occasion party') || text.includes('set occasion to party'))
      return 'Party';
    if (text.includes('occasion formal') || text.includes('set occasion to formal'))
      return 'Formal';
    if (text.includes('occasion sport') || text.includes('set occasion to sport'))
      return 'Sport';
    return '';
  })();

  if (occasionValue) {
    payload.occasion = occasionValue;
  }

  // mood matching
  const moodValue = (() => {
    if (
      text.includes('mood comfortable') ||
      text.includes('set mood to comfortable')
    )
      return 'Comfortable';
    if (
      text.includes('mood confident') ||
      text.includes('set mood to confident')
    )
      return 'Confident';
    if (
      text.includes('mood relaxed') ||
      text.includes('set mood to relaxed')
    )
      return 'Relaxed';
    if (
      text.includes('mood productive') ||
      text.includes('set mood to productive')
    )
      return 'Productive';
    if (
      text.includes('mood social') ||
      text.includes('set mood to social')
    )
      return 'Social';
    return '';
  })();

  if (moodValue) {
    payload.mood = moodValue;
  }

  if (!Object.keys(payload).length) {
    return null;
  }

  return {
    spokenReply: 'Okay, I updated that field.',
    intent: {
      type: 'set_add_item_fields',
      payload,
    },
  };
};

// direct voice actions for add item page
const extractAddItemActionIntent = (message = '', currentScreen = '') => {
  const text = normaliseVoiceText(message);

  if (
    text.includes('analyse image') ||
    text.includes('analyze image')
  ) {
    return {
      spokenReply: 'Okay, analysing the image now.',
      intent: {
        type: 'analyze_item_image',
        payload: {},
      },
    };
  }

  if (
    text.includes('save item') ||
    text.includes('add this item') ||
    text.includes('save this item')
  ) {
    return {
      spokenReply: 'Okay, saving the item now.',
      intent: {
        type: 'save_item',
        payload: {},
      },
    };
  }

  if (
    text.includes('clear form') ||
    text.includes('reset form') ||
    text.includes('start again')
  ) {
    return {
      spokenReply: 'Okay, clearing the form.',
      intent: {
        type: 'clear_form',
        payload: {},
      },
    };
  }

  // only try field extraction if actually on add item screen
  if (
    currentScreen === 'addItem' &&
    (
      text.includes('set item name') ||
      text.includes('item name is') ||
      text.includes('name is') ||
      text.includes('set colour') ||
      text.includes('set color') ||
      text.includes('colour is') ||
      text.includes('color is') ||
      text.includes('set category') ||
      text.includes('category is') ||
      text.includes('set occasion') ||
      text.includes('occasion is') ||
      text.includes('set mood') ||
      text.includes('mood is') ||
      text.includes('set description') ||
      text.includes('description is')
    )
  ) {
    return extractAddItemFieldIntent(text);
  }

  return null;
};

// direct voice intents for wardrobe page
const extractWardrobeIntent = (message = '') => {
  const text = normaliseVoiceText(message);

  const categoryMap = [
    { words: ['show tops', 'show top'], value: 'Top', reply: 'Showing tops.' },
    { words: ['show bottoms', 'show bottom', 'show trousers', 'show jeans'], value: 'Bottom', reply: 'Showing bottoms.' },
    { words: ['show dresses', 'show dress'], value: 'Dress', reply: 'Showing dresses.' },
    { words: ['show outerwear', 'show jackets', 'show jacket', 'show coats', 'show coat'], value: 'Outerwear', reply: 'Showing outerwear.' },
    { words: ['show shoes', 'show trainers', 'show boots'], value: 'Shoes', reply: 'Showing shoes.' },
    { words: ['show accessories', 'show accessory', 'show bags'], value: 'Accessory', reply: 'Showing accessories.' },
    { words: ['show all', 'show everything', 'all items'], value: 'All', reply: 'Showing all wardrobe items.' },
  ];

  // category filters from voice
  for (const entry of categoryMap) {
    if (entry.words.some((word) => text.includes(word))) {
      return {
        spokenReply: entry.reply,
        intent: {
          type: 'filter_wardrobe',
          payload: {
            category: entry.value,
          },
        },
      };
    }
  }

  // open first/second/third shortcuts
  if (
    text.includes('open first item') ||
    text.includes('expand first item')
  ) {
    return {
      spokenReply: 'Opening the first item.',
      intent: {
        type: 'open_item_by_index',
        payload: {
          index: 0,
        },
      },
    };
  }

  if (
    text.includes('open second item') ||
    text.includes('expand second item')
  ) {
    return {
      spokenReply: 'Opening the second item.',
      intent: {
        type: 'open_item_by_index',
        payload: {
          index: 1,
        },
      },
    };
  }

  if (
    text.includes('open third item') ||
    text.includes('expand third item')
  ) {
    return {
      spokenReply: 'Opening the third item.',
      intent: {
        type: 'open_item_by_index',
        payload: {
          index: 2,
        },
      },
    };
  }

  if (
    text.includes('edit this item') ||
    text.includes('edit current item') ||
    text.includes('start editing')
  ) {
    return {
      spokenReply: 'Opening edit mode.',
      intent: {
        type: 'edit_item',
        payload: {},
      },
    };
  }

  if (
    text.includes('save changes') ||
    text.includes('save item changes')
  ) {
    return {
      spokenReply: 'Saving your changes.',
      intent: {
        type: 'save_item_changes',
        payload: {},
      },
    };
  }

  // tries to open a named item
  const openMatch =
    text.match(/open (.+)/) ||
    text.match(/show me (.+)/) ||
    text.match(/expand (.+)/);

  if (openMatch?.[1]) {
    const possibleName = openMatch[1]
      .replace('item', '')
      .replace('hoodie please', 'hoodie')
      .trim();

    if (
      possibleName &&
      !possibleName.includes('page') &&
      !possibleName.includes('wardrobe') &&
      !possibleName.includes('suggestions')
    ) {
      return {
        spokenReply: 'Okay, opening that item.',
        intent: {
          type: 'open_item',
          payload: {
            itemName: titleCase(possibleName),
          },
        },
      };
    }
  }

  return null;
};

// main voice assistant backend route
app.post('/voice-assistant', async (req, res) => {
  try {
    const { message, currentScreen = '', screenState = {} } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // first check direct hard coded navigation
    const directRoute = getRouteFromVoiceCommand(message);
    const targetScreen = getScreenNameFromRoute(directRoute);

    if (directRoute) {
      // if already on page, dont navigate again
      if (currentScreen === targetScreen) {
        return res.json({
          spokenReply: 'You are already on that page.',
          intent: {
            type: 'none',
            payload: {},
          },
        });
      }

      return res.json({
        spokenReply: 'Okay, taking you there now.',
        intent: {
          type: 'navigate',
          payload: {
            route: directRoute,
          },
        },
      });
    }

    // direct scroll intent
    const scrollIntent = extractScrollIntent(message);
    if (scrollIntent) {
      return res.json(scrollIntent);
    }

    // direct add item actions
    const addItemIntent = extractAddItemActionIntent(message, currentScreen);
    if (addItemIntent) {
      return res.json(addItemIntent);
    }

    // direct wardrobe actions
    const wardrobeIntent = extractWardrobeIntent(message);
    if (wardrobeIntent) {
      return res.json(wardrobeIntent);
    }

    // if no direct rule matched, ask openai to interpret it
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: `
You are the voice assistant for an AI Wardrobe Assistant app.

Your job is to understand the user's spoken request and return ONLY valid JSON.

You must respond in this exact structure:
{
  "spokenReply": "",
  "intent": {
    "type": "none",
    "payload": {}
  }
}

Allowed intent types:
- "none"
- "navigate"
- "set_outfit_context"
- "generate_outfit"
- "filter_wardrobe"
- "open_item"
- "open_item_by_index"
- "save_outfit"
- "set_add_item_fields"
- "analyze_item_image"
- "save_item"
- "clear_form"
- "scroll"
- "edit_item"
- "save_item_changes"

Intent rules:
- Use "navigate" when the user wants to open a different section or page
  Payload example:
  { "route": "/(tabs)/suggestions" }

- Use "set_outfit_context" when the user mentions occasion, mood, or weather
  Payload example:
  { "occasion": "Work", "mood": "Confident", "weather": "Mild" }

- Use "generate_outfit" when the user asks to generate or continue to recommendations

- Use "filter_wardrobe" when the user wants to view wardrobe by category
  Payload example:
  { "category": "Top" }

- Use "open_item" when the user wants a specific wardrobe item opened
  Payload example:
  { "itemName": "Black Coat" }

- Use "open_item_by_index" when the user wants first, second, or third item
  Payload example:
  { "index": 0 }

- Use "save_outfit" when the user wants to save an outfit
  Payload example:
  { "index": 0 }

- Use "set_add_item_fields" when the user wants to fill in the add item form
  Payload example:
  {
    "itemName": "Black Hoodie",
    "category": "Top",
    "colour": "Black",
    "occasion": "Casual",
    "mood": "Comfortable",
    "description": "Soft casual hoodie"
  }

- Use "analyze_item_image" when the user wants image analysis
- Use "save_item" when the user wants to save the current add-item form
- Use "clear_form" when the user wants to clear the add-item form
- Use "scroll" when the user wants the page to move
  Payload example:
  { "direction": "down" }

- Use "edit_item" when the user wants to edit the currently open wardrobe item
- Use "save_item_changes" when the user wants to save edits to the currently open wardrobe item

Interpret these routes:
- home => "/(tabs)"
- add item => "/(tabs)/addItem"
- wardrobe => "/(tabs)/wardrobe"
- suggestions / outfit suggestions => "/(tabs)/suggestions"
- saved outfits / saved => "/(tabs)/savedOutfits"
- past looks / history => "/(tabs)/pastLooks"

Recognise these allowed occasion values:
- Casual
- Work
- Party
- Formal
- Sport

Recognise these allowed mood values:
- Comfortable
- Confident
- Relaxed
- Productive
- Social

Recognise these allowed weather values:
- Cold
- Mild
- Warm
- Rainy

Current screen: ${currentScreen}
Current screen state: ${JSON.stringify(screenState)}

Important:
- If the user is just chatting, use intent type "none"
- If the user asks for something unclear, use "none"
- Keep spokenReply natural, short, and useful
- Do not include markdown
- Do not include explanation outside the JSON
          `.trim(),
        },
        {
          role: 'user',
          content: JSON.stringify({
            message,
            currentScreen,
            screenState,
          }),
        },
      ],
    });

    const parsed = extractJsonObject(response.output_text || '');

    // safety fallback if model gives weird result
    const spokenReply =
      typeof parsed.spokenReply === 'string' && parsed.spokenReply.trim()
        ? parsed.spokenReply.trim()
        : 'Done.';

    const intent =
      parsed.intent && typeof parsed.intent === 'object'
        ? parsed.intent
        : { type: 'none', payload: {} };

    return res.json({
      spokenReply,
      intent: {
        type: intent.type || 'none',
        payload: intent.payload || {},
      },
    });
  } catch (error) {
    console.error('Voice assistant error:', error);

    return res.status(500).json({
      spokenReply: 'Sorry, something went wrong with the voice assistant.',
      intent: {
        type: 'none',
        payload: {},
      },
    });
  }
});

// image analysis route for add item page
app.post('/analyze-item', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // send image to openai and ask for clothing json
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
You are analyzing a clothing item image for a wardrobe assistant app.

Return ONLY valid JSON in this exact structure:
{
  "itemName": "",
  "category": "",
  "colour": "",
  "occasion": "",
  "mood": "",
  "description": ""
}

Rules:
- itemName should be a short human-friendly name
- category should be one clothing category like Top, Bottom, Dress, Outerwear, Shoes, Accessory, Other
- colour should be the main visible colour
- occasion should be one simple value like Casual, Work, Party, Formal, Sport
- mood should be one simple value like Comfortable, Confident, Relaxed, Productive, Social
- description should be one short sentence
- do not include markdown
- do not include extra text
              `.trim(),
            },
            {
              type: 'input_image',
              image_url: imageUrl,
            },
          ],
        },
      ],
    });

    const parsed = extractJsonObject(response.output_text || '');

    res.json({
      itemName: parsed.itemName || '',
      category: parsed.category || '',
      colour: parsed.colour || '',
      occasion: parsed.occasion || '',
      mood: parsed.mood || '',
      description: parsed.description || '',
    });
  } catch (error) {
    console.error('AI analyze error:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

// outfit generation route
app.post('/generate-outfit', async (req, res) => {
  try {
    const {
      wardrobeItems,
      occasion,
      mood,
      weather,
      feedbackSummary = {},
    } = req.body;

    if (!Array.isArray(wardrobeItems) || !occasion || !mood || !weather) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // clean input values
    const requestedOccasion = normalise(occasion);
    const requestedMood = normalise(mood);
    const requestedWeather = normalise(weather);

    // score and enrich every wardrobe item
    const enrichedItems = enrichWardrobeItems(
      wardrobeItems,
      requestedOccasion,
      requestedMood,
      requestedWeather,
      feedbackSummary
    );

    // build outfit combos from those items
    const candidates = buildOutfitCandidates(
      enrichedItems,
      requestedOccasion,
      requestedMood,
      requestedWeather,
      feedbackSummary
    );

    if (!candidates.length) {
      return res.json({
        outfits: [],
      });
    }

    return res.json({
      outfits: candidates,
    });
  } catch (error) {
    console.error('Generate outfit error:', error);

    // fallback response if backend logic crashes
    return res.json({
      outfits: [
        {
          title: 'Fallback Outfit',
          selectedItemIds: [],
          reason:
            'The system could not confidently generate a matching outfit from the current wardrobe.',
          confidence: 58,
          weakRecommendation: true,
          explanationTags: ['Fallback'],
          scoringLog: {
            totalScore: 0,
            items: [],
          },
        },
      ],
    });
  }
});

// starts backend on port 3001
app.listen(3001, () => {
  console.log('Backend running on http://192.168.0.83:3001');
});