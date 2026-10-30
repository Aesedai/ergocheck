// The assessment definition. Each option carries risk points (0 = ideal) and,
// when it indicates a problem, the guidance shown on the results screen.
// Changing this file changes both the form and the server-side scoring.

export const AREAS = ['seating', 'monitor', 'input', 'breaks', 'discomfort'] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  seating: 'Seating & posture',
  monitor: 'Monitor setup',
  input: 'Keyboard & mouse',
  breaks: 'Breaks & movement',
  discomfort: 'Reported discomfort',
};

export interface Option {
  value: string;
  label: string;
  points: number;
  tip?: string;
}

export interface Question {
  id: string;
  area: Area;
  prompt: string;
  kind: 'single' | 'multi';
  options: Option[];
}

export const QUESTIONS: Question[] = [
  {
    id: 'chair_adjust',
    area: 'seating',
    prompt: 'Can you adjust your chair height, seat depth and backrest?',
    kind: 'single',
    options: [
      { value: 'fully', label: 'Yes, all of them', points: 0 },
      { value: 'partly', label: 'Some of them', points: 1, tip: 'Ask about a chair with adjustable seat depth and backrest so your hips sit back and your thighs are supported.' },
      { value: 'none', label: 'No / not sure', points: 2, tip: 'A non-adjustable chair is a common cause of back strain. Request an ergonomic chair through your health & safety lead.' },
    ],
  },
  {
    id: 'lumbar',
    area: 'seating',
    prompt: 'Is your lower back supported when you sit back in the chair?',
    kind: 'single',
    options: [
      { value: 'yes', label: 'Yes', points: 0 },
      { value: 'no', label: 'No', points: 2, tip: 'Add lumbar support — an adjustable backrest or a small cushion at belt height — and sit all the way back.' },
    ],
  },
  {
    id: 'feet',
    area: 'seating',
    prompt: 'When seated, are your feet flat on the floor with knees roughly level with hips?',
    kind: 'single',
    options: [
      { value: 'yes', label: 'Yes', points: 0 },
      { value: 'sometimes', label: 'Sometimes', points: 1, tip: 'Lower the chair or use a footrest so your feet rest flat and knees are about hip height.' },
      { value: 'no', label: 'No', points: 2, tip: 'Dangling or tucked feet load the lower back. Use a footrest or lower the seat.' },
    ],
  },
  {
    id: 'monitor_height',
    area: 'monitor',
    prompt: 'Where is the top of your main screen relative to your eyes?',
    kind: 'single',
    options: [
      { value: 'eye_level', label: 'At or slightly below eye level', points: 0 },
      { value: 'too_low', label: 'Well below — I look down', points: 2, tip: 'Raise the screen so its top edge is at or just below eye level; looking down strains the neck.' },
      { value: 'too_high', label: 'Above eye level — I look up', points: 2, tip: 'Lower the screen so you are not tilting your head back.' },
    ],
  },
  {
    id: 'monitor_distance',
    area: 'monitor',
    prompt: 'Is the screen roughly an arm’s length away?',
    kind: 'single',
    options: [
      { value: 'yes', label: 'Yes', points: 0 },
      { value: 'too_close', label: 'Closer', points: 1, tip: 'Push the screen back to about arm’s length and increase text size if needed.' },
      { value: 'too_far', label: 'Further', points: 1, tip: 'Bring the screen closer so you are not leaning forward to read.' },
    ],
  },
  {
    id: 'laptop',
    area: 'monitor',
    prompt: 'Do you mostly work directly on a laptop screen?',
    kind: 'single',
    options: [
      { value: 'no', label: 'No — external monitor or laptop stand', points: 0 },
      { value: 'yes', label: 'Yes', points: 2, tip: 'Use a laptop stand with a separate keyboard and mouse, or an external monitor, to keep your neck neutral.' },
    ],
  },
  {
    id: 'wrists',
    area: 'input',
    prompt: 'While typing, are your wrists straight and forearms roughly level?',
    kind: 'single',
    options: [
      { value: 'yes', label: 'Yes', points: 0 },
      { value: 'sometimes', label: 'Sometimes', points: 1, tip: 'Adjust desk or chair height so elbows are about 90° and wrists float straight while typing.' },
      { value: 'no', label: 'No — bent up, down or sideways', points: 2, tip: 'Bent wrists under load raise the risk of strain. Lower the keyboard, flatten its feet, and keep wrists straight.' },
    ],
  },
  {
    id: 'mouse',
    area: 'input',
    prompt: 'Is your mouse close beside the keyboard?',
    kind: 'single',
    options: [
      { value: 'yes', label: 'Yes', points: 0 },
      { value: 'no', label: 'No — I reach for it', points: 1, tip: 'Keep the mouse right next to the keyboard so your upper arm stays relaxed at your side.' },
    ],
  },
  {
    id: 'break_interval',
    area: 'breaks',
    prompt: 'How long do you usually work at the screen without a break?',
    kind: 'single',
    options: [
      { value: 'under_1h', label: 'Under an hour', points: 0 },
      { value: '1_2h', label: '1–2 hours', points: 1, tip: 'Aim for a short movement break every 30–60 minutes — stand, stretch, refocus your eyes.' },
      { value: 'over_2h', label: 'More than 2 hours', points: 2, tip: 'Long static stretches are a key risk factor. Set a reminder to move every 30–60 minutes.' },
    ],
  },
  {
    id: 'screen_hours',
    area: 'breaks',
    prompt: 'How many hours a day do you spend at a computer?',
    kind: 'single',
    options: [
      { value: 'under_4', label: 'Under 4', points: 0 },
      { value: '4_7', label: '4–7', points: 1 },
      { value: 'over_7', label: 'More than 7', points: 2, tip: 'With long daily screen time, setup and breaks matter most — consider a sit-stand option.' },
    ],
  },
  {
    id: 'discomfort_areas',
    area: 'discomfort',
    prompt: 'In the last month, have you had discomfort in any of these areas? (Select all that apply)',
    kind: 'multi',
    options: [
      { value: 'neck', label: 'Neck', points: 1, tip: 'Neck discomfort often follows screen height — check your monitor position first.' },
      { value: 'shoulders', label: 'Shoulders', points: 1, tip: 'Shoulder discomfort often comes from reaching — bring the keyboard and mouse closer.' },
      { value: 'upper_back', label: 'Upper back', points: 1 },
      { value: 'lower_back', label: 'Lower back', points: 1, tip: 'Lower back discomfort: check lumbar support and sit all the way back in your chair.' },
      { value: 'wrists', label: 'Wrists / hands', points: 1, tip: 'Wrist or hand symptoms: keep wrists straight and take regular micro-breaks.' },
      { value: 'eyes', label: 'Eyes', points: 1, tip: 'Eye strain: follow the 20-20-20 rule — every 20 minutes, look 20 feet away for 20 seconds.' },
    ],
  },
  {
    id: 'discomfort_frequency',
    area: 'discomfort',
    prompt: 'How often do you notice that discomfort?',
    kind: 'single',
    options: [
      { value: 'never', label: 'Never / not applicable', points: 0 },
      { value: 'occasionally', label: 'Occasionally', points: 2 },
      { value: 'weekly', label: 'Most weeks', points: 4, tip: 'Recurring discomfort is worth raising with your health & safety lead or occupational health.' },
      { value: 'daily', label: 'Daily', points: 6, tip: 'Daily discomfort should be reviewed by occupational health — please raise it with your health & safety lead.' },
    ],
  },
];
