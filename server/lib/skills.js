// The skill taxonomy teachers assess against, from the school's Reading
// Progress spec. Each category's `skills` list is what populates the
// second (skill) dropdown once a category is chosen - kept as plain data
// so the client can render the picker via GET /api/progress/skills without
// duplicating this list.
const SKILL_TAXONOMY = [
  {
    category: "Letters",
    skills: [
      "Recites all the Alef Bet by heart in order",
      "Identifies all letters of the Alef Bet in order and out of order",
    ],
  },
  {
    category: "Phonemic Awareness",
    skills: ["Accurately sounds out all the initial sounds of the letters"],
  },
  {
    category: "Vowels",
    skills: ["Recites all the Nekudot by heart", "Identifies all Nekudot by name"],
  },
  {
    category: "Vowel-Letter Blending",
    skills: [
      "Accurately blends all the letters with every learnt nekuda",
      "Open Syllable Words",
      "Closed Syllable Words",
      'Accurately blends all the "End letters" (Otiot Sofiot)',
    ],
  },
  {
    category: "Exception Rules",
    skills: [
      "Silent Letters",
      "Shin and Sin with shared/hidden Nekuda",
      "Patach Genuvah endings",
      "Yud Vav Endings",
      "Yud Endings",
      "Mapik Hey",
      "Vav that has both a dagesh and a Nekudah",
    ],
  },
  {
    category: "Vowel-Sh'va",
    skills: [
      "Sounds Sheva in the beginning of the word",
      "Silent Sheva in the middle of the word",
      "Shuruk Vowel in the beginning of the word followed by silent Sheva",
      "Sounds Sheva following a silent Sheva in the middle",
      "Sounds Sheva under first twin letter in the middle",
      "Silent Sheva under second twin letter in the middle",
      "Sounds Sheva under dagesh or line",
      "Silent Sheva at the end of the word",
    ],
  },
];

// Categories where "which letters are being mixed up" notes make sense.
const LETTER_CONFUSION_CATEGORIES = ["Letters", "Phonemic Awareness"];
// Categories where "which vowels are being mixed up" notes make sense.
const VOWEL_CONFUSION_CATEGORIES = ["Vowels", "Vowel-Letter Blending", "Vowel-Sh'va"];

const FLUENCY_NOTE_OPTIONS = [
  { id: "hesitancy", label: "Reading with hesitancy" },
  { id: "self_correction", label: "Reading with self corrections" },
  { id: "slow_but_accurate", label: "Reads slow but accurate" },
];

function isValidCategory(category) {
  return SKILL_TAXONOMY.some((c) => c.category === category);
}

function isValidSkill(category, skill) {
  const cat = SKILL_TAXONOMY.find((c) => c.category === category);
  return !!cat && cat.skills.includes(skill);
}

module.exports = {
  SKILL_TAXONOMY,
  LETTER_CONFUSION_CATEGORIES,
  VOWEL_CONFUSION_CATEGORIES,
  FLUENCY_NOTE_OPTIONS,
  isValidCategory,
  isValidSkill,
};
